import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const readSource = (relativePath) =>
  fs.readFile(new URL(relativePath, import.meta.url), "utf8");

test("MSWDO bulk rows retain authoritative event and Barangay identity", async () => {
  const source = await readSource(
    "../src/features/stubs/useMswdoStubDistribution.js",
  );
  const pageSource = await readSource(
    "../src/pages/mswdo/StubDistributionPage.jsx",
  );

  assert.match(source, /disaster_event_id:[\s\S]*stubRow\.disaster_event_id[\s\S]*disasterEventId/);
  assert.match(source, /barangay_id:[\s\S]*stubRow\.barangay_id/);
  assert.match(source, /getMappedRows\(dashboard\.data \|\| \[\], selectedDisasterEventId\)/);
  assert.match(
    pageSource,
    /barangayId: row\?\.barangay\?\.id \|\| row\?\.barangay_id \|\| null,/,
  );
  assert.match(
    pageSource,
    /disasterEventId: row\?\.disaster_event\?\.id \|\| row\?\.disaster_event_id \|\| ""/,
  );
});

test("MSWDO queued claims keep per-record identity in the shared STUB_CLAIM payload", async () => {
  const serviceSource = await readSource(
    "../src/features/stubs/stubService.js",
  );

  assert.match(serviceSource, /barangay_id: barangayId \|\| null/);
  assert.match(serviceSource, /disaster_event_id: disasterEventId/);
  assert.match(serviceSource, /proof_type: normalizedProofType/);
  assert.match(serviceSource, /proof_photo_data_url: proofPhotoDataUrl \|\| null/);
  assert.match(serviceSource, /actionKey: "STUB_CLAIM"/);
});
