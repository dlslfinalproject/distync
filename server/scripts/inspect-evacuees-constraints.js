const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const pool = require("../src/config/db");

const main = async () => {
  const constraintsResult = await pool.query(`
    SELECT conname, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'evacuees'::regclass
    ORDER BY conname
  `);

  const columnsResult = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'evacuees'
    ORDER BY ordinal_position
  `);

  console.log(
    JSON.stringify(
      {
        constraints: constraintsResult.rows,
        columns: columnsResult.rows,
      },
      null,
      2,
    ),
  );
};

main()
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
