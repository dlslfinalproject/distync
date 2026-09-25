const trimOrNull = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  return value.trim() || null;
};

const logRuntimeBuildFingerprint = ({
  env = {},
  serverEntrypoint,
  resolveProfileStorageModule,
  logger = console,
} = {}) => {
  try {
    let profileStorageModule = null;

    try {
      const resolvedModule = resolveProfileStorageModule();
      profileStorageModule = trimOrNull(resolvedModule);
    } catch {
      profileStorageModule = null;
    }

    logger.info("[runtime-build]", {
      renderGitCommit: trimOrNull(env.RENDER_GIT_COMMIT),
      renderGitBranch: trimOrNull(env.RENDER_GIT_BRANCH),
      serverEntrypoint: trimOrNull(serverEntrypoint),
      profileStorageModule,
    });
  } catch {
    // A logging failure must not interfere with server startup.
  }
};

module.exports = { logRuntimeBuildFingerprint };
