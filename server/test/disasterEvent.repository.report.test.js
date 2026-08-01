const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const repositoryPath = path.resolve(
  __dirname,
  "../src/repositories/disasterEvent.repository.js",
);
const dbPath = path.resolve(__dirname, "../src/config/db.js");

const loadRepositoryWithMockPool = (queryImpl) => {
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

  const repository = require(repositoryPath);

  const restore = () => {
    delete require.cache[repositoryPath];

    if (originalDbEntry) {
      require.cache[dbPath] = originalDbEntry;
    } else {
      delete require.cache[dbPath];
    }

    if (originalRepositoryEntry) {
      require.cache[repositoryPath] = originalRepositoryEntry;
    }
  };

  return {
    repository,
    restore,
  };
};

test("barangay breakdown query uses status-array filtering for aggregate exports", async () => {
  let capturedQuery = "";
  let capturedValues = [];
  const harness = loadRepositoryWithMockPool(async (query, values) => {
    capturedQuery = query;
    capturedValues = values;
    return { rows: [] };
  });

  try {
    await harness.repository.getDisasterEventReportBarangayBreakdown({
      statuses: ["ACTIVE", "CLOSED"],
      sortOrder: "newest",
      limit: 25,
    });

    assert.match(capturedQuery, /de\.status = ANY\(\$1::TEXT\[\]\)/);
    assert.deepEqual(capturedValues[0], ["ACTIVE", "CLOSED"]);
    assert.equal(capturedValues[capturedValues.length - 1], 25);
  } finally {
    harness.restore();
  }
});
