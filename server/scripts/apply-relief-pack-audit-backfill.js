const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const migrationPath = path.resolve(
  __dirname,
  "../../database/migrations/2026-08-10_backfill_relief_pack_template_audit_logs.sql",
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
          FROM relief_pack_templates
          WHERE is_active = TRUE
        ) AS active_templates,
        (
          SELECT COUNT(1)::int
          FROM audit_logs al
          INNER JOIN relief_pack_templates rpt ON rpt.id = al.entity_id
          WHERE al.entity_type = 'RELIEF_PACK_TEMPLATE'
            AND al.action = 'RELIEF_PACK_TEMPLATE_CREATE'
            AND rpt.is_active = TRUE
        ) AS creation_audits,
        (
          SELECT COUNT(1)::int
          FROM audit_logs al
          INNER JOIN relief_pack_templates rpt ON rpt.id = al.entity_id
          WHERE al.entity_type = 'RELIEF_PACK_TEMPLATE'
            AND al.action = 'RELIEF_PACK_TEMPLATE_UPDATE'
            AND rpt.is_active = TRUE
        ) AS edit_audits,
        (
          SELECT COUNT(1)::int
          FROM relief_pack_templates
          WHERE is_active = TRUE
            AND updated_at > created_at
        ) AS templates_with_later_updates
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
