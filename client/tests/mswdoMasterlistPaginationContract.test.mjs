import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const readSource = (relativePath) =>
  fs.readFile(path.join(process.cwd(), relativePath), "utf8");

const normalizeSource = (source) => source.replace(/\r\n/g, "\n");

test("MSWDO live-list requests opt into the existing server pagination contract", async () => {
  const source = normalizeSource(
    await readSource("src/features/mswdo-masterlist/mswdoMasterlistService.js"),
  );
  const liveStart = source.indexOf("export const fetchConsolidatedMasterlist");
  const liveEnd = source.indexOf(
    "export const fetchMswdoMasterlistExportMetadata",
    liveStart,
  );
  const liveSource = source.slice(liveStart, liveEnd);

  assert.match(liveSource, /page,/);
  assert.match(liveSource, /pageSize,/);
  assert.match(liveSource, /searchParams\.set\("page", page\)/);
  assert.match(liveSource, /searchParams\.set\("pageSize", pageSize\)/);
  assert.match(liveSource, /searchParams\.set\("search", search\.trim\(\)\)/);
  assert.match(liveSource, /searchParams\.set\("sector_ids", sectorCodes\.join\(","\)\)/);
  assert.match(liveSource, /searchParams\.set\("sort_order", sortOrder\)/);
  assert.match(liveSource, /recordStatus === "archived"/);
  assert.match(liveSource, /isPaginatedRequest/);
});

test("MSWDO no longer applies authoritative filtering, sorting, or slicing after page retrieval", async () => {
  const [hookSource, pageSource, tableSource] = await Promise.all([
    readSource("src/features/mswdo-masterlist/useMswdoMasterlist.js"),
    readSource("src/pages/mswdo/ConsolidatedMasterlistPage.jsx"),
    readSource("src/components/masterlist/MasterlistTable.jsx"),
  ]);
  const normalizedHookSource = normalizeSource(hookSource);
  const normalizedPageSource = normalizeSource(pageSource);

  assert.match(normalizedHookSource, /page: currentPage/);
  assert.match(normalizedHookSource, /pageSize/);
  assert.match(normalizedHookSource, /search: searchTerm/);
  assert.match(normalizedHookSource, /sectorCodes: selectedSectorIds/);
  assert.match(normalizedHookSource, /sortOrder: selectedSortOrder/);
  assert.match(normalizedHookSource, /const displayedRows = mappedRows/);
  assert.doesNotMatch(normalizedHookSource, /sortMasterlistRows/);
  assert.doesNotMatch(normalizedHookSource, /paginateRows/);
  assert.match(normalizedHookSource, /masterlistRequestSequenceRef/);

  assert.match(normalizedPageSource, /rows=\{displayedRows\}/);
  assert.match(normalizedPageSource, /pagination=\{\{/);
  assert.match(normalizedPageSource, /onPageChange=\{setCurrentPage\}/);
  assert.match(normalizedPageSource, /onPageSizeChange=\{setPageSize\}/);
  assert.doesNotMatch(normalizedPageSource, /paginateRows/);
  assert.doesNotMatch(normalizedPageSource, /getTablePaginationState/);
  assert.match(tableSource, /<TablePagination/);
});

test("MSWDO filter setters reset the server page while modal opens remain outside the reset contract", async () => {
  const hookSource = normalizeSource(
    await readSource("src/features/mswdo-masterlist/useMswdoMasterlist.js"),
  );
  const pageHookSource = normalizeSource(
    await readSource("src/features/mswdo-masterlist/useMswdoMasterlistPage.js"),
  );

  assert.match(hookSource, /const resetPage = useCallback/);
  for (const marker of [
    "setSelectedBarangayIdState(nextBarangayId);\n      resetPage();",
    "setSelectedSectorIdsState(nextSectorIds);\n      resetPage();",
    "setSelectedSortOrderState(nextSortOrder);\n      resetPage();",
    "setSearchTermState(nextSearchTerm);\n      resetPage();",
    "setRecordStatusState(nextRecordStatus);\n      resetPage();",
  ]) {
    assert.match(hookSource, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(hookSource, /setPageSizeState\(numericPageSize\);\n    setCurrentPageState\(1\)/);
  assert.match(pageHookSource, /setIsExportModalOpen\(false\)/);
  assert.match(pageHookSource, /setIsFilterOpen\(false\)/);
});

test("dashboard scope stays independent from live page/search/sector/sort changes", async () => {
  const source = normalizeSource(
    await readSource("src/features/mswdo-masterlist/useMswdoMasterlist.js"),
  );
  const dashboardStart = source.indexOf("const loadDashboard = async () =>");
  const dashboardEnd = source.indexOf("const mappedRows =", dashboardStart);
  const dashboardSource = source.slice(dashboardStart, dashboardEnd);

  assert.match(dashboardSource, /fetchConsolidatedMasterlistDashboard/);
  assert.match(
    dashboardSource,
    /\}, \[reloadKey, selectedBarangayId, selectedDisasterEventId\]\)/,
  );
  assert.doesNotMatch(dashboardSource, /currentPage|pageSize|searchTerm|selectedSectorIds|selectedSortOrder/);
});
