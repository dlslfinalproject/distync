const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const disasterEventValidator = require("../src/validators/disasterEvent.validator");

const repositoryRoot = path.resolve(__dirname, "../..");
const migrationPath = path.join(
  repositoryRoot,
  "database/migrations/2026-09-02_remove_disaster_event_archived_status.sql",
);
const schemaPath = path.join(
  repositoryRoot,
  "database/schema/distync_schema.sql",
);

const runValidator = (body) => {
  let nextCalled = false;
  let responseStatus = null;
  let responseBody = null;
  const req = { body };
  const res = {
    status(statusCode) {
      responseStatus = statusCode;
      return this;
    },
    json(payload) {
      responseBody = payload;
      return this;
    },
  };

  disasterEventValidator.validateCreateDisasterEvent(req, res, () => {
    nextCalled = true;
  });

  return { nextCalled, responseStatus, responseBody, validatedBody: req.body };
};

test("disaster-event cleanup migration converts legacy ARCHIVED rows to CLOSED", () => {
  const migrationSql = fs.readFileSync(migrationPath, "utf8");

  assert.match(
    migrationSql,
    /UPDATE\s+public\.disaster_events\s+SET\s+status\s*=\s*'CLOSED'\s+WHERE\s+status\s*=\s*'ARCHIVED'/i,
  );
  assert.match(migrationSql, /DROP CONSTRAINT/i);
  assert.match(
    migrationSql,
    /CHECK\s*\(status\s+IN\s*\('PLANNED',\s*'ACTIVE',\s*'CLOSED'\)\)/i,
  );
});

test("schema reference allows CLOSED but no longer allows ARCHIVED event status", () => {
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  const disasterEventsTable = schemaSql.match(
    /CREATE TABLE public\.disaster_events \(([\s\S]*?)\n\);/i,
  );

  assert.ok(disasterEventsTable, "disaster_events table should exist in schema reference");
  assert.match(
    disasterEventsTable[1],
    /status[^\n]*'PLANNED'[^\n]*'ACTIVE'[^\n]*'CLOSED'/i,
  );
  assert.doesNotMatch(disasterEventsTable[1], /status[^\n]*'ARCHIVED'/i);
});

test("new disaster events reject ARCHIVED while CLOSED remains valid", () => {
  const baseBody = {
    title: "Test flood",
    disaster_type: "Flood",
    start_date: "2026-09-01",
    end_date: "2026-09-02",
    barangay_ids: [],
  };

  const archivedResult = runValidator({ ...baseBody, status: "ARCHIVED" });
  assert.equal(archivedResult.nextCalled, false);
  assert.equal(archivedResult.responseStatus, 400);
  assert.match(archivedResult.responseBody.message, /PLANNED, ACTIVE, CLOSED/);

  const closedResult = runValidator({ ...baseBody, status: "CLOSED" });
  assert.equal(closedResult.nextCalled, true);
  assert.equal(closedResult.validatedBody.status, "CLOSED");
});
