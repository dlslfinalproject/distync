const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateInventoryItemBarcodeLookup,
  validateInventoryItemPayload,
} = require("../src/validators/inventoryItem.validator");

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

test("PUT preserves the legacy short-barcode read contract while normalizing whitespace", () => {
  const { req, result } = runValidator("PUT", {
    item_name: "Legacy item",
    category: "Non-Perishable",
    unit_of_measure: "pc",
    unit_of_measure_value: 1,
    packaging: "piece",
    packaging_count: 1,
    quantity: 1,
    reorder_level: 1,
    barcode: "00 1234",
  });

  assert.equal(result.nextCalled, true);
  assert.equal(result.statusCode, null);
  assert.equal(req.validatedBody.barcode, "001234");
});

test("POST still rejects a new short barcode assignment", () => {
  const { result } = runValidator("POST", {
    item_name: "New item",
    category: "Non-Perishable",
    unit_of_measure: "pc",
    unit_of_measure_value: 1,
    packaging: "piece",
    packaging_count: 1,
    quantity: 1,
    reorder_level: 1,
    barcode: "001234",
  });

  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 400);
  assert.equal(result.responseBody.message, "barcode must contain 8 to 18 digits");
});

test("barcode lookup accepts an existing six-digit legacy value", () => {
  const req = { params: { barcode: "00 1234" } };
  const result = { nextCalled: false, statusCode: null, responseBody: null };
  const res = {
    status(statusCode) {
      result.statusCode = statusCode;
      return this;
    },
    json(body) {
      result.responseBody = body;
      return this;
    },
  };

  validateInventoryItemBarcodeLookup(req, res, () => {
    result.nextCalled = true;
  });

  assert.equal(result.nextCalled, true);
  assert.equal(result.statusCode, null);
  assert.equal(req.validatedParams.barcode, "001234");
});
