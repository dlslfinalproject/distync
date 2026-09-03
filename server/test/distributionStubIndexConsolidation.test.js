const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const repositoryRoot = path.resolve(__dirname, "..", "..");
const migrationPath = path.join(
  repositoryRoot,
  "database",
  "migrations",
  "2026-09-02_consolidate_distribution_stub_index.sql",
);
const schemaPath = path.join(repositoryRoot, "database", "schema", "distync_schema.sql");
const distributionTransactionServicePath = path.join(
  repositoryRoot,
  "server",
  "src",
  "services",
  "distributionTransaction.service.js",
);
const stubServicePath = path.join(
  repositoryRoot,
  "server",
  "src",
  "services",
  "stub.service.js",
);

const read = (filePath) => fs.readFileSync(filePath, "utf8");

test("distribution stub migration is a narrow, guarded standalone-index removal", () => {
  const migration = read(migrationPath);
  const executableSql = migration.replace(/^\s*--.*$/gm, "");

  assert.match(migration, /^BEGIN;\s*/);
  assert.match(migration, /LOCK TABLE public\.distribution_transactions IN ACCESS EXCLUSIVE MODE/);
  assert.equal(
    (executableSql.match(/DROP INDEX public\.idx_distribution_transactions_stub_id;/g) || [])
      .length,
    1,
  );
  assert.doesNotMatch(executableSql, /DROP INDEX\s+IF\s+EXISTS/i);
  assert.doesNotMatch(executableSql, /DROP INDEX[^;]*\bCASCADE\b/i);
  assert.doesNotMatch(executableSql, /DROP\s+CONSTRAINT/i);
  assert.doesNotMatch(executableSql, /\b(?:CREATE|ALTER)\s+(?:UNIQUE\s+)?INDEX/i);
  assert.match(migration, /pg_constraint/);
  assert.match(migration, /pg_class/);
  assert.match(migration, /pg_index/);
  assert.match(migration, /pg_attribute/);
  assert.match(migration, /pg_depend/);
  assert.match(migration, /pg_opclass/);
  for (const catalogField of [
    "convalidated",
    "condeferrable",
    "condeferred",
    "conindid",
    "indisunique",
    "indisvalid",
    "indisready",
    "indislive",
    "indnkeyatts",
    "indnatts",
    "indkey",
    "indoption",
    "indcollation",
    "indclass",
    "indpred",
    "indexprs",
    "duplicate_group_count",
    "null_stub_count",
    "matching_index_count",
    "final_constraint_count",
    "final_index_count",
  ]) {
    assert.match(migration, new RegExp(`\\b${catalogField}\\b`));
  }
  assert.match(migration, /COMMIT;\s*$/);
});

test("schema declares canonical stub uniqueness once and does not encode a physical index", () => {
  const schema = read(schemaPath);
  const tableBlock = schema.match(
    /CREATE TABLE public\.distribution_transactions \(([\s\S]*?)\n\);/,
  )?.[1];

  assert.ok(tableBlock, "distribution_transactions schema block should exist");
  assert.match(tableBlock, /stub_id uuid NOT NULL,/);
  assert.doesNotMatch(tableBlock, /stub_id uuid NOT NULL UNIQUE/);
  assert.equal((tableBlock.match(/UNIQUE \(stub_id\)/g) || []).length, 1);
  assert.match(tableBlock, /CONSTRAINT uq_distribution_stub UNIQUE \(stub_id\),/);
  assert.doesNotMatch(tableBlock, /idx_distribution_transactions_stub_id/);
});

test("runtime duplicate recognition is fail-closed for canonical and legacy names", () => {
  for (const servicePath of [
    distributionTransactionServicePath,
    stubServicePath,
  ]) {
    const source = read(servicePath);
    assert.match(source, /DISTRIBUTION_STUB_UNIQUE_CONSTRAINTS = new Set\(\[/);
    assert.match(source, /"uq_distribution_stub"/);
    assert.match(source, /"distribution_transactions_stub_id_key"/);
    assert.match(source, /error(?:\?\.)?\.?code === "23505"/);
    assert.match(source, /DISTRIBUTION_STUB_UNIQUE_CONSTRAINTS\.has\(/);
    assert.doesNotMatch(source, /idx_distribution_transactions_stub_id/);
  }
});
