const test = require("node:test");
const assert = require("node:assert/strict");

const servicePath = require.resolve("../src/services/sync.service");
const syncRepositoryPath = require.resolve("../src/repositories/sync.repository");

const withStubbedSyncService = async (stubs, runTest) => {
  const dependencyPaths = [syncRepositoryPath];
  const originalEntries = new Map(
    dependencyPaths.map((modulePath) => [modulePath, require.cache[modulePath]]),
  );

  delete require.cache[servicePath];

  try {
    require.cache[syncRepositoryPath] = {
      id: syncRepositoryPath,
      filename: syncRepositoryPath,
      loaded: true,
      exports: stubs[syncRepositoryPath],
    };

    const syncService = require(servicePath);
    await runTest(syncService);
  } finally {
    delete require.cache[servicePath];

    dependencyPaths.forEach((modulePath) => {
      const originalEntry = originalEntries.get(modulePath);

      if (originalEntry) {
        require.cache[modulePath] = originalEntry;
      } else {
        delete require.cache[modulePath];
      }
    });
  }
};

test("getSyncStatusSummary returns unresolved conflict count and last successful sync for the current user", async () => {
  await withStubbedSyncService(
    {
      [syncRepositoryPath]: {
        countOpenSyncConflictsByUser: async ({ userId }) => {
          assert.equal(userId, "user-1");
          return 3;
        },
        getLastSuccessfulSyncAtByUser: async ({ userId }) => {
          assert.equal(userId, "user-1");
          return "2026-08-05T14:45:00.000Z";
        },
      },
    },
    async ({ getSyncStatusSummary }) => {
      const summary = await getSyncStatusSummary({
        auth: {
          userId: "user-1",
        },
      });

      assert.deepEqual(summary, {
        conflictCount: 3,
        lastSuccessfulSyncAt: "2026-08-05T14:45:00.000Z",
        backendReachable: true,
      });
    },
  );
});
