import { BACKEND_URL } from "./config.mjs";

const backendOrigin = new URL(BACKEND_URL).origin;
const ignoredQueryParams = new Set([
  "_",
  "cache",
  "cachebuster",
  "t",
  "timestamp",
]);

let nextRequestId = 1;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const safeQuerySignature = (requestUrl) => {
  const entries = [...requestUrl.searchParams.entries()]
    .filter(([key]) => !ignoredQueryParams.has(key.toLowerCase()))
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));

  return entries.map(([key, value]) => `${key}=${value}`).join("&");
};

const getEventId = (requestUrl) =>
  requestUrl.searchParams.get("disaster_event_id") || "";

const countRows = (payload) => {
  if (Array.isArray(payload)) {
    return payload.length;
  }

  if (!payload || typeof payload !== "object") {
    return null;
  }

  for (const key of [
    "data",
    "rows",
    "records",
    "results",
    "items",
    "households",
    "families",
    "evacuees",
    "masterlist",
  ]) {
    const value = payload[key];

    if (Array.isArray(value)) {
      return value.length;
    }
  }

  return null;
};

const safeResponseFingerprint = (record, body) => {
  if (record.type !== "masterlist") {
    return null;
  }

  try {
    const parsed = JSON.parse(body.toString("utf8"));
    const rowCount = countRows(parsed);

    return {
      rowCount,
      emptyState: rowCount === 0,
    };
  } catch (_error) {
    return null;
  }
};

export const classifyRequest = (url, method = "GET") => {
  const parsedUrl = new URL(url);

  if (method !== "GET") {
    return null;
  }

  if (parsedUrl.origin !== backendOrigin) {
    return null;
  }

  if (parsedUrl.pathname === "/api/v1/masterlist") {
    return "masterlist";
  }

  if (parsedUrl.pathname === "/api/v1/masterlist/barangay-dashboard") {
    return "dashboard";
  }

  if (parsedUrl.pathname.startsWith("/api/v1/")) {
    return "protected";
  }

  return null;
};

export class NetworkCollector {
  constructor(page) {
    this.page = page;
    this.records = [];
    this.requestMap = new Map();
    this.runStartedAt = new Map();
    this.started = false;
  }

  start() {
    if (this.started) {
      return;
    }

    this.started = true;
    this.page.on("request", this.onRequest);
    this.page.on("response", this.onResponse);
    this.page.on("requestfailed", this.onRequestFailed);
  }

  stop() {
    if (!this.started) {
      return;
    }

    this.page.off("request", this.onRequest);
    this.page.off("response", this.onResponse);
    this.page.off("requestfailed", this.onRequestFailed);
    this.started = false;
  }

  markRun(runId, startedAt) {
    this.currentRunId = runId;
    this.currentRunStartedAt = startedAt;
    this.runStartedAt.set(runId, startedAt);
  }

  beginRun(runId, startedAt = performance.now()) {
    this.markRun(runId, startedAt);
    return startedAt;
  }

  finalizeRun(runId) {
    return this.getRunRecords(runId);
  }

  getRunRecords(runId) {
    return this.records.filter((record) => record.runId === runId);
  }

  onRequest = (request) => {
    const requestType = classifyRequest(request.url(), request.method());

    if (!requestType) {
      return;
    }

    const requestUrl = new URL(request.url());
    const runId = this.currentRunId || "setup";
    const runStartedAt = this.runStartedAt.get(runId) ?? this.currentRunStartedAt;
    const record = {
      runId,
      runStartedAt,
      requestId: `req-${nextRequestId}`,
      timestamp: new Date().toISOString(),
      type: requestType,
      method: request.method(),
      pathname: requestUrl.pathname,
      eventId: getEventId(requestUrl),
      safeQuerySignature: safeQuerySignature(requestUrl),
      normalizedSignature: [
        request.method(),
        requestUrl.pathname,
        safeQuerySignature(requestUrl),
      ].join(" "),
      status: null,
      requestStartMs: this.elapsed(runStartedAt),
      responseStartMs: null,
      responseEndMs: null,
      ttfbMs: null,
      downloadMs: null,
      totalDurationMs: null,
      responseSizeBytes: null,
      responseFingerprint: null,
      resourceType: request.resourceType(),
      fromServiceWorker: null,
      failureText: null,
    };

    nextRequestId += 1;
    this.requestMap.set(request, record);
    this.records.push(record);
  };

  onResponse = async (response) => {
    const request = response.request();
    const record = this.requestMap.get(request);

    if (!record) {
      return;
    }

    const responseStartMs = this.elapsed(record.runStartedAt);
    record.status = response.status();
    record.responseStartMs = responseStartMs;
    record.ttfbMs =
      record.requestStartMs == null ? null : responseStartMs - record.requestStartMs;
    record.fromServiceWorker =
      typeof response.fromServiceWorker === "function"
        ? response.fromServiceWorker()
        : null;

    try {
      const body = await response.body();
      record.responseSizeBytes = body.byteLength;
      record.responseFingerprint = safeResponseFingerprint(record, body);
    } catch (_error) {
      record.responseSizeBytes = null;
      record.responseFingerprint = null;
    } finally {
      record.responseEndMs = this.elapsed(record.runStartedAt);
      record.downloadMs =
        record.responseStartMs == null ? null : record.responseEndMs - record.responseStartMs;
      record.totalDurationMs =
        record.requestStartMs == null ? null : record.responseEndMs - record.requestStartMs;
    }
  };

  onRequestFailed = (request) => {
    const record = this.requestMap.get(request);

    if (!record) {
      return;
    }

    const failure = request.failure();
    record.failureText = failure?.errorText || "request failed";
    record.responseEndMs = this.elapsed(record.runStartedAt);
    record.totalDurationMs =
      record.requestStartMs == null ? null : record.responseEndMs - record.requestStartMs;
  };

  elapsed(startedAt = this.currentRunStartedAt) {
    if (!startedAt) {
      return 0;
    }

    return Math.round(performance.now() - startedAt);
  }

  async waitForCompletedRunRequest(
    runId,
    type,
    { timeoutMs = 30000, status = 200, afterMs = null, eventId = null } = {},
  ) {
    const startedAt = performance.now();

    while (performance.now() - startedAt <= timeoutMs) {
      const record = this.getRunRecords(runId)
        .filter((candidate) => {
          if (candidate.type !== type || candidate.responseEndMs == null) {
            return false;
          }

          if (afterMs != null && candidate.requestStartMs < afterMs) {
            return false;
          }

          if (eventId != null && candidate.eventId !== eventId) {
            return false;
          }

          return status == null || candidate.status === status;
        })
        .at(-1);

      if (record) {
        return record;
      }

      await sleep(50);
    }

    throw new Error(
      `Timed out waiting for completed ${type} request for ${runId}.`,
    );
  }
}

export const classifyEventRequest = (record, finalEventId) => {
  if (!finalEventId || !record.eventId) {
    return "UNRESOLVED";
  }

  return record.eventId === finalEventId
    ? "AUTHORITATIVE_FINAL_EVENT"
    : "SUPERSEDED_EVENT";
};

const equivalentDuplicateCount = (records) => {
  const signatureCounts = new Map();

  records.forEach((record) => {
    const currentCount = signatureCounts.get(record.normalizedSignature) || 0;
    signatureCounts.set(record.normalizedSignature, currentCount + 1);
  });

  return [...signatureCounts.values()].reduce(
    (total, count) => total + Math.max(0, count - 1),
    0,
  );
};

const classifyRecordsForFinalEvent = (records, finalEventId) =>
  records.map((record) => {
    if (!["masterlist", "dashboard"].includes(record.type)) {
      return record;
    }

    record.classification = classifyEventRequest(record, finalEventId);
    return record;
  });

export const summarizeRunNetwork = (records, { finalEventId = null } = {}) => {
  classifyRecordsForFinalEvent(records, finalEventId);

  const masterlistRecords = records.filter((record) => record.type === "masterlist");
  const dashboardRecords = records.filter((record) => record.type === "dashboard");
  const protectedRecords = records.filter((record) => record.type === "protected");
  const signatureCounts = new Map();

  masterlistRecords.forEach((record) => {
    const currentCount = signatureCounts.get(record.normalizedSignature) || 0;
    signatureCounts.set(record.normalizedSignature, currentCount + 1);
  });

  const duplicateSignatures = [...signatureCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([signature, count]) => ({ signature, count }));

  const latestMasterlist = masterlistRecords[masterlistRecords.length - 1] || null;
  const latestDashboard = dashboardRecords[dashboardRecords.length - 1] || null;
  const authoritativeMasterlistRecords = masterlistRecords.filter(
    (record) => record.classification === "AUTHORITATIVE_FINAL_EVENT",
  );
  const supersededMasterlistRecords = masterlistRecords.filter(
    (record) => record.classification === "SUPERSEDED_EVENT",
  );
  const unresolvedMasterlistRecords = masterlistRecords.filter(
    (record) => record.classification === "UNRESOLVED",
  );
  const authoritativeDashboardRecords = dashboardRecords.filter(
    (record) => record.classification === "AUTHORITATIVE_FINAL_EVENT",
  );
  const completedAuthoritativeMasterlistRecords =
    authoritativeMasterlistRecords.filter((record) => record.responseEndMs != null);
  const completedAuthoritativeDashboardRecords =
    authoritativeDashboardRecords.filter((record) => record.responseEndMs != null);
  const authoritativeMasterlist =
    completedAuthoritativeMasterlistRecords.at(-1) || null;
  const authoritativeDashboard =
    completedAuthoritativeDashboardRecords.at(-1) || null;
  const duplicateFinalEventRequestCount = equivalentDuplicateCount(
    authoritativeMasterlistRecords,
  );

  return {
    dashboardRecords,
    masterlistRecords,
    protectedRecords,
    latestDashboard,
    latestMasterlist,
    authoritativeDashboard,
    authoritativeMasterlist,
    authoritativeMasterlistRecords,
    supersededMasterlistRecords,
    unresolvedMasterlistRecords,
    masterlistRequestCount: masterlistRecords.length,
    authoritativeMasterlistRequestCount: authoritativeMasterlistRecords.length,
    supersededMasterlistRequestCount: supersededMasterlistRecords.length,
    unresolvedMasterlistRequestCount: unresolvedMasterlistRecords.length,
    duplicateFinalEventRequestCount,
    authoritativeEquivalentDuplicateCount: duplicateFinalEventRequestCount,
    duplicateSignatures,
    unauthorizedProtectedRequestCount: records.filter(
      (record) => record.status === 401,
    ).length,
    httpFailureCount: records.filter(
      (record) =>
        record.failureText ||
        (record.status != null && (record.status < 200 || record.status >= 400)),
    ).length,
  };
};
