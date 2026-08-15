import assert from "node:assert/strict";
import { BACKEND_URL } from "./config.mjs";
import { classifyRequest, summarizeRunNetwork } from "./networkCollector.mjs";
import { buildStatistics } from "./stats.mjs";
import { assertReportIntegrity } from "./reportWriter.mjs";
import { validateSampleIntegrity } from "./run.mjs";
import { isPlaceholderEventText } from "./uiHelpers.mjs";

const backend = new URL(BACKEND_URL);

assert.equal(
  classifyRequest(new URL("/api/v1/masterlist", backend).toString(), "GET"),
  "masterlist",
);
assert.equal(
  classifyRequest(
    new URL("/api/v1/masterlist/barangay-dashboard", backend).toString(),
    "GET",
  ),
  "dashboard",
);
assert.equal(
  classifyRequest(new URL("/api/v1/masterlist", backend).toString(), "POST"),
  null,
);

assert.equal(isPlaceholderEventText("Select active disaster event"), true);
assert.equal(isPlaceholderEventText("Typhoon Egay 2026"), false);

const statistics = buildStatistics([
  {
    type: "warm-refresh",
    result: "PASS",
    masterlistDurationMs: 100,
    masterlistTtfbMs: 50,
    timeToMasterlistResponseMs: 200,
    timeToDataVisibleMs: 220,
    timeToUsableMs: 230,
  },
  {
    type: "warm-refresh",
    result: "PASS",
    masterlistDurationMs: 300,
    masterlistTtfbMs: 70,
    timeToMasterlistResponseMs: 400,
    timeToDataVisibleMs: 440,
    timeToUsableMs: 460,
  },
  {
    type: "event-switch",
    result: "PASS",
    masterlistDurationMs: 999,
  },
]);

assert.equal(statistics.warmRefresh.masterlistDurationMs.median, 100);
assert.equal(statistics.warmRefresh.masterlistDurationMs.p95, 300);
assert.equal(statistics.eventSwitch.masterlistDurationMs.max, 999);

assert.throws(() =>
  assertReportIntegrity({
    samples: [
      {
        runId: "bad-pass",
        type: "warm-refresh",
        result: "PASS",
        selectedEventText: "Select active disaster event",
        masterlistRequestCount: 0,
        masterlistDurationMs: null,
        timeToMasterlistResponseMs: null,
      },
    ],
  }),
);

const baseValidSample = {
  runId: "synthetic",
  type: "event-switch",
  result: "PASS",
  selectedEventText: "Event B",
  masterlistRequestCount: 1,
  authoritativeMasterlistRequestCount: 1,
  supersededMasterlistRequestCount: 0,
  duplicateFinalEventRequestCount: 0,
  masterlistDurationMs: 100,
  masterlistTtfbMs: 80,
  timeToMasterlistResponseMs: 1500,
  timeToAuthoritativeMasterlistResponseMs: 1500,
  timeToDataVisibleMs: 1550,
  timeToUsableMs: 1560,
  staleCommitDetected: false,
  correctness: {
    finalEventVisible: true,
  },
};

assert.equal(validateSampleIntegrity(baseValidSample).result, "PASS");

assert.equal(
  validateSampleIntegrity({
    ...baseValidSample,
    runId: "initial-invalid",
    type: "initial",
    timeToMasterlistResponseMs: 4896,
    timeToAuthoritativeMasterlistResponseMs: 4896,
    timeToDataVisibleMs: 4034,
  }).result,
  "HARNESS_INVALID",
);

assert.equal(
  validateSampleIntegrity({
    ...baseValidSample,
    runId: "late-superseded",
    masterlistRequestCount: 2,
    authoritativeMasterlistRequestCount: 1,
    supersededMasterlistRequestCount: 1,
    timeToMasterlistResponseMs: 1400,
    timeToAuthoritativeMasterlistResponseMs: 1400,
    timeToDataVisibleMs: 1500,
  }).result,
  "PASS",
);

assert.equal(
  validateSampleIntegrity({
    ...baseValidSample,
    runId: "stale-commit",
    staleCommitDetected: true,
  }).result,
  "FAIL",
);

assert.equal(
  validateSampleIntegrity({
    ...baseValidSample,
    runId: "fingerprint-mismatch",
    correctness: {
      finalEventVisible: true,
      authoritativeFingerprintVisible: false,
    },
  }).result,
  "HARNESS_INVALID",
);

const makeRecord = ({
  requestId,
  type = "masterlist",
  eventId,
  query = `disaster_event_id=${eventId}`,
  requestStartMs = 100,
  responseEndMs = 200,
}) => ({
  runId: "synthetic",
  requestId,
  type,
  method: "GET",
  pathname:
    type === "dashboard"
      ? "/api/v1/masterlist/barangay-dashboard"
      : "/api/v1/masterlist",
  eventId,
  safeQuerySignature: query,
  normalizedSignature: `GET ${type} ${query}`,
  status: 200,
  requestStartMs,
  responseStartMs: responseEndMs - 20,
  responseEndMs,
  ttfbMs: responseEndMs - requestStartMs - 20,
  totalDurationMs: responseEndMs - requestStartMs,
});

const differentEventSummary = summarizeRunNetwork(
  [
    makeRecord({ requestId: "req-a", eventId: "A" }),
    makeRecord({ requestId: "req-b", eventId: "B" }),
  ],
  { finalEventId: "B" },
);
assert.equal(differentEventSummary.authoritativeMasterlistRequestCount, 1);
assert.equal(differentEventSummary.supersededMasterlistRequestCount, 1);
assert.equal(differentEventSummary.duplicateFinalEventRequestCount, 0);

const duplicateFinalSummary = summarizeRunNetwork(
  [
    makeRecord({ requestId: "req-b1", eventId: "B", query: "disaster_event_id=B&record_status=active" }),
    makeRecord({ requestId: "req-b2", eventId: "B", query: "disaster_event_id=B&record_status=active" }),
  ],
  { finalEventId: "B" },
);
assert.equal(duplicateFinalSummary.authoritativeMasterlistRequestCount, 2);
assert.equal(duplicateFinalSummary.duplicateFinalEventRequestCount, 1);

const dashboardSummary = summarizeRunNetwork(
  [
    makeRecord({
      requestId: "dash-a",
      type: "dashboard",
      eventId: "A",
      responseEndMs: 900,
    }),
    makeRecord({
      requestId: "dash-b",
      type: "dashboard",
      eventId: "B",
      responseEndMs: 1200,
    }),
    makeRecord({
      requestId: "ml-b",
      type: "masterlist",
      eventId: "B",
      requestStartMs: 1300,
      responseEndMs: 1500,
    }),
  ],
  { finalEventId: "B" },
);
assert.equal(
  dashboardSummary.authoritativeMasterlist.requestStartMs -
    dashboardSummary.authoritativeDashboard.responseEndMs,
  100,
);

console.log("barangay masterlist harness self-tests passed (13 assertions)");
