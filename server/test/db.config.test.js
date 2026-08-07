const test = require("node:test");
const assert = require("node:assert/strict");

const dbPath = require.resolve("../src/config/db");
const loadDb = (environment) => {
  const original = { NODE_ENV: process.env.NODE_ENV, DATABASE_URL: process.env.DATABASE_URL, TEST_DATABASE_URL: process.env.TEST_DATABASE_URL, ALLOW_TEST_DB_MUTATIONS: process.env.ALLOW_TEST_DB_MUTATIONS };
  Object.assign(process.env, environment);
  delete require.cache[dbPath];
  const pool = require(dbPath);
  return { pool, restore: () => { if (typeof pool.end === "function") pool.end(); Object.entries(original).forEach(([key, value]) => value === undefined ? delete process.env[key] : process.env[key] = value); delete require.cache[dbPath]; } };
};

test("test configuration selects TEST_DATABASE_URL and accepts an explicitly enabled test database", () => {
  const { pool, restore } = loadDb({ NODE_ENV: "test", DATABASE_URL: "postgresql://example/default", TEST_DATABASE_URL: "postgresql://example/distync_test", ALLOW_TEST_DB_MUTATIONS: "true" });
  try { assert.equal(pool.getSafeDatabaseDebugInfo().host, "example"); assert.doesNotThrow(() => pool.assertTestDatabaseMutationAllowed()); } finally { restore(); }
});

test("test configuration refuses a missing TEST_DATABASE_URL instead of falling back", async () => {
  const { pool, restore } = loadDb({ NODE_ENV: "test", DATABASE_URL: "postgresql://example/default", TEST_DATABASE_URL: "", ALLOW_TEST_DB_MUTATIONS: "true" });
  try { await assert.rejects(() => pool.query("SELECT 1"), /Integration tests require TEST_DATABASE_URL/); assert.throws(() => pool.assertTestDatabaseMutationAllowed(), /Integration tests require TEST_DATABASE_URL/); } finally { restore(); }
});

test("development configuration retains DATABASE_URL", () => {
  const { pool, restore } = loadDb({ NODE_ENV: "development", DATABASE_URL: "postgresql://dev-host/distync", TEST_DATABASE_URL: "postgresql://test-host/distync_test", ALLOW_TEST_DB_MUTATIONS: "false" });
  try { assert.equal(pool.getSafeDatabaseDebugInfo().host, "dev-host"); } finally { restore(); }
});
