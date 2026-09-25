const test = require("node:test");
const assert = require("node:assert/strict");
const { logRuntimeBuildFingerprint } = require("../src/utils/runtimeBuildFingerprint");

const captureFingerprint = (options = {}) => {
  const entries = [];
  logRuntimeBuildFingerprint({
    serverEntrypoint: "/srv/server/src/server.js",
    resolveProfileStorageModule: () =>
      "/srv/server/src/services/profilePictureStorage.service.js",
    logger: { info: (...args) => entries.push(args) },
    ...options,
  });
  return entries;
};

test("runtime fingerprint trims Render values and includes only approved fields", () => {
  const entries = captureFingerprint({
    env: {
      RENDER_GIT_COMMIT: "  abc123  ",
      RENDER_GIT_BRANCH: " release/testing-rc1 ",
      SECRET: "must-not-be-logged",
    },
  });

  assert.equal(entries.length, 1);
  assert.equal(entries[0][0], "[runtime-build]");
  assert.deepEqual(entries[0][1], {
    renderGitCommit: "abc123",
    renderGitBranch: "release/testing-rc1",
    serverEntrypoint: "/srv/server/src/server.js",
    profileStorageModule:
      "/srv/server/src/services/profilePictureStorage.service.js",
  });
  assert.deepEqual(Object.keys(entries[0][1]), [
    "renderGitCommit",
    "renderGitBranch",
    "serverEntrypoint",
    "profileStorageModule",
  ]);
  assert.equal(JSON.stringify(entries).includes("must-not-be-logged"), false);
});

test("missing Render values are null", () => {
  const entries = captureFingerprint({ env: {} });

  assert.equal(entries.length, 1);
  assert.equal(entries[0][1].renderGitCommit, null);
  assert.equal(entries[0][1].renderGitBranch, null);
});

test("module resolution failure logs null without throwing", () => {
  assert.doesNotThrow(() => {
    const entries = captureFingerprint({
      resolveProfileStorageModule: () => {
        throw new Error("module unavailable");
      },
    });

    assert.equal(entries.length, 1);
    assert.equal(entries[0][1].profileStorageModule, null);
  });
});

test("fingerprint logger failure does not throw", () => {
  assert.doesNotThrow(() =>
    logRuntimeBuildFingerprint({
      env: {},
      serverEntrypoint: "/srv/server/src/server.js",
      resolveProfileStorageModule: () => "/srv/profilePictureStorage.service.js",
      logger: { info: () => { throw new Error("logger unavailable"); } },
    }),
  );
});
