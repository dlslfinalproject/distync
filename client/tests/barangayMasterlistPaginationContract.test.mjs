import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const readSource = (relativePath) =>
  fs.readFile(path.join(__dirname, "..", relativePath), "utf8");

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
  const cssSource = await readSource("src/index.css");

  assert.match(tableSource, /paginationTotalItems > 0/);
  assert.match(tableSource, /Showing \$\{firstVisibleItem\}-\$\{lastVisibleItem\} of \$\{paginationTotalItems\}/);
  assert.match(tableSource, /const hasMultiplePages = totalPages > 1/);
  assert.match(tableSource, /Rows per page/);
  assert.match(tableSource, /Previous/);
  assert.match(tableSource, /Page \{currentPage\} of \{totalPages\}/);
  assert.match(tableSource, /Next/);
  assert.match(tableSource, /aria-label="Masterlist pagination"/);
  assert.match(cssSource, /\.masterlist-pagination-metadata/);
  assert.match(cssSource, /\.masterlist-pagination-navigation/);
  assert.match(cssSource, /\.masterlist-pagination-controls span/);
});

test("Barangay Masterlist resets or revalidates page for result-scope changes", async () => {
  const pageSource = await readSource("src/pages/barangay/BarangayMasterlistPage.jsx");

  assert.match(pageSource, /setCurrentPage\(1\)/);
  assert.match(pageSource, /setCurrentPage\(masterlistTotalPages\)/);
  assert.match(pageSource, /SEARCH_DEBOUNCE_MS = 300/);
  assert.doesNotMatch(pageSource, /exportBarangayMasterlist\(\{[\s\S]*page,/);
  assert.doesNotMatch(pageSource, /exportBarangayMasterlist\(\{[\s\S]*pageSize,/);
});
