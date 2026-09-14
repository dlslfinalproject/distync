const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const repositoryRoot = path.resolve(__dirname, "..", "..");
const migrationPath = path.join(
  repositoryRoot,
  "database",
  "migrations",
  "2026-09-07_remove_redundant_inventory_batch_status_check.sql",
);

const readMigration = () => fs.readFileSync(migrationPath, "utf8");
const stripSqlComments = (sql) =>
  sql.replace(/--[^\r\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

test("inventory batch status-check migration is fail-closed and idempotent", () => {
  assert.equal(fs.existsSync(migrationPath), true);

  const migration = readMigration();
  const executableSql = stripSqlComments(migration);

  assert.match(migration, /^BEGIN;\s*/i);
  assert.match(migration, /COMMIT;\s*$/i);
  assert.match(migration, /public\.inventory_batches/i);
  assert.match(migration, /inventory_batches_status_check/i);
  assert.match(migration, /chk_inventory_batch_status/i);
  assert.match(migration, /pg_catalog\.pg_class/i);
  assert.match(migration, /pg_catalog\.pg_namespace/i);
  assert.match(migration, /pg_catalog\.pg_attribute/i);
  assert.match(migration, /pg_catalog\.pg_constraint/i);
  assert.match(migration, /pg_catalog\.pg_get_constraintdef/i);
  assert.match(migration, /pg_advisory_xact_lock/i);
  assert.match(
    migration,
    /LOCK TABLE public\.inventory_batches\s+IN SHARE ROW EXCLUSIVE MODE/i,
  );

  for (const contractField of [
    "relkind",
    "status_attnum",
    "conkey",
    "convalidated",
    "condeferrable",
    "condeferred",
    "conbin",
    "narrow_constraint_count",
    "broad_constraint_count",
    "unexpected_status_constraint_count",
    "broad_only_count",
    "expected_narrow_definition",
    "expected_broad_definition",
  ]) {
    assert.match(migration, new RegExp(`\\b${contractField}\\b`));
  }

  assert.match(migration, /narrow_constraint_count\s+<>\s+1[\s\S]*RAISE EXCEPTION/i);
  assert.match(migration, /narrow_constraint_definition\s+<>\s+expected_narrow_definition/i);
  assert.match(migration, /broad_constraint_count\s*=\s*0/);
  assert.match(migration, /broad_constraint_definition\s+<>\s+expected_broad_definition/i);
  assert.match(migration, /broad_statuses\s+@>\s+narrow_statuses/i);
  assert.match(migration, /broad_only_count\s+<>\s+0[\s\S]*RAISE EXCEPTION/i);
  assert.match(
    migration,
    /ALTER TABLE public\.inventory_batches\s+DROP CONSTRAINT inventory_batches_status_check/i,
  );
  assert.match(migration, /broad_constraint_count\s*=\s*1[\s\S]*DROP CONSTRAINT/i);
  assert.match(migration, /broad_constraint_count\s+<>\s+0[\s\S]*postcondition failed/i);

  assert.equal(
    (executableSql.match(/DROP CONSTRAINT inventory_batches_status_check/g) || [])
      .length,
    1,
  );
  assert.doesNotMatch(executableSql, /DROP CONSTRAINT IF EXISTS/i);
  assert.doesNotMatch(executableSql, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\b/i);
  assert.doesNotMatch(executableSql, /CREATE\s+(?:UNIQUE\s+)?INDEX/i);
  assert.doesNotMatch(executableSql, /DROP\s+INDEX|ALTER\s+INDEX/i);
  assert.doesNotMatch(executableSql, /ADD\s+CONSTRAINT|FOREIGN\s+KEY/i);
  assert.doesNotMatch(executableSql, /ALTER\s+TABLE[^;]*\bALTER\s+COLUMN/i);
  assert.doesNotMatch(executableSql, /\bCASCADE\b/i);
  assert.equal((executableSql.match(/ALTER TABLE/g) || []).length, 1);
});

test("current runtime and historical migrations do not depend on the stale broad constraint name", () => {
  const staleName = /\binventory_batches_status_check\b/i;
  const collectTextFiles = (directory) =>
    fs
      .readdirSync(directory, { recursive: true })
      .filter((entry) => typeof entry === "string")
      .filter((entry) => /\.(?:js|jsx|mjs|sql|cjs|ts|tsx)$/i.test(entry))
      .map((entry) => path.join(directory, entry));

  for (const directory of [
    path.join(repositoryRoot, "server", "src"),
    path.join(repositoryRoot, "client", "src"),
  ]) {
    for (const filePath of collectTextFiles(directory)) {
      assert.doesNotMatch(fs.readFileSync(filePath, "utf8"), staleName, filePath);
    }
  }

  const migrationDirectory = path.join(repositoryRoot, "database", "migrations");
  for (const filePath of collectTextFiles(migrationDirectory)) {
    if (filePath === migrationPath) continue;
    assert.doesNotMatch(fs.readFileSync(filePath, "utf8"), staleName, filePath);
  }
});

const sameItemMigrationPath = path.join(
  repositoryRoot,
  "database",
  "migrations",
  "2026-09-12_add_batch_stock_form_same_item_fk.sql",
);

test("batch stock-form same-item migration is limited to the parent key and validated composite FK", () => {
  assert.equal(fs.existsSync(sameItemMigrationPath), true);

  const migration = fs.readFileSync(sameItemMigrationPath, "utf8");
  const executableSql = stripSqlComments(migration);

  assert.match(migration, /^BEGIN;\s*/i);
  assert.match(migration, /COMMIT;\s*$/i);
  assert.match(
    migration,
    /ALTER TABLE public\.inventory_item_stock_forms\s+ADD CONSTRAINT uq_inventory_item_stock_forms_id_item\s+UNIQUE \(id, inventory_item_id\)/i,
  );
  assert.match(
    migration,
    /ALTER TABLE public\.inventory_batches\s+ADD CONSTRAINT inventory_batches_stock_form_item_same_fkey\s+FOREIGN KEY \(inventory_item_stock_form_id, inventory_item_id\)\s+REFERENCES public\.inventory_item_stock_forms \(id, inventory_item_id\)\s+MATCH SIMPLE\s+ON UPDATE NO ACTION\s+ON DELETE NO ACTION\s+NOT VALID/i,
  );
  assert.match(
    migration,
    /ALTER TABLE public\.inventory_batches\s+VALIDATE CONSTRAINT inventory_batches_stock_form_item_same_fkey/i,
  );

  assert.equal(
    (executableSql.match(/ALTER TABLE/g) || []).length,
    3,
  );
  assert.equal(
    (executableSql.match(/ADD CONSTRAINT/g) || []).length,
    2,
  );
  assert.equal(
    (executableSql.match(/VALIDATE CONSTRAINT/g) || []).length,
    1,
  );
  assert.equal(
    (executableSql.match(/NOT VALID/g) || []).length,
    1,
  );
  assert.doesNotMatch(
    executableSql,
    /\bINSERT\s+INTO\b|\bUPDATE\s+[^;\n]+\s+SET\b|\bDELETE\s+FROM\b|\bTRUNCATE\b/i,
  );
  assert.doesNotMatch(executableSql, /\bCASCADE\b/i);
  assert.doesNotMatch(executableSql, /ALTER\s+COLUMN/i);
  assert.doesNotMatch(executableSql, /CREATE\s+(?:UNIQUE\s+)?INDEX/i);
  assert.doesNotMatch(executableSql, /DROP\s+(?:CONSTRAINT|INDEX)/i);
  assert.doesNotMatch(executableSql, /TRIGGER|FUNCTION|POLICY|GRANT|REVOKE/i);
});

test("batch stock-form same-item schema contract preserves nullable compatibility and independent FKs", () => {
  const schemaPath = path.join(
    repositoryRoot,
    "database",
    "schema",
    "distync_schema.sql",
  );
  const schema = fs.readFileSync(schemaPath, "utf8");
  const batchBlock = schema.match(
    /CREATE TABLE public\.inventory_batches \(([\s\S]*?)\r?\n\);/i,
  )?.[1];
  const stockFormBlock = schema.match(
    /CREATE TABLE public\.inventory_item_stock_forms \(([\s\S]*?)\r?\n\);/i,
  )?.[1];

  assert.ok(batchBlock);
  assert.ok(stockFormBlock);
  assert.match(batchBlock, /inventory_item_stock_form_id uuid,\s/i);
  assert.match(
    batchBlock,
    /inventory_batches_inventory_item_id_fkey FOREIGN KEY \(inventory_item_id\) REFERENCES public\.inventory_items\(id\) ON DELETE RESTRICT/i,
  );
  assert.match(
    batchBlock,
    /inventory_batches_inventory_item_stock_form_id_fkey FOREIGN KEY \(inventory_item_stock_form_id\) REFERENCES public\.inventory_item_stock_forms\(id\)/i,
  );
  assert.match(
    stockFormBlock,
    /inventory_item_stock_forms_inventory_item_id_fkey FOREIGN KEY \(inventory_item_id\) REFERENCES public\.inventory_items\(id\)/i,
  );
  assert.match(stockFormBlock, /inventory_item_stock_forms_barcode_key UNIQUE \(barcode\)/i);
  assert.match(
    batchBlock,
    /inventory_batches_inventory_item_id_batch_no_unique UNIQUE \(inventory_item_id, batch_no\)/i,
  );
  assert.equal(
    (schema.match(/inventory_batches_stock_form_item_same_fkey/g) || []).length,
    1,
  );
});
