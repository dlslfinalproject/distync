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
    new RegExp(
      `${columnName}::text = ANY \\(ARRAY\\[([^\\]]*)\\]::text\\[\\]\\)`,
      "i",
    ),
  )?.[1];

  return expression
    ? [...expression.matchAll(/'([^']+)'/g)].map((match) => match[1])
    : null;
};

test("canonical inventory batch schema preserves the bounded column contracts", () => {
  const tableBlock = getTableBlock(readSchema(), "inventory_batches");

  assert.ok(tableBlock, "inventory_batches schema block should exist");
  assert.match(tableBlock, /batch_no character varying\(100\) NOT NULL/i);
  assert.match(
    tableBlock,
    /source_type character varying\(30\) NOT NULL DEFAULT 'LGU'::character varying/i,
  );
  assert.match(tableBlock, /storage_location character varying\(200\),/i);
  assert.match(
    tableBlock,
    /status character varying\(30\) NOT NULL DEFAULT 'AVAILABLE'::character varying/i,
  );
  assert.equal(getCheckValues(tableBlock, "source_type").length, 5);
  assert.deepEqual(getCheckValues(tableBlock, "source_type"), [
    "PURCHASED",
    "DONATED",
    "DSWD",
    "LGU",
    "OTHER",
  ]);
});

test("canonical inventory batch schema preserves constraints and proven indexes", () => {
  const schema = readSchema();
  const tableBlock = getTableBlock(schema, "inventory_batches");

  assert.ok(tableBlock, "inventory_batches schema block should exist");
  assert.match(
    tableBlock,
    /CONSTRAINT inventory_batches_inventory_item_id_fkey FOREIGN KEY \(inventory_item_id\) REFERENCES public\.inventory_items\(id\) ON DELETE RESTRICT/i,
  );
  assert.match(
    tableBlock,
    /CONSTRAINT inventory_batches_created_by_fkey FOREIGN KEY \(created_by\) REFERENCES public\.users\(id\) ON DELETE SET NULL/i,
  );
  assert.match(
    tableBlock,
    /CONSTRAINT inventory_batches_inventory_item_stock_form_id_fkey FOREIGN KEY \(inventory_item_stock_form_id\) REFERENCES public\.inventory_item_stock_forms\(id\)(?:,|\r?\n)/i,
  );
  assert.match(
    tableBlock,
    /CONSTRAINT inventory_batches_inventory_item_id_batch_no_unique UNIQUE \(inventory_item_id, batch_no\)/i,
  );
  assert.match(tableBlock, /quantity_received integer NOT NULL CHECK \(quantity_received >= 0\)/i);
  assert.match(tableBlock, /quantity_available integer NOT NULL CHECK \(quantity_available >= 0\)/i);
  assert.deepEqual(getCheckValues(tableBlock, "status"), [
    "AVAILABLE",
    "LOW_STOCK",
    "EXPIRED",
    "DEPLETED",
    "MISSING",
    "DAMAGED",
  ]);
  assert.match(
    schema,
    /CREATE INDEX idx_inventory_batches_inventory_item_id\s+ON public\.inventory_batches USING btree \(inventory_item_id\);/i,
  );
  assert.equal(
    (schema.match(/\bidx_inventory_batches_inventory_item_id\b/g) || []).length,
    1,
  );
  assert.match(
    schema,
    /CONSTRAINT uq_inventory_item_stock_forms_id_item UNIQUE \(id, inventory_item_id\)/i,
  );
  assert.match(
    tableBlock,
    /CONSTRAINT inventory_batches_stock_form_item_same_fkey FOREIGN KEY \(inventory_item_stock_form_id, inventory_item_id\) REFERENCES public\.inventory_item_stock_forms\(id, inventory_item_id\) MATCH SIMPLE ON UPDATE NO ACTION ON DELETE NO ACTION/i,
  );
  assert.match(
    tableBlock,
    /inventory_item_stock_form_id uuid,\s+batch_no character varying\(100\) NOT NULL/i,
  );
  assert.doesNotMatch(schema, /\binventory_batches_status_check\b/i);
  assert.doesNotMatch(schema, /CREATE INDEX idx_inventory_batches_status/i);
  assert.doesNotMatch(
    schema,
    /CREATE INDEX [^;]*inventory_batches[^;]*inventory_item_stock_form_id/i,
  );
});

test("canonical inventory batch schema preserves stock-version and excludes unresolved live-only status index", () => {
  const schema = readSchema();
  const tableBlock = getTableBlock(schema, "inventory_batches");

  assert.match(tableBlock, /stock_version integer NOT NULL DEFAULT 0/i);
  assert.match(
    schema,
    /CREATE OR REPLACE FUNCTION public\.increment_inventory_batch_stock_version\(\)/i,
  );
  assert.match(
    schema,
    /CREATE TRIGGER inventory_batches_stock_version_before_update[\s\S]*?BEFORE UPDATE\s+ON public\.inventory_batches/i,
  );
  assert.doesNotMatch(schema, /CREATE INDEX idx_inventory_batches_status/i);
});
