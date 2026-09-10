const test = require("node:test");
const assert = require("node:assert/strict");

const { validateInventoryItemPayload } = require("../src/validators/inventoryItem.validator");

const runValidator = (method, body) => {
  const req = { method, body };
  const result = {
    nextCalled: false,
    statusCode: null,
    responseBody: null,
  };
  const res = {
    status(statusCode) {
      result.statusCode = statusCode;
      return this;
    },
    json(bodyValue) {
      result.responseBody = bodyValue;
      return this;
    },
  };

  validateInventoryItemPayload(req, res, () => {
    result.nextCalled = true;
  });

  return { req, result };
};

test("PUT accepts an expiration-only compatibility payload", () => {
  const { req, result } = runValidator("PUT", {
    expiration_date: "2028-05-01",
  });

  assert.equal(result.nextCalled, true);
  assert.equal(result.statusCode, null);
  assert.deepEqual(req.validatedBody, {
    expiration_date: "2028-05-01",
  });
});

test("PUT normalizes nullable expiration-only compatibility payloads", () => {
  for (const expirationDate of [null, ""]) {
    const { req, result } = runValidator("PUT", { expiration_date: expirationDate });

    assert.equal(result.nextCalled, true);
    assert.equal(result.statusCode, null);
    assert.deepEqual(req.validatedBody, { expiration_date: null });
  }
});

test("PUT rejects an invalid expiration-only compatibility payload", () => {
  const { result } = runValidator("PUT", {
    expiration_date: "not-a-date",
  });

  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 400);
  assert.equal(
    result.responseBody.message,
    "expiration_date must be a valid date in YYYY-MM-DD format",
  );
});

test("POST still requires the normal item-create fields", () => {
  const { result } = runValidator("POST", {
    expiration_date: "2028-05-01",
  });

  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 400);
  assert.equal(
    result.responseBody.message,
    "item_name is required and must be a non-empty string",
  );
});
