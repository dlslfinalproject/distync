const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateDisasterEventReportSummary,
} = require("../src/validators/disasterEvent.validator");

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

const runMiddleware = async (middleware, query = {}) => {
  const req = { query };
  const result = {
    statusCode: 200,
    jsonPayload: null,
    nextCalled: false,
    req,
  };
  const res = {
    status(code) {
      result.statusCode = code;
      return this;
    },
    json(payload) {
      result.jsonPayload = payload;
      return this;
    },
  };

  await new Promise((resolve) => {
    middleware(req, res, () => {
      result.nextCalled = true;
      resolve();
    });

    if (!result.nextCalled && result.jsonPayload) {
      resolve();
    }
  });

  return result;
};

test("report summary validation accepts ACTIVE and ENDED aggregate selections", async () => {
  const activeResult = await runMiddleware(validateDisasterEventReportSummary, {
    event_selection: "ACTIVE",
    sort_order: "newest",
  });
  const endedResult = await runMiddleware(validateDisasterEventReportSummary, {
    event_selection: "ENDED",
    sort_order: "oldest",
  });

  assert.equal(activeResult.nextCalled, true);
  assert.equal(activeResult.req.validatedQuery.event_selection, "ACTIVE");
  assert.equal(endedResult.nextCalled, true);
  assert.equal(endedResult.req.validatedQuery.event_selection, "ENDED");
});

test("report summary validation accepts event-based selection values", async () => {
  const result = await runMiddleware(validateDisasterEventReportSummary, {
    event_selection: `EVENT:${VALID_UUID}`,
    sort_order: "az",
  });

  assert.equal(result.nextCalled, true);
  assert.equal(result.req.validatedQuery.event_selection, `EVENT:${VALID_UUID}`);
  assert.equal(result.req.validatedQuery.disaster_event_id, VALID_UUID);
});

test("report summary validation rejects unsupported aggregate selections", async () => {
  const result = await runMiddleware(validateDisasterEventReportSummary, {
    event_selection: "RECENT",
  });

  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 400);
  assert.match(result.jsonPayload.message, /event_selection must be one of/i);
});

test("report summary validation normalizes filters and accepts server pagination", async () => {
  const result = await runMiddleware(validateDisasterEventReportSummary, {
    status: " active ",
    barangay_id: VALID_UUID,
    date_from: "2026-09-01",
    date_to: "2026-09-15",
    search: " Santiago ",
    sort_order: "oldest",
    page: "3",
    page_size: "50",
  });

  assert.equal(result.nextCalled, true);
  assert.deepEqual(result.req.validatedQuery, {
    disaster_event_id: "",
    event_selection: "ALL",
    barangay_id: VALID_UUID,
    status: "ACTIVE",
    date_from: "2026-09-01",
    date_to: "2026-09-15",
    search: "Santiago",
    sort_order: "oldest",
    limit: 100,
    page: 3,
    page_size: 50,
  });
});

test("report summary validation rejects invalid pagination and date ranges", async () => {
  const missingPagePair = await runMiddleware(validateDisasterEventReportSummary, {
    page: "2",
  });
  const oversizedPage = await runMiddleware(validateDisasterEventReportSummary, {
    page: "1",
    page_size: "101",
  });
  const reversedDateRange = await runMiddleware(validateDisasterEventReportSummary, {
    date_from: "2026-09-15",
    date_to: "2026-09-01",
  });

  assert.equal(missingPagePair.statusCode, 400);
  assert.match(missingPagePair.jsonPayload.message, /page and page_size/i);
  assert.equal(oversizedPage.statusCode, 400);
  assert.match(oversizedPage.jsonPayload.message, /page_size/i);
  assert.equal(reversedDateRange.statusCode, 400);
  assert.match(reversedDateRange.jsonPayload.message, /date_from cannot be later/i);
});
