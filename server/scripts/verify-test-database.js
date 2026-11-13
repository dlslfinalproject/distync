const pool = require("../src/config/db");

try {
  pool.assertTestDatabaseMutationAllowed();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
