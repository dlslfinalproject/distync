const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const repositoryPath = path.resolve(
  __dirname,
  "../src/repositories/mswdoReport.repository.js",
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
    } else {
      delete require.cache[repositoryPath];
    }
  };

  return {
    repository,
    restore,
  };
};

test("H01-01 suspicious distribution keeps household-derived barangay attribution", async () => {
  let capturedQuery = "";
  let capturedValues = [];
  const harness = loadRepositoryWithMockPool(async (query, values) => {
    capturedQuery = query;
    capturedValues = values;
    return { rows: [] };
  });

  try {
    await harness.repository.getMswdoAnomalyTracking({
      barangayId: "barangay-a",
      limit: 25,
    });

    assert.match(capturedQuery, /INNER JOIN households h ON h\.id = dt\.household_id/);
    assert.match(capturedQuery, /INNER JOIN barangays b ON b\.id = h\.barangay_id/);
    assert.match(capturedQuery, /b\.id AS barangay_id/);
    assert.match(capturedQuery, /h\.barangay_id = \$1/);
    assert.equal(capturedValues[0], "barangay-a");
    assert.equal(capturedValues.at(-1), 25);
  } finally {
    harness.restore();
  }
});

test("H01-02 and H01-03 sync anomalies resolve barangay through typed server entity joins", async () => {
  let capturedQuery = "";
  const harness = loadRepositoryWithMockPool(async (query) => {
    capturedQuery = query;
    return { rows: [] };
  });

  try {
    await harness.repository.getMswdoAnomalyTracking({
      barangayId: "barangay-a",
      limit: 50,
    });

    assert.match(capturedQuery, /sync_barangay_attribution AS/);
    assert.match(capturedQuery, /st\.entity_type = 'HOUSEHOLD'\s+AND h_household\.id = st\.entity_server_id/);
    assert.match(capturedQuery, /st\.entity_type = 'STUB'\s+AND s_stub\.id = st\.entity_server_id/);
    assert.match(capturedQuery, /st\.entity_type = 'DISTRIBUTION_TRANSACTION'\s+AND dt_distribution\.id = st\.entity_server_id/);
    assert.match(capturedQuery, /st\.entity_type = 'EVACUEE'\s+AND e_evacuee\.id = st\.entity_server_id/);
    assert.match(capturedQuery, /st\.entity_type = 'EVACUATION_LOG'\s+AND el_evacuation_log\.id = st\.entity_server_id/);
    assert.match(capturedQuery, /LEFT JOIN sync_barangay_attribution sba\s+ON sba\.sync_transaction_id = st\.id/);
    assert.match(capturedQuery, /LEFT JOIN barangays b\s+ON b\.id = sba\.barangay_id/);
    assert.match(capturedQuery, /SELECT \* FROM sync_failed/);
    assert.match(capturedQuery, /SELECT \* FROM sync_conflict/);
  } finally {
    harness.restore();
  }
});

test("H01-04 and H01-05 error-log anomalies use a narrow Barangay-only actor fallback", async () => {
  let capturedQuery = "";
  const harness = loadRepositoryWithMockPool(async (query) => {
    capturedQuery = query;
    return { rows: [] };
  });

  try {
    await harness.repository.getMswdoAnomalyTracking({
      barangayId: "barangay-a",
      limit: 50,
    });

    assert.match(capturedQuery, /error_barangay_attribution AS/);
    assert.match(capturedQuery, /el\.module_name IN \('distribution', 'stubs'\)/);
    assert.match(capturedQuery, /LEFT JOIN stubs s_error\s+ON el\.reference_type = 'STUB'\s+AND s_error\.id = el\.reference_id/);
    assert.match(capturedQuery, /LEFT JOIN households h_error\s+ON h_error\.id = s_error\.household_id/);
    assert.match(capturedQuery, /r_barangay\.code = 'BARANGAY'/);
    assert.match(capturedQuery, /r_other\.code IN \('MSWDO', 'MAYOR'\)/);
    assert.match(capturedQuery, /LEFT JOIN error_barangay_attribution eba\s+ON eba\.error_log_id = el\.id/);
    assert.match(capturedQuery, /DUPLICATE_CLAIM_ATTEMPT/);
    assert.match(capturedQuery, /FAILED_STUB_OR_QR_VERIFICATION/);
  } finally {
    harness.restore();
  }
});

test("H01-06 through H01-14 Barangay scoping uses barangay_id and event-scoped unattributable logs stay hidden", async () => {
  let capturedQuery = "";
  let capturedValues = [];
  const harness = loadRepositoryWithMockPool(async (query, values) => {
    capturedQuery = query;
    capturedValues = values;
    return { rows: [] };
  });

  try {
    await harness.repository.getMswdoAnomalyTracking({
      disasterEventId: "event-1",
      barangayId: "barangay-a",
      limit: 100,
    });

    assert.match(capturedQuery, /WHERE barangay_id = \$2/);
    assert.doesNotMatch(capturedQuery, /barangay_name IS NOT NULL/);
    assert.match(capturedQuery, /AND sba\.disaster_event_id = \$1/);
    assert.match(capturedQuery, /AND eba\.disaster_event_id = \$1/);
    assert.doesNotMatch(capturedQuery, /AND FALSE/);
    assert.deepEqual(capturedValues.slice(0, 2), ["event-1", "barangay-a"]);
  } finally {
    harness.restore();
  }
});

test("ANOMSRC-01/02/03 suspicious distribution is grouped by household and disaster event", async () => {
  let capturedQuery = "";
  const harness = loadRepositoryWithMockPool(async (query) => {
    capturedQuery = query;
    return { rows: [] };
  });

  try {
    await harness.repository.getMswdoAnomalyTracking({
      limit: 20,
    });

    assert.match(capturedQuery, /CONCAT\(dt\.household_id::text, ':', dt\.disaster_event_id::text\) AS reference_id/);
    assert.match(capturedQuery, /GROUP BY[\s\S]*dt\.household_id,[\s\S]*dt\.disaster_event_id/);
    assert.match(capturedQuery, /HAVING COUNT\(\*\) > 1/);
    assert.doesNotMatch(capturedQuery, /COUNT\(\*\) OVER \(PARTITION BY dt\.household_id, dt\.disaster_event_id\)/);
  } finally {
    harness.restore();
  }
});

test("ANOMSRC-04/05 error-log anomalies use structured codes and stub references", async () => {
  let capturedQuery = "";
  const harness = loadRepositoryWithMockPool(async (query) => {
    capturedQuery = query;
    return { rows: [] };
  });

  try {
    await harness.repository.getMswdoAnomalyTracking({
      disasterEventId: "event-1",
      barangayId: "barangay-a",
      limit: 20,
    });

    assert.match(capturedQuery, /el\.error_code = 'STUB_ALREADY_CLAIMED'/);
    assert.match(capturedQuery, /el\.error_code IN \([\s\S]*'INVALID_QR_STUB'[\s\S]*'STUB_NOT_FOUND'[\s\S]*'QR_REFERENCE_MISMATCH'[\s\S]*'QR_INACTIVE'[\s\S]*'STUB_NOT_CLAIMABLE'[\s\S]*'STUB_CANCELLED'[\s\S]*'STUB_VOID'[\s\S]*'STUB_UNAVAILABLE'[\s\S]*\)/);
    assert.doesNotMatch(capturedQuery, /ILIKE '%already claimed%'/);
    assert.doesNotMatch(capturedQuery, /ILIKE '%stub not found%'/);
    assert.match(capturedQuery, /LEFT JOIN disaster_events de\s+ON de\.id = eba\.disaster_event_id/);
  } finally {
    harness.restore();
  }
});
