const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const testDirectory = path.resolve(__dirname, "../test");
const testFiles = fs
  .readdirSync(testDirectory)
  .filter((fileName) => fileName.endsWith(".test.js"))
  .filter((fileName) => !fileName.endsWith(".integration.test.js"))
  .map((fileName) => path.join("test", fileName));

const result = spawnSync(process.execPath, ["--test", ...testFiles], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "test",
  },
});

process.exitCode = result.status || 0;
