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
