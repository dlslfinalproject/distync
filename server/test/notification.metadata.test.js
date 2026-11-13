const test = require("node:test");
const assert = require("node:assert/strict");

const {
  sanitizeNotificationMetadata,
} = require("../src/modules/notifications/notification.service");

test("notification metadata allowlist keeps safe inventory context and drops unsafe fields", () => {
  const metadata = sanitizeNotificationMetadata("NEAR_EXPIRY_STOCK", {
    batchId: "batch-1",
    itemId: "item-1",
    expiresAt: "2026-08-15T00:00:00+08:00",
    remainingQuantity: 24,
    url: "/inventory/batches/batch-1",
    html: "<script>alert(1)</script>",
    token: "secret",
    unknownKey: "discard",
  });

  assert.deepEqual(metadata, {
    batchId: "batch-1",
    itemId: "item-1",
    expiresAt: "2026-08-15T00:00:00+08:00",
    remainingQuantity: 24,
  });
});

test("notification summary metadata is bounded and excludes arbitrary nested queue payloads", () => {
  const metadata = sanitizeNotificationMetadata("HOUSEHOLD_REGISTERED", {
    summary: {
      windowStart: "2026-08-07T12:00:00.000Z",
      windowEnd: "2026-08-07T13:00:00.000Z",
      eventCount: 2,
      breakdown: [{ barangayId: "barangay-1", action: "registered", count: 2, url: "/unsafe" }],
      events: Array.from({ length: 100 }, () => ({ raw: true })),
    },
  });

  assert.deepEqual(metadata, {
    summary: {
      windowStart: "2026-08-07T12:00:00.000Z",
      windowEnd: "2026-08-07T13:00:00.000Z",
      eventCount: 2,
      breakdown: [{ barangayId: "barangay-1", action: "registered", count: 2 }],
    },
  });
});
