import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const pageSourcePath = new URL(
  "../src/pages/mswdo/AnomalyTrackingPage.jsx",
  import.meta.url,
);
const serviceSourcePath = new URL(
  "../src/features/mswdo-reports/mswdoReportService.js",
  import.meta.url,
);

test("M05 anomaly page requests bounded server pages instead of the old 500-row fetch", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");

  assert.doesNotMatch(source, /limit:\s*500/);
  assert.match(source, /page,\s*\n\s*pageSize,/);
  assert.match(source, /anomaly_type:\s*viewState\.anomaly_type === "all"/);
  assert.match(source, /status_category:\s*viewState\.status === "all"/);
  assert.match(source, /search:\s*viewState\.search\.trim\(\)/);
  assert.match(source, /order:\s*viewState\.order/);
  assert.doesNotMatch(source, /filteredRows/);
  assert.doesNotMatch(source, /\.sort\(\(firstRow,\s*secondRow\)/);
});

test("M05 anomaly page resets pagination when result filters change", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");

  assert.match(source, /const updateFilters = \(updater\) => \{\s*setPage\(1\);/);
  assert.match(source, /const updateViewState = \(updater\) => \{\s*setPage\(1\);/);
  assert.match(source, /setPage\(1\);\s*setPageSize\(Number\(event\.target\.value\)\)/);
});

test("M05 anomaly page renders accessible previous and next pagination controls", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");

  assert.match(source, /<button\s+type="button"[\s\S]*Previous/);
  assert.match(source, /disabled=\{!pagination\.hasPreviousPage \|\| isLoadingRows\}/);
  assert.match(source, /<button\s+type="button"[\s\S]*Next/);
  assert.match(source, /disabled=\{!pagination\.hasNextPage \|\| isLoadingRows\}/);
  assert.match(source, /Page \{pagination\.page\} of \{totalPages\}/);
});

test("M05F-09 anomaly page shows empty state without Page 0 of 0", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");

  assert.match(source, /const shouldShowPaginationControls = totalItems > 0/);
  assert.match(source, /totalItems === 0[\s\S]*\? "No anomalies found"/);
  assert.match(source, /<EmptyState message="No matching records found\. Try adjusting your search or filters\." \/>/);
  assert.doesNotMatch(source, /Page \{totalPages === 0 \? 0 : pagination\.page\} of \{totalPages\}/);
  assert.match(
    source,
    /totalItems === 0\s*\? "No anomalies found"\s*:\s*`Showing \$\{firstVisibleItem\}-\$\{lastVisibleItem\} of \$\{totalItems\}`/,
  );
});

test("M05F-10 empty after filter reset clears stale page rows and keeps page valid", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");

  assert.match(source, /const updateFilters = \(updater\) => \{\s*setPage\(1\);\s*setFilters\(updater\);/);
  assert.match(source, /const updateViewState = \(updater\) => \{\s*setPage\(1\);\s*setViewState\(updater\);/);
  assert.match(source, /setRows\(Array\.isArray\(response\.data\) \? response\.data : \[\]\)/);
  assert.match(source, /rows\.length === 0[\s\S]*<EmptyState/);
});

test("M05F-11 recover from empty restores non-empty pagination controls", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");

  assert.match(source, /setPagination\(\s*response\.pagination \|\|/);
  assert.match(source, /const shouldShowPaginationControls = totalItems > 0/);
  assert.match(source, /rows\.map\(\(row, rowIndex\) =>/);
  assert.match(source, /\{paginationControls\}/);
});

test("M05 anomaly service uses URLSearchParams for explicit query values", async () => {
  const source = await fs.readFile(serviceSourcePath, "utf8");

  assert.match(source, /new URLSearchParams\(\)/);
  assert.match(source, /Object\.entries\(filters\)/);
});
