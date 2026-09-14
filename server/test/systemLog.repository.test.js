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
  assert.match(capturedQuery, /FROM audit_logs transaction_audit/);
  assert.match(capturedQuery, /transaction_audit\.new_values_json->>'inventory_batch_id'/);
  assert.match(capturedQuery, /transaction_audit\.new_values_json->>'reference_type'/);
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
  assert.doesNotMatch(capturedQuery, /stock_adjusted/i);
  assert.doesNotMatch(capturedQuery, /THEN 'stock adjusted'/i);
  assert.deepEqual(capturedValues, [50, 100]);
});

test("getInventoryItemCreationRelatedAuditLogs loads opening stock records", async () => {
  let capturedQuery = "";
  let capturedValues = [];

  await withMockPool(
    async (query, values) => {
      capturedQuery = query;
      capturedValues = values;
      return { rows: [] };
    },
    async ({ getInventoryItemCreationRelatedAuditLogs }) => {
      await getInventoryItemCreationRelatedAuditLogs({
        itemIds: ["item-1", "item-1"],
      });
    },
  );

  assert.match(capturedQuery, /INVENTORY_ITEM_STOCK_FORM_CREATE/);
  assert.match(capturedQuery, /INVENTORY_BATCH_CREATE/);
  assert.match(capturedQuery, /INVENTORY_TRANSACTION_CREATE/);
  assert.match(capturedQuery, /related_inventory_item_id/);
  assert.match(capturedQuery, /COALESCE\([\s\S]*<> 'DONATION'/);
  assert.deepEqual(capturedValues, [["item-1"]]);
});

test("getInventoryPackagingAddedRelatedAuditLogs loads the new packaging opening stock", async () => {
  let capturedQuery = "";
  let capturedValues = [];

  await withMockPool(
    async (query, values) => {
      capturedQuery = query;
      capturedValues = values;
      return { rows: [] };
    },
    async ({ getInventoryPackagingAddedRelatedAuditLogs }) => {
      await getInventoryPackagingAddedRelatedAuditLogs({
        stockFormIds: ["stock-form-1", "stock-form-1"],
      });
    },
  );

  assert.match(capturedQuery, /INVENTORY_BATCH_CREATE/);
  assert.match(capturedQuery, /INVENTORY_TRANSACTION_CREATE/);
  assert.match(capturedQuery, /related_inventory_item_stock_form_id/);
  assert.match(capturedQuery, /transaction_type.*= 'INFLOW'/);
  assert.deepEqual(capturedValues, [["stock-form-1"]]);
});

test("getAuditLogs searches user-facing audit fields before paging", async () => {
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

  assert.match(capturedQuery, /CASE[\s\S]*THEN 'item created'[\s\S]*END ILIKE \$1/);
  assert.match(capturedQuery, /u\.email ILIKE \$1/);
  assert.match(capturedQuery, /ii_direct\.item_name ILIKE \$1/);
  assert.match(capturedQuery, /ii_stock_form\.item_name ILIKE \$1/);
  assert.match(capturedQuery, /ib_direct\.batch_no ILIKE \$1/);
  assert.match(capturedQuery, /rpt_direct\.name ILIKE \$1/);
  assert.match(capturedQuery, /d_direct\.donor_name ILIKE \$1/);
  assert.match(capturedQuery, /donated stock added/);
  assert.match(capturedQuery, /donated stock removed/);
  assert.doesNotMatch(capturedQuery, /al\.action ILIKE \$1/);
  assert.doesNotMatch(capturedQuery, /barcode ILIKE \$1/);
  assert.doesNotMatch(capturedQuery, /al\.new_values_json::text ILIKE \$1/);
  assert.match(capturedQuery, /LIMIT \$2 OFFSET \$3/);
  assert.deepEqual(capturedValues, ["%rice%", 50, 0]);
});

test("getAuditLogs includes related stock and sync audit records", async () => {
  let capturedQuery = "";

  await withMockPool(
    async (query) => {
      capturedQuery = query;
      return { rows: [] };
    },
    async ({ getAuditLogs }) => {
      await getAuditLogs({
        auditAction: "donation_details_edited",
        module: "Sync",
        limit: "all",
      });
    },
  );

  assert.match(capturedQuery, /INVENTORY_ITEM_STOCK_FORM/);
  assert.match(capturedQuery, /SYNC_CONFLICT/);
  assert.match(capturedQuery, /SYNC_TRANSACTION/);
  assert.match(capturedQuery, /DONATION/);
  assert.match(capturedQuery, /DONATION_ITEM_UPDATE/);
  assert.match(capturedQuery, /it_direct\.reference_type = 'DONATION'/);
  assert.match(capturedQuery, /COALESCE\(it_direct\.reference_type, ''\) <> 'DONATION'/);
  assert.doesNotMatch(capturedQuery, /rpt_direct\.is_active = TRUE/);
  assert.doesNotMatch(capturedQuery, /dt_direct\.distribution_status = 'CLAIMED'/);
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

test("getAuditLogs filters Packaging Added to additional packaging records", async () => {
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
        auditAction: "packaging_added",
        limit: 50,
        page: 1,
      });
    },
  );

  assert.match(capturedQuery, /INVENTORY_ITEM_STOCK_FORM_CREATE/);
  assert.match(capturedQuery, /is_additional_packaging.*'true'/);
  assert.match(capturedQuery, /NOT \([\s\S]*is_additional_packaging/);
  assert.deepEqual(capturedValues, [50, 0]);
});

test("getAuditLogs includes write-offs for both inventory sources", async () => {
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
        auditAction: "written_off",
        limit: 50,
        page: 1,
      });
    },
  );

  assert.match(capturedQuery, /al\.entity_type = 'INVENTORY_TRANSACTION'/);
  assert.match(capturedQuery, /al\.new_values_json->>'transaction_type' IN \(/);
  assert.match(capturedQuery, /'EXPIRED'/);
  assert.match(capturedQuery, /'DAMAGED'/);
  assert.match(capturedQuery, /'OTHER'/);
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
