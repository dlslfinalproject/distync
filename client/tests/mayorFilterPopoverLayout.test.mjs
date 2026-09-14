import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const readSource = (...segments) =>
  fs.readFile(path.join(process.cwd(), "src", ...segments), "utf8");

test("Mayor filter popovers share responsive behavior and expand short lists before scrolling", async () => {
  const [
    sharedSource,
    transactionSource,
    itemSource,
    distributionSource,
    reliefPackSource,
    donationSource,
    notificationSource,
    syncSource,
    anomalySource,
    mayorAnomalySource,
  ] = await Promise.all([
    readSource("components", "shared", "ResponsiveFilterPopover.jsx"),
    readSource("pages", "inventory", "InventoryTransactionsPage.jsx"),
    readSource("components", "inventory-items", "InventoryFilters.jsx"),
    readSource("pages", "inventory", "InventoryDistributionPage.jsx"),
    readSource("pages", "inventory", "ReliefPackTemplatesPage.jsx"),
    readSource("components", "donations", "DonationFilters.jsx"),
    readSource("pages", "inventory", "NotificationCenterPage.jsx"),
    readSource("pages", "SyncManagementPage.jsx"),
    readSource("pages", "mswdo", "AnomalyTrackingPage.jsx"),
    readSource("pages", "inventory", "MayorAnomalyTrackingPage.jsx"),
  ]);

  assert.match(sharedSource, /maxHeight: "240px"/);
  assert.match(sharedSource, /overflowY: "auto"/);
  assert.match(sharedSource, /overscrollBehavior: "contain"/);
  assert.match(sharedSource, /maxHeight: "min\(86dvh, calc\(100dvh - 24px\)\)"/);
  assert.match(sharedSource, /maxHeight: "calc\(100vh - 32px\)"/);

  for (const source of [
    notificationSource,
    syncSource,
    anomalySource,
  ]) {
    assert.match(source, /ResponsiveFilterPopover/);
  }

  assert.match(mayorAnomalySource, /<AnomalyTrackingPage scope="mayor" \/>/);

  assert.match(itemSource, /onFilterChange\("category", "All"\)/);
  assert.match(distributionSource, /const handleClearPopoverFilters = \(\) =>/);
  assert.match(distributionSource, /onClick=\{handleClearPopoverFilters\}[\s\S]*?Clear/);
  assert.match(transactionSource, /const handleClearPopoverFilters = \(\) =>/);
  assert.match(transactionSource, /movement: ""/);
  assert.match(transactionSource, /onClick=\{handleClearPopoverFilters\}[\s\S]*?Clear/);
  assert.match(reliefPackSource, /const handleClearPopoverFilters = \(\) =>/);
  assert.match(reliefPackSource, /onClick=\{handleClearPopoverFilters\}[\s\S]*?Clear/);
  assert.match(donationSource, /onDonationTypeFilterChange\?\.\(""\)/);
  assert.match(anomalySource, /const handleClearPopoverFilters = \(\) =>/);
  assert.match(anomalySource, /status: "all"[\s\S]*?order: "newest"/);
  assert.match(syncSource, /const handleClearPopoverFilters = \(\) =>/);
  assert.match(syncSource, /updateFilter\("order", DEFAULT_SYNC_FILTERS\.order\)/);

  const reliefMainClearState = reliefPackSource.match(
    /const hasActiveReliefPackFilters = Boolean\([\s\S]*?\);/,
  )?.[0] || "";
  assert.match(reliefMainClearState, /filters\.packType/);
  assert.doesNotMatch(
    reliefMainClearState,
    /filters\.search|selectedAvailabilityFilters|selectedDisasterTypeFilters|selectedSortOrder/,
  );

  assert.match(
    transactionSource,
    /const hasActiveTrackingFilters = Object\.values\(filters\)\.some\(Boolean\);/,
  );
  assert.match(
    syncSource,
    /const hasActiveSyncFilters = Boolean\([\s\S]*?filters\.recordType[\s\S]*?filters\.status/,
  );
  assert.doesNotMatch(
    syncSource.match(/const hasActiveSyncFilters = Boolean\([\s\S]*?\);/)?.[0] || "",
    /filters\.order|filters\.search/,
  );
  assert.match(anomalySource, /const hasActiveMainFilters = Boolean\(/);
  assert.match(anomalySource, /\{hasActiveMainFilters \? \(/);

  for (const source of [
    transactionSource,
    distributionSource,
    reliefPackSource,
    donationSource,
    anomalySource,
    syncSource,
  ]) {
    assert.doesNotMatch(source, /Clear all filters/);
  }

  for (const source of [
    transactionSource,
    itemSource,
    distributionSource,
    reliefPackSource,
    donationSource,
  ]) {
    assert.match(source, /maxHeight: "240px"/);
    assert.match(source, /overscrollBehavior: "contain"/);
  }
});
