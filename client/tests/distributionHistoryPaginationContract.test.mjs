import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const sourcePath = (...segments) => path.join(process.cwd(), "src", ...segments);

const readSource = (relativePath) =>
  fs.readFile(sourcePath(...relativePath), "utf8");

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
  const [pageSource, paginationSource, cssSource] = await Promise.all([
    readSource(["pages", "DistributionHistoryPage.jsx"]),
    readSource(["components", "shared", "TablePagination.jsx"]),
    readSource(["index.css"]),
  ]);
  const normalizedPageSource = normalizeSource(pageSource);
  const normalizedCssSource = normalizeSource(cssSource);

  assert.match(normalizedPageSource, /<TablePagination/);
  assert.match(normalizedPageSource, /ariaLabel="Distribution history pagination"/);
  assert.match(normalizedPageSource, /previousAriaLabel="Go to previous distribution history page"/);
  assert.match(normalizedPageSource, /nextAriaLabel="Go to next distribution history page"/);
  assert.match(paginationSource, /Rows per page/);
  assert.match(paginationSource, /FiChevronLeft/);
  assert.match(paginationSource, /FiChevronRight/);
  assert.match(paginationSource, /Page \{pagination\.currentPage\} of \{pagination\.totalPages\}/);
  assert.match(
    normalizedPageSource,
    /<TablePagination[\s\S]*?className="distribution-history-table-scroll distribution-history-summary-scroll"/,
  );
  assert.match(normalizedCssSource, /\.table-pagination-bar/);
  assert.match(normalizedCssSource, /\.table-pagination-button/);
});

test("Distribution History uses one canonical paginator above the active table", async () => {
  const source = await readSource(["pages", "DistributionHistoryPage.jsx"]);
  const normalizedSource = normalizeSource(source);

  assert.match(normalizedSource, /<TablePagination/);
  assert.match(normalizedSource, /isVisible=\{!isLoadingHistory && !errorMessage\}/);
  assert.doesNotMatch(normalizedSource, /HistoryPaginationMetadata|HistoryPaginationNavigation/);
  assert.doesNotMatch(normalizedSource, /Showing \{firstVisibleItem\}-\{lastVisibleItem\} of \{totalItems\}/);
  assertOrdered(normalizedSource, [
    '<section className="distribution-history-records-card"',
    '<h3 className="table-card-title">Distribution Records</h3>',
    "<TablePagination",
    'className="distribution-history-table-scroll',
    "<table className=",
    "<thead>",
  ]);
  assert.doesNotMatch(
    normalizedSource,
    /distribution-history-pagination-|distribution-history-records-(?:header|title-group)/,
  );
});

test("Distribution History clamps the page when the authoritative result set shrinks", async () => {
  const source = await readSource(["pages", "DistributionHistoryPage.jsx"]);

  assert.match(source, /const safePage =\s*totalPages > 0/);
  assert.match(source, /if \(page !== safePage\) \{\s*setPage\(safePage\)/);
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
