import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const readSource = (relativePath) =>
  fs.readFile(new URL(`../src/${relativePath}`, import.meta.url), "utf8");

test("Barangay offline access keeps the supported workflow routes available", async () => {
  const access = await import(
    "../src/features/offline/barangayOfflineAccess.js"
  );

  assert.equal(access.isBarangayOfflineRouteAvailable("/barangay/masterlist"), true);
  assert.equal(
    access.isBarangayOfflineRouteAvailable("/barangay/stub-distribution"),
    true,
  );
  assert.equal(
    access.isBarangayOfflineRouteAvailable("/barangay/distribution-transaction"),
    true,
  );
  assert.equal(access.isBarangayOfflineRouteAvailable("/barangay/sync"), true);

  assert.equal(
    access.isBarangayOfflineBlockedRoute("/barangay/distribution-history"),
    true,
  );
  assert.equal(access.isBarangayOfflineBlockedRoute("/barangay/anomalies"), true);
  assert.equal(access.isBarangayOfflineBlockedRoute("/barangay/notifications"), true);
  assert.equal(access.isBarangayOfflineBlockedRoute("/inventory/items"), false);
  assert.equal(
    access.BARANGAY_OFFLINE_ACCESS_MESSAGE,
    "Connect online to access this page.",
  );
});

test("Barangay offline navigation and table indicators use the shared offline rules", async () => {
  const [layout, sidebar, masterlistTable, stubTable, masterlistPage, stubPage] =
    await Promise.all([
      readSource("components/layout/BarangayLayout.jsx"),
      readSource("components/layout/Sidebar.jsx"),
      readSource("components/masterlist/MasterlistTable.jsx"),
      readSource("components/stubs/StubResultsTable.jsx"),
      readSource("pages/barangay/BarangayMasterlistPage.jsx"),
      readSource("pages/barangay/StubDistributionPage.jsx"),
    ]);

  assert.match(layout, /isBarangayOffline && isBarangayOfflineBlockedRoute/);
  assert.match(layout, /BARANGAY_OFFLINE_ACCESS_MESSAGE/);
  assert.match(sidebar, /isBarangayOfflineLocked/);
  assert.match(sidebar, /isBarangayOfflineBlockedRoute/);
  assert.match(sidebar, /aria-disabled=\{isMayorOfflineLocked/);

  assert.match(masterlistTable, /shouldShowSyncStatusIcon\(syncStatus, isOffline\)/);
  assert.match(masterlistTable, /showOfflineSyncStatus = false/);
  assert.match(masterlistTable, /departure_sync_detailed_status/);
  assert.match(stubTable, /isOffline = false/);
  assert.match(stubTable, /shouldShowSyncStatusIcon\(syncStatus, isOffline\)/);
  assert.match(masterlistPage, /const isOffline = !isOnline/);
  assert.match(masterlistPage, /showOfflineSyncStatus/);
  assert.match(stubPage, /isOffline=\{isOfflineForDisplay\}/);
});

test("sync icons show saved records offline and attention states online", async () => {
  const { shouldShowSyncStatusIcon } = await import(
    "../src/offline/syncStatus.js"
  );

  assert.equal(shouldShowSyncStatusIcon("SYNCED", false), false);
  assert.equal(shouldShowSyncStatusIcon("SYNCED", true), true);
  assert.equal(shouldShowSyncStatusIcon("PENDING", false), true);
  assert.equal(shouldShowSyncStatusIcon("FAILED", false), true);
  assert.equal(shouldShowSyncStatusIcon("CONFLICT", false), true);
});
