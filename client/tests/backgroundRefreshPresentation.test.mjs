import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const readSource = async (relativePath) =>
  fs.readFile(new URL(relativePath, import.meta.url), "utf8");

const getSection = (source, startMarker, endMarker) => {
  const start = source.indexOf(startMarker);
  const end = endMarker ? source.indexOf(endMarker, start) : source.length;

  assert.ok(start >= 0, `Missing source marker: ${startMarker}`);
  return source.slice(start, end >= 0 ? end : source.length);
};

test("Masterlist keeps the initial loader but preserves rows during automatic refresh", async () => {
  const [hookSource, syncSource, pageSource, tableSource] = await Promise.all([
    readSource("../src/features/masterlist/masterlistHooks.js"),
    readSource("../src/features/masterlist/useBarangayMasterlistSync.js"),
    readSource("../src/pages/barangay/BarangayMasterlistPage.jsx"),
    readSource("../src/components/masterlist/MasterlistTable.jsx"),
  ]);

  assert.match(
    hookSource,
    /const preserveExistingData =\s*\(isNewRequestContext && Boolean\(cacheEntry\)\)[\s\S]*lastSuccessfulRequestKeyRef\.current === requestKey/,
  );
  assert.match(
    hookSource,
    /isInitialLoading: visibleIsLoading && !visibleIsRefreshing/,
  );
  assert.match(
    hookSource,
    /if \(!preserveExistingData\) \{\s*setIsLoading\(true\);[\s\S]*setIsRefreshing\(preserveExistingData\);[\s\S]*try \{/,
  );
  assert.match(hookSource, /page,[\s\S]*search,[\s\S]*sectorIds:/);
  assert.match(syncSource, /REMOTE_MASTERLIST_REVALIDATION_INTERVAL_MS = 60 \* 1000/);
  assert.match(syncSource, /reloadMasterlist\(\{ background: true \}\)/);
  assert.match(pageSource, /<MasterlistTable[\s\S]*isLoading=\{isInitialLoading\}/);
  assert.match(tableSource, /if \(isLoading\) \{[\s\S]*Loading masterlist data/);
});

test("Masterlist records a completed empty result without using row count as load state", async () => {
  const hookSource = await readSource("../src/features/masterlist/masterlistHooks.js");

  assert.match(hookSource, /lastSuccessfulRequestKeyRef\.current = requestKey/);
  assert.match(hookSource, /setData\(result\);[\s\S]*lastSuccessfulRequestKeyRef\.current = requestKey/);
  assert.doesNotMatch(hookSource, /rows\.length === 0/);
});

test("Sync History keeps its initial loader while retaining the current table during background refresh", async () => {
  const source = await readSource("../src/pages/SyncManagementPage.jsx");
  const historySection = getSection(
    source,
    '{activeSyncTab === "AUDIT" ? (',
    '{activeSyncTab === "CONFLICTS" ? (',
  );

  assert.match(source, /const \[hasLoadedHistory, setHasLoadedHistory\] = useState\(false\)/);
  assert.match(
    source,
    /const preserveExistingData =\s*Boolean\(background\) && hasLoadedHistoryRef\.current/,
  );
  assert.match(source, /hasLoadedHistoryRef\.current = true;\s*setHasLoadedHistory\(true\)/);
  assert.match(source, /void loadSyncHistory\(\);/);
  assert.match(source, /void loadSyncHistory\(\{ background: true \}\);/);
  assert.match(source, /window\.setInterval\(refreshSyncHistory, 30000\)/);
  assert.match(historySection, /isVisible=\{!isInitialHistoryLoading && !errorMessage\}/);
  assert.match(historySection, /disabled=\{isInitialHistoryLoading\}/);
  assert.match(historySection, /\{isInitialHistoryLoading \? \([\s\S]*Loading sync history\.\.\./);
  assert.match(historySection, /currentPage=\{auditPagination\.page\}/);
});

test("Masterlist return visits hydrate a bounded context-safe memory cache", async () => {
  const source = await readSource("../src/features/masterlist/masterlistHooks.js");

  assert.match(source, /const MASTERLIST_MEMORY_CACHE_LIMIT = 24/);
  assert.match(source, /const masterlistDataCache = new Map\(\)/);
  assert.match(source, /const buildMasterlistRequestKey =/);
  assert.match(source, /role: "barangay"/);
  assert.match(source, /disasterEventId: String\(disasterEventId \|\| ""\)/);
  assert.match(source, /barangayId: String\(barangayId \|\| ""\)/);
  assert.match(source, /initialCacheEntry\?\.data/);
  assert.match(source, /const isNewRequestContext =/);
  assert.match(source, /setMasterlistCacheEntry\(requestKey, \{\s*data: result/);
  assert.match(source, /isInitialLoading: visibleIsLoading && !visibleIsRefreshing/);
});

test("Relief Distribution return visits hydrate a context-safe memory cache without caching route components", async () => {
  const [hookSource, routesSource] = await Promise.all([
    readSource("../src/features/stubs/useStubDashboard.js"),
    readSource("../src/routes/AppRoutes.jsx"),
  ]);

  assert.match(hookSource, /const STUB_DASHBOARD_MEMORY_CACHE_LIMIT = 24/);
  assert.match(hookSource, /const stubDashboardDataCache = new Map\(\)/);
  assert.match(hookSource, /const buildStubDashboardRequestKey =/);
  assert.match(hookSource, /userId: String\(userId \|\| ""\)/);
  assert.match(hookSource, /disasterEventId: String\(disasterEventId \|\| ""\)/);
  assert.match(hookSource, /overrideBarangayId: String\(overrideBarangayId \|\| ""\)/);
  assert.match(hookSource, /initialCacheEntry\?\.dashboard/);
  assert.match(hookSource, /setStubDashboardCacheEntry\(requestKey, \{\s*dashboard: nextDashboard/);
  assert.match(hookSource, /isInitialLoading: visibleIsLoading && !visibleIsRefreshing/);
  assert.doesNotMatch(routesSource, /DashboardRouteOutletCache|keep.*mounted/i);
});

test("Sync History background refreshes do not replace the selected tab or pagination state", async () => {
  const source = await readSource("../src/pages/SyncManagementPage.jsx");
  const backgroundRefreshCalls = source.match(/loadSyncHistory\(\{ background: true \}\)/g) || [];

  assert.ok(backgroundRefreshCalls.length >= 3);
  assert.match(source, /const \[activeSyncTab, setActiveSyncTab\] = useState\("QUEUE"\)/);
  assert.match(source, /const \[paginationByTab, setPaginationByTab\] = useState\(/);
  assert.match(source, /updatePaginationPage\("AUDIT", page\)/);
  assert.match(source, /updatePaginationPageSize\("AUDIT", pageSize\)/);
});
