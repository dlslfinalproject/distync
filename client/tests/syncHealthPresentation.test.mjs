import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const syncStatusModulePath = new URL("../src/offline/syncStatus.js", import.meta.url);
const syncStatusComponentPath = new URL(
  "../src/components/shared/SyncHealthStatus.jsx",
  import.meta.url,
);
const syncStatusBannerPath = new URL(
  "../src/components/layout/SyncStatusBanner.jsx",
  import.meta.url,
);
const syncCenterPagePath = new URL(
  "../src/pages/SyncManagementPage.jsx",
  import.meta.url,
);
const masterlistPagePath = new URL(
  "../src/pages/barangay/BarangayMasterlistPage.jsx",
  import.meta.url,
);
const distributionPagePath = new URL(
  "../src/pages/barangay/StubDistributionPage.jsx",
  import.meta.url,
);
const distributionTransactionPagePath = new URL(
  "../src/pages/barangay/DistributionTransactionPage.jsx",
  import.meta.url,
);
const historyPagePath = new URL(
  "../src/pages/DistributionHistoryPage.jsx",
  import.meta.url,
);
const layoutPath = new URL(
  "../src/components/layout/BarangayLayout.jsx",
  import.meta.url,
);

const getHealthPresentation = async () => {
  const { getSyncHealthPresentation } = await import(syncStatusModulePath.href);
  return getSyncHealthPresentation;
};

test("SYNC-HEALTH-P01 healthy state has only the healthy badge", async () => {
  const getSyncHealthPresentation = await getHealthPresentation();
  const health = getSyncHealthPresentation();

  assert.equal(health.state, "HEALTHY");
  assert.equal(health.message, "All changes are synchronized.");
  assert.equal(health.isHealthy, true);
  assert.equal(health.needsAttention, false);
  assert.deepEqual(health.badges, [{ type: "healthy", label: "All changes synced" }]);
});

test("SYNC-HEALTH-P02 failed state cannot present as healthy", async () => {
  const getSyncHealthPresentation = await getHealthPresentation();
  const health = getSyncHealthPresentation({ failed: 1 });

  assert.equal(health.state, "FAILED");
  assert.equal(health.message, "Synchronization needs attention.");
  assert.equal(health.isHealthy, false);
  assert.deepEqual(health.badges, [{ type: "failed", label: "1 failed" }]);
});

test("SYNC-HEALTH-P03 pending-only state is processing, not an error", async () => {
  const getSyncHealthPresentation = await getHealthPresentation();
  const health = getSyncHealthPresentation({ pending: 2 });

  assert.equal(health.state, "PENDING");
  assert.equal(health.message, "Synchronization is still processing.");
  assert.equal(health.needsAttention, true);
  assert.deepEqual(health.badges, [{ type: "pending", label: "2 pending" }]);
});

test("SYNC-HEALTH-P04 conflict-only state asks for review", async () => {
  const getSyncHealthPresentation = await getHealthPresentation();
  const health = getSyncHealthPresentation({ conflicts: 1 });

  assert.equal(health.state, "CONFLICT");
  assert.equal(health.message, "A synchronization conflict needs review.");
  assert.deepEqual(health.badges, [{ type: "conflict", label: "1 conflict" }]);
});

test("SYNC-HEALTH-P05 mixed state exposes relevant counts without a healthy badge", async () => {
  const getSyncHealthPresentation = await getHealthPresentation();
  const health = getSyncHealthPresentation({ pending: 2, failed: 1, conflicts: 1 });

  assert.equal(health.state, "ATTENTION");
  assert.equal(health.message, "Some changes are waiting or need attention.");
  assert.deepEqual(health.badges, [
    { type: "failed", label: "1 failed" },
    { type: "conflict", label: "1 conflict" },
    { type: "pending", label: "2 pending" },
  ]);
  assert.equal(health.badges.some((badge) => badge.type === "healthy"), false);
});

test("SYNC-HEALTH-P06 loading and unavailable states never claim all synced", async () => {
  const getSyncHealthPresentation = await getHealthPresentation();
  const loading = getSyncHealthPresentation({ isLoading: true });
  const unavailable = getSyncHealthPresentation({ hasError: true });

  assert.equal(loading.state, "LOADING");
  assert.equal(loading.isHealthy, false);
  assert.equal(unavailable.state, "UNAVAILABLE");
  assert.equal(unavailable.isHealthy, false);
  assert.notEqual(loading.message, "All changes are synchronized.");
  assert.notEqual(unavailable.message, "All changes are synchronized.");
});

test("SYNC-HEALTH-P06B offline status does not retain a healthy badge", async () => {
  const component = await fs.readFile(syncStatusComponentPath, "utf8");

  assert.match(component, /type: "offline", label: "Offline"/);
  assert.match(component, /badge\.type !== "healthy"/);
  assert.match(component, /basePresentation\.isOnline === false/);
});

test("SYNC-HEALTH-P06C Sync Center passes browser connectivity into its status", async () => {
  const syncCenter = await fs.readFile(syncCenterPagePath, "utf8");

  assert.match(syncCenter, /isOnline,\r?\n\s+lastSuccessfulSyncAt/);
  assert.match(syncCenter, /isLoadingHistory, isOnline, summary/);
});

test("SYNC-HEALTH-P07 Sync Center owns the full status card", async () => {
  const [component, banner, syncCenter, masterlist, distribution, transaction, history, layout] =
    await Promise.all([
      fs.readFile(syncStatusComponentPath, "utf8"),
      fs.readFile(syncStatusBannerPath, "utf8"),
      fs.readFile(syncCenterPagePath, "utf8"),
      fs.readFile(masterlistPagePath, "utf8"),
      fs.readFile(distributionPagePath, "utf8"),
      fs.readFile(distributionTransactionPagePath, "utf8"),
      fs.readFile(historyPagePath, "utf8"),
      fs.readFile(layoutPath, "utf8"),
    ]);

  assert.match(syncCenter, /<SyncHealthStatus health=\{syncHealth\} \/>/);
  assert.doesNotMatch(masterlist, /SyncHealthStatus|useBarangaySyncHealth/);
  assert.doesNotMatch(distribution, /SyncHealthStatus|useBarangaySyncHealth/);
  assert.doesNotMatch(transaction, /SyncHealthStatus|useBarangaySyncHealth/);
  assert.match(masterlist, /useLiveQuery\(\(\) => getVisibleSyncQueueEntries\(\), \[\], \[\]\)/);
  assert.doesNotMatch(history, /SyncHealthStatus|useBarangaySyncHealth/);
  assert.match(layout, /isBarangayPortal/);
  assert.match(
    layout,
    /shouldShowSyncStatusBanner =\s*!isBarangayPortal[\s\S]*?isMayorAnomalyRoute[\s\S]*?isSyncRoute/,
  );
  assert.match(layout, /shouldShowSyncStatusBanner/);
  assert.match(layout, /\{shouldShowSyncStatusBanner \? <SyncStatusBanner \/> : null\}/);
  assert.doesNotMatch(component, /updated_at|latest timestamp|client_sync_id|PostgreSQL/i);
  assert.doesNotMatch(banner, /updated_at|latest timestamp|client_sync_id|PostgreSQL/i);
});
