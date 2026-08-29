const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "../..");
const originalMigrationPath = path.join(
  repoRoot,
  "database/migrations/2026-08-22_add_anomaly_reviews.sql",
);
const nullableMigrationPath = path.join(
  repoRoot,
  "database/migrations/2026-08-29_allow_municipal_anomaly_reviews_without_barangay.sql",
);

test("municipal anomaly review migration only relaxes Barangay nullability and adds NULL identity protection", () => {
  const originalSql = fs.readFileSync(originalMigrationPath, "utf8");
  const migrationSql = fs.readFileSync(nullableMigrationPath, "utf8");
  const normalizedMigrationSql = migrationSql
    .replace(/--[^\r\n]*/g, "")
    .replace(/\s+/g, " ")
    .trim();

  assert.match(originalSql, /barangay_id uuid NOT NULL/);
  assert.match(
    originalSql,
    /CONSTRAINT anomaly_reviews_barangay_id_fkey FOREIGN KEY \(barangay_id\) REFERENCES public\.barangays\(id\)/,
  );
  assert.match(
    originalSql,
    /CREATE UNIQUE INDEX IF NOT EXISTS anomaly_reviews_current_identity_unique[\s\S]*barangay_id/,
  );

  assert.match(
    normalizedMigrationSql,
    /^BEGIN; ALTER TABLE public\.anomaly_reviews ALTER COLUMN barangay_id DROP NOT NULL; CREATE UNIQUE INDEX IF NOT EXISTS anomaly_reviews_current_identity_null_barangay_unique ON public\.anomaly_reviews \(source_type, source_id, anomaly_type\) WHERE barangay_id IS NULL; COMMIT;$/i,
  );
  assert.doesNotMatch(migrationSql, /DROP\s+(CONSTRAINT|INDEX|COLUMN)/i);
  assert.doesNotMatch(migrationSql, /DELETE\s+FROM\s+anomaly_reviews/i);
  assert.doesNotMatch(migrationSql, /UPDATE\s+anomaly_reviews/i);
});
