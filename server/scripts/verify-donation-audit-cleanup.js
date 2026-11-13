const { Client } = require("pg");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

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
  const client = buildClient();
  await client.connect();

  try {
    const result = await client.query(`
      SELECT
        al.action,
        al.entity_type,
        COALESCE(
          d.donor_name,
          d_item.donor_name,
          al.new_values_json->>'donor_name',
          al.old_values_json->>'donor_name'
        ) AS donor_name,
        al.created_at
        ,
        al.old_values_json,
        al.new_values_json
      FROM audit_logs al
      LEFT JOIN donations d
        ON al.entity_type = 'DONATION'
        AND d.id = al.entity_id
      LEFT JOIN donation_items di
        ON al.entity_type = 'DONATION_ITEM'
        AND di.id = al.entity_id
      LEFT JOIN donations d_item
        ON d_item.id = di.donation_id
      WHERE al.entity_type IN ('DONATION', 'DONATION_ITEM')
      ORDER BY al.created_at DESC, al.id DESC
      LIMIT 20
    `);

    console.log(JSON.stringify(result.rows, null, 2));
  } finally {
    await client.end();
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
