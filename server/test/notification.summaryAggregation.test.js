const test = require("node:test");
const assert = require("node:assert/strict");

const servicePath = require.resolve("../src/modules/notifications/notification.service");
const repositoryPath = require.resolve("../src/modules/notifications/notification.repository");
const authPath = require.resolve("../src/modules/auth/auth.middleware");
const emailPath = require.resolve("../src/modules/email/email.service");
const logPath = require.resolve("../src/repositories/systemLog.repository");
const disasterPath = require.resolve("../src/repositories/disasterEvent.repository");

const loadService = () => {
  const paths = [repositoryPath, authPath, emailPath, logPath, disasterPath];
  const saved = new Map(paths.map((entry) => [entry, require.cache[entry]]));
  delete require.cache[servicePath];
  const repository = {};
  require.cache[repositoryPath] = { id: repositoryPath, filename: repositoryPath, loaded: true, exports: repository };
  require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: { ROLE_CODES: { BARANGAY: "BARANGAY", MSWDO: "MSWDO", MAYOR: "MAYOR" } } };
  require.cache[emailPath] = { id: emailPath, filename: emailPath, loaded: true, exports: {} };
  require.cache[logPath] = { id: logPath, filename: logPath, loaded: true, exports: {} };
  require.cache[disasterPath] = { id: disasterPath, filename: disasterPath, loaded: true, exports: {} };
  const service = require(servicePath);
  return { service, restore: () => { delete require.cache[servicePath]; paths.forEach((entry) => saved.get(entry) ? require.cache[entry] = saved.get(entry) : delete require.cache[entry]); } };
};

test("summary buckets retain one, two, and five logical events", () => {
  const { service, restore } = loadService();
  try {
    for (const count of [1, 2, 5]) {
      const group = { events: [{ payload_json: { events: Array.from({ length: count }, (_, index) => ({ eventId: `event-${index}` })) } }] };
      assert.equal(service.getSummaryEventCount(group), count);
    }
  } finally { restore(); }
});

test("summary buckets support legacy one-event rows and do not cross-count buckets", () => {
  const { service, restore } = loadService();
  try {
    assert.equal(service.getSummaryEventCount({ events: [{ payload_json: { count: 1 } }] }), 1);
    assert.equal(service.getSummaryEventCount({ events: [{ payload_json: { events: [{ eventId: "A" }] } }, { payload_json: { events: [{ eventId: "B" }] } }] }), 2);
  } finally { restore(); }
});

test("hourly bucket boundaries are explicitly Asia/Manila", () => {
  const { service, restore } = loadService();
  try {
    const beforeBoundary = service.getWindowBounds("HOURLY_SUMMARY", new Date("2026-08-07T00:59:59.999Z"));
    const atBoundary = service.getWindowBounds("HOURLY_SUMMARY", new Date("2026-08-07T01:00:00.000Z"));
    assert.equal(beforeBoundary.windowStartedAt.toISOString(), "2026-08-07T00:00:00.000Z");
    assert.equal(atBoundary.windowStartedAt.toISOString(), "2026-08-07T01:00:00.000Z");
  } finally { restore(); }
});
