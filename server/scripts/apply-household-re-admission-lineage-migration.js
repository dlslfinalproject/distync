const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const migrationPath = path.resolve(
  __dirname,
  "../../database/migrations/2026-09-15_add_household_re_admission_lineage.sql",
);

const normalizeConnectionString = (value) =>
  typeof value === "string" ? value.trim().replace(/^['"]|['"]$/g, "") : "";

const getDatabaseUrl = () => {
  const databaseUrl = normalizeConnectionString(process.env.DATABASE_URL);

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured in server/.env.");
  }

  return databaseUrl;
};

const buildClient = (databaseUrl) => {
  const parsedUrl = new URL(databaseUrl);
  const isSupabaseHost =
    parsedUrl.hostname.endsWith(".supabase.com") ||
    parsedUrl.hostname.endsWith(".supabase.co");

  return new Client({
    connectionString: databaseUrl,
    ssl: isSupabaseHost ? { rejectUnauthorized: false } : false,
  });
};

const readLineageColumnState = async (client) => {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'households'
        AND column_name = 'source_household_id'
    ) AS source_household_id_exists
  `);

  return Boolean(result.rows[0]?.source_household_id_exists);
};

const main = async () => {
  const databaseUrl = getDatabaseUrl();
  const parsedUrl = new URL(databaseUrl);
  const client = buildClient(databaseUrl);
  const shouldApply = process.argv.includes("--apply");

  await client.connect();

  try {
    const before = await readLineageColumnState(client);

    if (!shouldApply) {
      console.log(
        JSON.stringify({
          host: parsedUrl.hostname,
          source_household_id_exists: before,
          mode: "check-only",
        }),
      );
      return;
    }

    const migrationSql = fs.readFileSync(migrationPath, "utf8");
    await client.query(migrationSql);
    const after = await readLineageColumnState(client);

    console.log(
      JSON.stringify({
        host: parsedUrl.hostname,
        source_household_id_before: before,
        source_household_id_after: after,
        mode: "applied",
      }),
    );
  } finally {
    await client.end();
  }
};

main().catch((error) => {
  console.error(error?.message || error || "Migration check failed.");
  process.exitCode = 1;
});
