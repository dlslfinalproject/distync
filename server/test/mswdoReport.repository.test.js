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

const extractOrderBy = (query) =>
  query.match(/ORDER BY([\s\S]*?)LIMIT/)?.[1].replace(/\s+/g, " ").trim() || "";

const captureAnomalyRepositoryCall = async (filters = {}, countRows = [{ total_items: 0 }]) => {
  const capturedQueries = [];
  const capturedValues = [];
  const harness = loadRepositoryWithMockPool(async (query, values) => {
    capturedQueries.push(query);
    capturedValues.push(values);

    if (/COUNT\(\*\)::int AS total_items/.test(query)) {
      return { rows: countRows };
    }

    return { rows: [] };
  });

  try {
    const result = await harness.repository.getMswdoAnomalyTracking(filters);
    return { capturedQueries, capturedValues, result };
  } finally {
    harness.restore();
  }
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
    assert.equal(capturedValues.at(-2), 25);
    assert.equal(capturedValues.at(-1), 0);
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

test("M05 server pagination counts filtered anomalies before applying limit and offset", async () => {
  const capturedQueries = [];
  const capturedValues = [];
  const harness = loadRepositoryWithMockPool(async (query, values) => {
    capturedQueries.push(query);
    capturedValues.push(values);

    if (/COUNT\(\*\)::int AS total_items/.test(query)) {
      return { rows: [{ total_items: 101 }] };
    }

    return {
      rows: [
        {
          anomaly_type: "SYNC_CONFLICT",
          reference_id: "conflict-51",
          occurred_at: "2026-08-08T10:00:00.000Z",
        },
      ],
    };
  });

  try {
    const result = await harness.repository.getMswdoAnomalyTracking({
      disasterEventId: "event-1",
      barangayId: "barangay-a",
      anomalyType: "SYNC_CONFLICT",
      statusCategory: "open",
      search: "claim",
      order: "newest",
      page: 2,
      pageSize: 50,
    });

    assert.equal(capturedQueries.length, 2);
    assert.match(capturedQueries[0], /FROM filtered_anomalies/);
    assert.doesNotMatch(capturedQueries[0], /LIMIT/);
    assert.match(capturedQueries[1], /ORDER BY[\s\S]*occurred_at DESC NULLS LAST[\s\S]*anomaly_type ASC[\s\S]*reference_id ASC NULLS LAST[\s\S]*source_type ASC[\s\S]*source_id ASC/);
    assert.match(capturedQueries[1], /LIMIT \$6\s+OFFSET \$7/);
    assert.match(capturedQueries[1], /anomaly_rows AS/);
    assert.match(capturedQueries[1], /filtered_anomalies AS/);
    assert.match(capturedQueries[1], /anomaly_type = \$3/);
    assert.match(capturedQueries[1], /END = \$4/);
    assert.match(capturedQueries[1], /ILIKE \$5/);
    assert.deepEqual(capturedValues[1], [
      "event-1",
      "barangay-a",
      "SYNC_CONFLICT",
      "open",
      "%claim%",
      50,
      50,
    ]);
    assert.deepEqual(result.pagination, {
      page: 2,
      pageSize: 50,
      totalItems: 101,
      totalPages: 3,
      hasPreviousPage: true,
      hasNextPage: true,
    });
    assert.equal(result.items[0].reference_id, "conflict-51");
  } finally {
    harness.restore();
  }
});

test("M05-04/M05F-01 tied timestamp/type/reference rows use source identity after reference_id", async () => {
  let itemQuery = "";
  const harness = loadRepositoryWithMockPool(async (query) => {
    if (/COUNT\(\*\)::int AS total_items/.test(query)) {
      return { rows: [{ total_items: 3 }] };
    }

    itemQuery = query;
    return {
      rows: [
        {
          anomaly_type: "DUPLICATE_CLAIM_ATTEMPT",
          reference_id: "same-stub-reference",
          occurred_at: "2026-08-08T10:00:00.000Z",
        },
        {
          anomaly_type: "DUPLICATE_CLAIM_ATTEMPT",
          reference_id: "same-stub-reference",
          occurred_at: "2026-08-08T10:00:00.000Z",
        },
        {
          anomaly_type: "DUPLICATE_CLAIM_ATTEMPT",
          reference_id: "same-stub-reference",
          occurred_at: "2026-08-08T10:00:00.000Z",
        },
      ],
    };
  });

  try {
    await harness.repository.getMswdoAnomalyTracking({
      order: "newest",
      page: 1,
      pageSize: 3,
    });

    assert.match(itemQuery, /'ERROR_LOG' AS source_type/);
    assert.match(itemQuery, /el\.id::text AS source_id/);
    assert.match(itemQuery, /reference_id ASC NULLS LAST[\s\S]*source_type ASC[\s\S]*source_id ASC/);
  } finally {
    harness.restore();
  }
});

test("M05F-02 repeated deterministic query keeps the same server-owned ORDER BY", async () => {
  const itemQueries = [];
  const harness = loadRepositoryWithMockPool(async (query) => {
    if (/COUNT\(\*\)::int AS total_items/.test(query)) {
      return { rows: [{ total_items: 3 }] };
    }

    itemQueries.push(query);
    return { rows: [] };
  });

  try {
    await harness.repository.getMswdoAnomalyTracking({ order: "newest", page: 1, pageSize: 2 });
    await harness.repository.getMswdoAnomalyTracking({ order: "newest", page: 1, pageSize: 2 });

    const normalizedOrderBy = itemQueries.map((query) =>
      query.match(/ORDER BY([\s\S]*?)LIMIT/)?.[1].replace(/\s+/g, " ").trim(),
    );

    assert.equal(normalizedOrderBy[0], normalizedOrderBy[1]);
    assert.match(normalizedOrderBy[0], /source_type ASC, source_id ASC/);
  } finally {
    harness.restore();
  }
});

test("M05F-03 page-boundary ties use the same source identity with LIMIT and OFFSET", async () => {
  let itemQuery = "";
  let itemValues = [];
  const harness = loadRepositoryWithMockPool(async (query, values) => {
    if (/COUNT\(\*\)::int AS total_items/.test(query)) {
      return { rows: [{ total_items: 3 }] };
    }

    itemQuery = query;
    itemValues = values;
    return { rows: [] };
  });

  try {
    await harness.repository.getMswdoAnomalyTracking({ order: "newest", page: 2, pageSize: 2 });

    assert.match(itemQuery, /ORDER BY[\s\S]*source_type ASC[\s\S]*source_id ASC[\s\S]*LIMIT \$1\s+OFFSET \$2/);
    assert.deepEqual(itemValues, [2, 2]);
  } finally {
    harness.restore();
  }
});

test("M05F-04 same reference_id rows remain separate because error log source IDs are distinct", async () => {
  let itemQuery = "";
  const harness = loadRepositoryWithMockPool(async (query) => {
    if (/COUNT\(\*\)::int AS total_items/.test(query)) {
      return { rows: [{ total_items: 2 }] };
    }

    itemQuery = query;
    return {
      rows: [
        { anomaly_type: "DUPLICATE_CLAIM_ATTEMPT", reference_id: "stub-s", occurred_at: "2026-08-08T10:00:00.000Z" },
        { anomaly_type: "DUPLICATE_CLAIM_ATTEMPT", reference_id: "stub-s", occurred_at: "2026-08-08T10:00:00.000Z" },
      ],
    };
  });

  try {
    const result = await harness.repository.getMswdoAnomalyTracking({
      anomalyType: "DUPLICATE_CLAIM_ATTEMPT",
      order: "newest",
      page: 1,
      pageSize: 2,
    });

    assert.equal(result.items.length, 2);
    assert.match(itemQuery, /SELECT \* FROM duplicate_claim_attempts/);
    assert.match(itemQuery, /el\.id::text AS source_id/);
    assert.match(itemQuery, /source_type ASC[\s\S]*source_id ASC/);
  } finally {
    harness.restore();
  }
});

test("M05F-05 null reference_id ties still end with non-null source identity ordering", async () => {
  let itemQuery = "";
  const harness = loadRepositoryWithMockPool(async (query) => {
    if (/COUNT\(\*\)::int AS total_items/.test(query)) {
      return { rows: [{ total_items: 2 }] };
    }

    itemQuery = query;
    return {
      rows: [
        { anomaly_type: "SYNC_FAILED", reference_id: null, occurred_at: "2026-08-08T10:00:00.000Z" },
        { anomaly_type: "SYNC_FAILED", reference_id: null, occurred_at: "2026-08-08T10:00:00.000Z" },
      ],
    };
  });

  try {
    await harness.repository.getMswdoAnomalyTracking({ order: "newest", page: 1, pageSize: 2 });

    assert.match(itemQuery, /reference_id ASC NULLS LAST/);
    assert.match(itemQuery, /st\.id::text AS source_id/);
    assert.match(itemQuery, /source_type ASC[\s\S]*source_id ASC/);
  } finally {
    harness.restore();
  }
});

test("M05F-06 every allowlisted sort mode includes the stable source tie-breaker", async () => {
  const itemQueriesByOrder = new Map();
  const harness = loadRepositoryWithMockPool(async (query) => {
    if (/COUNT\(\*\)::int AS total_items/.test(query)) {
      return { rows: [{ total_items: 1 }] };
    }

    const orderBy = query.match(/ORDER BY([\s\S]*?)LIMIT/)?.[1] || "";
    itemQueriesByOrder.set(itemQueriesByOrder.size, orderBy);
    return { rows: [] };
  });

  try {
    for (const order of ["newest", "oldest", "az", "za"]) {
      await harness.repository.getMswdoAnomalyTracking({ order, page: 1, pageSize: 1 });
    }

    for (const orderBy of itemQueriesByOrder.values()) {
      assert.match(orderBy, /reference_id ASC NULLS LAST/);
      assert.match(orderBy, /source_type ASC/);
      assert.match(orderBy, /source_id ASC/);
    }
  } finally {
    harness.restore();
  }
});

test("M05F-07 source_type distinguishes source_id values that could collide across sources", async () => {
  let itemQuery = "";
  const harness = loadRepositoryWithMockPool(async (query) => {
    if (/COUNT\(\*\)::int AS total_items/.test(query)) {
      return { rows: [{ total_items: 2 }] };
    }

    itemQuery = query;
    return { rows: [] };
  });

  try {
    await harness.repository.getMswdoAnomalyTracking({ order: "newest", page: 1, pageSize: 2 });

    assert.match(itemQuery, /'SYNC_TRANSACTION' AS source_type[\s\S]*st\.id::text AS source_id/);
    assert.match(itemQuery, /'SYNC_CONFLICT' AS source_type[\s\S]*sc\.id::text AS source_id/);
    assert.match(itemQuery, /source_type ASC[\s\S]*source_id ASC/);
  } finally {
    harness.restore();
  }
});

test("M05F-08 source semantics stay unchanged while adding internal source identity", async () => {
  let itemQuery = "";
  const harness = loadRepositoryWithMockPool(async (query) => {
    if (/COUNT\(\*\)::int AS total_items/.test(query)) {
      return { rows: [{ total_items: 5 }] };
    }

    itemQuery = query;
    return { rows: [] };
  });

  try {
    await harness.repository.getMswdoAnomalyTracking({ page: 1, pageSize: 5 });

    assert.match(itemQuery, /GROUP BY[\s\S]*dt\.household_id,[\s\S]*dt\.disaster_event_id[\s\S]*HAVING COUNT\(\*\) > 1/);
    assert.match(itemQuery, /st\.sync_status = 'FAILED'/);
    assert.match(itemQuery, /sc\.status = 'OPEN'/);
    assert.match(itemQuery, /el\.error_code = 'STUB_ALREADY_CLAIMED'/);
    assert.match(itemQuery, /el\.error_code IN \(/);
    assert.equal((itemQuery.match(/UNION ALL/g) || []).length, 4);
  } finally {
    harness.restore();
  }
});

test("M05 out-of-range pagination returns empty items with scoped total metadata", async () => {
  const harness = loadRepositoryWithMockPool(async (query) => {
    if (/COUNT\(\*\)::int AS total_items/.test(query)) {
      return { rows: [{ total_items: 12 }] };
    }

    return { rows: [] };
  });

  try {
    const result = await harness.repository.getMswdoAnomalyTracking({
      barangayId: "barangay-a",
      page: 8,
      pageSize: 10,
    });

    assert.deepEqual(result.items, []);
    assert.deepEqual(result.pagination, {
      page: 8,
      pageSize: 10,
      totalItems: 12,
      totalPages: 2,
      hasPreviousPage: true,
      hasNextPage: false,
    });
  } finally {
    harness.restore();
  }
});

test("M05NULL-01 oldest keeps null occurred_at rows before dated rows in generated SQL", async () => {
  const { capturedQueries } = await captureAnomalyRepositoryCall({
    order: "oldest",
    page: 1,
    pageSize: 10,
  });

  const orderBy = extractOrderBy(capturedQueries[1]);

  assert.match(orderBy, /^occurred_at ASC NULLS FIRST/);
  assert.match(orderBy, /anomaly_type ASC/);
  assert.match(orderBy, /reference_id ASC NULLS LAST/);
  assert.match(orderBy, /source_type ASC, source_id ASC$/);
});

test("M05NULL-02 null timestamp ties still use source identity for deterministic order", async () => {
  const { capturedQueries } = await captureAnomalyRepositoryCall({
    order: "oldest",
    page: 1,
    pageSize: 3,
  });

  const itemQuery = capturedQueries[1];
  const orderBy = extractOrderBy(itemQuery);

  assert.match(orderBy, /occurred_at ASC NULLS FIRST/);
  assert.match(orderBy, /anomaly_type ASC, reference_id ASC NULLS LAST, source_type ASC, source_id ASC/);
  assert.match(itemQuery, /'ERROR_LOG' AS source_type[\s\S]*el\.id::text AS source_id/);
  assert.match(itemQuery, /'SYNC_TRANSACTION' AS source_type[\s\S]*st\.id::text AS source_id/);
});

test("M05NULL-03 null timestamp page boundaries retain stable ORDER BY with LIMIT and OFFSET", async () => {
  const { capturedQueries, capturedValues } = await captureAnomalyRepositoryCall(
    {
      order: "oldest",
      page: 2,
      pageSize: 2,
    },
    [{ total_items: 3 }],
  );

  const itemQuery = capturedQueries[1];

  assert.match(itemQuery, /ORDER BY[\s\S]*occurred_at ASC NULLS FIRST[\s\S]*source_type ASC[\s\S]*source_id ASC[\s\S]*LIMIT \$1\s+OFFSET \$2/);
  assert.deepEqual(capturedValues[1], [2, 2]);
});

test("M05NULL-04 non-null oldest chronology remains ascending", async () => {
  const { capturedQueries } = await captureAnomalyRepositoryCall({
    order: "oldest",
    page: 1,
    pageSize: 10,
  });

  const orderBy = extractOrderBy(capturedQueries[1]);

  assert.match(orderBy, /^occurred_at ASC NULLS FIRST/);
  assert.doesNotMatch(orderBy, /occurred_at DESC/);
});

test("M05NULL-05 newest ORDER BY remains unchanged", async () => {
  const { capturedQueries } = await captureAnomalyRepositoryCall({
    order: "newest",
    page: 1,
    pageSize: 10,
  });

  assert.equal(
    extractOrderBy(capturedQueries[1]),
    "occurred_at DESC NULLS LAST, anomaly_type ASC, reference_id ASC NULLS LAST, source_type ASC, source_id ASC",
  );
});

test("M05NULL-06 alphabetical ORDER BY clauses remain unchanged", async () => {
  const az = await captureAnomalyRepositoryCall({ order: "az", page: 1, pageSize: 10 });
  const za = await captureAnomalyRepositoryCall({ order: "za", page: 1, pageSize: 10 });

  assert.equal(
    extractOrderBy(az.capturedQueries[1]),
    "LOWER(CONCAT_WS(' ', disaster_event_title, family_head_name)) ASC, occurred_at DESC NULLS LAST, anomaly_type ASC, reference_id ASC NULLS LAST, source_type ASC, source_id ASC",
  );
  assert.equal(
    extractOrderBy(za.capturedQueries[1]),
    "LOWER(CONCAT_WS(' ', disaster_event_title, family_head_name)) DESC, occurred_at DESC NULLS LAST, anomaly_type ASC, reference_id ASC NULLS LAST, source_type ASC, source_id ASC",
  );
});

test("M05NULL-07 every sort mode terminates with source_type and source_id", async () => {
  for (const order of ["newest", "oldest", "az", "za"]) {
    const { capturedQueries } = await captureAnomalyRepositoryCall({
      order,
      page: 1,
      pageSize: 10,
    });

    assert.match(extractOrderBy(capturedQueries[1]), /source_type ASC, source_id ASC$/);
  }
});

test("M05NULL-08 source counts are produced from filtered anomalies before ordering", async () => {
  const { capturedQueries, result } = await captureAnomalyRepositoryCall(
    {
      order: "oldest",
      anomalyType: "SYNC_FAILED",
      page: 1,
      pageSize: 10,
    },
    [{ total_items: 5 }],
  );

  assert.match(capturedQueries[0], /SELECT COUNT\(\*\)::int AS total_items\s+FROM filtered_anomalies/);
  assert.doesNotMatch(capturedQueries[0], /ORDER BY/);
  assert.doesNotMatch(capturedQueries[0], /LIMIT/);
  assert.equal(result.pagination.totalItems, 5);
});

test("M05NULL-09 pagination metadata remains based on count and requested page", async () => {
  const { result } = await captureAnomalyRepositoryCall(
    {
      order: "oldest",
      page: 2,
      pageSize: 2,
    },
    [{ total_items: 3 }],
  );

  assert.deepEqual(result.pagination, {
    page: 2,
    pageSize: 2,
    totalItems: 3,
    totalPages: 2,
    hasPreviousPage: true,
    hasNextPage: false,
  });
});

test("M05NULL-10 Barangay authorization scope is unchanged by oldest null placement", async () => {
  const { capturedQueries, capturedValues } = await captureAnomalyRepositoryCall({
    disasterEventId: "event-1",
    barangayId: "barangay-a",
    order: "oldest",
    page: 1,
    pageSize: 10,
  });

  assert.match(capturedQueries[1], /WHERE barangay_id = \$2/);
  assert.match(capturedQueries[1], /AND sba\.disaster_event_id = \$1/);
  assert.match(capturedQueries[1], /AND eba\.disaster_event_id = \$1/);
  assert.deepEqual(capturedValues[1], ["event-1", "barangay-a", 10, 0]);
});
