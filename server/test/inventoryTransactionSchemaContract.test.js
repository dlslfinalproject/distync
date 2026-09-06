const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const schemaPath = path.resolve(
  __dirname,
  "../../database/schema/distync_schema.sql",
);

const readSchema = () => fs.readFileSync(schemaPath, "utf8");

const getTableBlock = (schema, tableName) =>
  schema.match(
    new RegExp(`CREATE TABLE public\\.${tableName} \\(([\\s\\S]*?)\\r?\\n\\);`),
  )?.[1];

const getCheckValues = (tableBlock, columnName) => {
  const expression = tableBlock.match(
    new RegExp(`${columnName}::text = ANY \\(ARRAY\\[([^\\]]*)\\]::text\\[\\]\\)`, "i"),
  )?.[1];

  return expression
    ? [...expression.matchAll(/'([^']+)'/g)].map((match) => match[1])
    : null;
};

test("canonical inventory transaction schema preserves the enumerated type contracts", () => {
  const tableBlock = getTableBlock(readSchema(), "inventory_transactions");

  assert.ok(tableBlock, "inventory_transactions schema block should exist");
  assert.match(tableBlock, /transaction_type character varying\(30\) NOT NULL/i);
  assert.match(
    tableBlock,
    /reference_type character varying\(30\) NOT NULL DEFAULT 'MANUAL'::character varying/i,
  );
  assert.match(tableBlock, /quantity integer NOT NULL CHECK \(quantity >= 0\)/i);
  assert.deepEqual(getCheckValues(tableBlock, "transaction_type"), [
    "INFLOW",
    "OUTFLOW",
    "ADJUSTMENT",
    "EXPIRED",
    "MISSING",
    "DAMAGED",
    "SPOILED",
    "STOLEN",
    "RETURN",
    "OTHER",
  ]);
  assert.deepEqual(getCheckValues(tableBlock, "reference_type"), [
    "MANUAL",
    "BARCODE_SCAN",
    "QR_SCAN",
    "DISTRIBUTION",
    "DONATION",
    "PROOF_OF_RECEIPT",
    "SYNC",
    "SYSTEM",
  ]);
});

test("canonical inventory transaction schema declares proven FK delete actions", () => {
  const tableBlock = getTableBlock(readSchema(), "inventory_transactions");

  assert.ok(tableBlock, "inventory_transactions schema block should exist");
  assert.match(
    tableBlock,
    /CONSTRAINT inventory_transactions_disaster_event_id_fkey FOREIGN KEY \(disaster_event_id\) REFERENCES public\.disaster_events\(id\) ON DELETE SET NULL/i,
  );
  assert.match(
    tableBlock,
    /CONSTRAINT inventory_transactions_inventory_batch_id_fkey FOREIGN KEY \(inventory_batch_id\) REFERENCES public\.inventory_batches\(id\) ON DELETE CASCADE/i,
  );
  assert.match(
    tableBlock,
    /CONSTRAINT inventory_transactions_performed_by_fkey FOREIGN KEY \(performed_by\) REFERENCES public\.users\(id\) ON DELETE SET NULL/i,
  );
});

test("canonical inventory transaction schema declares the proven batch index and preserves reference identity", () => {
  const schema = readSchema();
  const tableBlock = getTableBlock(schema, "inventory_transactions");

  assert.ok(tableBlock, "inventory_transactions schema block should exist");
  assert.match(
    schema,
    /CREATE INDEX idx_inventory_transactions_batch_id\s+ON public\.inventory_transactions USING btree \(inventory_batch_id\);/i,
  );
  assert.equal(
    (schema.match(/\bidx_inventory_transactions_batch_id\b/g) || []).length,
    1,
  );
  assert.match(
    tableBlock,
    /inventory_transaction_reference_no character varying\(15\) NOT NULL CHECK/i,
  );
  assert.match(
    schema,
    /CREATE UNIQUE INDEX inventory_transactions_reference_no_unique\s+ON public\.inventory_transactions \(inventory_transaction_reference_no\);/i,
  );
  assert.match(
    schema,
    /CREATE TRIGGER inventory_transactions_reference_no_before_insert/i,
  );
  assert.match(tableBlock, /other_status character varying\(80\)/i);
  assert.match(tableBlock, /reference_id uuid,/i);
});
