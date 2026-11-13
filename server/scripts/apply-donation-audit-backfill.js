const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const migrationPath = path.resolve(
  __dirname,
  "../../database/migrations/2026-08-10_backfill_donation_audit_logs.sql",
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
          FROM donations
          WHERE created_at <= TIMESTAMPTZ '2026-07-28 15:51:00+08'
        ) AS legacy_donations_remaining,
        (
          SELECT COUNT(1)::int
          FROM audit_logs
          WHERE entity_type IN ('DONATION', 'DONATION_ITEM')
            AND created_at <= TIMESTAMPTZ '2026-07-28 15:51:00+08'
        ) AS legacy_donation_audits_remaining,
        (
          SELECT COUNT(1)::int
          FROM donations
          WHERE status <> 'CANCELLED'
            AND created_at > TIMESTAMPTZ '2026-07-28 15:51:00+08'
        ) AS current_donations,
        (
          SELECT COUNT(1)::int
          FROM audit_logs al
          INNER JOIN donations d ON d.id = al.entity_id
          WHERE al.entity_type = 'DONATION'
            AND al.action = 'DONATION_CREATE'
            AND d.status <> 'CANCELLED'
            AND d.created_at > TIMESTAMPTZ '2026-07-28 15:51:00+08'
        ) AS current_donation_entry_audits
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
