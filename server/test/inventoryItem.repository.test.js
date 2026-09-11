const test = require("node:test");
const assert = require("node:assert/strict");

const repositoryPath = require.resolve("../src/repositories/inventoryItem.repository");
const dbPath = require.resolve("../src/config/db");

const withStubbedInventoryItemRepository = async (
  runTest,
  dbExports = {
    query: async () => ({ rows: [{ has_column: true }] }),
  },
) => {
  const originalRepository = require.cache[repositoryPath];
  const originalDb = require.cache[dbPath];

  delete require.cache[repositoryPath];

  try {
    require.cache[dbPath] = {
      id: dbPath,
      filename: dbPath,
      loaded: true,
      exports: dbExports,
    };

    const repository = require(repositoryPath);
    await runTest(repository);
  } finally {
    delete require.cache[repositoryPath];

    if (originalRepository) {
      require.cache[repositoryPath] = originalRepository;
    }

    if (originalDb) {
      require.cache[dbPath] = originalDb;
    } else {
      delete require.cache[dbPath];
    }
  }
};

const buildInventoryItemData = (overrides = {}) => ({
  item_code: "ITEM-001",
  item_name: "Rice",
  category: "Non-Perishable",
  unit_of_measure: "pc",
  unit_of_measure_value: 1,
  packaging: "box",
  packaging_count: 10,
  quantity: 12,
  reorder_level: 2,
  expiration_date: "2028-05-01",
  barcode: "12345678",
  is_perishable: false,
  ...overrides,
});

test("inventory item UPDATE does not assign or return parent expiration", async () => {
  await withStubbedInventoryItemRepository(async ({ updateInventoryItem }) => {
    let capturedSql = "";
    let capturedValues = [];
    const dbClient = {
      query: async (sql, values) => {
        capturedSql = sql;
        capturedValues = values;
        return {
          rows: [
            { id: "item-1" },
          ],
        };
      },
    };

    const item = await updateInventoryItem(
      "item-1",
      buildInventoryItemData(),
      dbClient,
    );

    const updateStatement = capturedSql.split(/WHERE id = \$1/i)[0];

    assert.equal(item.expiration_date, undefined);
    assert.match(capturedSql, /UPDATE inventory_items/i);
    assert.doesNotMatch(updateStatement, /expiration_date/i);
    assert.doesNotMatch(capturedSql, /expiration_date/i);
    assert.equal(capturedValues.length, 12);
    assert.equal(capturedValues[10], "12345678");
    assert.equal(capturedValues[11], false);
    assert.equal(capturedValues.includes("2028-05-01"), false);
  });
});

test("inventory item INSERT ignores parent expiration and returns only live item fields", async () => {
  await withStubbedInventoryItemRepository(async ({ insertInventoryItem }) => {
    let capturedSql = "";
    let capturedValues = [];
    const dbClient = {
      query: async (sql, values) => {
        capturedSql = sql;
        capturedValues = values;
        return {
          rows: [{ id: "item-1" }],
        };
      },
    };

    const item = await insertInventoryItem(buildInventoryItemData(), dbClient);

    assert.equal(item.expiration_date, undefined);
    assert.match(capturedSql, /INSERT INTO inventory_items/i);
    assert.doesNotMatch(capturedSql, /expiration_date/i);
    assert.equal(capturedValues.length, 11);
    assert.equal(capturedValues[9], "12345678");
    assert.equal(capturedValues[10], false);
    assert.equal(capturedValues.includes("2028-05-01"), false);
  });
});

test("all live inventory item projections omit the retired parent expiration column", async () => {
  const capturedQueries = [];
  const dbExports = {
    query: async (sql) => {
      capturedQueries.push(sql);

      if (/information_schema\.columns/i.test(sql)) {
        return { rows: [{ has_column: true }] };
      }

      return { rows: [{ id: "item-1" }] };
    },
  };

  await withStubbedInventoryItemRepository(
    async ({
      getInventoryItems,
      getInventoryItemById,
      getInventoryItemByIdForUpdate,
      getInventoryItemsByIdsForUpdate,
      getInventoryItemByBarcode,
      updateInventoryItemReorderLevel,
    }) => {
      const dbClient = {
        query: async (sql) => {
          capturedQueries.push(sql);
          return { rows: [{ id: "item-1" }] };
        },
      };

      await getInventoryItems({ category: null, is_perishable: null, search: null });
      await getInventoryItemById("item-1", dbClient);
      await getInventoryItemByIdForUpdate("item-1", dbClient);
      await getInventoryItemsByIdsForUpdate(["item-1"], dbClient);
      await getInventoryItemByBarcode("12345678", dbClient);
      await updateInventoryItemReorderLevel("item-1", 3, dbClient);
    },
    dbExports,
  );

  const itemQueries = capturedQueries.filter((sql) =>
    /(?:FROM|UPDATE|INSERT INTO) inventory_items/i.test(sql),
  );

  assert.equal(itemQueries.length, 6);
  for (const query of itemQueries) {
    assert.doesNotMatch(query, /expiration_date/i);
  }
});
