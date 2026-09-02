import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const readSource = async (relativePath) =>
  fs.readFile(new URL(relativePath, import.meta.url), "utf8");

test("BRG-OFFLINE-AUDIT-PWA app shell never caches authenticated API responses", async () => {
  const source = await readSource("../vite.config.js");

  assert.match(source, /VitePWA\(/);
  assert.match(source, /handler:\s*"NetworkOnly"/);
  assert.match(source, /cleanupOutdatedCaches:\s*true/);
  assert.match(source, /display:\s*"standalone"/);
  assert.match(source, /start_url:\s*"\/"/);
  assert.match(source, /distync-logo-cropped\.png/);
  assert.match(source, /assetFileNames/);
});

test("BRG-OFFLINE-AUDIT-QUEUE queue rows are durable, scoped, and safely claimable", async () => {
  const source = await readSource("../src/offline/syncQueue.js");

  assert.match(source, /await db\.syncQueue\.put\(/);
  assert.match(source, /userId:\s*actorContext\.userId/);
  assert.match(source, /roleCode:\s*actorContext\.roleCode/);
  assert.match(source, /barangayId:/);
  assert.match(source, /processingOwner/);
  assert.match(source, /processingUntil/);
  assert.match(source, /export const claimSyncEntries/);
  assert.match(source, /SYNC_ERROR_CODES\.LOCAL_STORAGE_FAILURE/);
  assert.match(source, /isMalformedSyncEntry/);
  assert.match(source, /!entry\.userId|!actorContext\.userId/);
});

test("BRG-OFFLINE-AUDIT-RECOVERY transient HTTP failures remain eligible for idempotent replay", async () => {
  const source = await readSource("../src/offline/syncService.js");

  for (const statusCode of [408, 425, 429, 500, 502, 503, 504]) {
    assert.match(source, new RegExp(String(statusCode)));
  }

  assert.match(source, /client_sync_id: entry\.id/);
  assert.match(source, /claimSyncEntries\(queuedEntries, processingOwner\)/);
  assert.match(source, /processingOwner:\s*null/);
});

test("BRG-OFFLINE-AUDIT-UX Barangay pages expose shared offline status without duplicate cards", async () => {
  const [healthHook, healthComponent, syncCenter, layout, banner, masterlist, relief, distribution] =
    await Promise.all([
      readSource("../src/features/sync/useBarangaySyncHealth.js"),
      readSource("../src/components/shared/SyncHealthStatus.jsx"),
      readSource("../src/pages/SyncManagementPage.jsx"),
      readSource("../src/components/layout/BarangayLayout.jsx"),
      readSource("../src/components/layout/SyncStatusBanner.jsx"),
      readSource("../src/pages/barangay/BarangayMasterlistPage.jsx"),
      readSource("../src/pages/barangay/StubDistributionPage.jsx"),
      readSource("../src/pages/barangay/DistributionTransactionPage.jsx"),
    ]);

  assert.match(healthHook, /window\.addEventListener\("offline"/);
  assert.match(healthComponent, /Supported actions will be saved on this device/);
  assert.match(healthComponent, /basePresentation\.isOnline === false/);
  assert.match(healthComponent, /type: "offline", label: "Offline"/);
  assert.match(syncCenter, /<SyncHealthStatus health=\{syncHealth\} \/>/);
  assert.match(syncCenter, /isOnline,/);
  assert.match(
    layout,
    /shouldShowSyncStatusBanner =\s*!isBarangayPortal[\s\S]*?!isMayorPortal[\s\S]*?isMayorAnomalyRoute[\s\S]*?isSyncRoute/,
  );
  assert.match(banner, /LOCAL_SYNC_STATUS\.FAILED/);
  assert.match(banner, /isNonRetryableSyncEntry\(entry\)/);
  assert.doesNotMatch(masterlist, /SyncHealthStatus|useBarangaySyncHealth/);
  assert.doesNotMatch(relief, /SyncHealthStatus|useBarangaySyncHealth/);
  assert.doesNotMatch(distribution, /SyncHealthStatus|useBarangaySyncHealth/);
  assert.match(masterlist, /syncQueueEntries/);
});

test("BRG-OFFLINE-AUDIT-CLAIM bulk claim resolves each selected row before queueing", async () => {
  const [source, serviceSource] = await Promise.all([
    readSource("../src/pages/barangay/StubDistributionPage.jsx"),
    readSource("../src/features/stubs/stubService.js"),
  ]);

  assert.match(
    source,
    /claimableSelectedStubIds\.map\(\(stubId\) => \{[\s\S]*const row = stubRows\.find/s,
  );
  assert.match(serviceSource, /actionKey:\s*"STUB_CLAIM"/);
});
