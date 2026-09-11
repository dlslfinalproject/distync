const assert = require("node:assert/strict");
const { test } = require("node:test");

const validator = require("../src/validators/inventoryTransaction.validator");

const runValidation = (query) => {
  const request = { query };
  const response = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  let nextCalled = false;

  validator.validateGetInventoryTransactions(request, response, () => {
    nextCalled = true;
  });

  return { request, response, nextCalled };
};

test("inventory transaction export filters are normalized by the route validator", () => {
  const result = runValidation({
    transaction_label: "Donated",
    movement: "INFLOW",
    source: "Donors",
    date_from: "2026-09-01",
    date_to: "2026-09-10",
    stock_form_packaging: [" Box ", "Bag"],
  });

  assert.equal(result.nextCalled, true);
  assert.deepEqual(result.request.validatedQuery, {
    inventory_batch_id: null,
    inventory_item_id: null,
    transaction_type: null,
    reference_type: null,
    disaster_event_id: null,
    performed_by: null,
    search: null,
    transaction_label: "Donated",
    movement: "INFLOW",
    source: "Donors",
    date_from: "2026-09-01",
    date_to: "2026-09-10",
    stock_form_packaging: ["Box", "Bag"],
  });
});

test("inventory transaction export filters reject invalid date ranges", () => {
  const result = runValidation({
    date_from: "2026-09-11",
    date_to: "2026-09-10",
  });

  assert.equal(result.nextCalled, false);
  assert.equal(result.response.statusCode, 400);
  assert.equal(result.response.body.message, "date_from must be on or before date_to");
});

test("inventory transaction repository applies the export filter contract", async () => {
  const repositoryPath = require.resolve(
    "../src/repositories/inventoryTransaction.repository",
  );
  const databasePath = require.resolve("../src/config/db");
  const originalRepository = require.cache[repositoryPath];
  const originalDatabase = require.cache[databasePath];
  const calls = [];

  delete require.cache[repositoryPath];
  require.cache[databasePath] = {
    id: databasePath,
    filename: databasePath,
    loaded: true,
    exports: {
      query: async (query, values) => {
        calls.push({ query, values });
        return { rows: [] };
      },
    },
  };

  try {
    const repository = require(repositoryPath);
    await repository.getInventoryTransactions({
      inventory_batch_id: "11111111-1111-4111-8111-111111111111",
      inventory_item_id: "22222222-2222-4222-8222-222222222222",
      transaction_label: "Donated",
      movement: "INFLOW",
      source: "Donors",
      date_from: "2026-09-01",
      date_to: "2026-09-10",
      stock_form_packaging: ["Box", "Bag"],
      search: "rice",
    });
  } finally {
    delete require.cache[repositoryPath];

    if (originalRepository) {
      require.cache[repositoryPath] = originalRepository;
    }

    if (originalDatabase) {
      require.cache[databasePath] = originalDatabase;
    } else {
      delete require.cache[databasePath];
    }
  }

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].values, [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
    ["INFLOW", "RETURN", "ADJUSTMENT"],
    ["INFLOW", "RETURN", "ADJUSTMENT"],
    "2026-09-01",
    "2026-09-10",
    ["Box", "Bag"],
    "%rice%",
  ]);
  assert.match(calls[0].query, /it\.transaction_type = ANY\(\$3::text\[\]\)/);
  assert.match(calls[0].query, /it\.transaction_type = ANY\(\$4::text\[\]\)/);
  assert.match(calls[0].query, /ib\.source_type = 'DONATED'/);
  assert.match(calls[0].query, /it\.performed_at::date >= \$5::date/);
  assert.match(calls[0].query, /it\.performed_at::date <= \$6::date/);
  assert.match(calls[0].query, /stock_forms\.packaging = ANY\(\$7::text\[\]\)/);
  assert.match(calls[0].query, /it\.id::text ILIKE \$8/);
});
