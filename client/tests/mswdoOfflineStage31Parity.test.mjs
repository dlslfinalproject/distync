import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (relativePath) =>
  readFile(resolve(process.cwd(), relativePath), "utf8");

test("MSWDO preparation persists shared registration references", async () => {
  const source = await read("src/features/offline/mswdoOfflinePreparation.js");

  assert.match(source, /fetchEvacuationCenters\(\)/);
  assert.match(source, /cacheRegistrationActiveDisasterEvents/);
  assert.match(source, /cacheRegistrationBarangays/);
  assert.match(source, /cacheRegistrationSectors/);
  assert.match(source, /cacheRegistrationEvacuationCenters/);
  assert.match(source, /cacheSelectedDisasterEvent/);
});

test("MSWDO registration options short-circuit network access offline", async () => {
  const source = await read("src/features/household-registration/useHouseholdRegistrationForm.js");

  assert.match(source, /if \(isOffline\) \{[\s\S]*OFFLINE_USE_CACHED_REGISTRATION_REFERENCES/);
  assert.match(source, /let centers = isOffline/);
  assert.match(source, /getCachedEvacuationCentersByBarangay/);
});

test("MSWDO details and departure use prepared local records offline", async () => {
  const source = await read("src/features/mswdo-masterlist/useMswdoMasterlistPage.js");

  assert.match(source, /const isOffline = typeof navigator/);
  assert.match(source, /selectedRow\?\.offline_household_details/);
  assert.match(source, /getMswdoOfflineHouseholdDetails/);
  assert.match(source, /barangayId: row\?\.barangay_id/);
  assert.match(source, /resolveFamilyHeadName/);
});
