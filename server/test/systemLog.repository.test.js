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

test("getAuditLogs includes finalized distribution claim audit rows", async () => {
  let capturedQuery = "";

  await withMockPool(
    async (query) => {
      capturedQuery = query;
      return { rows: [] };
    },
    async ({ getAuditLogs }) => {
      await getAuditLogs({ limit: "all" });
    },
  );

  assert.match(capturedQuery, /distribution_transactions dt_direct/);
  assert.match(capturedQuery, /distribution_transaction_items dti_distribution/);
  assert.match(capturedQuery, /DISTRIBUTION_RECORD/);
  assert.match(capturedQuery, /DISTRIBUTION_QR_CLAIM/);
  assert.match(capturedQuery, /distribution_items_json/);
});

test("getAuditLogs applies five-year retention and page offset", async () => {
  let capturedQuery = "";
  let capturedValues = [];

  await withMockPool(
    async (query, values) => {
      capturedQuery = query;
      capturedValues = values;
      return { rows: [] };
    },
    async ({ getAuditLogs }) => {
      await getAuditLogs({ limit: 50, page: 3 });
    },
  );

  assert.match(capturedQuery, /COUNT\(\*\) OVER\(\) AS total_count/);
  assert.match(capturedQuery, /AS inventory_count/);
  assert.match(capturedQuery, /AS relief_pack_count/);
  assert.match(capturedQuery, /AS donation_count/);
  assert.match(capturedQuery, /AS distribution_count/);
  assert.match(capturedQuery, /NOW\(\) - INTERVAL '5 years'/);
  assert.match(capturedQuery, /ORDER BY al\.created_at DESC, al\.id DESC/);
  assert.match(capturedQuery, /LIMIT \$1 OFFSET \$2/);
  assert.deepEqual(capturedValues, [50, 100]);
});

test("getAuditLogs searches audit, user, record, and value fields before paging", async () => {
  let capturedQuery = "";
  let capturedValues = [];

  await withMockPool(
    async (query, values) => {
      capturedQuery = query;
      capturedValues = values;
      return { rows: [] };
    },
    async ({ getAuditLogs }) => {
      await getAuditLogs({ limit: 50, page: 1, search: "rice" });
    },
  );

  assert.match(capturedQuery, /al\.action ILIKE \$1/);
  assert.match(capturedQuery, /u\.email ILIKE \$1/);
  assert.match(capturedQuery, /ii_direct\.item_name ILIKE \$1/);
  assert.match(capturedQuery, /ii_direct\.barcode ILIKE \$1/);
  assert.match(capturedQuery, /d_direct\.donor_name ILIKE \$1/);
  assert.match(capturedQuery, /al\.new_values_json::text ILIKE \$1/);
  assert.match(capturedQuery, /LIMIT \$2 OFFSET \$3/);
  assert.deepEqual(capturedValues, ["%rice%", 50, 0]);
});

test("getAuditLogs applies module filter before paging", async () => {
  let capturedQuery = "";
  let capturedValues = [];

  await withMockPool(
    async (query, values) => {
      capturedQuery = query;
      capturedValues = values;
      return { rows: [] };
    },
    async ({ getAuditLogs }) => {
      await getAuditLogs({ limit: 50, module: "Donation", page: 2 });
    },
  );

  assert.match(capturedQuery, /al\.entity_type IN \('DONATION', 'DONATION_ITEM'\)/);
  assert.match(capturedQuery, /it_direct\.reference_type = 'DONATION'/);
  assert.match(capturedQuery, /LIMIT \$1 OFFSET \$2/);
  assert.deepEqual(capturedValues, [50, 50]);
});

test("getAuditLogs applies audit action filter before paging", async () => {
  let capturedQuery = "";
  let capturedValues = [];

  await withMockPool(
    async (query, values) => {
      capturedQuery = query;
      capturedValues = values;
      return { rows: [] };
    },
    async ({ getAuditLogs }) => {
      await getAuditLogs({
        auditAction: "relief_pack_details_edited",
        limit: 50,
        page: 1,
      });
    },
  );

  assert.match(capturedQuery, /RELIEF_PACK_TEMPLATE_UPDATE/);
  assert.match(capturedQuery, /RELIEF_PACK_TEMPLATE_UPDATED/);
  assert.match(capturedQuery, /RELIEF_PACK_TEMPLATE_ITEMS_UPDATED/);
  assert.match(capturedQuery, /LIMIT \$1 OFFSET \$2/);
  assert.deepEqual(capturedValues, [50, 0]);
});

test("getAuditLogs applies inclusive date range filter before paging", async () => {
  let capturedQuery = "";
  let capturedValues = [];

  await withMockPool(
    async (query, values) => {
      capturedQuery = query;
      capturedValues = values;
      return { rows: [] };
    },
    async ({ getAuditLogs }) => {
      await getAuditLogs({
        dateFrom: "2026-08-01",
        dateTo: "2026-08-11",
        limit: 50,
        page: 1,
      });
    },
  );

  assert.match(
    capturedQuery,
    /COALESCE\(dt_direct\.distribution_date, al\.created_at\) >= \$1::date/,
  );
  assert.match(
    capturedQuery,
    /COALESCE\(dt_direct\.distribution_date, al\.created_at\) < \(\$2::date \+ INTERVAL '1 day'\)/,
  );
  assert.match(capturedQuery, /LIMIT \$3 OFFSET \$4/);
  assert.deepEqual(capturedValues, ["2026-08-01", "2026-08-11", 50, 0]);
});
