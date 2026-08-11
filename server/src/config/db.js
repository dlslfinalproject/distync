const path = require("path");
const { Pool } = require("pg");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const normalizeConnectionString = (value) => {
  if (!value || typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/^['"]|['"]$/g, "");
};

const isTestEnvironment = process.env.NODE_ENV === "test";
const testDatabaseUrl = normalizeConnectionString(process.env.TEST_DATABASE_URL);
const databaseUrl = isTestEnvironment
  ? testDatabaseUrl
  : normalizeConnectionString(process.env.DATABASE_URL);

const createTestDatabaseSafetyError = () =>
  new Error(
    "Integration tests require TEST_DATABASE_URL. Refusing to run database-mutating tests against the default database connection.",
  );

const assertTestDatabaseMutationAllowed = () => {
  if (!isTestEnvironment || !testDatabaseUrl) {
    throw createTestDatabaseSafetyError();
  }

  let parsedTestDatabaseUrl;
  try {
    parsedTestDatabaseUrl = new URL(testDatabaseUrl);
  } catch (error) {
    throw new Error("TEST_DATABASE_URL is invalid.");
  }

  const databaseName = parsedTestDatabaseUrl.pathname.replace(/^\//, "");
  if (!/(^|[_-])test([_-]|$)/i.test(databaseName)) {
    throw new Error(
      "TEST_DATABASE_URL must target a database whose name contains 'test'. Refusing database mutation.",
    );
  }

  if (process.env.ALLOW_TEST_DB_MUTATIONS !== "true") {
    throw new Error(
      "ALLOW_TEST_DB_MUTATIONS=true is required for database-mutating integration tests.",
    );
  }
};

if (!databaseUrl && !isTestEnvironment) {
  throw new Error("DATABASE_URL is missing in server/.env");
}

let parsedDatabaseUrl;

if (databaseUrl) {
  try {
    parsedDatabaseUrl = new URL(databaseUrl);
  } catch (error) {
    throw new Error(
      isTestEnvironment
        ? "TEST_DATABASE_URL is invalid."
        : "DATABASE_URL is invalid. Check the PostgreSQL connection string in server/.env",
    );
  }
}

const databaseHost = parsedDatabaseUrl?.hostname || "unconfigured";
const isSupabaseHost =
  databaseHost.endsWith(".supabase.co") ||
  databaseHost.endsWith(".supabase.com");
const sslEnabled = isSupabaseHost;

console.log(
  `PostgreSQL config loaded (host: ${databaseHost}, ssl: ${sslEnabled ? "enabled" : "disabled"})`,
);

const poolConfig = databaseUrl ? { connectionString: databaseUrl } : null;

if (poolConfig && sslEnabled) {
  poolConfig.ssl = {
    rejectUnauthorized: false,
  };
}

const pool = poolConfig
  ? new Pool(poolConfig)
  : {
      query: async () => {
        throw createTestDatabaseSafetyError();
      },
      connect: async () => {
        throw createTestDatabaseSafetyError();
      },
      on: () => {},
    };

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error.message);
});

pool.getSafeDatabaseDebugInfo = () => {
  return {
    host: databaseHost,
    sslEnabled,
    isSupabaseHost,
  };
};

pool.assertTestDatabaseMutationAllowed = assertTestDatabaseMutationAllowed;

pool.verifyConnection = async () => {
  const client = await pool.connect();

  try {
    await client.query("SELECT 1");
    console.log(
      `PostgreSQL connected successfully (host: ${databaseHost}, ssl: ${sslEnabled ? "enabled" : "disabled"})`,
    );
  } finally {
    client.release();
  }
};

module.exports = pool;
