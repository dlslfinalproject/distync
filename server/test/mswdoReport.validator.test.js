const test = require("node:test");
const assert = require("node:assert/strict");

const { validateMswdoReportFilters } = require("../src/validators/mswdoReport.validator");

const runValidator = (query) =>
  new Promise((resolve) => {
    const req = { query };
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        resolve({ statusCode: this.statusCode, payload });
      },
    };

    validateMswdoReportFilters(req, res, () => {
      resolve({ statusCode: 200, validatedQuery: req.validatedQuery });
    });
  });

test("M05 validator defaults bounded page pagination for anomaly reports", async () => {
  const result = await runValidator({});

  assert.equal(result.statusCode, 200);
  assert.equal(result.validatedQuery.page, 1);
  assert.equal(result.validatedQuery.pageSize, 50);
  assert.equal(result.validatedQuery.order, "newest");
});

test("M05 validator rejects malformed page and oversized pageSize", async () => {
  const badPage = await runValidator({ page: "-2" });
  const badPageSize = await runValidator({ pageSize: "101" });

  assert.equal(badPage.statusCode, 400);
  assert.match(badPage.payload.message, /page must be an integer/);
  assert.equal(badPageSize.statusCode, 400);
  assert.match(badPageSize.payload.message, /pageSize must be an integer between 1 and 100/);
});

test("M05 validator allowlists anomaly filters and sort order", async () => {
  const valid = await runValidator({
    anomaly_type: "SYNC_CONFLICT",
    status_category: "open",
    search: "claim",
    order: "az",
    page: "3",
    pageSize: "25",
  });
  const invalidType = await runValidator({ anomaly_type: "DROP_TABLE" });
  const invalidOrder = await runValidator({ order: "occurred_at;DROP" });

  assert.equal(valid.statusCode, 200);
  assert.equal(valid.validatedQuery.anomaly_type, "SYNC_CONFLICT");
  assert.equal(valid.validatedQuery.status_category, "open");
  assert.equal(valid.validatedQuery.search, "claim");
  assert.equal(valid.validatedQuery.order, "az");
  assert.equal(valid.validatedQuery.page, 3);
  assert.equal(valid.validatedQuery.pageSize, 25);
  assert.equal(invalidType.statusCode, 400);
  assert.equal(invalidOrder.statusCode, 400);
});

test("M05NULL-11 validator keeps the server-owned anomaly sort allowlist unchanged", async () => {
  for (const order of ["newest", "oldest", "az", "za"]) {
    const result = await runValidator({ order });

    assert.equal(result.statusCode, 200);
    assert.equal(result.validatedQuery.order, order);
  }

  const nullsFirst = await runValidator({ order: "nullsFirst" });
  const nullsLast = await runValidator({ order: "nullsLast" });

  assert.equal(nullsFirst.statusCode, 400);
  assert.equal(nullsLast.statusCode, 400);
});
