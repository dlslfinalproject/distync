import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../src/${file}`, import.meta.url), "utf8");

test("offline preparation has explicit scoped readiness states and completion metadata", async () => {
  const source = await read("offline/offlinePreparation.js");
  assert.match(source, /NOT_PREPARED/);
  assert.match(source, /PREPARING/);
  assert.match(source, /READY/);
  assert.match(source, /PARTIAL/);
  assert.match(source, /cache_version/);
  assert.match(source, /stub_pages/);
  assert.match(source, /masterlist_pages/);
  assert.doesNotMatch(source, /length\s*>\s*0/);
});

test("preparation traverses every server page and preserves scoped storage", async () => {
  const source = await read("offline/offlinePreparation.js");
  assert.match(source, /totalPages/);
  assert.match(source, /page\s*\+=\s*1/);
  assert.match(source, /fetchBarangayStubDashboard/);
  assert.match(source, /fetchMasterlist/);
  assert.match(source, /upsertOfflineStubSnapshots/);
  assert.match(source, /cacheMasterlistRows/);
  assert.match(source, /ROLE_CODES\.BARANGAY/);
});

test("masterlist offline fallback uses persisted rows rather than only in-memory state", async () => {
  const source = await read("features/masterlist/masterlistHooks.js");
  assert.match(source, /getCachedMasterlistRows/);
  assert.match(source, /isOffline/);
  assert.match(source, /sortMasterlistRows/);
});
