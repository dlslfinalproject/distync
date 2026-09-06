const assert = require("node:assert/strict");
const test = require("node:test");

const {
  validateCreateReliefPackTemplate,
  validateReliefPackTemplateStatus,
  validateUpdateReliefPackTemplate,
} = require("../src/validators/reliefPackTemplate.validator");

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

const buildPayload = (quantityRequired) => ({
  name: "Standard Food Pack",
  items: [
    {
      inventory_item_id: VALID_INVENTORY_ITEM_ID,
      quantity_required: quantityRequired,
    },
  ],
});

const buildFamilySizePayload = (description) => ({
  name: "Standard Family Pack",
  based_on_family_size: true,
  description,
});

const buildNamePayload = (name) => ({
  ...buildPayload(3),
  name,
});

test("relief pack template item quantity accepts positive integers", () => {
  const result = runMiddleware(
    validateCreateReliefPackTemplate,
    buildPayload(3),
  );

  assert.equal(result.nextCalled, true);
  assert.equal(result.req.validatedBody.items[0].quantity_required, 3);
});

test("new relief pack templates default to inactive when status is omitted", () => {
  const result = runMiddleware(
    validateCreateReliefPackTemplate,
    buildPayload(3),
  );

  assert.equal(result.nextCalled, true);
  assert.equal(result.req.validatedBody.is_active, false);
});

test("relief pack template creation trims before enforcing the 150-character name limit", () => {
  const validAtLimit = runMiddleware(
    validateCreateReliefPackTemplate,
    buildNamePayload(`  ${"x".repeat(150)}  `),
  );
  const tooLong = runMiddleware(
    validateCreateReliefPackTemplate,
    buildNamePayload("x".repeat(151)),
  );

  assert.equal(validAtLimit.nextCalled, true);
  assert.equal(validAtLimit.req.validatedBody.name, "x".repeat(150));
  assert.equal(tooLong.nextCalled, false);
  assert.equal(tooLong.statusCode, 400);
  assert.equal(tooLong.jsonPayload.message, "name must not exceed 150 characters");
});

test("relief pack template creation accepts names from 1 through 150 characters", () => {
  [1, 149, 150].forEach((length) => {
    const result = runMiddleware(
      validateCreateReliefPackTemplate,
      buildNamePayload("x".repeat(length)),
    );

    assert.equal(result.nextCalled, true);
    assert.equal(result.req.validatedBody.name.length, length);
  });
});

test("relief pack template blank names preserve the existing validation behavior", () => {
  [validateCreateReliefPackTemplate, validateUpdateReliefPackTemplate].forEach(
    (validator) => {
      const result = runMiddleware(validator, buildNamePayload("  \t  "));

      assert.equal(result.nextCalled, false);
      assert.equal(result.statusCode, 400);
      assert.equal(
        result.jsonPayload.message,
        "name is required and must be a non-empty string",
      );
    },
  );
});

test("relief pack template updates preserve the existing status when omitted", () => {
  const result = runMiddleware(
    validateUpdateReliefPackTemplate,
    buildPayload(3),
  );

  assert.equal(result.nextCalled, true);
  assert.equal(result.req.validatedBody.is_active, undefined);
});

test("relief pack template updates allow omitted names for configuration changes", () => {
  const result = runMiddleware(validateUpdateReliefPackTemplate, {
    description: "Updated description",
  });

  assert.equal(result.nextCalled, true);
  assert.equal(result.req.validatedBody.name, undefined);
  assert.equal(result.req.validatedBody.description, "Updated description");
});

test("relief pack template updates enforce the 150-character name limit", () => {
  const validAtLimit = runMiddleware(
    validateUpdateReliefPackTemplate,
    buildNamePayload("x".repeat(150)),
  );
  const tooLong = runMiddleware(
    validateUpdateReliefPackTemplate,
    buildNamePayload("x".repeat(151)),
  );

  assert.equal(validAtLimit.nextCalled, true);
  assert.equal(validAtLimit.req.validatedBody.name, "x".repeat(150));
  assert.equal(tooLong.nextCalled, false);
  assert.equal(tooLong.statusCode, 400);
  assert.equal(tooLong.jsonPayload.message, "name must not exceed 150 characters");
});

test("relief pack template status requires a boolean", () => {
  [undefined, "true", 1, null].forEach((is_active) => {
    const result = runMiddleware(validateReliefPackTemplateStatus, {
      is_active,
    });

    assert.equal(result.nextCalled, false);
    assert.equal(result.statusCode, 400);
    assert.equal(result.jsonPayload.message, "is_active must be a boolean");
  });

  const result = runMiddleware(validateReliefPackTemplateStatus, {
    is_active: false,
  });

  assert.equal(result.nextCalled, true);
  assert.deepEqual(result.req.validatedBody, { is_active: false });
});

test("relief pack template item quantity rejects zero, negative, and decimal values", () => {
  [0, -1, 1.5].forEach((quantityRequired) => {
    const result = runMiddleware(
      validateCreateReliefPackTemplate,
      buildPayload(quantityRequired),
    );

    assert.equal(result.nextCalled, false);
    assert.equal(result.statusCode, 400);
    assert.match(result.jsonPayload.message, /positive integer/i);
  });
});

test("relief pack template family size rejects invalid values without truncating them", () => {
  const invalidCases = [
    [undefined, "Family size covered is required."],
    ["0", "Family size covered must be greater than 0."],
    ["-1", "Family size covered cannot be negative."],
    ["1.5", "Family size covered must be a whole number; decimal values are not allowed."],
    ["abc", "Family size covered must contain whole numbers only."],
  ];

  invalidCases.forEach(([description, expectedMessage]) => {
    [validateCreateReliefPackTemplate, validateUpdateReliefPackTemplate].forEach(
      (validator) => {
        const result = runMiddleware(
          validator,
          buildFamilySizePayload(description),
        );

        assert.equal(result.nextCalled, false);
        assert.equal(result.statusCode, 400);
        assert.equal(result.jsonPayload.message, expectedMessage);
      },
    );
  });
});

test("relief pack template family size accepts positive integers", () => {
  [validateCreateReliefPackTemplate, validateUpdateReliefPackTemplate].forEach(
    (validator) => {
      const result = runMiddleware(validator, buildFamilySizePayload("5"));

      assert.equal(result.nextCalled, true);
      assert.equal(result.req.validatedBody.description, "5");
    },
  );
});
