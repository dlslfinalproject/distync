const test = require("node:test");
const assert = require("node:assert/strict");

const repositoryPath = require.resolve("../src/repositories/inventoryItem.repository");
const dbPath = require.resolve("../src/config/db");

const withStubbedInventoryItemRepository = async (runTest) => {
  const originalRepository = require.cache[repositoryPath];
  const originalDb = require.cache[dbPath];

  delete require.cache[repositoryPath];

  try {
    require.cache[dbPath] = {
      id: dbPath,
      filename: dbPath,
      loaded: true,
      exports: {
        query: async () => ({ rows: [{ has_column: true }] }),
      },
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

test("inventory item UPDATE cannot assign parent expiration while RETURNING still exposes it", async () => {
  await withStubbedInventoryItemRepository(async ({ updateInventoryItem }) => {
    let capturedSql = "";
    let capturedValues = [];
    const dbClient = {
      query: async (sql, values) => {
        capturedSql = sql;
        capturedValues = values;
        return {
          rows: [
            {
              id: "item-1",
              expiration_date: "2027-01-01",
            },
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

    assert.equal(item.expiration_date, "2027-01-01");
    assert.match(capturedSql, /UPDATE inventory_items/i);
    assert.doesNotMatch(updateStatement, /expiration_date\s*=/i);
    assert.match(capturedSql, /RETURNING[\s\S]*expiration_date/i);
    assert.equal(capturedValues.length, 12);
    assert.equal(capturedValues[10], "12345678");
    assert.equal(capturedValues[11], false);
    assert.equal(capturedValues.includes("2028-05-01"), false);
  });
});

test("inventory item INSERT retains creation-time parent expiration compatibility", async () => {
  await withStubbedInventoryItemRepository(async ({ insertInventoryItem }) => {
    let capturedSql = "";
    let capturedValues = [];
    const dbClient = {
      query: async (sql, values) => {
        capturedSql = sql;
        capturedValues = values;
        return {
          rows: [{ id: "item-1", expiration_date: values[9] }],
        };
      },
    };

    const item = await insertInventoryItem(buildInventoryItemData(), dbClient);

    assert.equal(item.expiration_date, "2028-05-01");
    assert.match(capturedSql, /INSERT INTO inventory_items/i);
    assert.match(capturedSql, /expiration_date/i);
    assert.equal(capturedValues[9], "2028-05-01");
  });
});
