import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import {
  ALLOW_MUTATIONS,
  assertApprovedTargets,
  buildMasterlistUrl,
  BACKEND_URL,
  FRONTEND_URL,
  HARD_REFRESH_SAMPLES,
  MASTERLIST_WARNING_MS,
  PAUSE_BETWEEN_RUNS_MS,
  EVENT_SWITCH_SAMPLES,
  RAPID_SWITCH_SAMPLES,
  STORAGE_STATE_PATH,
  UI_WARNING_MS,
  WARM_REFRESH_SAMPLES,
} from "./config.mjs";
import { NetworkCollector, summarizeRunNetwork } from "./networkCollector.mjs";
import { buildStatistics } from "./stats.mjs";
import { writeReports } from "./reportWriter.mjs";
import {
  extractVisibleState,
  isPlaceholderEventText,
  readSafeSessionSummary,
  waitForCriticalControls,
  waitForMasterlistSettled,
  waitForResolvedEvent,
} from "./uiHelpers.mjs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isBlockingResult = (sample) =>
  ["FAIL", "HARNESS_INVALID"].includes(sample.result);

const ensureAuthStateExists = async () => {
  try {
    await fs.access(STORAGE_STATE_PATH);
  } catch (_error) {
    throw new Error(
      `BLOCKED - authenticated deployed Barangay storage state unavailable. Run npm run perf:barangay:auth first.`,
    );
  }
};

const lastCompleted = (records, type) =>
  records
    .filter((record) => record.type === type && record.responseEndMs != null)
    .at(-1);

const getEventOptions = async (page) =>
  page.locator("#barangay-dashboard-event option").evaluateAll((options) =>
    options
      .map((option) => ({
        value: option.value,
        label: option.textContent?.trim() || "",
      }))
      .filter((option) => option.value),
  );

const redactRequest = (record) =>
  record
    ? {
        requestId: record.requestId,
        classification: record.classification || "UNRESOLVED",
        requestStartMs: record.requestStartMs,
        responseEndMs: record.responseEndMs,
        completed: record.responseEndMs != null,
        responseFingerprint: record.responseFingerprint,
      }
    : null;

const summarizeRequestOrder = (records) => {
  const completed = records
    .filter((record) => record.type === "masterlist" && record.responseEndMs != null)
    .sort((left, right) => left.responseEndMs - right.responseEndMs);
  const completionIndex = new Map(
    completed.map((record, index) => [record.requestId, index + 1]),
  );

  return records
    .filter((record) => record.type === "masterlist")
    .map((record, index) => ({
      requestNumber: index + 1,
      requestId: record.requestId,
      classification: record.classification || "UNRESOLVED",
      completedOrder: completionIndex.get(record.requestId) || null,
      lateSuperseded:
        record.classification === "SUPERSEDED_EVENT" &&
        record.responseEndMs != null &&
        completed.some(
          (candidate) =>
            candidate.classification === "AUTHORITATIVE_FINAL_EVENT" &&
            candidate.responseEndMs != null &&
            record.responseEndMs > candidate.responseEndMs,
        ),
    }));
};

const fingerprintMatchesVisibleState = (fingerprint, visibleState) => {
  if (!fingerprint || fingerprint.rowCount == null) {
    return true;
  }

  return (
    visibleState.rowCount === fingerprint.rowCount &&
    visibleState.emptyState === Boolean(fingerprint.emptyState)
  );
};

const buildSample = ({
  runId,
  type,
  startedAtIso,
  settledMs,
  usableMs,
  records,
  finalSelectedEventId = null,
  finalSelectedEventText = "",
}) => {
  const networkSummary = summarizeRunNetwork(records, { finalEventId: finalSelectedEventId });
  const dashboard = networkSummary.authoritativeDashboard || lastCompleted(records, "dashboard");
  const masterlist =
    networkSummary.authoritativeMasterlist || lastCompleted(records, "masterlist");
  const dispatchDelay =
    dashboard?.responseEndMs != null && masterlist?.requestStartMs != null
      ? masterlist.requestStartMs - dashboard.responseEndMs
      : null;
  const hasPerformanceWarning =
    (masterlist?.totalDurationMs || 0) > MASTERLIST_WARNING_MS ||
    settledMs > UI_WARNING_MS ||
    usableMs > UI_WARNING_MS;
  const hasFailure = networkSummary.httpFailureCount > 0;

  return {
    runId,
    type,
    timestamp: startedAtIso,
    dashboardDurationMs: dashboard?.totalDurationMs ?? null,
    dashboardTtfbMs: dashboard?.ttfbMs ?? null,
    dashboardRequestCount: networkSummary.dashboardRecords.length,
    masterlistDurationMs: masterlist?.totalDurationMs ?? null,
    masterlistTtfbMs: masterlist?.ttfbMs ?? null,
    authoritativeMasterlistDurationMs: masterlist?.totalDurationMs ?? null,
    authoritativeMasterlistTtfbMs: masterlist?.ttfbMs ?? null,
    masterlistDispatchDelayAfterDashboardMs: dispatchDelay,
    timeToEventResolvedMs: dashboard?.responseEndMs ?? null,
    timeToMasterlistResponseMs: masterlist?.responseEndMs ?? null,
    timeToAuthoritativeMasterlistResponseMs: masterlist?.responseEndMs ?? null,
    timeToAuthoritativeDataVisibleMs: settledMs,
    timeToAuthoritativeUsableMs: usableMs,
    timeToDataVisibleMs: settledMs,
    timeToUsableMs: usableMs,
    masterlistRequestCount: networkSummary.masterlistRequestCount,
    authoritativeMasterlistRequestCount:
      networkSummary.authoritativeMasterlistRequestCount,
    supersededMasterlistRequestCount:
      networkSummary.supersededMasterlistRequestCount,
    unresolvedMasterlistRequestCount: networkSummary.unresolvedMasterlistRequestCount,
    duplicateFinalEventRequestCount: networkSummary.duplicateFinalEventRequestCount,
    authoritativeEquivalentDuplicateCount:
      networkSummary.authoritativeEquivalentDuplicateCount,
    duplicateSignatures: networkSummary.duplicateSignatures,
    authoritativeMasterlistRequest: redactRequest(masterlist),
    authoritativeDashboardRequest: redactRequest(dashboard),
    authoritativeResponseFingerprint: masterlist?.responseFingerprint ?? null,
    masterlistRequestOrder: summarizeRequestOrder(records),
    finalSelectedEventId: finalSelectedEventId ? "redacted-event-id" : "",
    finalSelectedEventText,
    unauthorizedProtectedRequestCount:
      networkSummary.unauthorizedProtectedRequestCount,
    retryCount: 0,
    httpFailureCount: networkSummary.httpFailureCount,
    result: hasFailure
      ? "FAIL"
      : hasPerformanceWarning
        ? "PASS WITH PERFORMANCE WARNING"
        : "PASS",
  };
};

export const validateSampleIntegrity = (
  sample,
  { requiresMasterlist = true } = {},
) => {
  const issues = [];
  const toleranceMs = 10;
  const responseMs =
    sample.timeToAuthoritativeMasterlistResponseMs ??
    sample.timeToMasterlistResponseMs;

  if (isPlaceholderEventText(sample.selectedEventText)) {
    issues.push("event was not resolved");
  }

  if (requiresMasterlist) {
    if (sample.masterlistRequestCount < 1) {
      issues.push("masterlist request was not observed");
    }

    if ((sample.authoritativeMasterlistRequestCount ?? 0) < 1) {
      issues.push("authoritative masterlist request was not identified");
    }

    if (sample.masterlistDurationMs == null) {
      issues.push("masterlist duration was not populated");
    }

    if (responseMs == null) {
      issues.push("time to authoritative masterlist response was not populated");
    }

    if (sample.timeToDataVisibleMs == null) {
      issues.push("time to data visible was not populated");
    }

    if (sample.timeToUsableMs == null) {
      issues.push("time to usable was not populated");
    }

    if (
      sample.timeToMasterlistResponseMs != null &&
      sample.masterlistDurationMs != null &&
      sample.timeToMasterlistResponseMs + toleranceMs < sample.masterlistDurationMs
    ) {
      issues.push("masterlist response timing was earlier than request duration");
    }

    if (
      sample.timeToDataVisibleMs != null &&
      responseMs != null &&
      sample.timeToDataVisibleMs + toleranceMs < responseMs
    ) {
      issues.push("data-visible timing preceded authoritative masterlist response");
    }

    if (
      sample.timeToUsableMs != null &&
      responseMs != null &&
      sample.timeToUsableMs + toleranceMs < responseMs
    ) {
      issues.push("usable timing preceded authoritative masterlist response");
    }

    if ((sample.duplicateFinalEventRequestCount ?? 0) > 0) {
      issues.push("duplicate equivalent final-event masterlist requests were observed");
    }

    if (sample.correctness?.finalEventVisible === false) {
      issues.push("final selected event was not authoritative in the UI");
    }

    if (sample.correctness?.authoritativeFingerprintVisible === false) {
      issues.push("final UI did not match authoritative response fingerprint");
    }
  }

  if (sample.staleCommitDetected) {
    return {
      ...sample,
      result: "FAIL",
      productCorrectnessIssues: [
        ...(sample.productCorrectnessIssues || []),
        "stale superseded response committed over final event UI",
      ],
    };
  }

  if (issues.length > 0) {
    return {
      ...sample,
      result: "HARNESS_INVALID",
      harnessIntegrityIssues: issues,
    };
  }

  return sample;
};

const runLoadSample = async ({ page, collector, runId, type, reloadOptions = {} }) => {
  const startedAt = collector.beginRun(runId);
  const startedAtIso = new Date().toISOString();
  let waitFailure = null;
  let eventResolvedMs = null;
  let masterlistResponseMs = null;
  let authoritativeResponseFingerprint = null;
  let resolvedState = null;

  if (type === "initial") {
    await page.goto(buildMasterlistUrl(), { waitUntil: "domcontentloaded" });
  } else {
    await page.reload({ waitUntil: "domcontentloaded", ...reloadOptions });
  }

  const requiresMasterlist = true;

  try {
    eventResolvedMs = await waitForResolvedEvent(page, { runStartedAt: startedAt });
    resolvedState = await extractVisibleState(page);

    const masterlist = await collector.waitForCompletedRunRequest(
      runId,
      "masterlist",
      {
        timeoutMs: 30000,
        status: 200,
        eventId: resolvedState.selectedEventValue,
      },
    );
    masterlistResponseMs = masterlist.responseEndMs;
    authoritativeResponseFingerprint = masterlist.responseFingerprint;
  } catch (error) {
    waitFailure = error;
  }

  const settledMs = waitFailure
    ? null
    : await waitForMasterlistSettled(page, {
        runStartedAt: startedAt,
        minElapsedMs: masterlistResponseMs ?? 0,
        expectedEventId: resolvedState?.selectedEventValue || "",
        expectedFingerprint: authoritativeResponseFingerprint,
      });
  const usableMs = waitFailure
    ? null
    : await waitForCriticalControls(page, {
        runStartedAt: startedAt,
        minElapsedMs: masterlistResponseMs ?? 0,
      });
  const visibleState = await extractVisibleState(page);
  const records = collector.finalizeRun(runId);
  const finalSelectedEventId =
    visibleState.selectedEventValue || resolvedState?.selectedEventValue || "";
  const finalSelectedEventText =
    visibleState.selectedEventText || resolvedState?.selectedEventText || "";
  const authoritativeMasterlist = records.find(
    (record) =>
      record.type === "masterlist" &&
      record.eventId === finalSelectedEventId &&
      record.responseEndMs === masterlistResponseMs,
  );
  const sample = buildSample({
    runId,
    type,
    startedAtIso,
    settledMs,
    usableMs,
    records,
    finalSelectedEventId,
    finalSelectedEventText,
  });

  return validateSampleIntegrity({
    ...sample,
    timeToEventResolvedMs: eventResolvedMs ?? sample.timeToEventResolvedMs,
    selectedEventText: visibleState.selectedEventText,
    authorizedBarangayText: visibleState.assignedBarangayText,
    rowCount: visibleState.rowCount,
    duplicateVisibleRecordCount: visibleState.duplicateVisibleRecordCount,
    correctness: {
      validSelectedEvent: !isPlaceholderEventText(visibleState.selectedEventText),
      unexpectedEmptyState: false,
      duplicatedVisibleRecords: visibleState.duplicateVisibleRecordCount > 0,
      controlsUsable: visibleState.hasExportButton,
      authoritativeFingerprintVisible: fingerprintMatchesVisibleState(
        authoritativeMasterlist?.responseFingerprint,
        visibleState,
      ),
    },
    harnessWaitError: waitFailure?.message,
  }, { requiresMasterlist });
};

const runEventSwitchSample = async ({
  page,
  collector,
  runId,
  type,
  fromEventId,
  toEventId,
  fromEventText = "",
  toEventText = "",
}) => {
  const startedAt = collector.beginRun(runId);
  const startedAtIso = new Date().toISOString();

  if (fromEventId) {
    await page.selectOption("#barangay-dashboard-event", fromEventId);
  }

  if (type === "rapid-event-switch" && fromEventId) {
    await page.selectOption("#barangay-dashboard-event", fromEventId);
    await page.selectOption("#barangay-dashboard-event", toEventId);
  } else {
    await page.selectOption("#barangay-dashboard-event", toEventId);
  }

  const eventResolvedMs = await waitForResolvedEvent(page, { runStartedAt: startedAt });
  const masterlist = await collector.waitForCompletedRunRequest(runId, "masterlist", {
    timeoutMs: 30000,
    status: 200,
    eventId: toEventId,
  });
  const settledMs = await waitForMasterlistSettled(page, {
    runStartedAt: startedAt,
    minElapsedMs: masterlist.responseEndMs ?? 0,
    expectedEventId: toEventId,
    expectedFingerprint: masterlist.responseFingerprint ?? null,
  });
  const usableMs = await waitForCriticalControls(page, {
    runStartedAt: startedAt,
    minElapsedMs: masterlist.responseEndMs ?? 0,
  });
  await sleep(750);
  const visibleState = await extractVisibleState(page);
  const records = collector.finalizeRun(runId);
  const sample = buildSample({
    runId,
    type,
    startedAtIso,
    settledMs,
    usableMs,
    records,
    finalSelectedEventId: toEventId,
    finalSelectedEventText: visibleState.selectedEventText || toEventText,
  });
  const finalEventCorrect = visibleState.selectedEventValue === toEventId;
  const staleCommitDetected =
    Boolean(fromEventId) &&
    (!finalEventCorrect ||
      !fingerprintMatchesVisibleState(masterlist.responseFingerprint, visibleState));

  return validateSampleIntegrity({
    ...sample,
    timeToEventResolvedMs: eventResolvedMs ?? sample.timeToEventResolvedMs,
    fromEventId: fromEventId ? "redacted-event-id" : "",
    fromEventText,
    toEventId: "redacted-event-id",
    toEventText,
    selectedEventText: visibleState.selectedEventText,
    authorizedBarangayText: visibleState.assignedBarangayText,
    rowCount: visibleState.rowCount,
    duplicateVisibleRecordCount: visibleState.duplicateVisibleRecordCount,
    staleCommitDetected,
    finalUiRemainedAuthoritative: finalEventCorrect,
    correctness: {
      finalEventVisible:
        finalEventCorrect && !isPlaceholderEventText(visibleState.selectedEventText),
      authoritativeFingerprintVisible: fingerprintMatchesVisibleState(
        masterlist.responseFingerprint,
        visibleState,
      ),
      duplicatedVisibleRecords: visibleState.duplicateVisibleRecordCount > 0,
      controlsUsable: visibleState.hasExportButton,
    },
  });
};

const run = async () => {
  assertApprovedTargets();
  await ensureAuthStateExists();

  console.log(`Target frontend: ${FRONTEND_URL}`);
  console.log(`Target backend: ${BACKEND_URL}`);
  console.log("Traffic mode: 1 browser, 1 page, sequential samples only.");

  const browser = await chromium.launch({
    headless: process.env.DISTYNC_PERF_HEADED === "true" ? false : true,
  });
  const context = await browser.newContext({
    storageState: STORAGE_STATE_PATH,
    bypassCSP: false,
  });
  const page = await context.newPage();
  const consoleErrors = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push({
        timestamp: new Date().toISOString(),
        text: message.text().slice(0, 500),
      });
    }
  });

  const collector = new NetworkCollector(page);
  collector.start();

  const samples = [];
  const scenarios = [
    { id: "BEM-AUTO-PERF-001", title: "Authenticated initial load", status: "BLOCKED" },
    { id: "BEM-AUTO-PERF-002", title: "20 sequential warm refreshes", status: "BLOCKED" },
    { id: "BEM-AUTO-PERF-003", title: "5 controlled hard/cache-bypass refreshes", status: "BLOCKED" },
    { id: "BEM-AUTO-PERF-004", title: "Duplicate Masterlist request detection", status: "BLOCKED" },
    { id: "BEM-AUTO-PERF-005", title: "Auth 401/retry detection", status: "BLOCKED" },
    { id: "BEM-AUTO-PERF-006", title: "Dashboard/event-gating measurement", status: "BLOCKED" },
    { id: "BEM-AUTO-PERF-007", title: "Event restoration", status: "BLOCKED" },
    { id: "BEM-AUTO-PERF-008", title: "Event A to Event B switch", status: "SKIPPED" },
    { id: "BEM-AUTO-PERF-009", title: "Controlled rapid A to B race test", status: "SKIPPED" },
    { id: "BEM-AUTO-PERF-010", title: "Current data correctness after refresh", status: "BLOCKED" },
    { id: "BEM-AUTO-PERF-011", title: "Refresh after safe data mutation", status: "SKIPPED" },
    { id: "BEM-AUTO-PERF-012", title: "Search/filter interaction", status: "SKIPPED" },
  ];

  try {
    const initial = await runLoadSample({
      page,
      collector,
      runId: "BEM-AUTO-PERF-001",
      type: "initial",
    });
    samples.push(initial);

    const session = await readSafeSessionSummary(page);

    if (!session) {
      throw new Error(
        "Authenticated Barangay test session has expired. Run the one-time auth setup command again.",
      );
    }

    if (session.role !== "BARANGAY") {
      throw new Error(`Expected BARANGAY session, found ${session.role || "UNKNOWN"}.`);
    }

    scenarios
      .filter((scenario) =>
        [
          "BEM-AUTO-PERF-001",
          "BEM-AUTO-PERF-004",
          "BEM-AUTO-PERF-005",
          "BEM-AUTO-PERF-006",
          "BEM-AUTO-PERF-007",
          "BEM-AUTO-PERF-010",
        ].includes(scenario.id),
      )
      .forEach((scenario) => {
        scenario.status = initial.result;
      });

    for (let index = 1; index <= WARM_REFRESH_SAMPLES; index += 1) {
      const sample = await runLoadSample({
        page,
        collector,
        runId: `BEM-AUTO-PERF-002-W${String(index).padStart(2, "0")}`,
        type: "warm-refresh",
      });
      samples.push(sample);
      await sleep(PAUSE_BETWEEN_RUNS_MS);
    }

    scenarios.find((scenario) => scenario.id === "BEM-AUTO-PERF-002").status =
      WARM_REFRESH_SAMPLES === 0
        ? "SKIPPED - disabled by validation configuration"
        : samples.some(
              (sample) => sample.type === "warm-refresh" && isBlockingResult(sample),
            )
          ? "FAIL"
          : samples.some(
                (sample) =>
                  sample.type === "warm-refresh" &&
                  sample.result === "PASS WITH PERFORMANCE WARNING",
              )
            ? "PASS WITH PERFORMANCE WARNING"
            : "PASS";

    for (let index = 1; index <= HARD_REFRESH_SAMPLES; index += 1) {
      await page.setExtraHTTPHeaders({
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      });
      const sample = await runLoadSample({
        page,
        collector,
        runId: `BEM-AUTO-PERF-003-H${String(index).padStart(2, "0")}`,
        type: "cache-bypass-refresh",
        reloadOptions: { waitUntil: "domcontentloaded" },
      });
      sample.limitation =
        "Playwright does not expose a browser hard-refresh primitive; this is a normal reload with HTTP cache pressure only. Authentication storage was preserved.";
      samples.push(sample);
      await sleep(PAUSE_BETWEEN_RUNS_MS);
    }

    scenarios.find((scenario) => scenario.id === "BEM-AUTO-PERF-003").status =
      HARD_REFRESH_SAMPLES === 0
        ? "SKIPPED - disabled by validation configuration"
        : samples.some(
              (sample) =>
                sample.type === "cache-bypass-refresh" && isBlockingResult(sample),
            )
          ? "FAIL"
          : "PASS";

    await page.setExtraHTTPHeaders({});

    const eventOptions = await getEventOptions(page);

    if (EVENT_SWITCH_SAMPLES === 0 && RAPID_SWITCH_SAMPLES === 0) {
      scenarios.find((scenario) => scenario.id === "BEM-AUTO-PERF-008").status =
        "SKIPPED - disabled by validation configuration";
      scenarios.find((scenario) => scenario.id === "BEM-AUTO-PERF-009").status =
        "SKIPPED - disabled by validation configuration";
    } else if (eventOptions.length >= 2) {
      const [eventA, eventB] = eventOptions;

      for (let index = 1; index <= EVENT_SWITCH_SAMPLES; index += 1) {
        const sample = await runEventSwitchSample({
          page,
          collector,
          runId: `BEM-AUTO-PERF-008-S${String(index).padStart(2, "0")}`,
          type: "event-switch",
          fromEventId: index % 2 === 0 ? eventB.value : eventA.value,
          toEventId: index % 2 === 0 ? eventA.value : eventB.value,
          fromEventText: index % 2 === 0 ? eventB.label : eventA.label,
          toEventText: index % 2 === 0 ? eventA.label : eventB.label,
        });
        samples.push(sample);
        await sleep(PAUSE_BETWEEN_RUNS_MS);
      }

      if (EVENT_SWITCH_SAMPLES > 0) {
        scenarios.find((scenario) => scenario.id === "BEM-AUTO-PERF-008").status =
          samples.some((sample) => sample.type === "event-switch" && isBlockingResult(sample))
            ? "FAIL"
            : "PASS";
      } else {
        scenarios.find((scenario) => scenario.id === "BEM-AUTO-PERF-008").status =
          "SKIPPED - disabled by validation configuration";
      }

      for (let index = 1; index <= RAPID_SWITCH_SAMPLES; index += 1) {
        const sample = await runEventSwitchSample({
          page,
          collector,
          runId: `BEM-AUTO-PERF-009-R${String(index).padStart(2, "0")}`,
          type: "rapid-event-switch",
          fromEventId: eventA.value,
          toEventId: eventB.value,
          fromEventText: eventA.label,
          toEventText: eventB.label,
        });
        sample.note =
          "Rapid switch uses immediate sequential select changes without artificial network throttling.";
        samples.push(sample);
        await sleep(PAUSE_BETWEEN_RUNS_MS);
      }

      if (RAPID_SWITCH_SAMPLES > 0) {
        scenarios.find((scenario) => scenario.id === "BEM-AUTO-PERF-009").status =
          samples.some(
            (sample) =>
              sample.type === "rapid-event-switch" &&
              (isBlockingResult(sample) || sample.staleCommitDetected),
          )
            ? "FAIL"
            : "PASS";
      } else {
        scenarios.find((scenario) => scenario.id === "BEM-AUTO-PERF-009").status =
          "SKIPPED - disabled by validation configuration";
      }
    } else {
      scenarios.find((scenario) => scenario.id === "BEM-AUTO-PERF-008").status =
        "SKIPPED - fewer than two legitimate events available";
      scenarios.find((scenario) => scenario.id === "BEM-AUTO-PERF-009").status =
        "SKIPPED - fewer than two legitimate events available";
    }
  } finally {
    collector.stop();
    await browser.close();
  }

  if (ALLOW_MUTATIONS) {
    scenarios.find((scenario) => scenario.id === "BEM-AUTO-PERF-011").status =
      "SKIPPED";
  }

  const refreshSamples = samples.filter((sample) =>
    ["warm-refresh", "cache-bypass-refresh"].includes(sample.type),
  );
  const duplicateRefreshCount = refreshSamples.filter(
    (sample) => sample.duplicateSignatures.length > 0,
  ).length;
  const unauthorizedCount = samples.reduce(
    (total, sample) => total + sample.unauthorizedProtectedRequestCount,
    0,
  );
  const warningCount = samples.filter(
    (sample) => sample.result === "PASS WITH PERFORMANCE WARNING",
  ).length;
  const failCount = samples.filter((sample) => isBlockingResult(sample)).length;

  const report = {
    execution: {
      startedAt: new Date().toISOString(),
      frontendUrl: FRONTEND_URL,
      backendUrl: BACKEND_URL,
      browser: "chromium",
      workers: 1,
      warmRefreshTarget: WARM_REFRESH_SAMPLES,
      hardRefreshTarget: HARD_REFRESH_SAMPLES,
      eventSwitchTarget: EVENT_SWITCH_SAMPLES,
      rapidSwitchTarget: RAPID_SWITCH_SAMPLES,
      mutationsAllowed: ALLOW_MUTATIONS,
    },
    scenarios,
    samples,
    statistics: buildStatistics(samples),
    thresholdObservations: {
      masterlistApiOver3s: samples.filter(
        (sample) => (sample.masterlistDurationMs || 0) > MASTERLIST_WARNING_MS,
      ).length,
      dataVisibleOver5s: samples.filter(
        (sample) => (sample.timeToDataVisibleMs || 0) > UI_WARNING_MS,
      ).length,
      usableOver5s: samples.filter(
        (sample) => (sample.timeToUsableMs || 0) > UI_WARNING_MS,
      ).length,
      timeouts: samples.filter((sample) => sample.result === "FAIL").length,
    },
    analyses: {
      duplicateRequestRefreshes: duplicateRefreshCount,
      unauthorizedProtectedRequestCount: unauthorizedCount,
      consoleErrors,
      eventSwitchStatus:
        samples.some((sample) => sample.type === "event-switch") ||
        samples.some((sample) => sample.type === "rapid-event-switch")
          ? "Executed when at least two legitimate event options were available."
          : "Skipped unless at least two legitimate event options are available.",
      mutationStatus:
        "SKIPPED - DISTYNC_PERF_ALLOW_MUTATIONS is false by default and no synthetic deployed record is assumed.",
      searchFilterStatus:
        "SKIPPED - optional interaction left for authenticated tester after baseline refresh suite.",
    },
    networkRecords: collector.records,
    classification:
      failCount > 0
        ? "FAIL - PERFORMANCE REMEDIATION REQUIRED"
        : warningCount > 0
          ? "PASS WITH PERFORMANCE FINDINGS"
          : "PASS - NO MATERIAL REFRESH PERFORMANCE DEFECT REPRODUCED",
  };

  const written = await writeReports(report);

  console.log(`Valid samples collected: ${samples.length}`);
  console.log(`Duplicate refreshes: ${duplicateRefreshCount}`);
  console.log(`401 protected requests: ${unauthorizedCount}`);
  console.log(`Report JSON: ${written.jsonPath}`);
  console.log(`Report CSV: ${written.csvPath}`);
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
