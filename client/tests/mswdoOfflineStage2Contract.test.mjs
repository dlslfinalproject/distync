import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read = (path) => fs.readFile(new URL(path, import.meta.url), "utf8");

test("MSWDO Stage 2 keeps distribution online-only boundaries explicit", async () => {
  const access = await read("../src/features/offline/mswdoOfflineAccess.js");
  assert.match(access, /\/mswdo\/stub-distribution/);
  assert.doesNotMatch(access, /\/mswdo\/distribution-history/);
});

test("MSWDO preparation persists verified distribution and photo datasets", async () => {
  const source = await read("../src/features/offline/mswdoOfflinePreparation.js");
  assert.match(source, /fetchMunicipalStubDashboard/);
  assert.match(source, /fetchPhotoDataUrl/);
  assert.match(source, /distribution: \{ complete: distributionComplete/);
  assert.match(source, /photoCache: \{ complete: photoCacheComplete/);
  assert.match(source, /offline distribution data could not be verified/);
});

test("MSWDO offline lookup and claims reuse the durable stub cache and queue", async () => {
  const service = await read("../src/features/stubs/stubService.js");
  const cache = await read("../src/features/stubs/stubCache.js");
  assert.match(service, /getCachedStubDetailsByQrValue/);
  assert.match(service, /STUB_ALREADY_CLAIMED/);
  assert.match(cache, /family_head_photo_data_url/);
  assert.match(service, /performSyncableMutation/);
});

test("MSWDO offline banner states prepared relief distribution support", async () => {
  const source = await read("../src/components/layout/MswdoOfflineModeNotice.jsx");
  assert.match(source, /analytics data while offline\./);
  assert.match(source, /prepared relief distribution/);
});
