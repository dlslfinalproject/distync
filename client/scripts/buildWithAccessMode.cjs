const { spawnSync } = require("node:child_process");
const path = require("node:path");
const {
  resolveBuildTargetConfig,
} = require("./buildTargetConfig.cjs");

const run = () => {
  const requestedTarget = process.argv[2];
  const targetConfig = resolveBuildTargetConfig(requestedTarget);
  const clientDir = path.resolve(__dirname, "..");
  const viteBin = path.resolve(clientDir, "node_modules", "vite", "bin", "vite.js");

  console.log(
    `DISTYNC frontend ${targetConfig.label} build starting. VITE_ACCESS_MODE=${targetConfig.accessMode}.`,
  );

  const result = spawnSync(
    process.execPath,
    [viteBin, "build", "--mode", targetConfig.modeName],
    {
      cwd: clientDir,
      env: {
        ...process.env,
        DISTYNC_BUILD_TARGET: targetConfig.target,
        VITE_ACCESS_MODE: targetConfig.accessMode,
      },
      stdio: "inherit",
    },
  );

  if (typeof result.status === "number") {
    process.exit(result.status);
  }

  process.exit(1);
};

run();
