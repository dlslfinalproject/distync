const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryPath = require.resolve("../src/repositories/inventoryBatch.repository");
const dbPath = require.resolve("../src/config/db");
const validator = require("../src/validators/inventoryBatch.validator");

const withStubbedInventoryBatchRepository = async (query, runTest) => {
  const originalRepository = require.cache[repositoryPath];
  const originalDb = require.cache[dbPath];

  delete require.cache[repositoryPath];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { query },
  };

  try {
    await runTest(require(repositoryPath));
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

const runValidation = (query) => {
  const req = { query };
  let statusCode = 200;
  let payload = null;
  let nextCalled = false;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(value) {
      payload = value;
      return value;
    },
  };

  validator.validateGetInventoryBatches(req, res, () => {
    nextCalled = true;
  });

  return { nextCalled, payload, req, statusCode };
};

test("inventory batch pagination validator preserves legacy mode and requires paired bounded integers", () => {
  const legacy = runValidation({ search: "rice" });
  assert.equal(legacy.nextCalled, true);
  assert.equal(legacy.req.validatedQuery.page, null);
  assert.equal(legacy.req.validatedQuery.pageSize, null);

  const valid = runValidation({ page: "2", pageSize: "100" });
  assert.equal(valid.nextCalled, true);
  assert.equal(valid.req.validatedQuery.page, 2);
  assert.equal(valid.req.validatedQuery.pageSize, 100);

  for (const query of [
    { page: "1" },
    { pageSize: "25" },
    { page: "0", pageSize: "25" },
    { page: "-1", pageSize: "25" },
    { page: "1.5", pageSize: "25" },
    { page: "1x", pageSize: "25" },
    { page: "1", pageSize: "0" },
    { page: "1", pageSize: "101" },
    { page: "1", pageSize: "10x" },
  ]) {
    assert.equal(runValidation(query).statusCode, 400, JSON.stringify(query));
  }
});

test("legacy inventory batch repository reads remain arrays and gain only a deterministic tie-breaker", async () => {
  const rows = [{ id: "batch-1" }, { id: "batch-2" }];
  const calls = [];

  await withStubbedInventoryBatchRepository(
    async (sql, values) => {
      calls.push({ sql, values });
      return { rows };
    },
    async (repository) => {
      const result = await repository.getInventoryBatches({
        search: "rice",
        status: "AVAILABLE",
      });

      assert.ok(Array.isArray(result));
      assert.deepEqual(result, rows);
    },
  );

  assert.equal(calls.length, 1);
  assert.doesNotMatch(calls[0].sql, /\n\s*LIMIT \$/i);
  assert.doesNotMatch(calls[0].sql, /\n\s*OFFSET \$/i);
  assert.match(
    calls[0].sql,
    /ORDER BY ib\.received_at DESC, ib\.id DESC/i,
  );
  assert.deepEqual(calls[0].values, ["AVAILABLE", "%rice%"]);
});

test("paginated inventory batch repository counts the same filtered universe before SQL limit and offset", async () => {
  const calls = [];
  const pageRows = [{ id: "batch-26" }];

  await withStubbedInventoryBatchRepository(
    async (sql, values) => {
      calls.push({ sql, values });

      if (/COUNT\(\*\)/i.test(sql)) {
        return { rows: [{ total_items: "26" }] };
      }

      return { rows: pageRows };
    },
    async (repository) => {
      const result = await repository.getInventoryBatches({
        inventory_item_id: "item-1",
        source_type: "LGU",
        status: "AVAILABLE",
        is_expiring: true,
        is_expired: false,
        search: "rice",
        page: 2,
        pageSize: 25,
      });

      assert.deepEqual(result.rows, pageRows);
      assert.deepEqual(result.pagination, {
        page: 2,
        pageSize: 25,
        totalItems: 26,
        totalPages: 2,
        hasPreviousPage: true,
        hasNextPage: false,
      });
    },
  );

  assert.equal(calls.length, 2);
  const countCall = calls.find(({ sql }) => /COUNT\(\*\)/i.test(sql));
  const pageCall = calls.find(({ sql }) => /\bLIMIT\b/i.test(sql));
  assert.ok(countCall);
  assert.ok(pageCall);
  assert.match(pageCall.sql, /LIMIT \$5\s+OFFSET \$6/i);
  assert.doesNotMatch(countCall.sql, /\bLIMIT\b|\bOFFSET\b/i);
  assert.match(
    pageCall.sql,
    /ORDER BY ib\.received_at DESC, ib\.id DESC[\s\S]*LIMIT \$5\s+OFFSET \$6/i,
  );
  assert.deepEqual(countCall.values, [
    "item-1",
    "LGU",
    "AVAILABLE",
    "%rice%",
  ]);
  assert.deepEqual(pageCall.values, [
    "item-1",
    "LGU",
    "AVAILABLE",
    "%rice%",
    25,
    25,
  ]);
  assert.match(
    countCall.sql,
    /ib\.inventory_item_id = \$1[\s\S]*ib\.source_type = \$2[\s\S]*ib\.status = \$3[\s\S]*expiration_date[\s\S]*ILIKE \$4/i,
  );
  assert.match(
    pageCall.sql,
    /ib\.inventory_item_id = \$1[\s\S]*ib\.source_type = \$2[\s\S]*ib\.status = \$3[\s\S]*expiration_date[\s\S]*ILIKE \$4/i,
  );
});

test("out-of-range and empty paginated batch reads keep deterministic metadata", async () => {
  await withStubbedInventoryBatchRepository(
    async (sql) => {
      if (/COUNT\(\*\)/i.test(sql)) {
        return { rows: [{ total_items: 0 }] };
      }

      return { rows: [] };
    },
    async (repository) => {
      const result = await repository.getInventoryBatches({
        page: 4,
        pageSize: 25,
      });

      assert.deepEqual(result.rows, []);
      assert.deepEqual(result.pagination, {
        page: 4,
        pageSize: 25,
        totalItems: 0,
        totalPages: 0,
        hasPreviousPage: false,
        hasNextPage: false,
      });
    },
  );
});

test("inventory batch pagination is repository-side and does not add row-level database calls", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../src/repositories/inventoryBatch.repository.js"),
    "utf8",
  );

  assert.match(source, /COUNT\(\*\)::int AS total_items/);
  assert.match(source, /LIMIT \$\$\{limitParamIndex\}\s+OFFSET \$\$\{offsetParamIndex\}/);
  assert.doesNotMatch(source, /result\.rows\.slice\(/);
  assert.doesNotMatch(source, /rows\.map\(async/);
});
