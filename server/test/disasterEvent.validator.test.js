const assert = require("node:assert/strict");
const test = require("node:test");

const disasterEventValidator = require("../src/validators/disasterEvent.validator");

const runValidator = (body) => {
  let nextCalled = false;
  let statusCode = null;
  let responseBody = null;
  const req = { body };
  const res = {
    status(status) {
      statusCode = status;
      return this;
    },
    json(payload) {
      responseBody = payload;
      return this;
    },
  };

  disasterEventValidator.validateCreateDisasterEvent(req, res, () => {
    nextCalled = true;
  });

  return { nextCalled, statusCode, responseBody, validatedBody: req.validatedBody };
};

const baseBody = {
  title: "Flood Response",
  disaster_type: "Flood",
  start_date: "2026-09-01",
  end_date: "2026-09-02",
};

test("disaster event validator normalizes and de-duplicates affected barangay UUIDs", () => {
  const result = runValidator({
    ...baseBody,
    barangay_ids: [
      "11111111-1111-4111-8111-111111111111",
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222".toUpperCase(),
    ],
  });

  assert.equal(result.nextCalled, true);
  assert.deepEqual(result.validatedBody.barangay_ids, [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
  ]);
});

test("disaster event validator rejects malformed affected barangay IDs", () => {
  const result = runValidator({
    ...baseBody,
    barangay_ids: ["not-a-uuid"],
  });

  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 400);
  assert.match(result.responseBody.message, /valid UUID values/i);
});
