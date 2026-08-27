const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  validateCreateInventoryTransaction,
} = require("../src/validators/inventoryTransaction.validator");

const validBatchId = "11111111-1111-4111-8111-111111111111";

const runCreateValidation = (body) => {
  const req = { body };
  let statusCode = null;
  let responseBody = null;
  let nextCalled = false;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      responseBody = payload;
      return this;
    },
  };

  validateCreateInventoryTransaction(req, res, () => {
    nextCalled = true;
  });

  return { req, statusCode, responseBody, nextCalled };
};

test("OTHER inventory write-offs require a short status and explanation", () => {
  const missingStatus = runCreateValidation({
    inventory_batch_id: validBatchId,
    transaction_type: "OTHER",
    quantity: 2,
    remarks: "Contaminated during storage",
  });

  assert.equal(missingStatus.statusCode, 400);
  assert.equal(missingStatus.nextCalled, false);
  assert.equal(
    missingStatus.responseBody.message,
    "other_status is required when transaction_type is OTHER",
  );

  const rejected = runCreateValidation({
    inventory_batch_id: validBatchId,
    transaction_type: "OTHER",
    quantity: 2,
    other_status: "Contaminated",
    remarks: "   ",
  });

  assert.equal(rejected.statusCode, 400);
  assert.equal(rejected.nextCalled, false);
  assert.equal(
    rejected.responseBody.message,
    "remarks is required when transaction_type is OTHER",
  );

  const accepted = runCreateValidation({
    inventory_batch_id: validBatchId,
    transaction_type: "OTHER",
    quantity: 2,
    other_status: "Contaminated",
    remarks: "Contaminated during storage",
  });

  assert.equal(accepted.statusCode, null);
  assert.equal(accepted.nextCalled, true);
  assert.equal(accepted.req.validatedBody.transaction_type, "OTHER");
  assert.equal(accepted.req.validatedBody.other_status, "Contaminated");
  assert.equal(
    accepted.req.validatedBody.remarks,
    "Contaminated during storage",
  );
});

test("OTHER is included in the inventory transaction schema and migration", () => {
  const schemaSql = fs.readFileSync(
    path.resolve(__dirname, "../../database/schema/distync_schema.sql"),
    "utf8",
  );
  const migrationSql = fs.readFileSync(
    path.resolve(
      __dirname,
      "../../database/migrations/2026-08-27_allow_other_inventory_writeoff_type.sql",
    ),
    "utf8",
  );

  assert.match(schemaSql, /transaction_type[\s\S]*'OTHER'/i);
  assert.match(schemaSql, /other_status character varying\(80\)/i);
  const otherStatusMigrationSql = fs.readFileSync(
    path.resolve(
      __dirname,
      "../../database/migrations/2026-08-27_add_inventory_transaction_other_status.sql",
    ),
    "utf8",
  );
  assert.match(otherStatusMigrationSql, /ADD COLUMN IF NOT EXISTS other_status/i);
  assert.match(otherStatusMigrationSql, /COMMIT;\s*$/i);
  assert.match(migrationSql, /DROP CONSTRAINT IF EXISTS/i);
  assert.match(migrationSql, /'OTHER'::character varying/i);
  assert.match(migrationSql, /COMMIT;\s*$/i);
});
