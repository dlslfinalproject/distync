import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (relativePath) =>
  readFile(new URL(relativePath, import.meta.url), "utf8");

test("Stage 5 active All flow makes one explicit municipal Stub request", async () => {
  const source = await readSource(
    "../src/features/inventory-distribution/useInventoryDistribution.js",
  );

  assert.match(
    source,
    /fetchMunicipalStubDashboard\(\{[\s\S]*?disasterEventId: selectedDisasterEventId/,
  );
  assert.doesNotMatch(
    source,
    /selectableBarangays\.map\([\s\S]*?fetchBarangayStubDashboard/,
  );
  assert.doesNotMatch(source, /combineStubDashboardPayloads/);
});
test("Stage 5 selected flow keeps one selected-Barangay request and never sends municipal scope from the client", async () => {
  const source = await readSource(
    "../src/features/inventory-distribution/useInventoryDistribution.js",
  );

  assert.match(
    source,
    /fetchBarangayStubDashboard\(\{[\s\S]*?barangayId: selectedBarangayId/,
  );
  assert.doesNotMatch(source, /overrideBarangayId\s*:/);
  assert.doesNotMatch(source, /barangay_ids\s*:/);
});

test("Stage 5 municipal client service uses only disaster_event_id and preserves row-level Barangay identity", async () => {
  const source = await readSource("../src/features/stubs/stubService.js");
  const municipalSection = source.slice(
    source.indexOf("export const fetchMunicipalStubDashboard"),
    source.indexOf("export const searchStubs"),
  );

  assert.match(municipalSection, /\/api\/v1\/stubs\/municipal-dashboard/);
  assert.match(municipalSection, /disaster_event_id: disasterEventId/);
  assert.doesNotMatch(municipalSection, /barangay_id=/);
  assert.doesNotMatch(municipalSection, /assigned_barangay\?\.id/);
  assert.match(municipalSection, /row\.barangay_id/);
  assert.match(municipalSection, /upsertOfflineStubSnapshots\(responseData\.data\)/);
});

test("Stage 5 municipal request has generation guards for event, tab, and selected-vs-All races", async () => {
  const source = await readSource(
    "../src/features/inventory-distribution/useInventoryDistribution.js",
  );

  assert.match(source, /const stubRequestGenerationRef = useRef\(0\)/);
  assert.match(source, /const requestGeneration = \+\+stubRequestGenerationRef\.current/);
  assert.match(
    source,
    /stubRequestGenerationRef\.current === requestGeneration/,
  );
  assert.match(source, /selectedDisasterEventId/);
  assert.match(source, /selectedBarangayId/);
  assert.match(source, /activeTab/);
  assert.match(source, /if \(isCurrentRequest\(\)\)/);
});

test("Stage 5 municipal failure clears municipal rows and does not fall back to Barangay requests", async () => {
  const source = await readSource(
    "../src/features/inventory-distribution/useInventoryDistribution.js",
  );

  const municipalRequestStart = source.indexOf(
    "const payload = await fetchMunicipalStubDashboard",
  );
  const municipalRequestEnd = source.indexOf(
    "useEffect(() => {",
    municipalRequestStart,
  );
  const municipalRequestSection = source.slice(
    municipalRequestStart,
    municipalRequestEnd,
  );

  assert.match(municipalRequestSection, /catch \(error\)/);
  assert.match(
    municipalRequestSection,
    /setAllBarangaysStubDashboardPayload\(emptyStubDashboardPayload\)/,
  );
  assert.doesNotMatch(municipalRequestSection, /fetchBarangayStubDashboard/);
});
