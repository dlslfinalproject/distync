import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const readSource = (relativePath) =>
  fs.readFile(new URL(`../src/${relativePath}`, import.meta.url), "utf8");

test("Mayor offline access keeps Inventory Items available and blocks other inventory routes", async () => {
  const access = await import("../src/features/offline/mayorOfflineAccess.js");

  assert.equal(
    access.isMayorOfflineRouteAvailable("/inventory/items"),
    true,
  );
  assert.equal(
    access.isMayorOfflineRouteAvailable("/inventory/sync"),
    true,
  );
  assert.equal(
    access.isMayorOfflineBlockedRoute("/inventory/relief-pack-templates"),
    true,
  );
  assert.equal(access.isMayorOfflineBlockedRoute("/inventory/donations"), true);
  assert.equal(access.isMayorOfflineBlockedRoute("/inventory/anomalies"), true);
  assert.equal(access.isMayorOfflineBlockedRoute("/barangay/masterlist"), false);
  assert.equal(
    access.MAYOR_OFFLINE_ACCESS_MESSAGE,
    "Connect online to access this page.",
  );
});

test("Mayor offline blocked routes replace page data and technical errors with the access card", async () => {
  const [layout, sidebar, notice, access, syncPage] = await Promise.all([
    readSource("components/layout/BarangayLayout.jsx"),
    readSource("components/layout/Sidebar.jsx"),
    readSource("components/layout/MayorOfflineAccessNotice.jsx"),
    readSource("features/offline/mayorOfflineAccess.js"),
    readSource("pages/SyncManagementPage.jsx"),
  ]);

  assert.match(layout, /isMayorOffline && isMayorOfflineBlockedRoute/);
  assert.match(layout, /shouldBlockMayorOfflineRoute/);
  assert.match(layout, /<MayorOfflineAccessNotice \/>/);
  assert.match(layout, /<Outlet \/>/);
  assert.match(sidebar, /isMayorOfflineLocked/);
  assert.match(sidebar, /event\.preventDefault\(\)/);
  assert.match(sidebar, /event\.stopPropagation\(\)/);
  assert.match(access, /Connect online to access this page\./);
  assert.doesNotMatch(notice, /Supabase|ENOTFOUND|Failed to fetch|data unavailable/i);
  assert.match(syncPage, /SYNC_TAB_OFFLINE_MESSAGE = "Connect online to access this tab\."/);
  assert.match(syncPage, /isSyncTabUnavailableOffline/);
  assert.match(syncPage, /disabled=\{isSyncTabUnavailableOffline\(isOnline, tab\.value\)\}/);
  assert.match(syncPage, /setActiveSyncTab\("QUEUE"\)/);
  assert.match(syncPage, /setSyncHistory\(\{ transactions: \[\], conflicts: \[\] \}\)/);
  assert.match(syncPage, /fetchSyncHistory/);
});
