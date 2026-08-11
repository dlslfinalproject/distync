const fs = require("fs");
const path = require("path");
const { Client } = require(path.resolve(__dirname, "../server/node_modules/pg"));
require(path.resolve(__dirname, "../server/node_modules/dotenv")).config({
  path: path.resolve(__dirname, "../server/.env"),
});

const normalizeConnectionString = (value) => {
  if (!value || typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/^['"]|['"]$/g, "");
};

const connectionString = normalizeConnectionString(process.env.DATABASE_URL);

if (!connectionString) {
  throw new Error("DATABASE_URL is missing in server/.env");
}

const parsedUrl = new URL(connectionString);
const sslEnabled =
  parsedUrl.hostname.endsWith(".supabase.co") ||
  parsedUrl.hostname.endsWith(".supabase.com");

const sqlFilePath = process.argv[2];

if (!sqlFilePath) {
  throw new Error("Usage: node tmp/run_sql_file.js <sql-file-path>");
}

const absoluteSqlFilePath = path.resolve(sqlFilePath);
const sql = fs.readFileSync(absoluteSqlFilePath, "utf8");

const client = new Client({
  connectionString,
  ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
});

const run = async () => {
  await client.connect();
  try {
    await client.query(sql);
    console.log(`Executed SQL file: ${absoluteSqlFilePath}`);
  } finally {
    await client.end();
  }
};

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
