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

test("listActiveDisasterEventsForEvacuationSummary filters to ACTIVE disaster events", async () => {
  let capturedQuery = "";
  const harness = loadRepositoryWithMockPool(async (query) => {
    capturedQuery = query;
    return { rows: [] };
  });

  try {
    await harness.repository.listActiveDisasterEventsForEvacuationSummary();
    assert.match(capturedQuery, /WHERE status = 'ACTIVE'/);
  } finally {
    harness.restore();
  }
});

test("getEvacuationSummaryForWindow uses half-open windows, DISTINCT counts, and latest-log attendance selection", async () => {
  const capturedQueries = [];
  const capturedValues = [];
  const harness = loadRepositoryWithMockPool(async (query, values = []) => {
    capturedQueries.push(query);
    capturedValues.push(values);

    if (capturedQueries.length === 1) {
      return {
        rows: [
          {
            id: "event-1",
            event_code: "FLD-2026-001",
            title: "Flood Monitoring",
            status: "ACTIVE",
          },
        ],
      };
    }

    return { rows: [] };
  });

  try {
    const result = await harness.repository.getEvacuationSummaryForWindow({
      disasterEventId: "event-1",
      windowStart: "2026-08-05T05:00:00.000Z",
      windowEnd: "2026-08-05T06:00:00.000Z",
    });

    assert.ok(result);
    assert.equal(capturedQueries.length, 3);
    assert.match(capturedQueries[1], /registered_at >= \$2::timestamptz/);
    assert.match(capturedQueries[1], /registered_at < \$3::timestamptz/);
    assert.match(capturedQueries[1], /COUNT\(DISTINCT h\.id\)::int AS count/);
    assert.match(capturedQueries[1], /COUNT\(DISTINCT e\.id\)::int AS count/);
    assert.match(capturedQueries[1], /SELECT DISTINCT ON \(el\.evacuee_id\)/);
    assert.match(capturedQueries[2], /ORDER BY active_barangays\.name ASC/);
    assert.deepEqual(capturedValues[1], [
      "event-1",
      "2026-08-05T05:00:00.000Z",
      "2026-08-05T06:00:00.000Z",
    ]);
  } finally {
    harness.restore();
  }
});
