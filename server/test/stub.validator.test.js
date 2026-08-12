const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateGetBarangayStubDashboard,
  validateClaimBarangayStub,
} = require("../src/validators/stub.validator");

const eventId = "11111111-1111-4111-8111-111111111111";
const barangayId = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";
const stubId = "44444444-4444-4444-8444-444444444444";

const runMiddleware = (middleware, req) =>
  new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        resolve({
          calledNext: false,
          statusCode: this.statusCode,
          payload,
          req,
        });
      },
    };

    middleware(req, res, () => {
      resolve({
        calledNext: true,
        statusCode: res.statusCode,
        req,
      });
    });
  });

test("DEPLOY-MSWDO-RGD-01 dashboard validator accepts legitimate barangay_id scope", async () => {
  const result = await runMiddleware(validateGetBarangayStubDashboard, {
    query: {
      disaster_event_id: eventId,
      barangay_id: barangayId,
    },
  });

  assert.equal(result.calledNext, true);
  assert.deepEqual(result.req.validatedQuery, {
    user_id: null,
    disaster_event_id: eventId,
    barangay_id: barangayId,
    override_barangay_id: null,
  });
});

test("DEPLOY-MSWDO-RGD-01 dashboard validator rejects malformed barangay_id", async () => {
  const result = await runMiddleware(validateGetBarangayStubDashboard, {
    query: {
      disaster_event_id: eventId,
      barangay_id: "not-a-uuid",
    },
  });

  assert.equal(result.calledNext, false);
  assert.equal(result.statusCode, 400);
  assert.match(result.payload.message, /barangay_id must be a valid UUID/);
});

test("DEPLOY-MSWDO-RGD-01 dashboard validator preserves user and override compatibility", async () => {
  const result = await runMiddleware(validateGetBarangayStubDashboard, {
    query: {
      user_id: userId,
      disaster_event_id: eventId,
      override_barangay_id: barangayId,
    },
  });

  assert.equal(result.calledNext, true);
  assert.equal(result.req.validatedQuery.user_id, userId);
  assert.equal(result.req.validatedQuery.override_barangay_id, barangayId);
});

test("DEPLOY-MSWDO-RGD-01 claim validator accepts legitimate barangay_id scope", async () => {
  const result = await runMiddleware(validateClaimBarangayStub, {
    params: { id: stubId },
    body: {
      barangay_id: barangayId,
      donated_loose_items: [],
    },
  });

  assert.equal(result.calledNext, true);
  assert.deepEqual(result.req.validatedBody, {
    id: stubId,
    user_id: null,
    barangay_id: barangayId,
    override_barangay_id: null,
    donated_loose_items: [],
  });
});

test("DEPLOY-MSWDO-RGD-01 claim validator rejects malformed barangay_id", async () => {
  const result = await runMiddleware(validateClaimBarangayStub, {
    params: { id: stubId },
    body: {
      barangay_id: "not-a-uuid",
    },
  });

  assert.equal(result.calledNext, false);
  assert.equal(result.statusCode, 400);
  assert.match(result.payload.message, /barangay_id must be a valid UUID/);
});
