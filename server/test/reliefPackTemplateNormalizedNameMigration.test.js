const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const migrationPath = path.resolve(
  __dirname,
  "../../database/migrations/2026-09-06_ensure_relief_pack_template_normalized_name_uniqueness.sql",
);

const readMigration = () => fs.readFileSync(migrationPath, "utf8");

test("normalized-name forward migration is narrow, guarded, and data-DML free", () => {
  const migration = readMigration();

  assert.match(migration, /^\s*BEGIN;/i);
  assert.match(migration, /COMMIT;\s*$/i);
  assert.match(migration, /public\.relief_pack_templates/i);
  assert.match(
    migration,
    /CREATE UNIQUE INDEX relief_pack_templates_name_normalized_unique[\s\S]*LOWER\(BTRIM\(name\)\)/i,
  );
  assert.match(
    migration,
    /GROUP BY LOWER\(BTRIM\(name\)\)[\s\S]*HAVING COUNT\(\*\) > 1[\s\S]*RAISE EXCEPTION/i,
  );

  assert.match(migration, /pg_catalog\.pg_class/i);
  assert.match(migration, /pg_catalog\.pg_attribute/i);
  assert.match(migration, /pg_catalog\.pg_index/i);
  assert.match(migration, /pg_catalog\.pg_namespace/i);
  assert.match(migration, /pg_catalog\.pg_am/i);
  assert.match(migration, /pg_get_expr\(/i);
  assert.match(migration, /indisunique/i);
  assert.match(migration, /indisvalid/i);
  assert.match(migration, /indisready/i);
  assert.match(migration, /indpred/i);
  assert.match(migration, /relkind/i);
  assert.match(migration, /wrong definition/i);
  assert.match(migration, /under another name/i);

  assert.doesNotMatch(migration, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\b/i);
  assert.doesNotMatch(migration, /\bDROP\b/i);
  assert.doesNotMatch(
    migration,
    /distribution_transactions|relief_pack_template_items|relief_pack_template_disaster_types|distribution_transaction_relief_pack_templates|\busers\b|\bsectors\b/i,
  );
  assert.doesNotMatch(
    migration,
    /ALTER\s+(?:TABLE|INDEX)|CREATE\s+(?:TABLE|TRIGGER|FUNCTION)/i,
  );
});
