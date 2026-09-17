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

test("event summary query applies search filters and returns server pagination", async () => {
  const calls = [];
  const harness = loadRepositoryWithMockPool(async (query, values) => {
    calls.push({ query, values });

    if (query.includes("SELECT COUNT(*)::int AS total_items")) {
      return { rows: [{ total_items: 126 }] };
    }

    return { rows: [{ id: "event-26" }] };
  });

  try {
    const result = await harness.repository.getDisasterEventReportSummary({
      status: "ACTIVE",
      barangayId: "11111111-1111-4111-8111-111111111111",
      dateFrom: "2026-09-01",
      dateTo: "2026-09-15",
      search: "Santiago",
      sortOrder: "az",
      page: 3,
      pageSize: 25,
    });
    const countCall = calls.find((call) =>
      call.query.includes("SELECT COUNT(*)::int AS total_items"),
    );
    const dataCall = calls.find(
      (call) => !call.query.includes("SELECT COUNT(*)::int AS total_items"),
    );

    assert.equal(calls.length, 2);
    assert.match(countCall.query, /de\.title ILIKE/);
    assert.match(countCall.query, /b_search\.name ILIKE/);
    assert.match(dataCall.query, /LIMIT \$\d+ OFFSET \$\d+/);
    assert.equal(dataCall.values[dataCall.values.length - 2], 25);
    assert.equal(dataCall.values[dataCall.values.length - 1], 50);
    assert.deepEqual(result.rows, [{ id: "event-26" }]);
    assert.deepEqual(result.pagination, {
      page: 3,
      pageSize: 25,
      totalItems: 126,
      totalPages: 6,
      hasPreviousPage: true,
      hasNextPage: true,
    });
  } finally {
    harness.restore();
  }
});

test("Barangay breakdown query applies search filters before server pagination", async () => {
  const calls = [];
  const harness = loadRepositoryWithMockPool(async (query, values) => {
    calls.push({ query, values });

    if (query.includes("SELECT COUNT(*)::int AS total_items")) {
      return { rows: [{ total_items: 51 }] };
    }

    return { rows: [{ id: "event-1", barangay_id: "barangay-1" }] };
  });

  try {
    const result = await harness.repository.getDisasterEventReportBarangayBreakdown({
      disasterEventId: "11111111-1111-4111-8111-111111111111",
      search: "Bagong Pook",
      sortOrder: "oldest",
      page: 2,
      pageSize: 25,
    });
    const countCall = calls.find((call) =>
      call.query.includes("SELECT COUNT(*)::int AS total_items"),
    );
    const dataCall = calls.find(
      (call) => !call.query.includes("SELECT COUNT(*)::int AS total_items"),
    );

    assert.match(countCall.query, /b\.name ILIKE/);
    assert.match(dataCall.query, /ORDER BY de\.start_date ASC/);
    assert.equal(dataCall.values[dataCall.values.length - 2], 25);
    assert.equal(dataCall.values[dataCall.values.length - 1], 25);
    assert.equal(result.pagination.totalItems, 51);
    assert.equal(result.pagination.totalPages, 3);
  } finally {
    harness.restore();
  }
});
