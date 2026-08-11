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
  assert.match(source, /fetchBarangayStubDashboard\(\{\s*userId: null,\s*disasterEventId: selectedDisasterEventId,\s*overrideBarangayId: selectedBarangayId,/s);
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

test("MSWDO distribution active/ended tab reconciliation waits for filter resolution", async () => {
  const source = await readSource("../src/pages/mswdo/StubDistributionPage.jsx");

  assert.match(source, /isEventSelectionResolved,/);
  assert.match(
    source,
    /if \(isLoadingFilters \|\| !isEventSelectionResolved\) \{\s*return;\s*\}/,
  );
});
