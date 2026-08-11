const test = require("node:test");
const assert = require("node:assert/strict");

const repositoryPath = require.resolve("../src/modules/auth/auth.repository");
const poolPath = require.resolve("../src/config/db");

const withStubbedRepository = async (poolStub, runTest) => {
  const originalPoolEntry = require.cache[poolPath];

  delete require.cache[repositoryPath];

  try {
    require.cache[poolPath] = {
      id: poolPath,
      filename: poolPath,
      loaded: true,
      exports: poolStub,
    };

    const repository = require(repositoryPath);
    await runTest(repository);
  } finally {
    delete require.cache[repositoryPath];

    if (originalPoolEntry) {
      require.cache[poolPath] = originalPoolEntry;
    } else {
      delete require.cache[poolPath];
    }
  }
};

test("updateUserGoogleIdentity only fills blank name columns", async () => {
  const calls = [];

  await withStubbedRepository(
    {
      query: async (sql, params) => {
        calls.push({ sql, params });
        return { rows: [{ id: params[0] }] };
      },
    },
    async ({ updateUserGoogleIdentity }) => {
      await updateUserGoogleIdentity("user-1", {
        googleSub: "google-sub-1",
        firstName: "Jane",
        lastName: "Paray",
      });
    },
  );

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /CASE\s+WHEN[\s\S]*first_name/i);
  assert.match(calls[0].sql, /CASE\s+WHEN[\s\S]*last_name/i);
  assert.deepEqual(calls[0].params, [
    "user-1",
    "google-sub-1",
    "Jane",
    "Paray",
  ]);
});
