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

test("Barangay dashboard overview renders neutral unresolved context before no-assignment", async () => {
  const source = await readSource(
    "../src/components/barangay-dashboard/BarangayDashboardOverview.jsx",
  );

  assert.match(source, /const showFallbackOverride =\s*isContextResolved && allowFallback && !hasAssignedBarangay/);
  assert.match(source, /!isContextResolved\s*\?\s*"Resolving barangay\.\.\."/);
  assert.match(source, /if \(!isContextResolved\) \{[\s\S]*stateMessage = "Preparing barangay and event context\.\.\."/s);
  assert.match(source, /isContextResolved && !isLoading && stateMessage/);
});

test("Barangay event selector separates unresolved loading from scoped empty selection", async () => {
  const source = await readSource(
    "../src/components/barangay-dashboard/BarangayDashboardOverview.jsx",
  );

  assert.match(source, /const getEventSelectPlaceholder = \(eventScope, isContextResolved\) => \{/);
  assert.match(source, /if \(!isContextResolved\) \{[\s\S]*return "Loading event context\.\.\.";/s);
  assert.match(source, /eventScope === "ended"[\s\S]*\? "Select ended disaster event"[\s\S]*: "Select active disaster event"/s);
  assert.match(source, /const eventSelectValue = isContextResolved \? selectedDisasterEventId : ""/);
  assert.match(source, /disabled=\{!isContextResolved \|\| isLoading \|\| !hasEvents\}/);
  assert.doesNotMatch(source, /Select \$\{scopeLabel\.toLowerCase\(\)\} disaster event/);
});

test("Barangay dashboard clears stale event payload and skips self-triggered default refetch", async () => {
  const source = await readSource(
    "../src/features/barangay-dashboard/useBarangayDashboard.js",
  );

  assert.match(source, /const skipSelectedEventReloadRef = useRef\(""\)/);
  assert.match(source, /skipSelectedEventReloadRef\.current === selectedDisasterEventId/);
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
