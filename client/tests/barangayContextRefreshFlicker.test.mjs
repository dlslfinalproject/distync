import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const readSource = async (relativePath) =>
  fs.readFile(new URL(relativePath, import.meta.url), "utf8");

test("Barangay dashboard keeps unresolved context separate from resolved no-assignment", async () => {
  const source = await readSource(
    "../src/features/barangay-dashboard/useBarangayDashboard.js",
  );

  assert.match(source, /const \[isContextResolved, setIsContextResolved\] = useState\(false\)/);
  assert.match(source, /const requestSeqRef = useRef\(0\)/);
  assert.match(
    source,
    /if \(!hasScopedBarangayContext\) \{[\s\S]*setIsContextResolved\(false\);[\s\S]*setErrorMessage\(""\);[\s\S]*setErrorCode\(""\);/s,
  );
  assert.match(
    source,
    /if \(allowFallback\) \{[\s\S]*setIsContextResolved\(true\);[\s\S]*Select a fallback barangay to continue\./s,
  );
  assert.match(source, /setIsContextResolved\(true\)/);
  assert.match(source, /isContextResolved,/);
});

test("Barangay dashboard overview keeps unresolved context free of transient loading copy", async () => {
  const source = await readSource(
    "../src/components/barangay-dashboard/BarangayDashboardOverview.jsx",
  );

  assert.match(source, /const showFallbackOverride =\s*isContextResolved && allowFallback && !hasAssignedBarangay/);
  assert.match(source, /assignedBarangay\?\.name \|\|/);
  assert.match(source, /isContextResolved \? "No assigned barangay" : "—"/);
  assert.doesNotMatch(source, /Resolving barangay\.\.\./);
  assert.doesNotMatch(source, /Preparing barangay and event context\.\.\./);
  assert.doesNotMatch(source, /Loading barangay dashboard\.\.\./);
  assert.match(source, /isContextResolved && !isLoading && stateMessage/);
});

test("Barangay event selector keeps a stable scope placeholder while context resolves", async () => {
  const source = await readSource(
    "../src/components/barangay-dashboard/BarangayDashboardOverview.jsx",
  );

  assert.match(source, /const getEventSelectPlaceholder = \(eventScope\) => \{/);
  assert.doesNotMatch(source, /Loading event context\.\.\./);
  assert.match(source, /eventScope === "ended"[\s\S]*\? "Select ended disaster event"[\s\S]*: "Select active disaster event"/s);
  assert.match(source, /const eventSelectValue = isContextResolved \? selectedDisasterEventId : ""/);
  assert.match(source, /disabled=\{!isContextResolved \|\| isLoading \|\| !hasEvents\}/);
  assert.doesNotMatch(source, /Select \$\{scopeLabel\.toLowerCase\(\)\} disaster event/);
});

test("Barangay dashboard retains confirmed event context through offline refreshes", async () => {
  const source = await readSource(
    "../src/features/barangay-dashboard/useBarangayDashboard.js",
  );

  assert.match(source, /const skipSelectedEventReloadRef = useRef\(""\)/);
  assert.match(source, /skipSelectedEventReloadRef\.current === selectedDisasterEventId/);
  assert.match(source, /const canRestoreOfflineContext = \(error\) =>/);
  assert.match(source, /readOperationalDisasterEventContext\(\{/);
  assert.match(source, /available_events: preparedEvents/);
  assert.match(source, /selected_event: retainedEvent/);
  assert.match(source, /setPayload\(\{\s*\.\.\.emptyPayload,\s*event_scope: eventScope,\s*\}\)/s);
  assert.match(source, /nextSelectedEvent\.id !== selectedDisasterEventId[\s\S]*skipSelectedEventReloadRef\.current = nextSelectedEvent\.id/s);
});

test("Barangay shell seeds compact navigation state before first paint", async () => {
  const source = await readSource(
    "../src/components/layout/BarangayLayout.jsx",
  );

  assert.match(source, /const COMPACT_NAV_QUERY = "\(max-width: 1024px\)"/);
  assert.match(source, /const getInitialMediaQueryMatch = \(query\) => \{/);
  assert.match(source, /useState\(\(\) =>\s*getInitialMediaQueryMatch\(COMPACT_NAV_QUERY\),\s*\)/s);
  assert.match(source, /const \[isCompactNavigation, setIsCompactNavigation\] = useState\(\(\) =>\s*getInitialMediaQueryMatch\(COMPACT_NAV_QUERY\),\s*\)/s);
  assert.match(source, /setIsCompactNavigation\(compactMediaQuery\.matches\)/);
  assert.match(source, /if \(!isCompactNavigation \|\| isDonorPortal\) \{/);
});

test("Barangay Masterlist and Relief Distribution both pass resolved context to the shared overview", async () => {
  const masterlistSource = await readSource(
    "../src/pages/barangay/BarangayMasterlistPage.jsx",
  );
  const distributionSource = await readSource(
    "../src/pages/barangay/StubDistributionPage.jsx",
  );

  assert.match(masterlistSource, /isContextResolved: isBarangayContextResolved/);
  assert.match(masterlistSource, /isContextResolved=\{isBarangayContextResolved\}/);
  assert.match(distributionSource, /isContextResolved: isBarangayContextResolved/);
  assert.match(distributionSource, /isContextResolved=\{isBarangayContextResolved\}/);
});
