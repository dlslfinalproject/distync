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

  const projected = buildQueuedInventoryBatch(entry, [mayorItem], []);
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
    suppliers: [],
    syncQueueEntries: [entry],
  });
  assert.deepEqual(merged.map((batch) => batch.client_sync_id), [entry.id]);
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
    suppliers: [],
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
  assert.equal(
    isCompleteMayorInventoryCache({ ...cache, suppliers: undefined }),
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
  const [dbSource, cacheSource, preparationSource, hookSource, pageSource, queueSource, syncSource] =
    await Promise.all([
      readSource("../src/offline/db.js"),
      readSource("../src/offline/mayorInventoryCache.js"),
      readSource("../src/offline/mayorInventoryPreparation.js"),
      readSource("../src/features/offline/useMayorInventoryOfflinePreparation.js"),
      readSource("../src/pages/inventory/InventoryItemsPage.jsx"),
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
  assert.match(preparationSource, /fetchSuppliers\(\)/);
  assert.match(preparationSource, /finally \{\s*jobs\.delete\(jobKey\)/);
  assert.match(hookSource, /actual complete cache read/);
  assert.match(pageSource, /navigator\.onLine === false/);
  assert.match(pageSource, /getMayorInventoryCacheSnapshot/);
  assert.match(pageSource, /persistMayorInventoryCacheSnapshot/);
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
  assert.match(batchRepositorySource, /\$12::timestamptz/);
  assert.match(transactionRepositorySource, /\$11::timestamptz/);
});
