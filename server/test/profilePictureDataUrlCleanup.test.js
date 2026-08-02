const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const workspaceRoot = path.resolve(__dirname, "../..");
const migrationPath = path.join(
  workspaceRoot,
  "database/migrations/2026-08-02_remove_obsolete_profile_picture_data_url.sql",
);
const schemaPath = path.join(
  workspaceRoot,
  "database/schema/distync_schema.sql",
);
const repositoryPath = path.join(
  workspaceRoot,
  "server/src/repositories/settings.repository.js",
);

test("forward migration drops the obsolete column without CASCADE", () => {
  const migrationSql = fs.readFileSync(migrationPath, "utf8");

  assert.match(
    migrationSql,
    /drop column if exists profile_picture_data_url/i,
  );
  assert.doesNotMatch(migrationSql, /cascade/i);
  assert.match(migrationSql, /profile_picture_path remains the authoritative/i);
});

test("current schema snapshot keeps profile_picture_path and omits the obsolete column", () => {
  const schemaSql = fs.readFileSync(schemaPath, "utf8");

  assert.match(schemaSql, /profile_picture_path text/i);
  assert.doesNotMatch(schemaSql, /profile_picture_data_url text/i);
});

test("active settings repository SQL omits the obsolete column", () => {
  const repositorySource = fs.readFileSync(repositoryPath, "utf8");

  assert.doesNotMatch(repositorySource, /profile_picture_data_url/i);
  assert.match(repositorySource, /profile_picture_path/i);
});
