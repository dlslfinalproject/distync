const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const repositoryRoot = path.resolve(__dirname, "..", "..");
const migrationPath = path.join(
  repositoryRoot,
  "database",
  "migrations",
  "2026-09-03_reconcile_distribution_transaction_items_batch_index.sql",
);
const schemaPath = path.join(
  repositoryRoot,
  "database",
  "schema",
  "distync_schema.sql",
);

const TARGET_INDEX = "idx_distribution_transaction_items_batch";
const TARGET_TABLE = "public.distribution_transaction_items";
const TARGET_DEFINITION =
  "CREATE INDEX idx_distribution_transaction_items_batch ON public.distribution_transaction_items USING btree (inventory_batch_id)";

const read = (filePath) => fs.readFileSync(filePath, "utf8");
const stripSqlComments = (sql) =>
  sql.replace(/--[^\r\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

test("DTI batch-index reconciliation migration is present and fail-closed", () => {
  assert.equal(fs.existsSync(migrationPath), true);

  const migration = read(migrationPath);
  const executableSql = stripSqlComments(migration);

  assert.match(migration, /^BEGIN;\s*/);
  assert.match(migration, /LOCK TABLE public\.distribution_transaction_items IN ACCESS EXCLUSIVE MODE/);
  assert.match(migration, /COMMIT;\s*$/);
  assert.match(migration, new RegExp(TARGET_INDEX));
  assert.match(migration, /inventory_batch_id/);
  assert.match(migration, /CREATE INDEX idx_distribution_transaction_items_batch ON public\.distribution_transaction_items USING btree \(inventory_batch_id\)/);

  for (const catalogName of [
    "pg_class",
    "pg_namespace",
    "pg_index",
    "pg_attribute",
    "pg_am",
    "pg_opclass",
    "pg_constraint",
    "pg_depend",
    "pg_get_indexdef",
  ]) {
    assert.match(migration, new RegExp(`\\b${catalogName}\\b`));
  }

  for (const contractField of [
    "indisunique",
    "indisprimary",
    "indisexclusion",
    "indisvalid",
    "indisready",
    "indislive",
    "indnullsnotdistinct",
    "indnkeyatts",
    "indnatts",
    "indkey",
    "indoption",
    "indcollation",
    "indpred",
    "indexprs",
    "uuid_ops",
    "target_object_count",
    "backing_constraint_count",
    "constraint_dependency_count",
    "allowed_dependency_count",
    "unexpected_dependency_count",
    "external_dependency_count",
  ]) {
    assert.match(migration, new RegExp(`\\b${contractField}\\b`));
  }

  assert.match(migration, /target_object_oid\s+IS\s+NULL[\s\S]*?EXECUTE\s+'CREATE INDEX idx_distribution_transaction_items_batch ON public\.distribution_transaction_items USING btree \(inventory_batch_id\)'/);
  assert.match(migration, /target_object_oid\s+IS\s+NOT\s+NULL[\s\S]*?relkind\s*=\s*'i'/);
  assert.match(migration, /pg_get_indexdef\(i\.oid\)\s*=\s*'CREATE INDEX idx_distribution_transaction_items_batch ON public\.distribution_transaction_items USING btree \(inventory_batch_id\)'/);
  assert.match(migration, /Distribution item batch-index postcondition failed/);

  assert.doesNotMatch(executableSql, /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS/i);
  assert.doesNotMatch(executableSql, /CREATE\s+UNIQUE\s+INDEX/i);
  assert.doesNotMatch(executableSql, /CREATE\s+INDEX\s+CONCURRENTLY/i);
  assert.doesNotMatch(executableSql, /DROP\s+INDEX/i);
  assert.doesNotMatch(executableSql, /\bCASCADE\b/i);
  assert.doesNotMatch(executableSql, /ALTER\s+TABLE/i);
  assert.doesNotMatch(executableSql, /DROP\s+CONSTRAINT/i);
  assert.doesNotMatch(executableSql, /FOREIGN\s+KEY/i);

  for (const protectedName of [
    "distribution_transaction_items_pkey",
    "distribution_transaction_items_distribution_transaction_id_fkey",
    "distribution_transaction_items_inventory_batch_id_fkey",
    "distribution_transaction_items_inventory_item_id_fkey",
    "distribution_transaction_items_quantity_released_check",
    "distribution_transaction_id",
    "inventory_item_id",
    "item_code_snapshot",
    "item_name_snapshot",
    "unit_of_measure_snapshot",
  ]) {
    assert.doesNotMatch(executableSql, new RegExp(`\\b${protectedName}\\b`));
  }
});

test("canonical schema retains the DTI batch index and documents live FK actions", () => {
  const schema = read(schemaPath);
  const tableBlock = schema.match(
    /CREATE TABLE public\.distribution_transaction_items \(([\s\S]*?)\n\);/,
  )?.[1];

  assert.ok(tableBlock, "distribution_transaction_items schema block should exist");
  assert.match(
    schema,
    /CREATE INDEX idx_distribution_transaction_items_batch\s+ON public\.distribution_transaction_items\s+USING btree \(inventory_batch_id\);/,
  );
  assert.equal((schema.match(new RegExp(TARGET_INDEX, "g")) || []).length, 1);
  assert.match(
    schema,
    /CONSTRAINT distribution_transaction_items_distribution_transaction_id_fkey FOREIGN KEY \(distribution_transaction_id\) REFERENCES public\.distribution_transactions\(id\) ON DELETE CASCADE,/,
  );
  assert.match(
    schema,
    /CONSTRAINT distribution_transaction_items_inventory_batch_id_fkey FOREIGN KEY \(inventory_batch_id\) REFERENCES public\.inventory_batches\(id\) ON DELETE RESTRICT,/,
  );
  assert.match(
    schema,
    /CONSTRAINT distribution_transaction_items_inventory_item_id_fkey FOREIGN KEY \(inventory_item_id\) REFERENCES public\.inventory_items\(id\) ON DELETE RESTRICT/,
  );
  assert.match(tableBlock, /inventory_batch_id uuid NOT NULL,/);
  assert.match(tableBlock, /inventory_item_id uuid NOT NULL,/);
  assert.match(tableBlock, /quantity_released integer NOT NULL CHECK \(quantity_released > 0\),/);
  assert.match(tableBlock, /item_code_snapshot text NOT NULL,/);
  assert.match(tableBlock, /item_name_snapshot text NOT NULL,/);
  assert.match(tableBlock, /unit_of_measure_snapshot text NOT NULL,/);
});

test("migration is limited to forward DTI batch-index reconciliation", () => {
  const migration = stripSqlComments(read(migrationPath));

  assert.equal(migration.includes(TARGET_DEFINITION), true);
  assert.doesNotMatch(migration, /donation_transparency_summary|public_donation_summary/i);
  assert.doesNotMatch(migration, /ROWs+LEVELs+SECURITY|CREATE\s+POLICY|ALTER\s+POLICY/i);
  assert.doesNotMatch(migration, /CREATE\s+(?:UNIQUE\s+)?INDEX[^;]*(?:distribution_transaction_id|inventory_item_id)/i);
});
