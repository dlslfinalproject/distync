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
