import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL(
    "../src/features/inventory-distribution/useInventoryDistribution.js",
    import.meta.url,
  ),
  "utf8",
);

test("Inventory Distribution uses supported barangay scope for a selected barangay", () => {
  assert.match(source, /barangayId:\s*selectedBarangayId/);

  assert.doesNotMatch(source, /overrideBarangayId:\s*selectedBarangayId/);
});

test("Inventory Distribution municipality aggregation delegates scope to the server", () => {
  assert.match(source, /fetchMunicipalStubDashboard\(/);
  assert.doesNotMatch(source, /barangayId:\s*barangay\.id/);
  assert.doesNotMatch(source, /overrideBarangayId:\s*barangay\.id/);
});

test("Inventory Distribution does not use development barangay overrides", () => {
  assert.doesNotMatch(source, /overrideBarangayId\s*:/);
});

test("Inventory Distribution resets record filters when switching event scopes", () => {
  assert.match(source, /const resetDistributionFilters = \(\) => \{/);
  assert.match(source, /setSearchTerm\(""\)/);
  assert.match(source, /setSelectedStatus\(""\)/);
  assert.match(source, /setSelectedSectorIds\(\[\]\)/);
  assert.match(source, /setSelectedSortOrder\("oldest"\)/);
  assert.match(
    source,
    /if \(isScopeChange\) \{\s*resetDistributionFilters\(\);\s*\}/,
  );
  assert.doesNotMatch(
    source,
    /const handleEventScopeChange = \(nextTab\) => \{[\s\S]*?setSelectedBarangayId\(""\);/,
  );
});

test("Inventory Distribution remembers event selection independently per scope", () => {
  assert.match(
    source,
    /const \[selectedDisasterEventIdsByTab, setSelectedDisasterEventIdsByTab\]/,
  );
  assert.match(
    source,
    /const selectedDisasterEventId =\s*selectedDisasterEventIdsByTab\[activeTab\] \|\| "";/,
  );
  assert.match(source, /const setSelectedDisasterEventId = useCallback\(/);
});

test("Inventory Distribution orders each event scope with the newest event first", () => {
  assert.match(source, /const getDisasterEventRecency = \(event\) => \{/);
  assert.match(
    source,
    /\.sort\(\s*\(leftEvent, rightEvent\) =>\s*getDisasterEventRecency\(rightEvent\) -\s*getDisasterEventRecency\(leftEvent\),/,
  );
});
