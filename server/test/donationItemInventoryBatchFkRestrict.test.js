const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const repositoryRoot = path.resolve(__dirname, "..", "..");
const migrationPath = path.join(
  repositoryRoot,
  "database",
  "migrations",
  "2026-09-05_restrict_donation_item_inventory_batch_delete.sql",
);
const schemaPath = path.join(
  repositoryRoot,
  "database",
  "schema",
  "distync_schema.sql",
);

const TARGET_CONSTRAINT = "donation_items_inventory_batch_id_fkey";
const TARGET_TABLE = "public.donation_items";
const TARGET_COLUMN = "inventory_batch_id";
const REFERENCED_TABLE = "public.inventory_batches";
const REFERENCED_COLUMN = "id";

const read = (filePath) => fs.readFileSync(filePath, "utf8");
const stripSqlComments = (sql) =>
  sql.replace(/--[^\r\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

test("donation-item batch FK migration is guarded, transactional, and narrow", () => {
  assert.equal(fs.existsSync(migrationPath), true);

  const migration = read(migrationPath);
  const executableSql = stripSqlComments(migration);

  assert.match(migration, /^BEGIN;\s*/);
  assert.match(migration, /LOCK TABLE public\.donation_items, public\.inventory_batches/);
  assert.match(migration, /SHARE ROW EXCLUSIVE MODE/);
  assert.match(migration, /COMMIT;\s*$/);
  assert.match(migration, /pg_advisory_xact_lock/);

  for (const catalogName of [
    "pg_catalog.pg_class",
    "pg_catalog.pg_namespace",
    "pg_catalog.pg_attribute",
    "pg_catalog.pg_attrdef",
    "pg_catalog.pg_constraint",
    "pg_catalog.pg_get_constraintdef",
  ]) {
    assert.match(migration, new RegExp(catalogName.replaceAll(".", "\\.")));
  }

  for (const contractField of [
    "conkey",
    "confkey",
    "contype",
    "confupdtype",
    "confdeltype",
    "confmatchtype",
    "convalidated",
    "condeferrable",
    "condeferred",
    "conbin",
    "source_attnum",
    "target_attnum",
    "equivalent_constraint_count",
    "null_inventory_batch_count",
    "orphan_inventory_batch_count",
    "non_donated_or_unknown_count",
    "inventory_item_mismatch_count",
  ]) {
    assert.match(migration, new RegExp(`\\b${contractField}\\b`));
  }

  assert.match(
    migration,
    /DROP CONSTRAINT donation_items_inventory_batch_id_fkey/,
  );
  assert.match(
    migration,
    /ADD CONSTRAINT donation_items_inventory_batch_id_fkey FOREIGN KEY \(inventory_batch_id\) REFERENCES public\.inventory_batches\(id\) ON UPDATE NO ACTION ON DELETE RESTRICT NOT DEFERRABLE INITIALLY IMMEDIATE/,
  );
  assert.match(migration, /target_confdeltype = 'n'/);
  assert.match(migration, /target_confdeltype <> 'r'/);
  assert.match(migration, /target_confdeltype NOT IN \('n', 'r'\)/);
  assert.match(migration, /no schema change was committed/);

  assert.equal(
    (executableSql.match(
      /DROP CONSTRAINT donation_items_inventory_batch_id_fkey/g,
    ) || []).length,
    1,
  );
  assert.equal(
    (executableSql.match(
      /ADD CONSTRAINT donation_items_inventory_batch_id_fkey/g,
    ) || []).length,
    1,
  );
  assert.doesNotMatch(executableSql, /DROP CONSTRAINT IF EXISTS/i);
  assert.doesNotMatch(executableSql, /ADD CONSTRAINT IF NOT EXISTS/i);
  assert.doesNotMatch(executableSql, /\bCASCADE\b/i);
  assert.doesNotMatch(executableSql, /\b(?:INSERT\s+INTO|DELETE\s+FROM|MERGE\s+INTO)\b/i);
  assert.doesNotMatch(executableSql, /UPDATE\s+public\./i);
  assert.doesNotMatch(executableSql, /CREATE\s+(?:UNIQUE\s+)?INDEX/i);
  assert.doesNotMatch(executableSql, /ALTER\s+TABLE\s+public\.(?!donation_items\b)/i);
  assert.doesNotMatch(executableSql, /SET\s+NOT\s+NULL/i);

  for (const protectedName of [
    "distribution_transaction_items_inventory_batch_id_fkey",
    "inventory_transactions_inventory_batch_id_fkey",
    "donation_items_inventory_item_id_fkey",
    "donation_items_donation_id_fkey",
    "donation_transparency_summary",
    "public_donation_summary",
  ]) {
    assert.doesNotMatch(executableSql, new RegExp(`\\b${protectedName}\\b`));
  }
});

test("canonical schema declares the donation-item batch FK as RESTRICT and keeps it nullable", () => {
  const schema = read(schemaPath);
  const tableBlock = schema.match(
    /CREATE TABLE public\.donation_items \(([\s\S]*?)\n\);/,
  )?.[1];

  assert.ok(tableBlock, "donation_items schema block should exist");
  assert.match(tableBlock, /inventory_batch_id uuid,\r?\n/);
  assert.doesNotMatch(tableBlock, /inventory_batch_id uuid NOT NULL/);
  assert.match(
    tableBlock,
    /CONSTRAINT donation_items_inventory_batch_id_fkey FOREIGN KEY \(inventory_batch_id\) REFERENCES public\.inventory_batches\(id\) ON UPDATE NO ACTION ON DELETE RESTRICT/,
  );
  assert.equal(
    (schema.match(new RegExp(TARGET_CONSTRAINT, "g")) || []).length,
    1,
  );
  assert.equal(TARGET_TABLE, "public.donation_items");
  assert.equal(TARGET_COLUMN, "inventory_batch_id");
  assert.equal(REFERENCED_TABLE, "public.inventory_batches");
  assert.equal(REFERENCED_COLUMN, "id");
});

test("migration has no application, view, policy, grant, or index scope", () => {
  const executableSql = stripSqlComments(read(migrationPath));

  assert.doesNotMatch(executableSql, /donation_transparency_summary|public_donation_summary/i);
  assert.doesNotMatch(executableSql, /(?:CREATE|ALTER|DROP)\s+(?:OR\s+REPLACE\s+)?VIEW/i);
  assert.doesNotMatch(executableSql, /(?:CREATE|ALTER|DROP)\s+POLICY/i);
  assert.doesNotMatch(executableSql, /\b(?:GRANT|REVOKE)\b/i);
  assert.doesNotMatch(executableSql, /ALTER\s+TABLE\s+public\.inventory_batches/i);
  assert.doesNotMatch(executableSql, /ALTER\s+TABLE\s+public\.inventory_transactions/i);
  assert.doesNotMatch(executableSql, /ALTER\s+TABLE\s+public\.distribution_transaction_items/i);
});
