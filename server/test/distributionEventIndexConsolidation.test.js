const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const repositoryRoot = path.resolve(__dirname, "..", "..");
const migrationPath = path.join(
  repositoryRoot,
  "database",
  "migrations",
  "2026-09-03_consolidate_distribution_transaction_event_indexes.sql",
);
const schemaPath = path.join(
  repositoryRoot,
  "database",
  "schema",
  "distync_schema.sql",
);

const read = (filePath) => fs.readFileSync(filePath, "utf8");

test("distribution event-index migration is forward-only, exact, and fail-closed", () => {
  const migration = read(migrationPath);
  const executableSql = migration
    .replace(/--[^\r\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  assert.match(migration, /^BEGIN;\s*/);
  assert.match(migration, /LOCK TABLE public\.distribution_transactions IN ACCESS EXCLUSIVE MODE/);
  assert.match(
    migration,
    /CREATE INDEX idx_distribution_transactions_household_event ON public\.distribution_transactions USING btree \(disaster_event_id, household_id\)/,
  );
  assert.match(
    migration,
    /DROP INDEX IF EXISTS public\.idx_distribution_transactions_disaster_event_id;/,
  );
  assert.match(migration, /COMMIT;\s*$/);

  assert.doesNotMatch(executableSql, /CASCADE/i);
  assert.doesNotMatch(executableSql, /DROP\s+INDEX[^;]*idx_distribution_transactions_household_event/i);
  assert.doesNotMatch(executableSql, /DROP\s+INDEX[^;]*idx_distribution_transactions_household_id/i);
  assert.doesNotMatch(executableSql, /DROP\s+INDEX[^;]*uq_distribution_stub/i);
  assert.doesNotMatch(executableSql, /DROP\s+CONSTRAINT/i);

  for (const catalogName of [
    "pg_class",
    "pg_namespace",
    "pg_index",
    "pg_attribute",
    "pg_am",
    "pg_constraint",
    "pg_depend",
    "pg_opclass",
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
    "indnkeyatts",
    "indnatts",
    "indkey",
    "indoption",
    "indcollation",
    "indpred",
    "indexprs",
    "uuid_ops",
    "canonical_allowed_dependency_count",
    "canonical_unexpected_dependency_count",
    "canonical_external_dependency_count",
    "standalone_allowed_dependency_count",
    "standalone_unexpected_dependency_count",
    "standalone_external_dependency_count",
  ]) {
    assert.match(migration, new RegExp(`\\b${contractField}\\b`));
  }

  assert.match(migration, /unexpected definition/);
  assert.match(migration, /postcondition failed/);
  assert.match(migration, /to_regclass\('public\.idx_distribution_transactions_disaster_event_id'\)/);
});

test("canonical schema declares the retained event-leading composite index only", () => {
  const schema = read(schemaPath);

  assert.match(
    schema,
    /CREATE INDEX idx_distribution_transactions_household_event\s+ON public\.distribution_transactions \(disaster_event_id, household_id\);/,
  );
  assert.doesNotMatch(schema, /idx_distribution_transactions_disaster_event_id/);

  const tableBlock = schema.match(
    /CREATE TABLE public\.distribution_transactions \(([\s\S]*?)\n\);/,
  )?.[1];
  assert.ok(tableBlock, "distribution_transactions schema block should exist");
  assert.match(tableBlock, /CONSTRAINT uq_distribution_stub UNIQUE \(stub_id\),/);
});

test("unrelated distribution index and uniqueness names are not cleanup targets", () => {
  const migration = read(migrationPath);

  assert.doesNotMatch(
    migration,
    /DROP\s+INDEX[^;]*(?:idx_distribution_transactions_household_id|uq_distribution_stub)/i,
  );
  assert.doesNotMatch(migration, /DROP\s+CONSTRAINT\s+uq_distribution_stub/i);
  assert.match(migration, /idx_distribution_transactions_household_event/);
  assert.match(migration, /idx_distribution_transactions_disaster_event_id/);
});
