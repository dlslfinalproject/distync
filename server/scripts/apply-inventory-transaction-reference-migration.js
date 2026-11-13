const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const migrationPath = path.resolve(
  __dirname,
  "../../database/migrations/2026-08-27_auto_generate_inventory_transaction_reference_no.sql",
);

const buildClient = () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const databaseUrl = new URL(process.env.DATABASE_URL);
  const isSupabaseHost =
    databaseUrl.hostname.endsWith(".supabase.com") ||
    databaseUrl.hostname.endsWith(".supabase.co");

  return new Client({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.DATABASE_SSL === "true" || isSupabaseHost
        ? { rejectUnauthorized: false }
        : false,
  });
};

const countInventoryReferenceState = async (client, includeCounterYear = false) => {
  const result = await client.query(`
    SELECT
      (
        SELECT COUNT(*)::int
        FROM inventory_transactions
      ) AS transaction_count,
      (
        SELECT COUNT(*)::int
        FROM inventory_transactions
        WHERE inventory_transaction_reference_no IS NULL
      ) AS missing_reference_count,
      (
        SELECT COUNT(*)::int
        FROM inventory_transactions
        WHERE inventory_transaction_reference_no !~ '^ITR-[0-9]{4}-[0-9]{6}$'
          OR RIGHT(inventory_transaction_reference_no, 6) = '000000'
      ) AS invalid_reference_count,
      (
        SELECT COUNT(*)::int
        FROM inventory_batches ib
        WHERE NOT EXISTS (
          SELECT 1
          FROM inventory_transactions it
          WHERE it.inventory_batch_id = ib.id
            AND it.transaction_type = 'INFLOW'
        )
      ) AS batches_missing_inflow_count,
      ${includeCounterYear ? "(SELECT COUNT(*)::int FROM inventory_transaction_reference_counters)" : "NULL::int"} AS counter_year_count
  `);

  return result.rows[0];
};

const main = async () => {
  const migrationSql = fs.readFileSync(migrationPath, "utf8");
  const client = buildClient();

  await client.connect();

  try {
    const before = await countInventoryReferenceState(client);
    await client.query(migrationSql);
    const after = await countInventoryReferenceState(client, true);

    console.log(JSON.stringify({ before, after }));
  } finally {
    await client.end();
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
