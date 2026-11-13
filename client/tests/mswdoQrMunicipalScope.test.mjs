import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (relativePath) =>
  fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("MSWDO QR path keeps event validation without selected-Barangay rejection", () => {
  const source = read("src/pages/mswdo/StubDistributionPage.jsx");

  assert.match(source, /stubEventId !== selectedDisasterEventId/);
  assert.doesNotMatch(source, /stubBarangayId !== selectedBarangayId/);
  assert.match(source, /pendingClaimStubDetails\?\.barangay\?\.id/);
});

test("MSWDO offline cache scope is event-wide while Barangay remains scoped", () => {
  const source = read("src/features/stubs/stubCache.js");

  assert.match(source, /ownerContext\.roleCode === ROLE_CODES\.MSWDO/);
  assert.match(source, /where\("disaster_event_id"\)/);
  assert.match(source, /where\("\[accessMode\+userId\+roleCode\+disaster_event_id\+barangay_id\]"\)/);
});
