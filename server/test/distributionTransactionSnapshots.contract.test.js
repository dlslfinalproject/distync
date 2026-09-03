const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.join(__dirname, "..", "..");
const migrationPath = path.join(
  repositoryRoot,
  "database",
  "migrations",
  "2026-08-29_add_distribution_transaction_snapshots.sql",
);
const schemaPath = path.join(
  repositoryRoot,
  "database",
  "schema",
  "distync_schema.sql",
);

test("distribution transaction snapshot migration backfills and enforces immutable labels", () => {
  const migration = fs.readFileSync(migrationPath, "utf8");

  assert.match(
    migration,
    /distribution_transaction_relief_pack_templates[\s\S]*ADD COLUMN IF NOT EXISTS name_snapshot/i,
  );
  assert.match(migration, /SET name_snapshot = rpt\.name/i);
  assert.match(migration, /item_code_snapshot\s*=\s*ii\.item_code/i);
  assert.match(migration, /item_name_snapshot\s*=\s*ii\.item_name/i);
  assert.match(migration, /unit_of_measure_snapshot\s*=\s*ii\.unit_of_measure/i);
  assert.match(
    migration,
    /distribution_transaction_relief_pack_templates[\s\S]*ALTER COLUMN name_snapshot SET NOT NULL/i,
  );
  assert.match(
    migration,
    /distribution_transaction_items[\s\S]*ALTER COLUMN item_code_snapshot SET NOT NULL/i,
  );
});

test("schema reference includes required distribution transaction snapshots", () => {
  const schema = fs.readFileSync(schemaPath, "utf8");

  assert.match(schema, /item_code_snapshot text NOT NULL/i);
  assert.match(schema, /item_name_snapshot text NOT NULL/i);
  assert.match(schema, /unit_of_measure_snapshot text NOT NULL/i);
  assert.match(schema, /name_snapshot text NOT NULL/i);
});
