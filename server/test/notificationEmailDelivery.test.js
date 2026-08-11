const test = require("node:test");
const assert = require("node:assert/strict");
const {
  classifyProviderFailure,
  sanitizeProviderError,
} = require("../src/modules/email/email.service");

test("email provider failures are classified conservatively for retries", () => {
  assert.equal(classifyProviderFailure({ statusCode: 429 }), "TRANSIENT");
  assert.equal(classifyProviderFailure({ statusCode: 503 }), "TRANSIENT");
  assert.equal(classifyProviderFailure({ statusCode: 422 }), "PERMANENT");
  assert.equal(classifyProviderFailure({ message: "connection timed out" }), "TRANSIENT");
  assert.equal(classifyProviderFailure({ message: "unexpected response" }), "UNKNOWN");
});

test("provider errors redact credential-shaped content before persistence", () => {
  const sanitized = sanitizeProviderError("Authorization Bearer re_secret_token_123456789 api_key=super-secret");
  assert.doesNotMatch(sanitized, /secret_token|super-secret/);
  assert.match(sanitized, /\[redacted\]/);
});
