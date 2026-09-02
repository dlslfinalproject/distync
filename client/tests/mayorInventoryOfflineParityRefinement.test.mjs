import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const readSource = (relativePath) =>
  fs.readFile(new URL(relativePath, import.meta.url), "utf8");

test("MAYOR-OFFLINE-PARITY-01 local item details are built from the verified graph", async () => {
  const { buildMayorInventoryItemDetailFromLocalGraph } = await import(
    "../src/offline/mayorInventoryOfflineModel.js"
  );

  const item = {
    id: "item-1",
    item_code: "RICE",
    item_name: "Rice",
    category: "Non-Perishable",
    reorder_level: 10,
    stock_forms: [
      {
        id: "stock-form-1",
        barcode: "12345678",
        packaging: "sack",
        units_per_packaging: 25,
        unit_of_measure: "kg",
      },
    ],
  };
  const detail = buildMayorInventoryItemDetailFromLocalGraph({
    inventoryItemId: "item-1",
    inventoryItems: [item],
    inventoryBatches: [
      {
        id: "batch-1",
        inventory_item_id: "item-1",
        batch_no: "RICE-BATCH-001",
        quantity_available: 100,
      },
      {
        id: "batch-2",
        inventory_item_id: "other-item",
        quantity_available: 999,
      },
    ],
    inventoryTransactions: [
      { id: "transaction-1", inventory_item_id: "item-1", quantity: 100 },
      { id: "transaction-2", inventory_item_id: "other-item", quantity: 999 },
    ],
  });

  assert.equal(detail.item.item_code, "RICE");
  assert.equal(detail.item.current_stock, 100);
  assert.equal(detail.stock_forms[0].barcode, "12345678");
  assert.deepEqual(
    detail.related_batches.map((batch) => batch.id),
    ["batch-1"],
  );
  assert.deepEqual(
    detail.related_transactions.map((transaction) => transaction.id),
    ["transaction-1"],
  );
  assert.deepEqual(detail.audit_history, []);
  assert.equal(detail.forecast_summary, null);
  assert.equal(
    buildMayorInventoryItemDetailFromLocalGraph({
      inventoryItemId: "missing-item",
      inventoryItems: [item],
    }),
    null,
  );
});

test("MAYOR-OFFLINE-PARITY-02 Item Details uses local data offline and removes the duplicate banner", async () => {
  const [pageSource, modelSource] = await Promise.all([
    readSource("../src/pages/inventory/InventoryItemsPage.jsx"),
    readSource("../src/offline/mayorInventoryOfflineModel.js"),
  ]);

  assert.match(pageSource, /buildMayorInventoryItemDetailFromLocalGraph/);
  assert.match(pageSource, /browserIsOffline/);
  assert.match(pageSource, /This item is not saved on this device for offline details/);
  assert.match(pageSource, /fetchInventoryItemDetail/);
  assert.doesNotMatch(
    pageSource,
    /You are offline\. Showing complete inventory information saved on this device\./,
  );
  assert.doesNotMatch(pageSource, /dataSourceNotice/);
  assert.match(modelSource, /related_batches/);
  assert.match(modelSource, /related_transactions/);
});

test("MAYOR-OFFLINE-PARITY-03 the Mayor inventory status card is scoped to Items Management", async () => {
  const [layoutSource, itemsSource, batchesSource, transactionsSource, syncBannerSource] =
    await Promise.all([
      readSource("../src/components/layout/BarangayLayout.jsx"),
      readSource("../src/pages/inventory/InventoryItemsPage.jsx"),
      readSource("../src/pages/inventory/InventoryBatchesPage.jsx"),
      readSource("../src/pages/inventory/InventoryTransactionsPage.jsx"),
      readSource("../src/components/layout/SyncStatusBanner.jsx"),
    ]);
  const otherMayorPageSources = await Promise.all(
    [
      "../src/pages/inventory/ReliefPackTemplatesPage.jsx",
      "../src/pages/inventory/InventoryDistributionPage.jsx",
      "../src/pages/inventory/InventoryForecastsPage.jsx",
      "../src/pages/DonationManagementPage.jsx",
      "../src/pages/inventory/InventoryTransactionsPage.jsx",
      "../src/pages/SystemLogReviewPage.jsx",
    ].map((path) => readSource(path)),
  );

  assert.match(layoutSource, /const isMayorPortal = currentRole === ROLE_CODES\.MAYOR/);
  assert.match(
    layoutSource,
    /shouldShowSyncStatusBanner =\s*!isBarangayPortal[\s\S]*?!isMayorPortal/,
  );
  assert.match(itemsSource, /<SyncStatusBanner scope="mayor-inventory" \/>/);
  assert.doesNotMatch(batchesSource, /OfflineDataReadiness/);
  assert.doesNotMatch(batchesSource, /dataSourceNotice/);
  assert.doesNotMatch(transactionsSource, /OfflineDataReadiness/);
  assert.doesNotMatch(transactionsSource, /dataSourceNotice/);
  for (const source of otherMayorPageSources) {
    assert.doesNotMatch(source, /<SyncStatusBanner|<OfflineDataReadiness/);
  }
  assert.match(syncBannerSource, /isMayorInventoryContext/);
  assert.match(syncBannerSource, /hasProcessedOnlineSync/);
  assert.match(syncBannerSource, /hasError: isMayorInventoryContext && !isOnline/);
  assert.match(
    syncBannerSource,
    /!isMayorInventoryContext && isOnline && retryableQueueCount/,
  );
});

test("MAYOR-OFFLINE-PARITY-04 transport loss keeps claimed work pending and reconnect is shared", async () => {
  const source = await readSource("../src/offline/syncService.js");

  assert.match(source, /const isTransportFailure = \(error\) =>/);
  assert.match(source, /status: transportFailure[\s\S]*LOCAL_SYNC_STATUS\.PENDING/);
  assert.match(source, /processingOwner: null/);
  assert.match(source, /processingUntil: null/);
  assert.match(source, /notifySyncListeners\(\{[\s\S]*type: "started"/);
  assert.match(source, /notifySyncListeners\(\{ type: "finished", source \}\)/);
  assert.match(source, /window\.addEventListener\("online", handleOnline\)/);
  assert.match(source, /flushPendingSyncEntries\(\{ source: "automatic" \}\)/);
  assert.match(source, /if \(!transportFailure\) \{/);
  const transportClassifier =
    source.match(/const isTransportFailure = \(error\) =>[\s\S]*?\n};/)?.[0] || "";
  assert.doesNotMatch(transportClassifier, /timeout|timed out/);
});

test("MAYOR-OFFLINE-PARITY-05 the contextual Mayor card hides after an online attempt", async () => {
  const source = await readSource(
    "../src/components/layout/SyncStatusBanner.jsx",
  );

  assert.match(
    source,
    /!isOnline \|\| isSyncing \|\| \(counts\[LOCAL_SYNC_STATUS\.PENDING\] > 0 && !hasProcessedOnlineSync\)/,
  );
  assert.match(source, /event\.source === "automatic"/);
  assert.match(source, /if \(isMayorInventoryContext\) \{\s*return;/);
});
