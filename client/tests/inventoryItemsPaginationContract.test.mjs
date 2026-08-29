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

test("Items Record table uses a consistent above-table responsive paginator", async () => {
  const [pageSource, tableSource, paginationSource, cssSource] = await Promise.all([
    readSource("src/pages/inventory/InventoryItemsPage.jsx"),
    readSource("src/components/inventory-items/InventoryItemsTable.jsx"),
    readSource("src/components/shared/TablePagination.jsx"),
    readSource("src/index.css"),
  ]);
  const normalizedPageSource = normalizeSource(pageSource);
  const normalizedTableSource = normalizeSource(tableSource);
  const normalizedCssSource = normalizeSource(cssSource);

  assert.match(normalizedTableSource, /TABLE_PAGE_SIZE_OPTIONS/);
  assert.match(normalizedTableSource, /const \[currentPage, setCurrentPage\] = useState\(1\)/);
  assert.match(normalizedTableSource, /const \[pageSize, setPageSize\] = useState/);
  assert.match(normalizedTableSource, /const paginatedRows = safeRows\.slice\(/);
  assert.match(
    normalizedTableSource,
    /useEffect\(\(\) => \{\s*setCurrentPage\(1\);\s*\}, \[rows\]\)/s,
  );
  assert.match(normalizedTableSource, /const paginationBar = \(/);
  assert.match(normalizedTableSource, /<TablePagination/);
  assert.match(normalizedTableSource, /isVisible=\{showPagination\}/);
  assert.match(paginationSource, /TABLE_PAGE_SIZE_OPTIONS/);
  assert.match(paginationSource, /getLoadedEntriesLabel/);
  assert.match(paginationSource, /Rows per page/);
  assert.match(paginationSource, /FiChevronLeft/);
  assert.match(paginationSource, /FiChevronRight/);
  assert.match(paginationSource, /Page \{pagination\.currentPage\} of \{pagination\.totalPages\}/);
  assert.match(paginationSource, /disabled=\{disabled \|\| !pagination\.hasPreviousPage\}/);
  assert.match(paginationSource, /disabled=\{disabled \|\| !pagination\.hasNextPage\}/);
  assert.match(paginationSource, /aria-label=\{ariaLabel\}/);
  assert.match(normalizedCssSource, /\.table-card-title/);
  assert.match(
    normalizedCssSource,
    /\.table-card-title \{[\s\S]*?font-size: 20px;[\s\S]*?font-weight: 700;[\s\S]*?line-height: 1\.2;[\s\S]*?margin: 0 0 16px;/,
  );
  assert.match(normalizedCssSource, /\.table-pagination-bar/);
  assert.match(normalizedCssSource, /\.table-pagination-button/);
  assert.match(normalizedCssSource, /\.table-pagination-navigation span/);
  assert.doesNotMatch(normalizedCssSource, /inventory-items-pagination-/);

  assertOrdered(normalizedPageSource, [
    '<section className="inventory-items-records-card"',
    '<h3 className="table-card-title">',
    "<InventoryItemsTable",
  ]);
  assertOrdered(normalizedTableSource, [
    "const paginationBar = (",
    "<TablePagination",
    'className="inventory-items-table-scroll"',
    '<table className="inventory-items-table"',
    "<thead>",
  ]);
});
