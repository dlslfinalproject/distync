const assert = require("node:assert/strict");
const test = require("node:test");

const repositoryPath = require.resolve("../src/repositories/masterlist.repository");
const databasePath = require.resolve("../src/config/db");
const eventId = "123e4567-e89b-42d3-a456-426614174000";

const withStubbedDatabase = async (runTest) => {
  const originalRepository = require.cache[repositoryPath];
  const originalDatabase = require.cache[databasePath];
  const calls = [];
  const rows = [{
    barangay_id: "barangay-1",
    barangay_code: "BAGONG_POOK",
    barangay_name: "Bagong Pook",
    is_affected: true,
    issued_stubs: 3,
    claimed_stubs: 1,
    pending_relief_claims: 2,
  }];
  const pool = {
    query: async (query, values) => {
      calls.push({ query, values });
      return { rows };
    },
  };

  delete require.cache[repositoryPath];
  require.cache[databasePath] = {
    id: databasePath,
    filename: databasePath,
    loaded: true,
    exports: pool,
  };

  try {
    await runTest(require(repositoryPath), { calls, rows });
  } finally {
    delete require.cache[repositoryPath];
    if (originalRepository) require.cache[repositoryPath] = originalRepository;
    if (originalDatabase) require.cache[databasePath] = originalDatabase;
    else delete require.cache[databasePath];
  }
};

test("heatmap reference and stub metrics use one bound set-wise repository query", async () => {
  await withStubbedDatabase(async (repository, { calls, rows }) => {
    const result = await repository.getMswdoBarangayHeatmapReferenceMetrics(eventId);

    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].values, [eventId]);
    assert.deepEqual(result, rows);
    assert.match(calls[0].query, /FROM barangays b/);
    assert.match(calls[0].query, /LEFT JOIN disaster_event_barangays deb/);
    assert.match(calls[0].query, /GROUP BY h\.barangay_id/);
  });
});
