const path = require("path");
const { Pool } = require("pg");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const normalizeConnectionString = (value) => {
  if (!value || typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/^['"]|['"]$/g, "");
};

const databaseUrl = normalizeConnectionString(process.env.DATABASE_URL);

if (!databaseUrl) {
  throw new Error("DATABASE_URL is missing in server/.env");
}

let parsedDatabaseUrl;

try {
  parsedDatabaseUrl = new URL(databaseUrl);
} catch (error) {
  throw new Error("DATABASE_URL is invalid. Check the PostgreSQL connection string in server/.env");
}

const databaseHost = parsedDatabaseUrl.hostname || "unknown";
const isSupabaseHost = databaseHost.endsWith(".supabase.co");
const sslEnabled = isSupabaseHost;

console.log(
  `PostgreSQL config loaded (host: ${databaseHost}, ssl: ${sslEnabled ? "enabled" : "disabled"})`,
);

const poolConfig = {
  connectionString: databaseUrl,
};

if (sslEnabled) {
  poolConfig.ssl = {
    rejectUnauthorized: false,
  };
}

const pool = new Pool(poolConfig);

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
