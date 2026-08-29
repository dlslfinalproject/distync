import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const readSource = (relativePath) =>
  fs.readFile(path.join(__dirname, "..", relativePath), "utf8");

const normalizeSource = (source) => source.replace(/\r\n/g, "\n");

const assertOrdered = (source, markers) => {
  let previousIndex = -1;

  for (const marker of markers) {
    const index = source.indexOf(marker, previousIndex + 1);

    assert.ok(index >= 0, `Missing structural marker: ${marker}`);
    assert.ok(index > previousIndex, `Expected marker after previous: ${marker}`);
    previousIndex = index;
  }
};

test("Relief Distribution sends authoritative dashboard pagination filters", async () => {
  const serviceSource = await readSource("src/features/stubs/stubService.js");
  const pageSource = await readSource("src/pages/barangay/StubDistributionPage.jsx");

  assert.match(serviceSource, /searchParams\.set\("page", page\)/);
  assert.match(serviceSource, /searchParams\.set\("pageSize", pageSize\)/);
  assert.match(serviceSource, /searchParams\.set\("search", search\.trim\(\)\)/);
  assert.match(serviceSource, /searchParams\.set\("status", status\)/);
  assert.match(serviceSource, /searchParams\.set\("sector_ids", sectorIds\.join\(","\)\)/);
  assert.match(serviceSource, /searchParams\.set\("sort_order", sortOrder\)/);
  assert.match(pageSource, /page: currentPage/);
  assert.match(pageSource, /pageSize/);
  assert.match(pageSource, /search: searchTerm/);
  assert.match(pageSource, /selectedSectorIds: currentFilters\.sectorNames/);
});

test("Relief Distribution guards full-scope offline cache warming", async () => {
  const hookSource = await readSource("src/features/stubs/useStubDashboard.js");
  const serviceSource = await readSource("src/features/stubs/stubService.js");

  assert.match(hookSource, /pagination:\s*response\.pagination/);
  assert.match(hookSource, /offlineStubCacheWarmRequests/);
  assert.match(hookSource, /!offlineStubCacheWarmRequests\.has\(warmKey\)/);
  assert.match(hookSource, /await warmRequest/);
  assert.match(serviceSource, /if \(!skipOfflineCache\) \{\s*await upsertOfflineStubSnapshots/s);
  assert.match(hookSource, /setPendingLocalRows\(\[\.\.\.pendingRows, \.\.\.cachedRows\]\)/);
  assert.doesNotMatch(hookSource, /offlineStubCache\.clear|bulkDelete|offlineStubCache\.delete/);
});

test("Relief Distribution adopts final conditional paginator UI", async () => {
  const tableSource = await readSource("src/components/stubs/StubResultsTable.jsx");
  const paginationSource = await readSource("src/components/shared/TablePagination.jsx");
  const cssSource = await readSource("src/index.css");
  const normalizedTableSource = normalizeSource(tableSource);
  const normalizedCssSource = normalizeSource(cssSource);

  assert.match(normalizedTableSource, /<TablePagination/);
  const populatedStart = normalizedTableSource.indexOf(
    '  return (\n    <section className="stub-results-card" style={shellStyles.card}>',
    normalizedTableSource.indexOf("const totalItems"),
  );
  assert.ok(populatedStart >= 0);
  assertOrdered(normalizedTableSource.slice(populatedStart), [
    '<h3 className="table-card-title">Stub Information</h3>',
    "<TablePagination",
    'className="stub-results-table-scroll"',
    "<table style={tableStyles.table}",
    "<thead>",
  ]);
  assert.doesNotMatch(normalizedTableSource, /stub-results-pagination-/);
  assert.match(paginationSource, /Showing \{pagination\.totalItems\} loaded entries/);
  assert.match(paginationSource, /Rows per page/);
  assert.match(paginationSource, /FiChevronLeft/);
  assert.match(paginationSource, /FiChevronRight/);
  assert.match(paginationSource, /Page \{pagination\.currentPage\} of \{pagination\.totalPages\}/);
  assert.match(tableSource, /className="stub-results-table-scroll"/);
  assert.match(normalizedCssSource, /\.table-pagination-controls span/);
  assert.doesNotMatch(normalizedCssSource, /stub-results-pagination-/);
});

test("Relief Distribution resets pages and keeps print off current page params", async () => {
  const pageSource = await readSource("src/pages/barangay/StubDistributionPage.jsx");

  assert.match(pageSource, /setCurrentPage\(1\)/);
  assert.match(pageSource, /setSelectedStubIds\(\[\]\)/);
  assert.match(pageSource, /const safePage =\s*totalPages > 0/);
  assert.match(pageSource, /if \(currentPage !== safePage\) \{\s*setCurrentPage\(safePage\)/);
  assert.doesNotMatch(pageSource, /buildStubPrintRoute\(\{[\s\S]*page,/);
  assert.doesNotMatch(pageSource, /buildStubPrintRoute\(\{[\s\S]*pageSize,/);
});
