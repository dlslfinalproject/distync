const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

let app;
let pool;

try {
  pool = require("./config/db");
  app = require("./app");
} catch (error) {
  console.error("Failed to initialize server configuration:", error.message);
  process.exit(1);
}

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await pool.verifyConnection();

    app.listen(PORT, () => {
      console.log(`DISTYNC server running on port ${PORT}`);
    });
  } catch (error) {
    const debugInfo = pool.getSafeDatabaseDebugInfo();

    console.error(
      `Failed to start server because PostgreSQL connection could not be established (host: ${debugInfo.host}, ssl: ${debugInfo.sslEnabled ? "enabled" : "disabled"})`,
    );
    console.error(`PostgreSQL startup error: ${error.message}`);

    if (debugInfo.isSupabaseHost) {
      console.error(
        "If the direct Supabase host still fails locally, replace DATABASE_URL with the Supabase Session pooler connection string from the Supabase dashboard.",
      );
    }

    process.exit(1);
  }
};

startServer();
