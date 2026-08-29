import assert from "node:assert/strict";
import test from "node:test";

import {
  getReliefPackTemplateNameValidationError,
  getPositiveIntegerValidationError,
  parsePositiveInteger,
} from "../src/features/relief-pack-templates/reliefPackTemplateValidation.js";

test("relief pack template names reject duplicates regardless of case or outer whitespace", () => {
  const existingTemplates = [
    { id: "template-1", name: "Standard Food Pack" },
  ];

  assert.equal(
    getReliefPackTemplateNameValidationError(
      "  standard food pack  ",
      existingTemplates,
    ),
    "A relief pack template with this name already exists. Choose a different name.",
  );
  assert.equal(
    getReliefPackTemplateNameValidationError(
      "Standard Food Pack",
      existingTemplates,
      "template-1",
    ),
    "",
  );
  assert.equal(
    getReliefPackTemplateNameValidationError("New Food Pack", existingTemplates),
    "",
  );
});

test("relief pack template names require a non-empty value", () => {
  assert.equal(
    getReliefPackTemplateNameValidationError("   "),
    "Pack name is required.",
  );
});

test("relief pack quantity accepts positive whole numbers", () => {
  assert.equal(parsePositiveInteger("1"), 1);
  assert.equal(parsePositiveInteger("12"), 12);
  assert.equal(parsePositiveInteger("0007"), 7);
});

test("relief pack quantity rejects invalid values with specific messages", () => {
  const invalidCases = [
    ["", "Quantity per pack is required."],
    ["0", "Quantity per pack must be greater than 0."],
    ["00", "Quantity per pack must be greater than 0."],
    ["-1", "Quantity per pack cannot be negative."],
    ["1.5", "Quantity per pack must be a whole number; decimal values are not allowed."],
    ["1.0", "Quantity per pack must be a whole number; decimal values are not allowed."],
    ["abc", "Quantity per pack must contain whole numbers only."],
  ];

  invalidCases.forEach(([value, expectedMessage]) => {
    assert.equal(parsePositiveInteger(value), null, `Expected ${value} to be rejected`);
    assert.equal(getPositiveIntegerValidationError(value), expectedMessage);
  });
});

test("family-size validation rejects invalid values without truncating them", () => {
  const invalidCases = [
    ["", "Family size covered is required."],
    ["0", "Family size covered must be greater than 0."],
    ["-1", "Family size covered cannot be negative."],
    ["1.5", "Family size covered must be a whole number; decimal values are not allowed."],
    ["abc", "Family size covered must contain whole numbers only."],
  ];

  invalidCases.forEach(([value, expectedMessage]) => {
    assert.equal(
      getPositiveIntegerValidationError(value, "Family size covered"),
      expectedMessage,
    );
  });

  assert.equal(
    getPositiveIntegerValidationError("5", "Family size covered"),
    "",
  );
});
