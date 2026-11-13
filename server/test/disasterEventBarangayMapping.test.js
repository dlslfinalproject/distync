const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const migrationPath = path.join(
  repositoryRoot,
  "database/migrations/2026-09-15_enforce_disaster_event_barangay_uniqueness.sql",
);
const schemaPath = path.join(
  repositoryRoot,
  "database/schema/distync_schema.sql",
);

test("disaster event barangay migration blocks existing duplicates before adding uniqueness", () => {
  const migrationSql = fs.readFileSync(migrationPath, "utf8");

  assert.match(
    migrationSql,
    /GROUP BY disaster_event_id, barangay_id[\s\S]*HAVING COUNT\(\*\) > 1/i,
  );
  assert.match(
    migrationSql,
    /ADD CONSTRAINT uq_disaster_event_barangay[\s\S]*UNIQUE \(disaster_event_id, barangay_id\)/i,
  );
});

test("schema reference prevents duplicate event-to-barangay mappings", () => {
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  const mappingTable = schemaSql.match(
    /CREATE TABLE public\.disaster_event_barangays \(([\s\S]*?)\n\);/i,
  );

  assert.ok(mappingTable, "disaster_event_barangays table should exist in schema reference");
  assert.match(
    mappingTable[1],
    /CONSTRAINT uq_disaster_event_barangay UNIQUE \(disaster_event_id, barangay_id\)/i,
  );
});
