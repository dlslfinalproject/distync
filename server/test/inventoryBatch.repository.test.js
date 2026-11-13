const test = require("node:test");
const assert = require("node:assert/strict");

const repositoryPath = require.resolve("../src/repositories/inventoryBatch.repository");
const dbPath = require.resolve("../src/config/db");

const withStubbedInventoryBatchRepository = async (runTest) => {
  const originalRepository = require.cache[repositoryPath];
  const originalDb = require.cache[dbPath];

  delete require.cache[repositoryPath];

  try {
    require.cache[dbPath] = {
      id: dbPath,
      filename: dbPath,
      loaded: true,
      exports: {},
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

test("insertInventoryBatch maps created_by to the inventory_batches INSERT $10 expression", async () => {
  await withStubbedInventoryBatchRepository(async ({ insertInventoryBatch }) => {
    let capturedSql = "";
    let capturedValues = [];

    const dbClient = {
      query: async (sql, values) => {
        capturedSql = sql;
        capturedValues = values;

        return {
          rows: [
            {
              id: "batch-1",
              created_by: values[9],
            },
          ],
        };
      },
    };

    const batch = await insertInventoryBatch(
      {
        inventory_item_id: "item-1",
        inventory_item_stock_form_id: "stock-form-1",
        batch_no: "INV-ITEM-OPEN-1",
        source_type: "LGU",
        quantity_received: 100,
        quantity_available: 100,
        expiration_date: "2027-08-14",
        storage_location: "Mayor's Office Inventory",
        status: "AVAILABLE",
        created_by: "mayor-user-1",
      },
      dbClient,
    );

    assert.equal(batch.created_by, "mayor-user-1");
    assert.equal(capturedValues.length, 10);
    assert.equal(capturedValues[9], "mayor-user-1");

    assert.match(capturedSql, /INSERT INTO inventory_batches/i);
    assert.match(
      capturedSql,
      /created_by,\s*created_at,\s*updated_at\s*\)\s*VALUES\s*\(\s*\$1,\s*\$2,\s*\$3,\s*\$4,\s*\$5,\s*\$6,\s*\$7,\s*NOW\(\),\s*\$8,\s*\$9,\s*\$10,\s*NOW\(\),\s*NOW\(\)/i,
    );
  });
});
