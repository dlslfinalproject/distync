const assert = require("node:assert/strict");
const test = require("node:test");

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
const inventoryBatchStatusServicePath = require.resolve(
  "../src/services/inventoryBatchStatus.service",
);

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
  inventoryBatchStatusServicePath,
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
    return await runTest(service);
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

const makeInventoryItem = (id, overrides = {}) => ({
  id,
  item_code: `CODE-${id}`,
  item_name: `Item ${id}`,
  category: "Perishable",
  unit_of_measure: "pc",
  unit_of_measure_value: "1",
  packaging: "piece",
  packaging_count: 1,
  quantity: 1,
  reorder_level: 2,
  expiration_date: null,
  barcode: null,
  is_perishable: true,
  created_at: "2026-09-08T00:00:00.000Z",
  updated_at: "2026-09-08T00:00:00.000Z",
  ...overrides,
});

const makeStockForm = (id, inventoryItemId, overrides = {}) => ({
  id,
  inventory_item_id: inventoryItemId,
  barcode: `${id}-barcode`,
  packaging: "box",
  units_per_packaging: "12",
  unit_of_measure: "pc",
  unit_of_measure_value: "1",
  is_active: true,
  created_at: "2026-09-08T01:00:00.000Z",
  updated_at: "2026-09-08T01:00:00.000Z",
  ...overrides,
});

test("getInventoryItems returns [] without calling the bulk stock-form helper for zero items", async () => {
  let bulkCalls = 0;
  let singularCalls = 0;

  await withStubbedInventoryItemService(
    {
      [inventoryItemRepositoryPath]: {
        getInventoryItems: async () => [],
      },
      [inventoryItemStockFormRepositoryPath]: {
        getInventoryItemStockFormsByItemIds: async () => {
          bulkCalls += 1;
          return [];
        },
        getInventoryItemStockFormsByItemId: async () => {
          singularCalls += 1;
          return [];
        },
      },
    },
    async ({ getInventoryItems }) => {
      assert.deepEqual(await getInventoryItems({}), []);
    },
  );

  assert.equal(bulkCalls, 0);
  assert.equal(singularCalls, 0);
});

test("getInventoryItems attaches an empty stock_forms array when an item has no forms", async () => {
  const item = makeInventoryItem("item-1");
  let bulkArguments = null;

  await withStubbedInventoryItemService(
    {
      [inventoryItemRepositoryPath]: {
        getInventoryItems: async () => [item],
      },
      [inventoryItemStockFormRepositoryPath]: {
        getInventoryItemStockFormsByItemIds: async (itemIds) => {
          bulkArguments = itemIds;
          return [];
        },
        getInventoryItemStockFormsByItemId: async () => {
          throw new Error("the list path must not use the singular helper");
        },
      },
    },
    async ({ getInventoryItems }) => {
      const result = await getInventoryItems({});

      assert.deepEqual(result, [{ ...item, stock_forms: [] }]);
    },
  );

  assert.deepEqual(bulkArguments, ["item-1"]);
});

test("getInventoryItems preserves a complete single stock-form object", async () => {
  const item = makeInventoryItem("item-1");
  const stockForm = makeStockForm("form-1", item.id, {
    barcode: "0748485100081",
    packaging: "case",
    units_per_packaging: "24",
    unit_of_measure: "kg",
    unit_of_measure_value: "5.5",
    is_active: false,
    created_at: "2026-09-08T02:00:00.000Z",
    updated_at: "2026-09-08T03:00:00.000Z",
  });
  let bulkCalls = 0;

  await withStubbedInventoryItemService(
    {
      [inventoryItemRepositoryPath]: {
        getInventoryItems: async () => [item],
      },
      [inventoryItemStockFormRepositoryPath]: {
        getInventoryItemStockFormsByItemIds: async (itemIds) => {
          bulkCalls += 1;
          assert.deepEqual(itemIds, [item.id]);
          return [stockForm];
        },
        getInventoryItemStockFormsByItemId: async () => {
          throw new Error("the list path must not use the singular helper");
        },
      },
    },
    async ({ getInventoryItems }) => {
      const result = await getInventoryItems({});

      assert.deepEqual(result, [{ ...item, stock_forms: [stockForm] }]);
    },
  );

  assert.equal(bulkCalls, 1);
});

test("getInventoryItems makes one bulk call and preserves per-item row order and inactive forms", async () => {
  const itemA = makeInventoryItem("item-a");
  const itemB = makeInventoryItem("item-b");
  const itemC = makeInventoryItem("item-c");
  const formA1 = makeStockForm("form-a-1", itemA.id, {
    created_at: "2026-09-08T01:00:00.000Z",
    packaging: "box",
  });
  const formA2 = makeStockForm("form-a-2", itemA.id, {
    created_at: "2026-09-08T02:00:00.000Z",
    packaging: "piece",
    is_active: false,
  });
  const formC1 = makeStockForm("form-c-1", itemC.id, {
    created_at: "2026-09-08T03:00:00.000Z",
  });
  const bulkCalls = [];
  let singularCalls = 0;

  await withStubbedInventoryItemService(
    {
      [inventoryItemRepositoryPath]: {
        getInventoryItems: async () => [itemA, itemB, itemC],
      },
      [inventoryItemStockFormRepositoryPath]: {
        getInventoryItemStockFormsByItemIds: async (itemIds) => {
          bulkCalls.push(itemIds);
          return [formA1, formA2, formC1];
        },
        getInventoryItemStockFormsByItemId: async () => {
          singularCalls += 1;
          return [];
        },
      },
    },
    async ({ getInventoryItems }) => {
      const result = await getInventoryItems({ category: null });

      assert.deepEqual(result, [
        { ...itemA, stock_forms: [formA1, formA2] },
        { ...itemB, stock_forms: [] },
        { ...itemC, stock_forms: [formC1] },
      ]);
    },
  );

  assert.deepEqual(bulkCalls, [[itemA.id, itemB.id, itemC.id]]);
  assert.equal(singularCalls, 0);
});

test("getInventoryItems preserves duplicate item rows while sharing their grouped forms", async () => {
  const firstItemRow = makeInventoryItem("item-duplicate", { item_name: "First row" });
  const secondItemRow = makeInventoryItem("item-duplicate", { item_name: "Second row" });
  const stockForm = makeStockForm("form-duplicate", firstItemRow.id);
  let bulkCalls = 0;

  await withStubbedInventoryItemService(
    {
      [inventoryItemRepositoryPath]: {
        getInventoryItems: async () => [firstItemRow, secondItemRow],
      },
      [inventoryItemStockFormRepositoryPath]: {
        getInventoryItemStockFormsByItemIds: async (itemIds) => {
          bulkCalls += 1;
          assert.deepEqual(itemIds, [firstItemRow.id, secondItemRow.id]);
          return [stockForm];
        },
        getInventoryItemStockFormsByItemId: async () => {
          throw new Error("the list path must not use the singular helper");
        },
      },
    },
    async ({ getInventoryItems }) => {
      const result = await getInventoryItems({});

      assert.deepEqual(result, [
        { ...firstItemRow, stock_forms: [stockForm] },
        { ...secondItemRow, stock_forms: [stockForm] },
      ]);
    },
  );

  assert.equal(bulkCalls, 1);
});

test("getInventoryItems uses one bulk stock-form call for 100 items and no singular calls", async () => {
  const inventoryItems = Array.from({ length: 100 }, (_, index) =>
    makeInventoryItem(`item-${index + 1}`),
  );
  const bulkCalls = [];
  let singularCalls = 0;

  await withStubbedInventoryItemService(
    {
      [inventoryItemRepositoryPath]: {
        getInventoryItems: async () => inventoryItems,
      },
      [inventoryItemStockFormRepositoryPath]: {
        getInventoryItemStockFormsByItemIds: async (itemIds) => {
          bulkCalls.push(itemIds);
          return [];
        },
        getInventoryItemStockFormsByItemId: async () => {
          singularCalls += 1;
          return [];
        },
      },
    },
    async ({ getInventoryItems }) => {
      const result = await getInventoryItems({});

      assert.equal(result.length, 100);
      assert.ok(result.every((item) => Array.isArray(item.stock_forms)));
    },
  );

  assert.equal(bulkCalls.length, 1);
  assert.deepEqual(bulkCalls[0], inventoryItems.map((item) => item.id));
  assert.equal(singularCalls, 0);
});

test("getInventoryItems propagates base and bulk repository failures", async (t) => {
  await t.test("base failure does not call the bulk helper", async () => {
    let bulkCalls = 0;

    await withStubbedInventoryItemService(
      {
        [inventoryItemRepositoryPath]: {
          getInventoryItems: async () => {
            throw new Error("base query failed");
          },
        },
        [inventoryItemStockFormRepositoryPath]: {
          getInventoryItemStockFormsByItemIds: async () => {
            bulkCalls += 1;
            return [];
          },
        },
      },
      async ({ getInventoryItems }) => {
        await assert.rejects(getInventoryItems({}), /base query failed/);
      },
    );

    assert.equal(bulkCalls, 0);
  });

  await t.test("bulk failure rejects the whole list request", async () => {
    const item = makeInventoryItem("item-1");
    const bulkError = new Error("bulk query failed");

    await withStubbedInventoryItemService(
      {
        [inventoryItemRepositoryPath]: {
          getInventoryItems: async () => [item],
        },
        [inventoryItemStockFormRepositoryPath]: {
          getInventoryItemStockFormsByItemIds: async () => {
            throw bulkError;
          },
        },
      },
      async ({ getInventoryItems }) => {
        await assert.rejects(getInventoryItems({}), (error) => error === bulkError);
      },
    );
  });
});
