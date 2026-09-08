import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const readSource = async (relativePath) =>
  fs.readFile(new URL(relativePath, import.meta.url), "utf8");

const mayorItem = {
  id: "item-1",
  item_code: "RICE",
  item_name: "Rice",
  category: "Non-Perishable",
  is_active: true,
  stock_forms: [
    {
      id: "stock-form-1",
      barcode: " 12345678 ",
      packaging: "sack",
      units_per_packaging: 25,
      unit_of_measure: "kg",
      unit_of_measure_value: 25,
      is_active: true,
    },
  ],
};

test("MAYOR-OFFLINE-01 known and unknown barcodes are resolved safely from the complete local graph", async () => {
  const {
    findMayorInventoryItemByBarcode,
    buildNextInventoryBatchNumber,
  } = await import("../src/offline/mayorInventoryOfflineModel.js");

  const known = findMayorInventoryItemByBarcode([mayorItem], "12 345 678");
  assert.equal(known.item.id, "item-1");
  assert.equal(known.stockForm.id, "stock-form-1");
  assert.equal(
    findMayorInventoryItemByBarcode([mayorItem], "99999999"),
    null,
  );
  assert.equal(
    findMayorInventoryItemByBarcode(
      [{ ...mayorItem, is_active: false }],
      "12345678",
    ),
    null,
  );

  const nextBatchNumber = buildNextInventoryBatchNumber(mayorItem, [
    { inventory_item_id: "item-1", batch_no: "RICE-BATCH-002" },
    { inventory_item_id: "item-1", batch_no: "RICE-BATCH-003" },
  ]);
  assert.equal(nextBatchNumber, "RICE-BATCH-004");
});

test("MAYOR-OFFLINE-02 pending stock-in projects with explicit quantity and stable identity", async () => {
  const {
    buildQueuedInventoryBatch,
    getInventoryBatchIdentity,
    mergeInventoryBatchesWithSyncStatus,
  } = await import("../src/offline/mayorInventoryOfflineModel.js");

  const entry = {
    id: "11111111-1111-4111-8111-111111111111",
    moduleName: "mayor-inventory",
    actionKey: "INVENTORY_BATCH_CREATE",
    entityType: "INVENTORY_BATCH",
    entityLocalId: "RICE-BATCH-004",
    clientTimestamp: "2026-08-30T01:02:03.000Z",
    status: "PENDING",
    payload: {
      inventory_item_id: "item-1",
      inventory_item_stock_form_id: "stock-form-1",
      batch_no: "RICE-BATCH-004",
      quantity_received: 100,
      source_type: "LGU",
      expiration_date: null,
    },
  };

  const projected = buildQueuedInventoryBatch(entry, [mayorItem]);
  assert.equal(projected.quantity_received, 100);
  assert.equal(projected.quantity_available, 100);
  assert.equal(projected.sync_status, "PENDING");
  assert.equal(projected.is_local_only, true);
  assert.equal(projected.received_at, entry.clientTimestamp);
  assert.equal(projected.client_sync_id, entry.id);
  assert.equal(
    getInventoryBatchIdentity(projected),
    "item-1|RICE-BATCH-004",
  );

  const merged = mergeInventoryBatchesWithSyncStatus({
    inventoryBatches: [],
    inventoryItems: [mayorItem],
    syncQueueEntries: [entry],
  });
  assert.deepEqual(merged.map((batch) => batch.client_sync_id), [entry.id]);
});

test("MAYOR-OFFLINE-08 offline new items project opening stock immediately", async () => {
  const { mergeInventoryItemsWithSyncStatus } = await import(
    "../src/features/inventory-items/inventoryItemSync.js"
  );
  const {
    buildQueuedInventoryItemOpeningBatch,
    mergeInventoryBatchesWithSyncStatus,
  } = await import("../src/offline/mayorInventoryOfflineModel.js");

  const entry = {
    id: "33333333-3333-4333-8333-333333333333",
    moduleName: "mayor-inventory",
    actionKey: "INVENTORY_ITEM_CREATE",
    entityType: "INVENTORY_ITEM",
    entityLocalId: "LOCAL-RICE-001",
    clientTimestamp: "2026-09-01T01:02:03.000Z",
    status: "PENDING",
    payload: {
      item_name: "Offline Rice",
      category: "Non-Perishable",
      unit_of_measure: "kg",
      unit_of_measure_value: 25,
      packaging: "sack",
      packaging_count: 2,
      quantity: 25,
      barcode: "12345678",
      expiration_date: null,
    },
  };

  const [projectedItem] = mergeInventoryItemsWithSyncStatus([], [entry]);
  assert.equal(projectedItem.id, entry.entityLocalId);
  assert.equal(projectedItem.is_local_only, true);
  assert.equal(projectedItem.stock_forms[0].barcode, "12345678");

  const openingBatch = buildQueuedInventoryItemOpeningBatch(entry, [projectedItem]);
  assert.equal(openingBatch.quantity_received, 50);
  assert.equal(openingBatch.quantity_available, 50);
  assert.equal(openingBatch.batch_no, "Pending opening batch");
  assert.equal(openingBatch.is_local_only, true);

  const mergedBatches = mergeInventoryBatchesWithSyncStatus({
    inventoryBatches: [],
    inventoryItems: [projectedItem],
    syncQueueEntries: [entry],
  });
  assert.equal(mergedBatches.length, 1);
  assert.equal(mergedBatches[0].quantity_available, 50);
  assert.equal(mergedBatches[0].inventory_item_id, entry.entityLocalId);
});

test("MAYOR-OFFLINE-09 pending new packaging projects its barcode for later local matching", async () => {
  const { mergeInventoryItemsWithSyncStatus } = await import(
    "../src/features/inventory-items/inventoryItemSync.js"
  );
  const {
    findMayorInventoryItemByBarcode,
    mergeInventoryBatchesWithSyncStatus,
  } = await import("../src/offline/mayorInventoryOfflineModel.js");

  const entry = {
    id: "44444444-4444-4444-8444-444444444444",
    moduleName: "mayor-inventory",
    actionKey: "INVENTORY_BATCH_CREATE",
    entityType: "INVENTORY_BATCH",
    entityLocalId: "RICE-BATCH-004",
    clientTimestamp: "2026-09-01T02:02:03.000Z",
    status: "PENDING",
    payload: {
      inventory_item_id: "item-1",
      inventory_item_stock_form_id: null,
      stock_form_barcode: "87654321",
      stock_form_packaging: "box",
      stock_form_units_per_packaging: 12,
      stock_form_unit_of_measure: "pc",
      stock_form_unit_of_measure_value: 1,
      batch_no: "RICE-BATCH-004",
      quantity_received: 24,
      source_type: "LGU",
      expiration_date: null,
    },
  };

  const [projectedItem] = mergeInventoryItemsWithSyncStatus([mayorItem], [entry]);
  const projectedStockForm = projectedItem.stock_forms.find(
    (stockForm) => stockForm.barcode === "87654321",
  );
  assert.ok(projectedStockForm);
  assert.equal(projectedStockForm.is_local_only, true);

  const barcodeMatch = findMayorInventoryItemByBarcode(
    [projectedItem],
    "87654321",
  );
  assert.equal(barcodeMatch.item.id, "item-1");
  assert.equal(barcodeMatch.stockForm.id, projectedStockForm.id);

  const [projectedBatch] = mergeInventoryBatchesWithSyncStatus({
    inventoryBatches: [],
    inventoryItems: [projectedItem],
    syncQueueEntries: [entry],
  });
  assert.equal(projectedBatch.quantity_available, 24);
  assert.equal(projectedBatch.inventory_item_stock_form_id, projectedStockForm.id);
  assert.equal(projectedBatch.stock_form_packaging, "box");
});

test("MAYOR-OFFLINE-10 offline restock and added packaging mark the existing item pending", async () => {
  const { mergeInventoryItemsWithSyncStatus } = await import(
    "../src/features/inventory-items/inventoryItemSync.js"
  );

  const restockEntry = {
    id: "55555555-5555-4555-8555-555555555555",
    moduleName: "mayor-inventory",
    actionKey: "INVENTORY_BATCH_CREATE",
    entityType: "INVENTORY_BATCH",
    entityLocalId: "RICE-BATCH-005",
    status: "PENDING",
    payload: {
      inventory_item_id: "item-1",
      inventory_item_stock_form_id: "stock-form-1",
      batch_no: "RICE-BATCH-005",
      quantity_received: 50,
      source_type: "LGU",
    },
  };

  const [restockedItem] = mergeInventoryItemsWithSyncStatus(
    [mayorItem],
    [restockEntry],
  );
  assert.equal(restockedItem.sync_status, "PENDING");

  const packagingEntry = {
    ...restockEntry,
    id: "66666666-6666-4666-8666-666666666666",
    entityLocalId: "RICE-BATCH-006",
    payload: {
      ...restockEntry.payload,
      inventory_item_stock_form_id: null,
      stock_form_barcode: "87654321",
      stock_form_packaging: "box",
      stock_form_units_per_packaging: 12,
    },
  };

  const [packagedItem] = mergeInventoryItemsWithSyncStatus(
    [mayorItem],
    [packagingEntry],
  );
  assert.equal(packagedItem.sync_status, "PENDING");
  assert.equal(
    packagedItem.stock_forms.some((stockForm) => stockForm.packaging === "box"),
    true,
  );

  const [failedItem] = mergeInventoryItemsWithSyncStatus(
    [mayorItem],
    [{ ...restockEntry, status: "FAILED" }],
  );
  assert.equal(failedItem.sync_status, "FAILED");
});

test("MAYOR-OFFLINE-03 cache requires complete datasets and scopes records to the Mayor device", async () => {
  const {
    buildMayorInventoryCacheRecord,
    canUseMayorInventoryCacheAfterError,
    isCompleteMayorInventoryCache,
    isMayorInventoryCacheVisible,
  } = await import("../src/offline/mayorInventoryCache.js");

  const scope = {
    accessMode: "DEVELOPMENT",
    userId: "mayor-1",
    roleCode: "MAYOR",
    deviceId: "22222222-2222-4222-8222-222222222222",
  };
  const cache = buildMayorInventoryCacheRecord({
    scope,
    items: [mayorItem],
    batches: [],
    transactions: [],
    cachedAt: "2026-08-30T01:02:03.000Z",
  });

  assert.equal(isCompleteMayorInventoryCache(cache), true);
  assert.equal(isMayorInventoryCacheVisible(cache, scope), true);
  assert.equal(
    isMayorInventoryCacheVisible(cache, {
      ...scope,
      userId: "another-user",
    }),
    false,
  );
  assert.equal(
    isMayorInventoryCacheVisible(cache, {
      ...scope,
      deviceId: "33333333-3333-4333-8333-333333333333",
    }),
    false,
  );
  assert.equal(canUseMayorInventoryCacheAfterError({ statusCode: 408 }), true);
  assert.equal(canUseMayorInventoryCacheAfterError({ statusCode: 429 }), true);
  assert.equal(canUseMayorInventoryCacheAfterError({ statusCode: 503 }), true);
  assert.equal(canUseMayorInventoryCacheAfterError({ statusCode: 401 }), false);
  assert.equal(canUseMayorInventoryCacheAfterError({ statusCode: 403 }), false);
  assert.equal(canUseMayorInventoryCacheAfterError({ statusCode: 422 }), false);
});

test("MAYOR-OFFLINE-04 page and queue contracts use durable restoration and safe status handling", async () => {
  const [dbSource, cacheSource, preparationSource, hookSource, pageSource, batchesPageSource, queueSource, syncSource] =
    await Promise.all([
      readSource("../src/offline/db.js"),
      readSource("../src/offline/mayorInventoryCache.js"),
      readSource("../src/offline/mayorInventoryPreparation.js"),
      readSource("../src/features/offline/useMayorInventoryOfflinePreparation.js"),
      readSource("../src/pages/inventory/InventoryItemsPage.jsx"),
      readSource("../src/pages/inventory/InventoryBatchesPage.jsx"),
      readSource("../src/offline/syncQueue.js"),
      readSource("../src/offline/syncService.js"),
    ]);

  assert.match(dbSource, /this\.version\(5\)/);
  assert.match(dbSource, /offlineInventoryCache:/);
  assert.match(cacheSource, /db\.transaction\("rw", db\.offlineInventoryCache/);
  assert.match(cacheSource, /const readBack = await db\.offlineInventoryCache\.get/);
  assert.match(preparationSource, /fetchInventoryItems\(\{ search: "" \}\)/);
  assert.match(preparationSource, /fetchInventoryBatches\(\)/);
  assert.match(preparationSource, /fetchInventoryTransactions\(\)/);
  assert.match(cacheSource, /LEGACY_MAYOR_INVENTORY_CACHE_VERSION = 1/);
  assert.match(cacheSource, /migrateLegacyMayorInventoryCache/);
  assert.doesNotMatch(cacheSource, /syncQueue\.(clear|bulkDelete|delete)/);
  assert.match(preparationSource, /finally \{\s*jobs\.delete\(jobKey\)/);
  assert.match(hookSource, /actual complete cache read/);
  assert.match(hookSource, /refreshRequestedRef/);
  assert.match(hookSource, /refreshRequestedRef\.current = true/);
  assert.match(hookSource, /cache && !shouldRefreshOnline/);
  assert.match(pageSource, /navigator\.onLine === false/);
  assert.match(pageSource, /getMayorInventoryCacheSnapshot/);
  assert.match(pageSource, /persistMayorInventoryCacheSnapshot/);
  assert.match(pageSource, /MAYOR_INVENTORY_PREPARATION_STATUS\.READY/);
  assert.match(pageSource, /distync-offline-preparation-updated/);
  assert.match(pageSource, /void restoreMayorInventoryCache\(\)/);
  assert.match(batchesPageSource, /MAYOR_INVENTORY_PREPARATION_STATUS\.READY/);
  assert.match(batchesPageSource, /distync-offline-preparation-updated/);
  assert.match(batchesPageSource, /void restoreMayorInventoryCache\(filters\)/);
  assert.match(pageSource, /buildReservedBatchRows/);
  assert.match(pageSource, /is_local_only/);
  assert.match(queueSource, /await db\.syncQueue\.put/);
  assert.match(queueSource, /deviceId:/);
  assert.match(syncSource, /let entriesToSync = \[\]/);
  assert.match(syncSource, /client_sync_id: entry\.id/);
  assert.match(syncSource, /processingUntil/);
});

test("MAYOR-OFFLINE-05 destructive inventory status changes remain online-only while stock-in stays queueable", async () => {
  const [transactionSource, batchSource, pwaSource] = await Promise.all([
    readSource("../src/features/inventory-transactions/inventoryTransactionService.js"),
    readSource("../src/features/inventory-batches/inventoryBatchService.js"),
    readSource("../vite.config.js"),
  ]);

  assert.match(transactionSource, /performOnlineOnlyMutation/);
  assert.doesNotMatch(transactionSource, /performSyncableMutation/);
  assert.match(transactionSource, /Status changes require a connection/);
  assert.match(batchSource, /performSyncableMutation/);
  assert.match(batchSource, /INVENTORY_BATCH_CREATE/);
  assert.match(batchSource, /canQueueOffline/);
  assert.match(pwaSource, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(pwaSource, /handler: "NetworkOnly"/);
  assert.match(pwaSource, /request\.mode === "navigate"/);
});

test("MAYOR-OFFLINE-07 unsafe inventory actions stay online-only with direct offline guidance", async () => {
  const [itemServiceSource, batchServiceSource, pageSource, noticeSource, tableSource, actionsSource, detailSource, formSource] = await Promise.all([
    readSource("../src/features/inventory-items/inventoryItemService.js"),
    readSource("../src/features/inventory-batches/inventoryBatchService.js"),
    readSource("../src/pages/inventory/InventoryItemsPage.jsx"),
    readSource("../src/components/layout/BarangayOfflineModeNotice.jsx"),
    readSource("../src/components/inventory-items/InventoryItemsTable.jsx"),
    readSource("../src/components/inventory-items/InventoryPageActions.jsx"),
    readSource("../src/components/inventory-items/InventoryItemDetailModal.jsx"),
    readSource("../src/components/inventory-items/InventoryItemFormModal.jsx"),
  ]);
  const updateStart = itemServiceSource.indexOf(
    "export const updateInventoryItem",
  );
  const updateEnd = itemServiceSource.indexOf(
    "export const runInventoryForecast",
  );
  const updateSource = itemServiceSource.slice(updateStart, updateEnd);

  assert.match(updateSource, /performOnlineOnlyMutation/);
  assert.doesNotMatch(updateSource, /performSyncableMutation/);
  assert.match(
    updateSource,
    /Editing inventory items requires an internet connection\./,
  );
  assert.match(itemServiceSource, /getMayorInventoryCacheSnapshot/);
  assert.match(
    itemServiceSource,
    /canQueueOffline: async \(\) => Boolean\(await getMayorInventoryCacheSnapshot\(\)\)/,
  );
  assert.match(pageSource, /MAYOR_INVENTORY_OFFLINE_SCOPE_MESSAGE/);
  assert.match(pageSource, /MAYOR_INVENTORY_OFFLINE_MESSAGE/);
  assert.match(
    pageSource,
    /You can add inventory items and stock-in existing items offline\./,
  );
  assert.match(pageSource, /isInventoryOffline/);
  assert.match(
    pageSource,
    /Editing batch expiry requires an internet connection\./,
  );
  assert.match(
    pageSource,
    /Exporting inventory data requires an internet connection\./,
  );
  assert.doesNotMatch(pageSource, /matchedScannedStockForm\?\.is_local_only/);
  assert.doesNotMatch(pageSource, /selectedLocalStockForm\?\.is_local_only/);
  assert.doesNotMatch(batchServiceSource, /LOCAL_STOCK_FORM_PENDING/);
  assert.match(pageSource, /inventory_item_local_id: matchedExistingItem\.id/);
  assert.match(pageSource, /inventory_item_local_id: matchedScannedItem\.id/);
  assert.match(noticeSource, /message = BARANGAY_OFFLINE_MODE_MESSAGE/);
  assert.match(noticeSource, /secondaryMessage/);
  assert.match(tableSource, /isOffline = false/);
  assert.match(tableSource, /isOffline \|\| typeof onEditItem/);
  assert.match(tableSource, /isOffline \|\| typeof onLogStatus/);
  assert.match(tableSource, /SyncStatusIcon/);
  assert.match(tableSource, /item\.sync_status !== "SYNCED" \|\| isOffline/);
  assert.doesNotMatch(tableSource, /SyncStatusBadge/);
  assert.match(actionsSource, /disabled=\{Boolean\(exportingFormat\) \|\| isOffline\}/);
  assert.match(detailSource, /isOffline = false/);
  assert.match(detailSource, /disabled=\{isBatchEditDisabled\}/);
  assert.match(formSource, /findMayorInventoryItemByBarcode/);
  assert.match(formSource, /barcodeMatchedItem \|\|/);
  assert.match(formSource, /isBarcodeResolvedExistingItem/);
  assert.match(formSource, /isBarcodeResolvedExistingItem;?/);
  assert.match(formSource, /duplicateBarcodeItem/);
  assert.match(formSource, /This barcode is already assigned to another item\./);
  assert.match(
    formSource,
    /This barcode is already assigned to another packaging\./,
  );
});

test("MAYOR-OFFLINE-06 fallback identifiers remain valid UUIDs and client timestamps reach sync handlers", async () => {
  const [identitySource, syncSource, itemServiceSource, serverSyncSource, batchRepositorySource, transactionRepositorySource] =
    await Promise.all([
      readSource("../src/offline/deviceIdentity.js"),
      readSource("../src/offline/syncService.js"),
      readSource("../../server/src/services/inventoryItem.service.js"),
      readSource("../../server/src/services/sync.service.js"),
      readSource("../../server/src/repositories/inventoryBatch.repository.js"),
      readSource("../../server/src/repositories/inventoryTransaction.repository.js"),
    ]);

  for (const source of [identitySource, syncSource]) {
    assert.match(source, /value\[12\] = "4"/);
    assert.match(source, /value\[16\]/);
  }
  assert.match(serverSyncSource, /clientTimestamp, dbClient/);
  assert.match(serverSyncSource, /received_at: clientTimestamp/);
  assert.match(
    serverSyncSource,
    /execute: async \(\{ payload, auth, clientTimestamp, dbClient \}\)/,
  );
  assert.match(itemServiceSource, /received_at: options\.clientTimestamp/);
  assert.match(itemServiceSource, /performed_at: options\.clientTimestamp/);
  assert.match(batchRepositorySource, /\$11::timestamptz/);
  assert.match(transactionRepositorySource, /\$11::timestamptz/);
});
