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

test("Barangay Masterlist sends authoritative server pagination filters", async () => {
  const serviceSource = await readSource("src/features/masterlist/masterlistService.js");
  const pageSource = await readSource("src/pages/barangay/BarangayMasterlistPage.jsx");

  assert.match(serviceSource, /searchParams\.set\("page", page\)/);
  assert.match(serviceSource, /searchParams\.set\("pageSize", pageSize\)/);
  assert.match(serviceSource, /searchParams\.set\("search", search\.trim\(\)\)/);
  assert.match(serviceSource, /searchParams\.set\("sector_ids", sectorIds\.join\(","\)\)/);
  assert.match(serviceSource, /searchParams\.set\("sort_order", sortOrder\)/);
  assert.match(pageSource, /page: currentPage/);
  assert.match(pageSource, /pageSize/);
  assert.match(pageSource, /search: debouncedSearchTerm/);
  assert.match(pageSource, /sectorIds: selectedSectorIds/);
  assert.match(pageSource, /sortOrder: selectedSortOrder/);
});

test("Barangay Masterlist follows final conditional paginator UI", async () => {
  const tableSource = await readSource("src/components/masterlist/MasterlistTable.jsx");
  const paginationSource = await readSource("src/components/shared/TablePagination.jsx");
  const cssSource = await readSource("src/index.css");
  const normalizedTableSource = normalizeSource(tableSource);
  const normalizedCssSource = normalizeSource(cssSource);

  assert.match(normalizedTableSource, /paginationEnabled/);
  assert.match(normalizedTableSource, /<TablePagination/);
  assert.match(normalizedTableSource, /isVisible=\{paginationEnabled\}/);
  const populatedStart = normalizedTableSource.indexOf(
    '  return (\n    <section style={shellStyles.card}>',
    normalizedTableSource.indexOf("const areAllSelected"),
  );
  assert.ok(populatedStart >= 0);
  assertOrdered(normalizedTableSource.slice(populatedStart), [
    '<h3 className="table-card-title">Registered Family</h3>',
    "<TablePagination",
    '<div style={{ overflowX: "auto" }}>',
    "<table style={tableStyles.table}",
    "<thead>",
  ]);
  assert.doesNotMatch(normalizedTableSource, /masterlist-pagination-/);
  assert.match(paginationSource, /getLoadedEntriesLabel/);
  assert.match(paginationSource, /Rows per page/);
  assert.match(paginationSource, /FiChevronLeft/);
  assert.match(paginationSource, /FiChevronRight/);
  assert.match(paginationSource, /Page \{pagination\.currentPage\} of \{pagination\.totalPages\}/);
  assert.match(tableSource, /ariaLabel="Masterlist pagination"/);
  assert.match(normalizedCssSource, /\.table-pagination-bar/);
  assert.match(normalizedCssSource, /\.table-pagination-button/);
  assert.match(normalizedCssSource, /\.table-pagination-navigation span/);
  assert.doesNotMatch(normalizedCssSource, /masterlist-pagination-/);
});

test("Barangay Masterlist resets or revalidates page for result-scope changes", async () => {
  const pageSource = await readSource("src/pages/barangay/BarangayMasterlistPage.jsx");

  assert.match(pageSource, /setCurrentPage\(1\)/);
  assert.match(pageSource, /const safePage =\s*masterlistTotalPages > 0/);
  assert.match(pageSource, /if \(currentPage !== safePage\) \{\s*setCurrentPage\(safePage\)/);
  assert.match(pageSource, /SEARCH_DEBOUNCE_MS = 300/);
  assert.doesNotMatch(pageSource, /exportBarangayMasterlist\(\{[\s\S]*page,/);
  assert.doesNotMatch(pageSource, /exportBarangayMasterlist\(\{[\s\S]*pageSize,/);
});
