const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "../..");
const migrationPath = path.join(
  repoRoot,
  "database/migrations/2026-09-02_consolidate_users_email_index.sql",
);
const schemaPath = path.join(repoRoot, "database/schema/distync_schema.sql");

const readUtf8 = (filePath) => fs.readFileSync(filePath, "utf8");

const collectJavaScriptFiles = (directoryPath) => {
  const files = [];

  for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectJavaScriptFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(entryPath);
    }
  }

  return files;
};

test("users email cleanup migration is a strict single-index forward migration", () => {
  const migrationSql = readUtf8(migrationPath);
  const executableSql = migrationSql
    .replace(/--[^\r\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  assert.match(migrationSql, /^BEGIN;\s*/i);
  assert.match(migrationSql, /LOCK TABLE public\.users IN ACCESS EXCLUSIVE MODE/i);
  assert.match(migrationSql, /DROP INDEX public\.idx_users_email;/i);
  assert.match(migrationSql, /COMMIT;\s*$/i);

  assert.doesNotMatch(executableSql, /CASCADE/i);
  assert.doesNotMatch(executableSql, /DROP\s+INDEX\s+IF\s+EXISTS/i);
  assert.doesNotMatch(executableSql, /DROP\s+CONSTRAINT/i);
  assert.doesNotMatch(executableSql, /CREATE\s+(?:UNIQUE\s+)?INDEX/i);
  assert.doesNotMatch(executableSql, /ALTER\s+TABLE\s+public\.users/i);
  assert.doesNotMatch(executableSql, /LOWER\s*\(/i);

  for (const requiredPattern of [
    /users_email_key/i,
    /pg_constraint/i,
    /pg_index/i,
    /pg_depend/i,
    /convalidated/i,
    /condeferrable/i,
    /condeferred/i,
    /conindid/i,
    /indisunique/i,
    /indisvalid/i,
    /indisready/i,
    /indislive/i,
    /indnkeyatts/i,
    /indnatts/i,
    /indkey/i,
    /indoption/i,
    /indcollation/i,
    /indclass/i,
    /indpred/i,
    /indexprs/i,
    /duplicate_group_count/i,
    /final_constraint_count/i,
    /final_index_count/i,
  ]) {
    assert.match(migrationSql, requiredPattern);
  }
});

test("current schema keeps the raw email UNIQUE invariant without declaring the legacy index", () => {
  const schemaSql = readUtf8(schemaPath);

  assert.match(schemaSql, /email character varying NOT NULL UNIQUE/i);
  assert.match(schemaSql, /google_sub character varying UNIQUE/i);
  assert.match(schemaSql, /CONSTRAINT uq_user_role UNIQUE \(user_id, role_id\)/i);
  assert.doesNotMatch(schemaSql, /idx_users_email/i);
});

test("runtime code has no physical users-email index dependency", () => {
  const runtimeFiles = collectJavaScriptFiles(path.join(repoRoot, "server/src"));

  for (const filePath of runtimeFiles) {
    const source = readUtf8(filePath);
    assert.doesNotMatch(
      source,
      /(?:users_email_key|idx_users_email)/i,
      `runtime source must not name an email index: ${path.relative(repoRoot, filePath)}`,
    );
  }
});

test("authentication and shared features retain ID-based and current email semantics", () => {
  const authRepositorySource = readUtf8(
    path.join(repoRoot, "server/src/modules/auth/auth.repository.js"),
  );
  const authServiceSource = readUtf8(
    path.join(repoRoot, "server/src/modules/auth/auth.service.js"),
  );
  const settingsRepositorySource = readUtf8(
    path.join(repoRoot, "server/src/repositories/settings.repository.js"),
  );
  const notificationRepositorySource = readUtf8(
    path.join(repoRoot, "server/src/modules/notifications/notification.repository.js"),
  );
  const syncRepositorySource = readUtf8(
    path.join(repoRoot, "server/src/repositories/sync.repository.js"),
  );

  assert.match(authRepositorySource, /WHERE google_sub = \$1/i);
  assert.match(authRepositorySource, /WHERE LOWER\(email\) = LOWER\(\$1\)/i);
  assert.match(authServiceSource, /getUserByGoogleSub\(verifiedIdentity\.sub\)/i);
  assert.match(authServiceSource, /getUserByEmail\(verifiedIdentity\.email\)/i);
  assert.match(authServiceSource, /if \(!user\.google_sub\)/i);
  assert.match(authServiceSource, /resolveAuthorizedRoleForUser/i);
  assert.match(authServiceSource, /buildSessionPayload\(user, roleCode\)/i);

  const profileUpdateSql = settingsRepositorySource.match(
    /UPDATE users[\s\S]*?RETURNING/i,
  )?.[0];
  assert.ok(profileUpdateSql, "settings still updates the users profile by user ID");
  assert.match(profileUpdateSql, /WHERE id = \$1/i);
  assert.doesNotMatch(profileUpdateSql, /\bSET[\s\S]*\bemail\s*=/i);

  assert.match(notificationRepositorySource, /SELECT DISTINCT u\.id/i);
  assert.match(
    notificationRepositorySource,
    /INNER JOIN user_roles ur ON ur\.user_id = u\.id/i,
  );
  assert.match(syncRepositorySource, /\buser_id\s*=\s*\$1/i);
});
