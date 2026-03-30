const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool
  .connect()
  .then(() => console.log("PostgreSQL connected successfully"))
  .catch((error) =>
    console.error("PostgreSQL connection error:", error.message),
  );

module.exports = pool;
