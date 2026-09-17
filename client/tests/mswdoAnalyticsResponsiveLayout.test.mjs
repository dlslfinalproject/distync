import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const sourcePath = (...segments) => path.join(process.cwd(), "src", ...segments);

const readSource = (relativePath) =>
  fs.readFile(sourcePath(...relativePath), "utf8");

test("MSWDO analytics export occupies a full mobile row", async () => {
  const [pageSource, cssSource] = await Promise.all([
    readSource(["pages", "mswdo", "AnalyticsDashboardPage.jsx"]),
    readSource(["index.css"]),
  ]);

  assert.match(pageSource, /className="mswdo-analytics-export-row"/);
  assert.match(pageSource, /className="mswdo-analytics-export-button"/);
  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.mswdo-analytics-export-row \{[\s\S]*?justify-content: stretch !important;[\s\S]*?width: 100% !important;/,
  );
  assert.match(
    cssSource,
    /\.mswdo-analytics-export-button \{[\s\S]*?width: 100% !important;/,
  );
});

test("MSWDO Barangays Covered donut gives the center summary enough room", async () => {
  const [pageSource, chartSource] = await Promise.all([
    readSource(["pages", "mswdo", "AnalyticsDashboardPage.jsx"]),
    readSource(["components", "mswdo-analytics", "DistributionPieChart.jsx"]),
  ]);

  assert.match(
    pageSource,
    /title="Barangays Covered"[\s\S]*?outerRadius=\{120\}[\s\S]*?mobileOuterRadius=\{104\}[\s\S]*?innerRadius=\{76\}[\s\S]*?mobileInnerRadius=\{64\}/,
  );
  assert.match(chartSource, /outerRadius: requestedOuterRadius/);
  assert.match(chartSource, /mobileInnerRadius/);
});

test("MSWDO horizontal bar charts use a rounded readable numeric axis", async () => {
  const chartSource = await readSource([
    "components",
    "mswdo-analytics",
    "BarangayBarChart.jsx",
  ]);

  assert.match(chartSource, /domain=\{\[0, axisMax\]\}/);
  assert.match(chartSource, /ticks=\{axisTicks\}/);
  assert.match(chartSource, /allowDecimals=\{false\}/);
});
