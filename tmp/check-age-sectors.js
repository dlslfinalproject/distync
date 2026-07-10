const { Client } = require("../server/node_modules/pg");

const connectionString = process.argv[2];

if (!connectionString) {
  console.error("Missing DATABASE_URL argument.");
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

client
  .connect()
  .then(() =>
    client.query(
      "select id, code, name, sector_group from sectors where sector_group = 'AGE_GROUP' order by name, code",
    ),
  )
  .then((result) => {
    console.log(JSON.stringify(result.rows, null, 2));
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
