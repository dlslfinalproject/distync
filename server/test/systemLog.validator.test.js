const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateGetSystemLogReview,
} = require("../src/validators/systemLog.validator");

test("system log review accepts the Packaging Added audit action filter", () => {
  const request = {
    query: {
      audit_action: "packaging_added",
    },
  };
  let nextCalled = false;
  let statusCode = null;
  let responseBody = null;
  const response = {
    status(code) {
      statusCode = code;
      return {
        json(body) {
          responseBody = body;
        },
      };
    },
  };

  validateGetSystemLogReview(request, response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(statusCode, null);
  assert.equal(responseBody, null);
  assert.equal(request.validatedQuery.auditAction, "packaging_added");
});
