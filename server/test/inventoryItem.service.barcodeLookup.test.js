const test = require("node:test");
const assert = require("node:assert/strict");

const servicePath = require.resolve("../src/services/inventoryItem.service");
const repositoryPath = require.resolve("../src/repositories/inventoryItem.repository");
const stockFormRepositoryPath = require.resolve(
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
const dbPath = require.resolve("../src/config/db");

const sampleItem = {
  id: "item-1",
  item_code: "INV-COLGATE-001",
  item_name: "Colgate Toothbrush",
  category: "Hygiene",
  unit_of_measure: "piece",
  unit_of_measure_value: null,
  packaging: "Single",
  packaging_count: 12,
  quantity: 1,
  reorder_level: 5,
  expiration_date: null,
  barcode: "8850006330449",
  is_perishable: false,
  is_active: true,
};

const withStubbedInventoryItemService = async (stubs, runTest) => {
  const dependencyPaths = [
    repositoryPath,
    stockFormRepositoryPath,
    inventoryBatchRepositoryPath,
    inventoryTransactionRepositoryPath,
    forecastRepositoryPath,
    systemLogRepositoryPath,
    inventoryItemExportPath,
    inventoryStateBasisPath,
    mayorReportExportPath,
    systemLogPath,
    dbPath,
  ];
  const originalEntries = new Map(
    dependencyPaths.map((modulePath) => [modulePath, require.cache[modulePath]]),
  );
  const originalFetch = global.fetch;

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

    if (stubs.fetch) {
      global.fetch = stubs.fetch;
    }

    const service = require(servicePath);
    await runTest(service);
  } finally {
    delete require.cache[servicePath];
    global.fetch = originalFetch;

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

const baseStubs = (overrides = {}) => ({
  [repositoryPath]: {
    getInventoryItemByBarcode: async () => null,
    getInventoryItemById: async () => sampleItem,
    ...overrides.inventoryItemRepository,
  },
  [stockFormRepositoryPath]: {
    getInventoryItemStockFormByBarcode: async () => null,
    getInventoryItemStockFormsByItemId: async () => [],
    ...overrides.stockFormRepository,
  },
  [inventoryBatchRepositoryPath]: {},
  [inventoryTransactionRepositoryPath]: {},
  [forecastRepositoryPath]: {},
  [systemLogRepositoryPath]: {},
  [inventoryItemExportPath]: {},
  [inventoryStateBasisPath]: {
    createInventoryStateBasis: () => ({}),
  },
  [mayorReportExportPath]: {},
  [systemLogPath]: {
    logAuditSafely: async () => {},
    pickDefined: (value) => value || {},
  },
  [dbPath]: {
    connect: async () => {
      throw new Error("Database connection should not be used by barcode lookup tests");
    },
  },
  fetch: overrides.fetch,
});

test("lookupInventoryItemByBarcode returns local inventory item before external lookup", async () => {
  let fetchCalled = false;

  await withStubbedInventoryItemService(
    baseStubs({
      inventoryItemRepository: {
        getInventoryItemByBarcode: async () => sampleItem,
      },
      fetch: async () => {
        fetchCalled = true;
        return {
          ok: false,
          json: async () => ({}),
        };
      },
    }),
    async ({ lookupInventoryItemByBarcode }) => {
      const result = await lookupInventoryItemByBarcode("8850006330449");

      assert.equal(result.found, true);
      assert.equal(result.source, "LOCAL_INVENTORY");
      assert.equal(result.item.item_name, "Colgate Toothbrush");
      assert.equal(result.item.barcode, "8850006330449");
      assert.equal(fetchCalled, false);
    },
  );
});

test("lookupInventoryItemByBarcode resolves stock-form barcode to its inventory item", async () => {
  const stockForm = {
    id: "stock-form-1",
    inventory_item_id: "item-1",
    barcode: "8850006330449",
    packaging: "Box",
    units_per_packaging: 12,
    unit_of_measure: "piece",
    unit_of_measure_value: null,
    is_active: true,
  };

  await withStubbedInventoryItemService(
    baseStubs({
      stockFormRepository: {
        getInventoryItemStockFormByBarcode: async () => stockForm,
      },
      fetch: async () => {
        throw new Error("External lookup should not run for local stock-form barcodes");
      },
    }),
    async ({ lookupInventoryItemByBarcode }) => {
      const result = await lookupInventoryItemByBarcode("8850006330449");

      assert.equal(result.found, true);
      assert.equal(result.source, "LOCAL_INVENTORY");
      assert.equal(result.item.item_name, "Colgate Toothbrush");
      assert.equal(result.item.packaging, "Box");
      assert.deepEqual(result.item.stock_form, {
        id: stockForm.id,
        barcode: stockForm.barcode,
        packaging: stockForm.packaging,
        units_per_packaging: stockForm.units_per_packaging,
        unit_of_measure: stockForm.unit_of_measure,
        unit_of_measure_value: stockForm.unit_of_measure_value,
        is_active: stockForm.is_active,
      });
    },
  );
});

test("lookupInventoryItemByBarcode falls back to the external catalog for unknown barcode", async () => {
  let fetchCalled = false;

  await withStubbedInventoryItemService(
    baseStubs({
      fetch: async () => {
        fetchCalled = true;
        return {
          ok: false,
          status: 502,
          json: async () => ({}),
        };
      },
    }),
    async ({ lookupInventoryItemByBarcode }) => {
      const result = await lookupInventoryItemByBarcode("0000000000000");

      assert.equal(result.found, false);
      assert.equal(result.source, "OPEN_FOOD_FACTS");
      assert.equal(result.item, null);
      assert.equal(
        result.message,
        "Barcode was not found locally and online catalog lookup failed.",
      );
      assert.equal(fetchCalled, true);
    },
  );
});
