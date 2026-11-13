const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  getDistributionItemSourceReliefTypeSnapshot,
} = require("../src/utils/distributionTransactionItemSnapshot");

const repositoryRoot = path.join(__dirname, "..", "..");
const migrationPath = path.join(
  repositoryRoot,
  "database",
  "migrations",
  "2026-08-29_add_distribution_transaction_snapshots.sql",
);
const packTypeMigrationPath = path.join(
  repositoryRoot,
  "database",
  "migrations",
  "2026-09-03_add_distribution_transaction_pack_type_snapshots.sql",
);
const packTemplateItemMigrationPath = path.join(
  repositoryRoot,
  "database",
  "migrations",
  "2026-09-05_add_distribution_transaction_item_pack_snapshots.sql",
);
const itemSourceMigrationPath = path.join(
  repositoryRoot,
  "database",
  "migrations",
  "2026-09-06_add_distribution_transaction_item_source_snapshots.sql",
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

test("pack type migration snapshots standard and additional classifications", () => {
  const migration = fs.readFileSync(packTypeMigrationPath, "utf8");

  assert.match(migration, /ADD COLUMN IF NOT EXISTS is_additional_pack_snapshot/i);
  assert.match(
    migration,
    /is_additional_pack_snapshot[\s\S]*SET DEFAULT false[\s\S]*SET NOT NULL/i,
  );
  assert.match(
    migration,
    /ADD COLUMN IF NOT EXISTS relief_pack_type_snapshot/i,
  );
  assert.match(
    migration,
    /relief_pack_type_snapshot[\s\S]*STANDARD_RELIEF_PACK[\s\S]*ADDITIONAL_RELIEF_PACK/i,
  );
});

test("schema reference includes required distribution transaction snapshots", () => {
  const schema = fs.readFileSync(schemaPath, "utf8");

  assert.match(schema, /item_code_snapshot text NOT NULL/i);
  assert.match(schema, /item_name_snapshot text NOT NULL/i);
  assert.match(schema, /unit_of_measure_snapshot text NOT NULL/i);
  assert.match(schema, /category_snapshot text NOT NULL/i);
  assert.match(schema, /relief_pack_type_snapshot text NOT NULL/i);
  assert.match(schema, /is_additional_pack_snapshot boolean NOT NULL/i);
  assert.match(schema, /name_snapshot text NOT NULL/i);
  assert.match(schema, /relief_pack_template_id_snapshot uuid/i);
  assert.match(schema, /source_type_snapshot text NOT NULL/i);
  assert.match(schema, /source_relief_type_snapshot text NOT NULL/i);
  assert.match(schema, /donor_name_snapshot text/i);
  assert.match(schema, /donated_relief_pack_name_snapshot text/i);
});

test("transaction item pack snapshot migration links unambiguous template items", () => {
  const migration = fs.readFileSync(packTemplateItemMigrationPath, "utf8");

  assert.match(
    migration,
    /ADD COLUMN IF NOT EXISTS relief_pack_template_id_snapshot uuid/i,
  );
  assert.match(migration, /candidate_templates/i);
  assert.match(migration, /HAVING COUNT\(\*\) = 1/i);
  assert.match(
    migration,
    /SET relief_pack_template_id_snapshot = unique_candidates\.relief_pack_template_id/i,
  );
});

test("transaction item source migration snapshots historical display metadata", () => {
  const migration = fs.readFileSync(itemSourceMigrationPath, "utf8");

  assert.match(migration, /ADD COLUMN IF NOT EXISTS category_snapshot text/i);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS source_type_snapshot text/i);
  assert.match(
    migration,
    /ADD COLUMN IF NOT EXISTS source_relief_type_snapshot text/i,
  );
  assert.match(migration, /donor_name_snapshot text/i);
  assert.match(migration, /donated_relief_pack_name_snapshot text/i);
  assert.match(migration, /source_donation.donation_item_remarks/i);
  assert.match(migration, /ALTER COLUMN category_snapshot SET NOT NULL/i);
  assert.match(
    migration,
    /ALTER COLUMN source_relief_type_snapshot SET NOT NULL/i,
  );
});

test("source snapshot classification keeps donated loose stock distinct from donated packs", () => {
  assert.equal(
    getDistributionItemSourceReliefTypeSnapshot({
      sourceType: "DONATED",
      sourceReliefType: "STANDARD_RELIEF_PACK",
    }),
    "DONATED_LOOSE_ITEM",
  );
  assert.equal(
    getDistributionItemSourceReliefTypeSnapshot({
      sourceType: "DONATED",
      sourceReliefType: "DONATED_RELIEF_PACK",
      donatedReliefPackName: "Family Care Pack",
    }),
    "DONATED_RELIEF_PACK",
  );
  assert.equal(
    getDistributionItemSourceReliefTypeSnapshot({
      sourceType: "LGU",
      sourceReliefType: "STANDARD_RELIEF_PACK",
    }),
    "LGU",
  );
});
