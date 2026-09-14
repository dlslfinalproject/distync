const assert = require("node:assert/strict");
const test = require("node:test");

const {
  validateCreateInventoryBatch,
} = require("../src/validators/inventoryBatch.validator");
const {
  validateDonationItemPayload,
} = require("../src/validators/donation.validator");
const {
  createInventoryBatch,
} = require("../src/services/inventoryBatch.service");
const pool = require("../src/config/db");

const VALID_INVENTORY_ITEM_ID = "11111111-1111-4111-8111-111111111111";

const runMiddleware = (middleware, body) => {
  const req = { body };
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

  middleware(req, res, () => {
    result.nextCalled = true;
  });

  return result;
};

const buildBatchPayload = (storageLocation) => ({
  inventory_item_id: VALID_INVENTORY_ITEM_ID,
  batch_no: "BATCH-001",
  source_type: "LGU",
  quantity_received: 1,
  ...(storageLocation !== undefined
    ? { storage_location: storageLocation }
    : {}),
});

const buildDonationItemPayload = (storageLocation) => ({
  inventory_item_id: VALID_INVENTORY_ITEM_ID,
  quantity_received: 1,
  remarks: null,
  storage_location: storageLocation,
});

test("inventory batch storage location remains optional and nullable", () => {
  const omitted = runMiddleware(
    validateCreateInventoryBatch,
    buildBatchPayload(),
  );
  const nullable = runMiddleware(
    validateCreateInventoryBatch,
    buildBatchPayload(null),
  );

  assert.equal(omitted.nextCalled, true);
  assert.equal(omitted.req.validatedBody.storage_location, null);
  assert.equal(nullable.nextCalled, true);
  assert.equal(nullable.req.validatedBody.storage_location, null);
});

test("inventory batch validation normalizes legacy short barcode input for service-level resolution", () => {
  const result = runMiddleware(
    validateCreateInventoryBatch,
    {
      ...buildBatchPayload(),
      stock_form_barcode: "00 1234",
    },
  );

  assert.equal(result.nextCalled, true);
  assert.equal(result.statusCode, 200);
  assert.equal(result.req.validatedBody.stock_form_barcode, "001234");
});

test("inventory batch storage location preserves existing server whitespace behavior", () => {
  const result = runMiddleware(
    validateCreateInventoryBatch,
    buildBatchPayload("  Warehouse A  "),
  );
  const blank = runMiddleware(
    validateCreateInventoryBatch,
    buildBatchPayload("  \t  "),
  );

  assert.equal(result.nextCalled, true);
  assert.equal(result.req.validatedBody.storage_location, "  Warehouse A  ");
  assert.equal(blank.nextCalled, true);
  assert.equal(blank.req.validatedBody.storage_location, "  \t  ");
});

test("inventory batch storage location accepts short and exactly 200-character values", () => {
  ["Warehouse A", "x".repeat(199), "x".repeat(200)].forEach((storageLocation) => {
    const result = runMiddleware(
      validateCreateInventoryBatch,
      buildBatchPayload(storageLocation),
    );

    assert.equal(result.nextCalled, true);
    assert.equal(result.req.validatedBody.storage_location, storageLocation);
  });
});

test("inventory batch storage location rejects values over 200 characters", () => {
  ["x".repeat(201), "x".repeat(500)].forEach((storageLocation) => {
    const result = runMiddleware(
      validateCreateInventoryBatch,
      buildBatchPayload(storageLocation),
    );

    assert.equal(result.nextCalled, false);
    assert.equal(result.statusCode, 400);
    assert.equal(
      result.jsonPayload.message,
      "storage_location must not exceed 200 characters",
    );
  });
});

test("donation batch storage location validates the existing trimmed value", () => {
  const validAtLimit = runMiddleware(
    validateDonationItemPayload,
    buildDonationItemPayload(`  ${"x".repeat(200)}  `),
  );
  const tooLong = runMiddleware(
    validateDonationItemPayload,
    buildDonationItemPayload("x".repeat(201)),
  );

  assert.equal(validAtLimit.nextCalled, true);
  assert.equal(validAtLimit.req.validatedBody.storage_location, "x".repeat(200));
  assert.equal(tooLong.nextCalled, false);
  assert.equal(tooLong.statusCode, 400);
  assert.equal(
    tooLong.jsonPayload.message,
    "storage_location must not exceed 200 characters",
  );
});

test("loose donation items do not require per-family allocation remarks", () => {
  const omitted = runMiddleware(validateDonationItemPayload, {
    ...buildDonationItemPayload(null),
    remarks: null,
  });
  const plainRemark = runMiddleware(validateDonationItemPayload, {
    ...buildDonationItemPayload(null),
    remarks: "Community food donation",
  });

  assert.equal(omitted.nextCalled, true);
  assert.equal(omitted.req.validatedBody.remarks, null);
  assert.equal(plainRemark.nextCalled, true);
  assert.equal(plainRemark.req.validatedBody.remarks, "Community food donation");
});

test("sync-capable inventory batch service rejects oversized locations before database access", async () => {
  let connectCalled = false;
  const originalConnect = pool.connect;
  pool.connect = async () => {
    connectCalled = true;
    throw new Error("database access was not expected");
  };

  try {
    await assert.rejects(
      () =>
        createInventoryBatch({
          storage_location: "x".repeat(201),
        }),
      (error) => {
        assert.equal(error.statusCode, 400);
        assert.equal(
          error.message,
          "storage_location must not exceed 200 characters",
        );
        return true;
      },
    );
  } finally {
    pool.connect = originalConnect;
  }

  assert.equal(connectCalled, false);
});
