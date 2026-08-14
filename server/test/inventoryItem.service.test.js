const test = require("node:test");
const assert = require("node:assert/strict");

const servicePath = require.resolve("../src/services/inventoryItem.service");
const dbPath = require.resolve("../src/config/db");
const inventoryItemRepositoryPath = require.resolve(
  "../src/repositories/inventoryItem.repository",
);
const inventoryItemStockFormRepositoryPath = require.resolve(
  "../src/repositories/inventoryItemStockForm.repository",
);
const inventoryBatchRepositoryPath = require.resolve(
  "../src/repositories/inventoryBatch.repository",
);
const inventoryTransactionRepositoryPath = require.resolve(
  "../src/repositories/inventoryTransaction.repository",
);
const forecastRepositoryPath = require.resolve("../src/repositories/forecast.repository");
const systemLogRepositoryPath = require.resolve("../src/repositories/systemLog.repository");
const inventoryItemExportPath = require.resolve("../src/utils/inventoryItemExport");
const inventoryStateBasisPath = require.resolve("../src/utils/inventoryStateBasis");
const mayorReportExportPath = require.resolve("../src/utils/mayorReportExport");
const systemLogPath = require.resolve("../src/utils/systemLog");

const dependencyPaths = [
  dbPath,
  inventoryItemRepositoryPath,
  inventoryItemStockFormRepositoryPath,
  inventoryBatchRepositoryPath,
  inventoryTransactionRepositoryPath,
  forecastRepositoryPath,
  systemLogRepositoryPath,
  inventoryItemExportPath,
  inventoryStateBasisPath,
  mayorReportExportPath,
  systemLogPath,
];

const withStubbedInventoryItemService = async (stubs, runTest) => {
  const originalEntries = new Map(
    dependencyPaths.map((modulePath) => [modulePath, require.cache[modulePath]]),
  );

  delete require.cache[servicePath];

  try {
    dependencyPaths.forEach((modulePath) => {
      require.cache[modulePath] = {
        id: modulePath,
        filename: modulePath,
        loaded: true,
        exports: stubs[modulePath] || {},
      };
    });

    const service = require(servicePath);
    await runTest(service);
  } finally {
    delete require.cache[servicePath];

    dependencyPaths.forEach((modulePath) => {
      const originalEntry = originalEntries.get(modulePath);

      if (originalEntry) {
        require.cache[modulePath] = originalEntry;
      } else {
        delete require.cache[modulePath];
      }
    });
  }
};

const buildInventoryItemPayload = (overrides = {}) => ({
  item_name: "Century Tuna Flakes in Oil - Test",
  barcode: "TEST-748485100081",
  category: "perishable",
  expiration_date: "2027-08-14",
  packaging: "piece",
  packaging_count: "100",
  quantity: "1",
  reorder_level: "50",
  unit_of_measure: "pc",
  unit_of_measure_value: "1",
  is_perishable: true,
  is_active: true,
  ...overrides,
});

const buildServiceStubs = (overrides = {}) => {
  const events = [];
  const calls = {
    insertedItem: null,
    insertedStockForm: null,
    insertedBatch: null,
    insertedTransaction: null,
  };

  const client = {
    query: async (sql) => {
      events.push(sql);
      return { rows: [] };
    },
    release: () => {
      events.push("RELEASE");
    },
  };

  const stubs = {
    [dbPath]: {
      connect: async () => client,
    },
    [inventoryItemRepositoryPath]: {
      getInventoryItemByCode: async () => null,
      getInventoryItemByName: async () => null,
      insertInventoryItem: async (itemData) => {
        calls.insertedItem = itemData;

        return {
          id: "item-created",
          ...itemData,
        };
      },
    },
    [inventoryItemStockFormRepositoryPath]: {
      insertInventoryItemStockForm: async (stockFormData) => {
        calls.insertedStockForm = stockFormData;

        return {
          id: "stock-form-created",
          ...stockFormData,
        };
      },
      getInventoryItemStockFormsByItemId: async () => [],
    },
    [inventoryBatchRepositoryPath]: {
      insertInventoryBatch: async (batchData) => {
        calls.insertedBatch = batchData;

        return {
          id: "batch-created",
          ...batchData,
        };
      },
    },
    [inventoryTransactionRepositoryPath]: {
      insertInventoryTransaction: async (transactionData) => {
        calls.insertedTransaction = transactionData;

        return {
          id: "transaction-created",
          ...transactionData,
        };
      },
    },
    [forecastRepositoryPath]: {},
    [systemLogRepositoryPath]: {},
    [inventoryItemExportPath]: {},
    [inventoryStateBasisPath]: {
      createInventoryStateBasis: () => ({ basisVersion: 1 }),
    },
    [mayorReportExportPath]: {
      formatDateOnly: () => "",
      formatDateTime: () => "",
      buildExportFile: () => ({}),
      ALLOWED_EXPORT_FORMATS: ["csv", "excel", "pdf"],
    },
    [systemLogPath]: {
      logAuditSafely: async () => {},
      pickDefined: (value, keys) =>
        keys.reduce((picked, key) => {
          if (value[key] !== undefined) {
            picked[key] = value[key];
          }
          return picked;
        }, {}),
    },
  };

  return {
    events,
    calls,
    stubs: Object.fromEntries(
      Object.entries(stubs).map(([modulePath, exportsValue]) => [
        modulePath,
        {
          ...exportsValue,
          ...(overrides[modulePath] || {}),
        },
      ]),
    ),
  };
};

test("createInventoryItem creates opening stock batch and transaction with Mayor add-item payload", async () => {
  const { events, calls, stubs } = buildServiceStubs();

  await withStubbedInventoryItemService(stubs, async ({ createInventoryItem }) => {
    const item = await createInventoryItem(
      buildInventoryItemPayload(),
      { userId: "mayor-user-1", roleCode: "MAYOR" },
    );

    assert.equal(item.id, "item-created");
  });

  assert.deepEqual(events, ["BEGIN", "COMMIT", "RELEASE"]);
  assert.equal(calls.insertedItem.barcode, "TEST-748485100081");
  assert.equal(calls.insertedItem.expiration_date, "2027-08-14");
  assert.equal(calls.insertedItem.packaging, "piece");
  assert.equal(calls.insertedItem.packaging_count, "100");
  assert.equal(calls.insertedItem.quantity, "1");
  assert.equal(calls.insertedItem.reorder_level, "50");
  assert.equal(calls.insertedItem.unit_of_measure, "pc");
  assert.equal(calls.insertedItem.unit_of_measure_value, "1");

  assert.equal(calls.insertedStockForm.inventory_item_id, "item-created");
  assert.equal(calls.insertedStockForm.barcode, "TEST-748485100081");
  assert.equal(calls.insertedStockForm.packaging, "piece");
  assert.equal(calls.insertedStockForm.units_per_packaging, 1);
  assert.equal(calls.insertedStockForm.unit_of_measure, "pc");
  assert.equal(calls.insertedStockForm.unit_of_measure_value, "1");

  assert.equal(calls.insertedBatch.inventory_item_id, "item-created");
  assert.equal(calls.insertedBatch.inventory_item_stock_form_id, "stock-form-created");
  assert.match(calls.insertedBatch.batch_no, /^INV-CENTURY-TUNA-FLAKES-IN-O-001-OPEN-/);
  assert.equal(calls.insertedBatch.quantity_received, 100);
  assert.equal(calls.insertedBatch.quantity_available, 100);
  assert.equal(calls.insertedBatch.expiration_date, "2027-08-14");
  assert.equal(calls.insertedBatch.storage_location, "Mayor's Office Inventory");
  assert.equal(calls.insertedBatch.status, "AVAILABLE");
  assert.equal(calls.insertedBatch.created_by, "mayor-user-1");

  assert.equal(calls.insertedTransaction.inventory_batch_id, "batch-created");
  assert.equal(calls.insertedTransaction.transaction_type, "INFLOW");
  assert.equal(calls.insertedTransaction.quantity, 100);
  assert.equal(calls.insertedTransaction.reference_type, "MANUAL");
  assert.equal(calls.insertedTransaction.reference_id, "item-created");
  assert.equal(calls.insertedTransaction.performed_by, "mayor-user-1");
  assert.equal(
    calls.insertedTransaction.remarks,
    "Opening stock recorded during inventory item creation",
  );
});

test("createInventoryItem rolls back when opening batch persistence fails", async () => {
  const { events, calls, stubs } = buildServiceStubs({
    [inventoryBatchRepositoryPath]: {
      insertInventoryBatch: async (batchData) => {
        calls.insertedBatch = batchData;
        throw new Error("batch insert failed");
      },
    },
    [inventoryTransactionRepositoryPath]: {
      insertInventoryTransaction: async () => {
        throw new Error("transaction insert must not run after batch failure");
      },
    },
  });

  await withStubbedInventoryItemService(stubs, async ({ createInventoryItem }) => {
    await assert.rejects(
      createInventoryItem(
        buildInventoryItemPayload({ item_name: "Rollback Tuna Test" }),
        { userId: "mayor-user-1", roleCode: "MAYOR" },
      ),
      /batch insert failed/,
    );
  });

  assert.equal(calls.insertedItem.item_name, "Rollback Tuna Test");
  assert.equal(calls.insertedStockForm.inventory_item_id, "item-created");
  assert.equal(calls.insertedBatch.created_by, "mayor-user-1");
  assert.deepEqual(events, ["BEGIN", "ROLLBACK", "RELEASE"]);
});

test("createInventoryItem with skip_opening_stock does not create opening batch or transaction", async () => {
  const { events, calls, stubs } = buildServiceStubs({
    [inventoryBatchRepositoryPath]: {
      insertInventoryBatch: async () => {
        throw new Error("opening batch must not be created when skipped");
      },
    },
    [inventoryTransactionRepositoryPath]: {
      insertInventoryTransaction: async () => {
        throw new Error("opening transaction must not be created when skipped");
      },
    },
  });

  await withStubbedInventoryItemService(stubs, async ({ createInventoryItem }) => {
    const item = await createInventoryItem(
      buildInventoryItemPayload({
        item_name: "No Opening Stock Test",
        skip_opening_stock: true,
      }),
      { userId: "mayor-user-1", roleCode: "MAYOR" },
    );

    assert.equal(item.id, "item-created");
  });

  assert.equal(calls.insertedBatch, null);
  assert.equal(calls.insertedTransaction, null);
  assert.deepEqual(events, ["BEGIN", "COMMIT", "RELEASE"]);
});
