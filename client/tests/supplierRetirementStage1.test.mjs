import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const readSource = async (relativePath) =>
  fs.readFile(new URL(relativePath, import.meta.url), "utf8");

test("Stage 1 removes Supplier from active Mayor inventory workflows", async () => {
  const [routes, sidebar, batchPage, batchForm, batchTable, batchDetail, itemsPage, transactionsPage] =
    await Promise.all([
      readSource("../src/routes/AppRoutes.jsx"),
      readSource("../src/components/layout/Sidebar.jsx"),
      readSource("../src/pages/inventory/InventoryBatchesPage.jsx"),
      readSource("../src/components/inventory-batches/InventoryBatchFormModal.jsx"),
      readSource("../src/components/inventory-batches/InventoryBatchesTable.jsx"),
      readSource("../src/components/inventory-batches/InventoryBatchDetailModal.jsx"),
      readSource("../src/pages/inventory/InventoryItemsPage.jsx"),
      readSource("../src/pages/inventory/InventoryTransactionsPage.jsx"),
    ]);

  assert.doesNotMatch(routes, /SuppliersPage/);
  assert.match(
    routes,
    /path: "suppliers",\s*element: <Navigate to="\/inventory\/items" replace \/>/,
  );
  assert.doesNotMatch(sidebar, /supplier/i);
  assert.doesNotMatch(batchPage, /supplier|fetchSuppliers/i);
  assert.doesNotMatch(batchForm, /supplier|supplier_id/i);
  assert.doesNotMatch(batchTable, /supplier/i);
  assert.doesNotMatch(batchDetail, /supplier/i);
  assert.doesNotMatch(itemsPage, /supplier|fetchSuppliers/i);
  assert.doesNotMatch(transactionsPage, /supplier|supplier_id/i);
});

test("Stage 1 strips Supplier fields from new batch payloads and offline readiness", async () => {
  const [batchService, model, cache, preparation, readiness, syncQueue] =
    await Promise.all([
      readSource("../src/features/inventory-batches/inventoryBatchService.js"),
      readSource("../src/offline/mayorInventoryOfflineModel.js"),
      readSource("../src/offline/mayorInventoryCache.js"),
      readSource("../src/offline/mayorInventoryPreparation.js"),
      readSource("../src/components/layout/OfflineDataReadiness.jsx"),
      readSource("../src/offline/syncQueue.js"),
    ]);

  assert.match(batchService, /normalizeCurrentInventoryBatchPayload/);
  assert.match(batchService, /delete currentPayload\.supplier_id/);
  assert.match(batchService, /payload: currentPayload/);
  assert.match(batchService, /body: JSON\.stringify\(currentPayload\)/);
  assert.doesNotMatch(batchService, /searchParams\.set\("supplier_id"/);
  assert.doesNotMatch(model, /supplier|supplier_id/i);
  assert.deepEqual(
    [...cache.matchAll(/"(items|batches|transactions|suppliers)"/g)].map(
      (match) => match[1],
    ),
    ["items", "batches", "transactions"],
  );
  assert.match(model, /MAYOR_INVENTORY_CACHE_VERSION = 2/);
  assert.doesNotMatch(preparation, /fetchSuppliers|suppliers_count/i);
  assert.doesNotMatch(readiness, /inventory, batch, transaction, supplier/i);
  assert.match(syncQueue, /legacySupplierActionKeys/);
  assert.match(syncQueue, /entry\.status === LOCAL_SYNC_STATUS\.FAILED/);

  const {
    getUnsupportedOfflineActionMessage,
    isLegacySupplierSyncEntry,
    isNonRetryableSyncEntry,
  } = await import("../src/offline/syncQueue.js");
  const legacyEntry = {
    id: "legacy-supplier-queue-1",
    actionKey: "SUPPLIER_CREATE",
    entityType: "SUPPLIER",
    clientTimestamp: "2026-08-30T01:02:03.000Z",
    payload: { name: "Old supplier" },
    status: "FAILED",
  };

  assert.equal(isLegacySupplierSyncEntry(legacyEntry), true);
  assert.equal(isNonRetryableSyncEntry(legacyEntry), true);
  assert.match(
    getUnsupportedOfflineActionMessage("SUPPLIER_CREATE", legacyEntry),
    /retained for review/,
  );
  assert.equal(
    isNonRetryableSyncEntry({ ...legacyEntry, status: "PENDING" }),
    false,
  );
  assert.equal(
    getUnsupportedOfflineActionMessage("SUPPLIER_CREATE", {
      ...legacyEntry,
      status: "PENDING",
    }),
    "",
  );
});

test("Stage 1 keeps server Supplier and historical batch compatibility isolated", async () => {
  const [syncService, syncRepository, batchService, supplierRoutes, routeIndex] =
    await Promise.all([
      readSource("../../server/src/services/sync.service.js"),
      readSource("../../server/src/repositories/sync.repository.js"),
      readSource("../../server/src/services/inventoryBatch.service.js"),
      readSource("../../server/src/routes/supplier.routes.js"),
      readSource("../../server/src/routes/index.js"),
    ]);

  assert.match(syncService, /SUPPLIER_CREATE:[\s\S]*supplierService\.createSupplier/);
  assert.match(syncService, /SUPPLIER_UPDATE:[\s\S]*supplierService\.updateSupplier/);
  assert.match(syncService, /"SUPPLIER"/);
  assert.match(syncService, /legacySupplierCompatibility/);
  assert.match(syncRepository, /SYNC_MAYOR_ENTITY_SCOPE[\s\S]*SUPPLIER/);
  assert.match(batchService, /let supplierId = batchData\.supplier_id/);
  assert.match(supplierRoutes, /router\.(get|post|put)/);
  assert.match(routeIndex, /supplier\.routes/);

  const exportSection = batchService.slice(
    batchService.indexOf("const exportInventoryBatches"),
  );
  assert.doesNotMatch(exportSection, /supplier/i);
});
