const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateInventoryItemBarcodeLookup,
  validateInventoryItemPayload,
  validateForecastRunPayload,
  validateForecastExportPayload,
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

const runForecastValidator = (validator, body) => {
  const req = { body };
  const result = { nextCalled: false, statusCode: null, responseBody: null };
  const res = {
    status(statusCode) {
      result.statusCode = statusCode;
      return this;
    },
    json(responseBody) {
      result.responseBody = responseBody;
      return this;
    },
  };

  validator(req, res, () => {
    result.nextCalled = true;
  });
  return { req, result };
};

const VALID_EVENT_ID = "123e4567-e89b-42d3-a456-426614174000";
const VALID_RUN_ID = "123e4567-e89b-42d3-a456-426614174001";

test("AUTO_BACKTEST run validation strips fixed-model fields and preserves the explicit mode", () => {
  const { req, result } = runForecastValidator(validateForecastRunPayload, {
    disaster_event_id: VALID_EVENT_ID,
    selection_mode: "AUTO_BACKTEST",
  });

  assert.equal(result.nextCalled, true);
  assert.deepEqual(req.validatedBody, {
    disaster_event_id: VALID_EVENT_ID,
    selection_mode: "AUTO_BACKTEST",
  });
});

test("AUTO_BACKTEST rejects a conflicting model selection", () => {
  const { result } = runForecastValidator(validateForecastRunPayload, {
    disaster_event_id: VALID_EVENT_ID,
    selection_mode: "AUTO_BACKTEST",
    model_name: "MOVING_AVERAGE",
  });

  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 400);
});

test("fixed and legacy model requests keep FIXED_MODEL semantics", () => {
  const explicit = runForecastValidator(validateForecastRunPayload, {
    disaster_event_id: VALID_EVENT_ID,
    selection_mode: "FIXED_MODEL",
    model_name: "TREND_PROJECTION",
  });
  const legacy = runForecastValidator(validateForecastRunPayload, {
    disaster_event_id: VALID_EVENT_ID,
    model_name: "EXPONENTIAL_SMOOTHING",
  });

  assert.deepEqual(explicit.req.validatedBody, {
    disaster_event_id: VALID_EVENT_ID,
    selection_mode: "FIXED_MODEL",
    model_name: "TREND_PROJECTION",
  });
  assert.deepEqual(legacy.req.validatedBody, {
    disaster_event_id: VALID_EVENT_ID,
    selection_mode: "FIXED_MODEL",
    model_name: "EXPONENTIAL_SMOOTHING",
  });
});

test("stored-run export validation accepts only the persisted run id", () => {
  const { req, result } = runForecastValidator(validateForecastExportPayload, {
    forecast_run_id: VALID_RUN_ID,
    disaster_event_id: VALID_EVENT_ID,
    model_name: "TREND_PROJECTION",
  });

  assert.equal(result.nextCalled, true);
  assert.deepEqual(req.validatedBody, { forecast_run_id: VALID_RUN_ID });
});

test("stored-run export validation rejects a malformed run id", () => {
  const { result } = runForecastValidator(validateForecastExportPayload, {
    forecast_run_id: "not-a-uuid",
  });

  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 400);
  assert.equal(result.responseBody.message, "forecast_run_id must be a valid UUID");
});
