const test = require("node:test");
const assert = require("node:assert/strict");

const repositoryPath = require.resolve("../src/repositories/systemLog.repository");
const dbPath = require.resolve("../src/config/db");

const withMockPool = async (queryImpl, runTest) => {
  const originalDbEntry = require.cache[dbPath];
  const originalRepositoryEntry = require.cache[repositoryPath];

  delete require.cache[repositoryPath];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: {
      query: queryImpl,
    },
  };

  try {
    const repository = require(repositoryPath);
    await runTest(repository);
  } finally {
    delete require.cache[repositoryPath];

    if (originalDbEntry) {
      require.cache[dbPath] = originalDbEntry;
    } else {
      delete require.cache[dbPath];
    }

    if (originalRepositoryEntry) {
      require.cache[repositoryPath] = originalRepositoryEntry;
    } else {
      delete require.cache[repositoryPath];
    }
  }
};

test("ANOMSRC-08 insertErrorLog persists structured anomaly source context", async () => {
  let capturedQuery = "";
  let capturedValues = [];

  await withMockPool(
    async (query, values) => {
      capturedQuery = query;
      capturedValues = values;
      return { rows: [{ id: "error-log-1" }] };
    },
    async ({ insertErrorLog }) => {
      const row = await insertErrorLog({
        user_id: "user-1",
        device_id: "device-1",
        module_name: "distribution",
        error_code: "STUB_ALREADY_CLAIMED",
        error_message: "This stub has already been used for distribution",
        severity: "WARNING",
        reference_type: "STUB",
        reference_id: "22222222-2222-4222-8222-222222222222",
        context_json: {
          action: "DIRECT_DUPLICATE_CLAIM_ATTEMPT",
        },
      });

      assert.equal(row.id, "error-log-1");
    },
  );

  assert.match(capturedQuery, /reference_type/);
  assert.match(capturedQuery, /reference_id/);
  assert.match(capturedQuery, /context_json/);
  assert.equal(capturedValues[7], "STUB");
  assert.equal(capturedValues[8], "22222222-2222-4222-8222-222222222222");
  assert.deepEqual(JSON.parse(capturedValues[9]), {
    action: "DIRECT_DUPLICATE_CLAIM_ATTEMPT",
  });
});

