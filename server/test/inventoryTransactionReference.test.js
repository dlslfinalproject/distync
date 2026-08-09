const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  isValidInventoryTransactionReferenceNo,
  normalizeInventoryTransactionReferenceNo,
} = require("../src/utils/inventoryTransactionReference");
const {
  validateCreateInventoryTransaction,
} = require("../src/validators/inventoryTransaction.validator");

const createResponse = () => {
  const response = {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };

  return response;
};

const validPayload = {
  inventory_batch_id: "11111111-1111-4111-8111-111111111111",
  transaction_type: "OUTFLOW",
  quantity: 1,
  inventoryTransactionReferenceNo: " itr-2026-000123 ",
  reference_type: "MANUAL",
  reference_id: null,
  performed_by: null,
  remarks: "Manual stock movement",
};

test("inventory transaction reference helper trims, uppercases, and validates approved format", () => {
  assert.equal(
    normalizeInventoryTransactionReferenceNo(" itr-2026-000123 "),
    "ITR-2026-000123",
  );
  assert.equal(isValidInventoryTransactionReferenceNo("ITR-2026-000123"), true);
  assert.equal(isValidInventoryTransactionReferenceNo("ITR-2025-000123"), true);
  assert.equal(isValidInventoryTransactionReferenceNo("ITR-2026-000000"), false);
  assert.equal(isValidInventoryTransactionReferenceNo("ITR-26-000123"), false);
});

test("manual inventory transaction validator requires normalized ITR", () => {
  const req = { body: validPayload };
  const res = createResponse();
  let nextCalled = false;

  validateCreateInventoryTransaction(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(
    req.validatedBody.inventoryTransactionReferenceNo,
    "ITR-2026-000123",
  );
});

test("manual inventory transaction validator rejects missing or zero-sequence ITR", () => {
  for (const inventoryTransactionReferenceNo of [null, "ITR-2026-000000"]) {
    const req = {
      body: {
        ...validPayload,
        inventoryTransactionReferenceNo,
      },
    };
    const res = createResponse();
    let nextCalled = false;

    validateCreateInventoryTransaction(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 400);
  }
});

test("ITR migration and schema preserve nullable historical rows and enforce format plus uniqueness", () => {
  const migrationSql = fs.readFileSync(
    path.resolve(
      __dirname,
      "../../database/migrations/2026-08-09_add_inventory_transaction_reference_no.sql",
    ),
    "utf8",
  );
  const schemaSql = fs.readFileSync(
    path.resolve(__dirname, "../../database/schema/distync_schema.sql"),
    "utf8",
  );

  assert.match(
    migrationSql,
    /ADD COLUMN IF NOT EXISTS inventory_transaction_reference_no character varying\(15\)/,
  );
  assert.doesNotMatch(migrationSql, /UPDATE\s+public\.inventory_transactions/i);
  assert.match(migrationSql, /\^ITR-\[0-9\]\{4\}-\[0-9\]\{6\}\$/);
  assert.match(migrationSql, /RIGHT\(inventory_transaction_reference_no, 6\) <> '000000'/);
  assert.match(
    migrationSql,
    /CREATE UNIQUE INDEX IF NOT EXISTS inventory_transactions_reference_no_unique/,
  );
  assert.match(migrationSql, /WHERE inventory_transaction_reference_no IS NOT NULL/);
  assert.match(
    schemaSql,
    /inventory_transaction_reference_no character varying\(15\) CHECK/,
  );
  assert.match(schemaSql, /CREATE UNIQUE INDEX inventory_transactions_reference_no_unique/);
});
