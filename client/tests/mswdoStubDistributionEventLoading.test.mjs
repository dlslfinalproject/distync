import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const readSource = async (relativePath) =>
  fs.readFile(new URL(relativePath, import.meta.url), "utf8");

test("MSWDO-LOAD-01/02/03/04 distribution waits for event options before authoritatively selecting an event", async () => {
  const source = await readSource(
    "../src/features/stubs/useMswdoStubDistribution.js",
  );

  assert.match(
    source,
    /const \[selectedDisasterEventId, setSelectedDisasterEventIdState\] = useState\(""\)/,
  );
  assert.match(source, /const \[isEventSelectionResolved, setIsEventSelectionResolved\]/);
  assert.match(source, /setIsEventSelectionResolved\(false\)/);
  assert.match(source, /readOperationalDisasterEventId\(\{\s*roleCode: ROLE_CODES\.MSWDO,\s*userId,/s);
  assert.match(source, /resolveOperationalDisasterEventId\(\{\s*availableEvents: allEvents,\s*preferredEventId: storedEventId,\s*fallbackEventId,/s);
  assert.match(source, /setSelectedDisasterEventIdState\(nextSelectedEventId\)/);
  assert.match(source, /setIsEventSelectionResolved\(true\)/);
});

test("MSWDO-LOAD-05/06 distribution has one authoritative user event-change path", async () => {
  const source = await readSource(
    "../src/features/stubs/useMswdoStubDistribution.js",
  );

  const setterCalls = source.match(/setSelectedDisasterEventIdState\(/g) || [];
  assert.equal(setterCalls.length, 3);
  assert.match(source, /const setSelectedDisasterEventId = useCallback/);
  assert.match(source, /persistOperationalDisasterEventSelection\(\{\s*roleCode: ROLE_CODES\.MSWDO,/s);
});

test("MSWDO-LOAD-07 distribution data loading waits for resolved event selection", async () => {
  const source = await readSource(
    "../src/features/stubs/useMswdoStubDistribution.js",
  );

  assert.match(
    source,
    /if \(\s*!isEventSelectionResolved \|\|\s*isLoadingFilters \|\|\s*!selectedDisasterEventId \|\|\s*!selectedBarangayId/s,
  );
  assert.match(source, /fetchBarangayStubDashboard\(\{\s*disasterEventId: selectedDisasterEventId,\s*barangayId: selectedBarangayId,/s);
  assert.doesNotMatch(source, /overrideBarangayId: selectedBarangayId/);
});

test("MSWDO-LOAD-08 stale distribution responses cannot commit after a newer request", async () => {
  const source = await readSource(
    "../src/features/stubs/useMswdoStubDistribution.js",
  );

  assert.match(source, /const dataRequestSeqRef = useRef\(0\)/);
  assert.match(source, /dataRequestSeqRef\.current = requestSeq/);
  assert.match(
    source,
    /if \(!isMounted \|\| dataRequestSeqRef\.current !== requestSeq\) \{\s*return;\s*\}/,
  );
  assert.match(
    source,
    /if \(isMounted && dataRequestSeqRef\.current === requestSeq\) \{\s*setIsLoadingData\(false\);/s,
  );
});

test("MSWDO distribution includes pending local rows in specific and all-Barangay scopes", async () => {
  const hookSource = await readSource(
    "../src/features/stubs/useMswdoStubDistribution.js",
  );
  const rowsSource = await readSource("../src/features/stubs/stubOfflineRows.js");

  assert.match(hookSource, /includeAllBarangays: isAllBarangays/);
  assert.match(rowsSource, /includeAllBarangays = false/);
  assert.match(rowsSource, /includeAllBarangays \|\|/);
});

test("MSWDO distribution expands to a complete local page set when pending rows exist", async () => {
  const source = await readSource(
    "../src/features/stubs/useMswdoStubDistribution.js",
  );

  assert.match(source, /MAX_SERVER_STUB_PAGE_SIZE = 100/);
  assert.match(source, /firstFullPayload = await fetchDashboardPage/);
  assert.match(source, /requestedPageSize: MAX_SERVER_STUB_PAGE_SIZE/);
  assert.match(source, /for \(let nextPage = 2; nextPage <= totalServerPages/);
  assert.match(source, /setServerPagination\(usesLocalPagination \? null/);
  assert.match(source, /setPendingLocalRows\(usesLocalPagination \? localRowsForDisplay/);
});

test("MSWDO distribution active/ended tab reconciliation waits for filter resolution", async () => {
  const source = await readSource("../src/pages/mswdo/StubDistributionPage.jsx");

  assert.match(source, /isEventSelectionResolved,/);
  assert.match(
    source,
    /if \(isLoadingFilters \|\| !isEventSelectionResolved\) \{\s*return;\s*\}/,
  );
});

test("MSWDO distribution keeps a background refresh silent when filter responses rerun data dependencies", async () => {
  const [source, pageSource] = await Promise.all([
    readSource("../src/features/stubs/useMswdoStubDistribution.js"),
    readSource("../src/pages/mswdo/StubDistributionPage.jsx"),
  ]);

  assert.match(source, /const selectedEventStatus = useMemo\(/);
  assert.match(source, /const sectorOptionsKey = useMemo\(/);
  assert.doesNotMatch(
    source,
    /isLoadingFilters,\s*reloadKey,\s*disasterEvents,\s*sectors,\s*page,/s,
  );
  assert.match(
    source,
    /rearmBackgroundDataRefreshIfContextChanged[\s\S]*backgroundReloadRef\.current = true;/,
  );
  assert.match(
    source,
    /if \(!preserveExistingData\) \{\s*setIsLoadingData\(true\);\s*\}/,
  );
  assert.match(source, /isInitialLoadingData: isLoadingData && !isRefreshingData/);
  assert.match(
    source,
    /if \(preserveExistingData\) \{[\s\S]*setBackgroundRefreshErrorMessage\([\s\S]*Unable to refresh relief goods distribution\. Showing the last successful data\.[\s\S]*return;/,
  );
  assert.match(source, /hasLoadedData: hasLoadedDataRef\.current/);
  assert.match(pageSource, /errorMessage=\{errorMessage\}/);
  assert.match(pageSource, /backgroundRefreshErrorMessage && hasLoadedData/);
});

test("MSWDO distribution keeps repeated background refresh cycles on the silent path", async () => {
  const source = await readSource(
    "../src/features/stubs/useMswdoStubDistribution.js",
  );

  assert.match(source, /const reloadDashboard = \(options = \{\}\) =>/);
  assert.match(source, /backgroundReloadRef\.current = isBackground/);
  assert.match(source, /backgroundReloadRef\.current = false/);
  assert.match(
    source,
    /setFiltersReloadKey\(\(currentValue\) => currentValue \+ 1\)/,
  );
  assert.match(
    source,
    /setReloadKey\(\(currentValue\) => currentValue \+ 1\)/,
  );
  assert.match(
    source,
    /isInitialLoadingData: isLoadingData && !isRefreshingData/,
  );
});

test("MSWDO distribution does not add a foreground refresh to the sync maintenance cycle", async () => {
  const [pageSource, hookSource, layoutSource, syncSource] = await Promise.all([
    readSource("../src/pages/mswdo/StubDistributionPage.jsx"),
    readSource("../src/features/stubs/useMswdoStubDistribution.js"),
    readSource("../src/components/layout/BarangayLayout.jsx"),
    readSource("../src/offline/syncService.js"),
  ]);

  assert.doesNotMatch(pageSource, /subscribeToSyncUpdates/);
  assert.match(
    hookSource,
    /handleSyncQueueUpdated[\s\S]*reloadDashboard\(\{ background: true \}\)/,
  );
  assert.match(layoutSource, /DASHBOARD_REVALIDATION_INTERVAL_MS = 30 \* 1000/);
  assert.match(syncSource, /notifySyncListeners\(\{ type: "finished", source \}\)/);
});
