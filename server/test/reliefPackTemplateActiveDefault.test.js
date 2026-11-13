const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.join(__dirname, "../..");
const migrationPath = path.join(
  repoRoot,
  "database/migrations/2026-09-02_align_relief_pack_template_active_default.sql",
);
const schemaPath = path.join(repoRoot, "database/schema/distync_schema.sql");

test("relief-pack template active default is inactive in the migration", () => {
  const migrationSql = fs.readFileSync(migrationPath, "utf8");

  assert.match(
    migrationSql,
    /ALTER TABLE public\.relief_pack_templates\s+ALTER COLUMN is_active SET DEFAULT false;/i,
  );
});

test("relief-pack template active default is inactive in the schema reference", () => {
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  const tableMatch = schemaSql.match(
    /CREATE TABLE public\.relief_pack_templates \(([^]*?)\n\);/i,
  );

  assert.ok(tableMatch, "relief_pack_templates table must exist in the schema");
  assert.match(tableMatch[1], /is_active boolean NOT NULL DEFAULT false,/i);
});
