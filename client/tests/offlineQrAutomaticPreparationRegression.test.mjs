import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../src/${file}`, import.meta.url), "utf8");

test("automatic dashboard rows inherit the same event and barangay shape as manual details", async () => {
  const source = await read("features/stubs/stubService.js");
  assert.match(source, /disaster_event_id: row\.disaster_event_id \|\| responseData\.disaster_event\?\.id \|\| disasterEventId/);
  assert.match(source, /disaster_event: row\.disaster_event \|\| responseData\.disaster_event/);
  assert.match(source, /barangay_id: row\.barangay_id \|\| responseData\.assigned_barangay\?\.id/);
  assert.match(source, /upsertOfflineStubSnapshots\(responseData\?\.data \|\| \[\]\)/);
});

test("readiness validates the production QR lookup fields after persistence", async () => {
  const preparation = await read("offline/offlinePreparation.js");
  const cache = await read("features/stubs/stubCache.js");
  assert.match(preparation, /getCachedStubDetailsByQrValue/);
  assert.match(preparation, /qrReadBack\.every\(Boolean\)/);
  assert.match(preparation, /normalizeOfflineStubQrKey/);
  assert.match(cache, /normalizeOfflineStubQrKey/);
  assert.match(cache, /qr_code_value/);
  assert.match(cache, /OFFLINE_QR_STUB_NOT_CACHED/);
});

test("readiness cannot be READY when required read-back fails", async () => {
  const source = await read("offline/offlinePreparation.js");
  assert.match(source, /if \(!qrReadBack\.every\(Boolean\) \|\| !masterlistReadBack/);
  assert.match(source, /OFFLINE_PREPARATION_STATUS\.PARTIAL/);
});
