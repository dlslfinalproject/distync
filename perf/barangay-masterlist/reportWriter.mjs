import fs from "node:fs/promises";
import path from "node:path";
import { RESULTS_ROOT } from "./config.mjs";
import { isPlaceholderEventText } from "./uiHelpers.mjs";

const csvEscape = (value) => {
  if (value == null) {
    return "";
  }

  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export const assertReportIntegrity = (report) => {
  const violations = report.samples
    .filter(
      (sample) =>
        [
          "initial",
          "warm-refresh",
          "cache-bypass-refresh",
          "event-switch",
          "rapid-event-switch",
        ].includes(sample.type) &&
        ["PASS", "PASS WITH PERFORMANCE WARNING"].includes(sample.result),
    )
    .flatMap((sample) => {
      const issues = [];

      if (sample.masterlistRequestCount < 1) {
        issues.push("missing masterlist request");
      }

      if ((sample.authoritativeMasterlistRequestCount ?? 0) < 1) {
        issues.push("missing authoritative masterlist request");
      }

      if (sample.masterlistDurationMs == null) {
        issues.push("missing masterlist duration");
      }

      const responseMs =
        sample.timeToAuthoritativeMasterlistResponseMs ??
        sample.timeToMasterlistResponseMs;

      if (responseMs == null) {
        issues.push("missing masterlist response timing");
      }

      if (
        sample.timeToDataVisibleMs != null &&
        responseMs != null &&
        sample.timeToDataVisibleMs + 10 < responseMs
      ) {
        issues.push("data visible before authoritative response");
      }

      if (
        sample.timeToUsableMs != null &&
        responseMs != null &&
        sample.timeToUsableMs + 10 < responseMs
      ) {
        issues.push("usable before authoritative response");
      }

      if (isPlaceholderEventText(sample.selectedEventText)) {
        issues.push("placeholder selected event");
      }

      if (sample.staleCommitDetected) {
        issues.push("stale commit detected");
      }

      if (sample.correctness?.authoritativeFingerprintVisible === false) {
        issues.push("final UI did not match authoritative response fingerprint");
      }

      return issues.length > 0
        ? [{ runId: sample.runId, issues: issues.join("; ") }]
        : [];
    });

  if (violations.length > 0) {
    throw new Error(
      `Harness integrity check failed: ${JSON.stringify(violations)}`,
    );
  }
};

export const writeReports = async (report) => {
  assertReportIntegrity(report);

  const stamp = report.execution.startedAt.replaceAll(":", "-").replace(/\.\d+Z$/, "Z");
  const outputDir = path.join(RESULTS_ROOT, stamp);

  await fs.mkdir(outputDir, { recursive: true });

  const jsonPath = path.join(outputDir, "barangay-masterlist-performance.json");
  const csvPath = path.join(outputDir, "barangay-masterlist-refresh-samples.csv");
  const networkPath = path.join(outputDir, "barangay-masterlist-network.json");

  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const rows = [
    [
      "Run",
      "Type",
      "Masterlist",
      "TTFB",
      "Data Visible",
      "Usable",
      "Requests",
      "Authoritative Requests",
      "Superseded Requests",
      "Duplicate Final Requests",
      "401",
      "Errors",
      "Result",
    ],
    ...report.samples.map((sample) => [
      sample.runId,
      sample.type,
      sample.masterlistDurationMs,
      sample.masterlistTtfbMs,
      sample.timeToDataVisibleMs,
      sample.timeToUsableMs,
      sample.masterlistRequestCount,
      sample.authoritativeMasterlistRequestCount,
      sample.supersededMasterlistRequestCount,
      sample.duplicateFinalEventRequestCount,
      sample.unauthorizedProtectedRequestCount,
      sample.httpFailureCount,
      sample.result,
    ]),
  ];

  await fs.writeFile(
    csvPath,
    `${rows.map((row) => row.map(csvEscape).join(",")).join("\n")}\n`,
    "utf8",
  );
  await fs.writeFile(
    networkPath,
    `${JSON.stringify(report.networkRecords, null, 2)}\n`,
    "utf8",
  );

  return { outputDir, jsonPath, csvPath, networkPath };
};
