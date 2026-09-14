const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const migrationPath = path.resolve(
  __dirname,
  "../../database/migrations/2026-09-13_backfill_inventory_packaging_audit_logs.sql",
);

const buildClient = () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
};

const main = async () => {
  const sql = fs.readFileSync(migrationPath, "utf8");
  const client = buildClient();

  await client.connect();

  try {
    await client.query(sql);

    const result = await client.query(`
      SELECT COUNT(*)::int AS packaging_added_audits
      FROM audit_logs
      WHERE entity_type = 'INVENTORY_ITEM_STOCK_FORM'
        AND action = 'INVENTORY_ITEM_STOCK_FORM_CREATE'
        AND new_values_json->>'is_additional_packaging' = 'true'
    `);

    console.log(JSON.stringify(result.rows[0]));
  } finally {
    await client.end();
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
