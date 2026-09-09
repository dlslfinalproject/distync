import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const readSource = (file) =>
  fs.readFile(new URL(`../src/${file}`, import.meta.url), "utf8");

test("MSWDO offline notice uses truthful read-only copy and the Barangay banner structure", async () => {
  const notice = await readSource("components/layout/MswdoOfflineModeNotice.jsx");

  assert.match(notice, /Offline Mode Active/);
  assert.match(
    notice,
    /You can view saved evacuee masterlist and analytics data while offline\./,
  );
  assert.match(notice, /Other functions require an internet connection\./);
  assert.match(notice, /<h2/);
  assert.match(notice, /<p/);
  assert.match(notice, /margin: "2px 0 0"/);
  assert.doesNotMatch(notice, /continue supported actions/i);
  assert.doesNotMatch(notice, /save them on this device/i);
  assert.doesNotMatch(notice, /sync them when the connection returns/i);
  assert.doesNotMatch(notice, /failed|conflict|SyncStatusBanner/);
});

test("MSWDO layout uses the presentation-only notice while preserving the shared banner branch", async () => {
  const layout = await readSource("components/layout/BarangayLayout.jsx");
  const barangayNotice = await readSource(
    "components/layout/BarangayOfflineModeNotice.jsx",
  );

  assert.match(layout, /isMswdoPortal \? <MswdoOfflineModeNotice \/> : <SyncStatusBanner \/>/);
  assert.match(layout, /isBarangayPortal \? <BarangayOfflineModeNotice \/> : null/);
  assert.match(layout, /<SyncStatusBanner \/>/);
  assert.match(barangayNotice, /BARANGAY_OFFLINE_MODE_MESSAGE/);
  assert.match(barangayNotice, /Other functions require an internet connection/);
});

test("MSWDO notice preserves reactive offline visibility and does not read queue state", async () => {
  const notice = await readSource("components/layout/MswdoOfflineModeNotice.jsx");

  assert.match(notice, /navigator\.onLine !== false/);
  assert.match(notice, /addEventListener\("offline"/);
  assert.match(notice, /addEventListener\("online"/);
  assert.match(notice, /if \(isOnline\) return null/);
  assert.doesNotMatch(notice, /useLiveQuery|syncQueue|LOCAL_SYNC_STATUS|failed|conflict/i);
});
