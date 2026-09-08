import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const readSource = (relativePath) =>
  fs.readFile(path.join(process.cwd(), "src", relativePath), "utf8");

test("MSWDO export metadata service is explicit and lightweight", async () => {
  const source = await readSource(
    "features/mswdo-masterlist/mswdoMasterlistService.js",
  );
  const metadataStart = source.indexOf(
    "export const fetchMswdoMasterlistExportMetadata",
  );
  const metadataEnd = source.indexOf(
    "export const fetchConsolidatedMasterlistDashboard",
    metadataStart,
  );
  const metadataSource = source.slice(metadataStart, metadataEnd);

  assert.notEqual(metadataStart, -1);
  assert.match(metadataSource, /masterlist\/export-metadata/);
  assert.match(metadataSource, /disaster_event_id/);
  assert.match(metadataSource, /record_status/);
  assert.match(metadataSource, /barangay_ids/);
  assert.match(metadataSource, /sector_ids/);
  assert.match(metadataSource, /sector_codes/);
  assert.doesNotMatch(metadataSource, /fetchConsolidatedMasterlist/);
  assert.doesNotMatch(metadataSource, /household|member|attendance|stub/i);
});

test("opening the MSWDO export modal no longer prefetches household rows", async () => {
  const pageSource = await readSource(
    "features/mswdo-masterlist/useMswdoMasterlistPage.js",
  );
  const serviceSource = await readSource(
    "features/mswdo-masterlist/mswdoMasterlistService.js",
  );
  const loaderStart = pageSource.indexOf(
    "const loadAvailableExportOptions = async () =>",
  );
  const loaderEnd = pageSource.indexOf(
    "\n    loadAvailableExportOptions();",
    loaderStart,
  );
  const loaderSource = pageSource.slice(loaderStart, loaderEnd);

  assert.notEqual(loaderStart, -1);
  assert.match(loaderSource, /fetchMswdoMasterlistExportMetadata/);
  assert.match(loaderSource, /recordStatus: selectedExportRecordStatus/);
  assert.doesNotMatch(loaderSource, /fetchConsolidatedMasterlist/);
  assert.doesNotMatch(loaderSource, /payload\.data|household_sectors|members/);
  assert.doesNotMatch(loaderSource, /fetchConsolidatedMasterlist|fetchMasterlist/);

  const exportStart = pageSource.indexOf("const handleExport = async (format) =>");
  const exportEnd = pageSource.indexOf("\n  return {", exportStart);
  const exportSource = pageSource.slice(exportStart, exportEnd);

  assert.match(exportSource, /exportConsolidatedMasterlist/);
  assert.match(serviceSource, /masterlist\/export\?/);
  assert.match(serviceSource, /exportConsolidatedMasterlist/);
});

test("metadata IDs/codes reuse existing MSWDO reference ordering and labels", async () => {
  const pageSource = await readSource(
    "features/mswdo-masterlist/useMswdoMasterlistPage.js",
  );
  const modalSource = await readSource(
    "components/mswdo-masterlist/MswdoExportModal.jsx",
  );

  assert.match(pageSource, /payload\.sector_codes/);
  assert.match(pageSource, /getCanonicalMemberSectorCode/);
  assert.match(pageSource, /payload\.barangay_ids/);
  assert.match(modalSource, /const selectableSectorIds = sectors\s*\.map/);
  assert.match(modalSource, /const selectableBarangayIds = barangays\s*\.map/);
  assert.match(modalSource, /sector\.display_name \|\| sector\.name/);
  assert.match(modalSource, /barangay\.name/);
});

test("live MSWDO table uses the server-authoritative paginated path while dashboard scope stays separate", async () => {
  const liveHookSource = await readSource(
    "features/mswdo-masterlist/useMswdoMasterlist.js",
  );
  const liveServiceSource = await readSource(
    "features/mswdo-masterlist/mswdoMasterlistService.js",
  );
  const pageSource = await readSource(
    "features/mswdo-masterlist/useMswdoMasterlistPage.js",
  );

  assert.match(liveHookSource, /fetchConsolidatedMasterlist\(\{/);
  assert.match(liveHookSource, /recordStatus,/);
  assert.match(liveHookSource, /page: currentPage/);
  assert.match(liveHookSource, /pageSize/);
  assert.match(liveHookSource, /search: searchTerm/);
  assert.match(liveHookSource, /sectorCodes: selectedSectorIds/);
  assert.match(liveHookSource, /sortOrder: selectedSortOrder/);
  assert.doesNotMatch(liveHookSource, /fetchConsolidatedMasterlist\(\{[\s\S]*\}\);[\s\S]*fetchConsolidatedMasterlist\(/);
  assert.match(liveServiceSource, /searchParams\.set\("page", page\)/);
  assert.match(liveServiceSource, /searchParams\.set\("pageSize", pageSize\)/);
  assert.match(liveServiceSource, /searchParams\.set\("sector_ids", sectorCodes\.join\(","\)\)/);
  assert.match(liveHookSource, /fetchConsolidatedMasterlistDashboard\(\{/);
  assert.doesNotMatch(liveHookSource, /sortMasterlistRows|paginateRows/);
  assert.match(pageSource, /fetchMswdoMasterlistExportMetadata/);
});
