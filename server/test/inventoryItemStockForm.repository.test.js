const assert = require("node:assert/strict");
const test = require("node:test");

const repositoryPath = require.resolve(
  "../src/repositories/inventoryItemStockForm.repository",
);
const dbPath = require.resolve("../src/config/db");

const withFreshStockFormRepository = async (dbClient, runTest) => {
  const originalRepository = require.cache[repositoryPath];
  const originalDb = require.cache[dbPath];

  delete require.cache[repositoryPath];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: dbClient,
  };

  try {
    const repository = require(repositoryPath);
    return await runTest(repository);
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

const createCapturingDbClient = ({ hasIsActiveColumn = true, rows = [] } = {}) => {
  const calls = [];

  return {
    calls,
    query: async (sql, values) => {
      calls.push({ sql, values });

      if (calls.length === 1) {
        return { rows: [{ has_column: hasIsActiveColumn }] };
      }

      return { rows };
    },
  };
};

test("getInventoryItemStockFormsByItemIds returns [] without querying for empty IDs", async () => {
  const dbClient = createCapturingDbClient();

  await withFreshStockFormRepository(dbClient, async (repository) => {
    assert.deepEqual(
      await repository.getInventoryItemStockFormsByItemIds([], dbClient),
      [],
    );
  });

  assert.equal(dbClient.calls.length, 0);
});

test("getInventoryItemStockFormsByItemIds uses one parameterized UUID-array query and preserves all rows", async () => {
  const itemA = "11111111-1111-4111-8111-111111111111";
  const itemB = "22222222-2222-4222-8222-222222222222";
  const rows = [
    {
      id: "form-a-1",
      inventory_item_id: itemA,
      barcode: "11111111",
      packaging: "box",
      units_per_packaging: "12",
      unit_of_measure: "pc",
      unit_of_measure_value: "1",
      is_active: true,
      created_at: "2026-09-08T01:00:00.000Z",
      updated_at: "2026-09-08T01:00:00.000Z",
    },
    {
      id: "form-a-2",
      inventory_item_id: itemA,
      barcode: "22222222",
      packaging: "piece",
      units_per_packaging: "1",
      unit_of_measure: "pc",
      unit_of_measure_value: "1",
      is_active: false,
      created_at: "2026-09-08T02:00:00.000Z",
      updated_at: "2026-09-08T02:00:00.000Z",
    },
    {
      id: "form-b-1",
      inventory_item_id: itemB,
      barcode: null,
      packaging: "case",
      units_per_packaging: "24",
      unit_of_measure: "kg",
      unit_of_measure_value: "5.5",
      is_active: false,
      created_at: "2026-09-08T03:00:00.000Z",
      updated_at: "2026-09-08T03:00:00.000Z",
    },
  ];
  const dbClient = createCapturingDbClient({ rows });

  await withFreshStockFormRepository(dbClient, async (repository) => {
    const result = await repository.getInventoryItemStockFormsByItemIds(
      [itemA, itemB, itemA],
      dbClient,
    );

    assert.deepEqual(result, rows);
  });

  assert.equal(dbClient.calls.length, 2);
  assert.match(dbClient.calls[0].sql, /information_schema\.columns/i);

  const dataQuery = dbClient.calls[1];
  const normalizedSql = dataQuery.sql.replace(/\s+/g, " ").trim();

  assert.deepEqual(dataQuery.values, [[itemA, itemB]]);
  assert.match(normalizedSql, /WHERE inventory_item_id = ANY\(\$1::uuid\[\]\)/i);
  assert.match(
    normalizedSql,
    /ORDER BY inventory_item_id ASC, created_at ASC, packaging ASC/i,
  );
  assert.match(
    normalizedSql,
    /id, inventory_item_id, barcode, packaging, units_per_packaging, unit_of_measure, unit_of_measure_value, is_active, created_at, updated_at/i,
  );
  assert.equal(dataQuery.sql.includes(itemA), false);
  assert.equal(dataQuery.sql.includes(itemB), false);
  assert.equal(dataQuery.sql.includes("JOIN"), false);
  assert.equal(dataQuery.sql.includes("household"), false);
  assert.equal(dataQuery.sql.includes("donor"), false);
  assert.equal(dataQuery.sql.includes("performer"), false);
  assert.equal(resultContainsInactive(rows), true);
});

test("getInventoryItemStockFormsByItemIds keeps the legacy TRUE AS is_active projection", async () => {
  const itemId = "33333333-3333-4333-8333-333333333333";
  const rows = [{ id: "legacy-form", inventory_item_id: itemId, is_active: true }];
  const dbClient = createCapturingDbClient({
    hasIsActiveColumn: false,
    rows,
  });

  await withFreshStockFormRepository(dbClient, async (repository) => {
    const result = await repository.getInventoryItemStockFormsByItemIds(
      [itemId],
      dbClient,
    );

    assert.deepEqual(result, rows);
  });

  assert.match(dbClient.calls[1].sql, /TRUE AS is_active/i);
  assert.doesNotMatch(dbClient.calls[1].sql, /WHERE[\s\S]*is_active\s*=/i);
});

test("getInventoryItemStockFormsByItemIds propagates metadata and data query failures", async (t) => {
  await t.test("metadata failure", async () => {
    const dbClient = {
      calls: [],
      query: async (sql, values) => {
        dbClient.calls.push({ sql, values });
        throw new Error("metadata query failed");
      },
    };

    await withFreshStockFormRepository(dbClient, async (repository) => {
      await assert.rejects(
        repository.getInventoryItemStockFormsByItemIds(
          ["44444444-4444-4444-8444-444444444444"],
          dbClient,
        ),
        /metadata query failed/,
      );
    });
  });

  await t.test("data failure", async () => {
    const dbClient = {
      calls: [],
      query: async (sql, values) => {
        dbClient.calls.push({ sql, values });

        if (dbClient.calls.length === 1) {
          return { rows: [{ has_column: true }] };
        }

        throw new Error("stock-form data query failed");
      },
    };

    await withFreshStockFormRepository(dbClient, async (repository) => {
      await assert.rejects(
        repository.getInventoryItemStockFormsByItemIds(
          ["55555555-5555-4555-8555-555555555555"],
          dbClient,
        ),
        /stock-form data query failed/,
      );
    });
  });
});

const resultContainsInactive = (rows) =>
  rows.some((row) => row.is_active === false);
