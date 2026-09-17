import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const sourcePath = (...segments) => path.join(process.cwd(), "src", ...segments);

const readSource = (relativePath) =>
  fs.readFile(sourcePath(...relativePath), "utf8");

test("MSWDO analytics export downloads the PDF response directly", async () => {
  const [pageSource, serviceSource] = await Promise.all([
    readSource(["pages", "mswdo", "AnalyticsDashboardPage.jsx"]),
    readSource(["features", "mswdo-analytics", "mswdoAnalyticsService.js"]),
  ]);

  assert.match(pageSource, /exportMasterlistOperationalAnalytics/);
  assert.match(pageSource, /downloadExportFile\(file\)/);
  assert.doesNotMatch(pageSource, /window\.open|window\.print|document\.write/);
  assert.match(serviceSource, /masterlist\/mswdo-dashboard\/export/);
  assert.match(serviceSource, /mswdo-evacuee-analytics-report\.pdf/);
});
