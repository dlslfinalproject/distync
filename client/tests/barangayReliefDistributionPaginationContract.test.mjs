import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const readSource = (relativePath) =>
  fs.readFile(path.join(__dirname, "..", relativePath), "utf8");

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
  assert.match(hookSource, /skipOfflineCache: true/);
  assert.match(hookSource, /offlineStubCacheWarmRequests/);
  assert.match(hookSource, /hasCachedStubSnapshotsForScope/);
  assert.match(hookSource, /!offlineStubCacheWarmRequests\.has\(warmKey\)/);
  assert.match(serviceSource, /if \(!skipOfflineCache\) \{\s*await upsertOfflineStubSnapshots/s);
  assert.match(hookSource, /setPendingLocalRows\(\[\.\.\.pendingRows, \.\.\.cachedRows\]\)/);
  assert.doesNotMatch(hookSource, /offlineStubCache\.clear|bulkDelete|offlineStubCache\.delete/);
});

test("Relief Distribution adopts final conditional paginator UI", async () => {
  const tableSource = await readSource("src/components/stubs/StubResultsTable.jsx");
  const cssSource = await readSource("src/index.css");

  assert.match(tableSource, /totalItems > 0/);
  assert.match(tableSource, /Showing \{firstVisibleItem\}-\{lastVisibleItem\} of \{totalItems\}/);
  assert.match(tableSource, /hasMultiplePages \? \(/);
  assert.match(tableSource, /Rows per page/);
  assert.match(tableSource, /Previous/);
  assert.match(tableSource, /Page \{currentPage\} of \{totalPages\}/);
  assert.match(tableSource, /Next/);
  assert.match(tableSource, /className="stub-results-table-scroll"/);
  assert.match(tableSource, /className="stub-results-pagination-navigation"/);
  assert.match(cssSource, /\.stub-results-pagination-controls span/);
});

test("Relief Distribution resets pages and keeps print off current page params", async () => {
  const pageSource = await readSource("src/pages/barangay/StubDistributionPage.jsx");

  assert.match(pageSource, /setCurrentPage\(1\)/);
  assert.match(pageSource, /setSelectedStubIds\(\[\]\)/);
  assert.match(pageSource, /setCurrentPage\(totalPages\)/);
  assert.doesNotMatch(pageSource, /buildStubPrintRoute\(\{[\s\S]*page,/);
  assert.doesNotMatch(pageSource, /buildStubPrintRoute\(\{[\s\S]*pageSize,/);
});
