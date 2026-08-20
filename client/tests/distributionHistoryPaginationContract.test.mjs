import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const sourcePath = (...segments) => path.join(process.cwd(), "src", ...segments);

const readSource = (relativePath) =>
  fs.readFile(sourcePath(...relativePath), "utf8");

test("Distribution History requests authoritative server pages without old 500/1000 row caps", async () => {
  const source = await readSource(["pages", "DistributionHistoryPage.jsx"]);

  assert.doesNotMatch(source, /limit:\s*filters\.disaster_event_id \? 500 : 1000/);
  assert.match(source, /mode:\s*isSummaryMode \? "summary" : "detail"/);
  assert.match(source, /search:\s*searchTerm\.trim\(\)/);
  assert.match(source, /page,\s*\n\s*pageSize,/);
  assert.doesNotMatch(source, /visibleHistoryRows\s*=\s*useMemo/);
  assert.doesNotMatch(source, /visibleSummaryRows\s*=\s*useMemo/);
});

test("Distribution History resets pagination when filters, search, order, or page size change", async () => {
  const source = await readSource(["pages", "DistributionHistoryPage.jsx"]);

  assert.match(source, /const updateFilters = \(updater\) => \{\s*setPage\(1\);/);
  assert.match(source, /const handleSearchChange = \(value\) => \{\s*setPage\(1\);/);
  assert.match(source, /const handleSortOrderChange = \(value\) => \{\s*setPage\(1\);/);
  assert.match(source, /const handlePageSizeChange = \(value\) => \{\s*setPage\(1\);/);
});

test("Distribution History renders accessible pagination controls outside table scroll", async () => {
  const [pageSource, cssSource] = await Promise.all([
    readSource(["pages", "DistributionHistoryPage.jsx"]),
    readSource(["index.css"]),
  ]);

  assert.match(pageSource, /aria-label="Distribution history pagination"/);
  assert.match(pageSource, /Rows per page/);
  assert.match(pageSource, /Go to previous distribution history page/);
  assert.match(pageSource, /Page \{currentPage\} of \{totalPages\}/);
  assert.match(pageSource, /Go to next distribution history page/);
  assert.match(pageSource, /<HistoryPaginationMetadata[\s\S]*?<HistoryPaginationNavigation/s);
  assert.match(pageSource, /className="distribution-history-table-scroll distribution-history-summary-scroll"[\s\S]*?<HistoryPaginationNavigation/s);
  assert.match(cssSource, /\.distribution-history-pagination-metadata \{/);
  assert.match(cssSource, /\.distribution-history-pagination-navigation \{/);
});

test("Distribution History splits top metadata from bottom navigation by result size", async () => {
  const source = await readSource(["pages", "DistributionHistoryPage.jsx"]);

  assert.match(source, /hasResults: totalItems > 0,/);
  assert.match(source, /hasMultiplePages: totalPages > 1,/);
  assert.match(source, /if \(!hasResults\) \{\s*return null;/);
  assert.match(source, /if \(!hasMultiplePages\) \{\s*return null;/);
  assert.match(
    source,
    /const HistoryPaginationMetadata = \([\s\S]*?Rows per page[\s\S]*?const HistoryPaginationNavigation/s,
  );
  assert.match(
    source,
    /const HistoryPaginationNavigation = \([\s\S]*?Previous[\s\S]*?Page \{currentPage\} of \{totalPages\}[\s\S]*?Next/s,
  );
  assert.match(
    source,
    /Showing \{firstVisibleItem\}-\{lastVisibleItem\} of \{totalItems\}/,
  );
  assert.doesNotMatch(source, /Showing 0-0 of 0/);
});

test("Distribution History stale responses cannot overwrite newer page results", async () => {
  const source = await readSource(["pages", "DistributionHistoryPage.jsx"]);

  assert.match(source, /const historyRequestIdRef = useRef\(0\)/);
  assert.match(source, /historyRequestIdRef\.current = requestId/);
  assert.match(source, /historyRequestIdRef\.current !== requestId/);
});

test("Distribution History export includes current search and omits current page params", async () => {
  const source = await readSource(["pages", "DistributionHistoryPage.jsx"]);

  assert.match(source, /search:\s*searchTerm\.trim\(\)/);
  assert.match(source, /search:\s*exportFilters\.search/);
  assert.doesNotMatch(source, /exportDistributionHistory\(\{[\s\S]*?page,/);
  assert.doesNotMatch(source, /exportDistributionHistory\(\{[\s\S]*?pageSize,/);
});
