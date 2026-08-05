const test = require("node:test");
const assert = require("node:assert/strict");

const {
  NOTIFICATION_TYPES,
  VALID_NOTIFICATION_TYPES,
  isValidNotificationType,
  assertValidNotificationType,
} = require("../src/modules/notifications/notification.constants");

test("notification type constants include SUMMARY alongside existing supported types", () => {
  assert.deepEqual(Object.values(NOTIFICATION_TYPES), [
    "EVENT",
    "INVENTORY",
    "EXPIRY",
    "SYNC",
    "ANOMALY",
    "SYSTEM",
    "SUMMARY",
  ]);

  assert.equal(VALID_NOTIFICATION_TYPES.has(NOTIFICATION_TYPES.SUMMARY), true);
  assert.equal(isValidNotificationType("SUMMARY"), true);
  assert.equal(isValidNotificationType("INVALID_TYPE"), false);
});

test("notification type assertion rejects unsupported values", () => {
  assert.doesNotThrow(() =>
    assertValidNotificationType(NOTIFICATION_TYPES.SUMMARY),
  );
  assert.throws(
    () => assertValidNotificationType("INVALID_TYPE"),
    /Unsupported notification type: INVALID_TYPE/,
  );
});
