const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const migrationPath = path.resolve(
  __dirname,
  "../../database/migrations/2026-08-11_backfill_distribution_audit_logs.sql",
);

const buildClient = () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return new Client({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.DATABASE_SSL === "true"
        ? { rejectUnauthorized: false }
        : false,
  });
};

const main = async () => {
  const sql = fs.readFileSync(migrationPath, "utf8");
  const client = buildClient();

  await client.connect();

  try {
    await client.query(sql);

    const result = await client.query(`
      SELECT
        (
          SELECT COUNT(1)::int
          FROM distribution_transactions
          WHERE distribution_status = 'CLAIMED'
        ) AS claimed_distributions,
        (
          SELECT COUNT(1)::int
          FROM audit_logs al
          INNER JOIN distribution_transactions dt ON dt.id = al.entity_id
          WHERE al.entity_type = 'DISTRIBUTION_TRANSACTION'
            AND al.action IN (
              'DISTRIBUTION_RECORD',
              'DISTRIBUTION_QR_CLAIM'
            )
            AND dt.distribution_status = 'CLAIMED'
        ) AS current_distribution_audits
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
