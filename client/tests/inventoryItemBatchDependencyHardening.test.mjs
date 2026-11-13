import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const makeItem = (id) => ({
  id,
  item_code: "RICE",
  item_name: "Rice",
  category: "Non-Perishable",
  is_active: true,
  stock_forms: [],
});

const makeBatchEntry = (overrides = {}) => ({
  id: "batch-queue-1",
  moduleName: "mayor-inventory",
  actionKey: "INVENTORY_BATCH_CREATE",
  entityType: "INVENTORY_BATCH",
  entityLocalId: "RICE-BATCH-001",
  clientTimestamp: "2026-09-07T01:05:00.000Z",
  status: "FAILED",
  payload: {
    inventory_item_id: "local-rice-1",
    inventory_item_local_id: "local-rice-1",
    inventory_item_stock_form_id: null,
    stock_form_barcode: "12345678",
    stock_form_packaging: "sack",
    stock_form_units_per_packaging: 25,
    stock_form_unit_of_measure: "kg",
    stock_form_unit_of_measure_value: 25,
    batch_no: "RICE-BATCH-001",
    quantity_received: 10,
    source_type: "LGU",
  },
  ...overrides,
});

test("dependent projections use local identity before parent sync and durable server alias after parent sync", async () => {
  const {
    buildQueuedInventoryStockForm,
    getInventoryBatchProjectionItemId,
    mergeInventoryItemsWithSyncStatus,
  } = await import("../src/features/inventory-items/inventoryItemSync.js");
  const { buildQueuedInventoryBatch, mergeInventoryBatchesWithSyncStatus } =
    await import("../src/offline/mayorInventoryOfflineModel.js");

  const localItem = makeItem("local-rice-1");
  const serverItem = makeItem("server-rice-1");
  const preParentEntry = makeBatchEntry();

  assert.equal(getInventoryBatchProjectionItemId(preParentEntry), "local-rice-1");
  const [preParentItem] = mergeInventoryItemsWithSyncStatus(
    [localItem],
    [preParentEntry],
  );
  assert.equal(preParentItem.id, "local-rice-1");
  assert.equal(preParentItem.sync_status, "FAILED");
  assert.equal(preParentItem.stock_forms.length, 1);

  const [preParentBatch] = mergeInventoryBatchesWithSyncStatus({
    inventoryBatches: [],
    inventoryItems: [localItem],
    syncQueueEntries: [preParentEntry],
  });
  assert.equal(preParentBatch.inventory_item_id, "local-rice-1");
  assert.equal(preParentBatch.inventory_item.id, "local-rice-1");

  const resolvedEntry = makeBatchEntry({
    queueDisplayContext: {
      resolved_inventory_item_id: "server-rice-1",
      preserved_label: "Rice",
    },
  });

  assert.equal(getInventoryBatchProjectionItemId(resolvedEntry), "server-rice-1");
  assert.equal(resolvedEntry.payload.inventory_item_id, "local-rice-1");
  const [postParentItem] = mergeInventoryItemsWithSyncStatus(
    [serverItem],
    [resolvedEntry],
  );
  assert.equal(postParentItem.id, "server-rice-1");
  assert.equal(postParentItem.sync_status, "FAILED");
  assert.equal(postParentItem.stock_forms.length, 1);
  assert.equal(postParentItem.stock_forms[0].inventory_item_id, "server-rice-1");

  const [postParentBatch] = mergeInventoryBatchesWithSyncStatus({
    inventoryBatches: [],
    inventoryItems: [serverItem],
    syncQueueEntries: [resolvedEntry],
  });
  assert.equal(postParentBatch.inventory_item_id, "server-rice-1");
  assert.equal(postParentBatch.inventory_item.id, "server-rice-1");
  assert.equal(postParentBatch.quantity_available, 10);

  assert.equal(
    buildQueuedInventoryBatch(resolvedEntry, [serverItem]).inventory_item_id,
    "server-rice-1",
  );
  assert.equal(
    buildQueuedInventoryStockForm(resolvedEntry, serverItem).inventory_item_id,
    "server-rice-1",
  );
});

test("multiple dependent children reconcile to one authoritative item and successful children are not double-counted", async () => {
  const { mergeInventoryItemsWithSyncStatus } = await import(
    "../src/features/inventory-items/inventoryItemSync.js"
  );
  const { mergeInventoryBatchesWithSyncStatus } = await import(
    "../src/offline/mayorInventoryOfflineModel.js"
  );

  const serverItem = makeItem("server-rice-1");
  const failedChildren = [1, 2, 3].map((sequence) =>
    makeBatchEntry({
      id: `batch-queue-${sequence}`,
      entityLocalId: `RICE-BATCH-00${sequence}`,
      queueDisplayContext: {
        resolved_inventory_item_id: "server-rice-1",
      },
      payload: {
        ...makeBatchEntry().payload,
        batch_no: `RICE-BATCH-00${sequence}`,
        quantity_received: sequence * 10,
      },
    }),
  );

  const [itemWithChildren] = mergeInventoryItemsWithSyncStatus(
    [serverItem],
    failedChildren,
  );
  assert.equal(itemWithChildren.id, "server-rice-1");
  assert.equal(itemWithChildren.stock_forms.length, 3);

  const projectedChildren = mergeInventoryBatchesWithSyncStatus({
    inventoryBatches: [],
    inventoryItems: [serverItem],
    syncQueueEntries: failedChildren,
  });
  assert.equal(projectedChildren.length, 3);
  assert.deepEqual(
    projectedChildren.map((batch) => batch.inventory_item_id),
    ["server-rice-1", "server-rice-1", "server-rice-1"],
  );

  const successfulChild = {
    ...failedChildren[0],
    status: "SYNCED",
    entityServerId: "server-batch-1",
  };
  const serverBatch = {
    id: "server-batch-1",
    inventory_item_id: "server-rice-1",
    batch_no: "RICE-BATCH-001",
    quantity_available: 10,
    quantity_received: 10,
  };
  const afterChildSuccess = mergeInventoryBatchesWithSyncStatus({
    inventoryBatches: [serverBatch],
    inventoryItems: [serverItem],
    syncQueueEntries: [successfulChild],
  });
  assert.equal(afterChildSuccess.length, 1);
  assert.equal(afterChildSuccess[0].id, "server-batch-1");
  assert.equal(afterChildSuccess[0].quantity_available, 10);
  assert.equal(afterChildSuccess[0].is_local_only, false);
});

test("parent conflict leaves the local child projection unaliased and opening stock keeps its existing flow", async () => {
  const { mergeInventoryItemsWithSyncStatus } = await import(
    "../src/features/inventory-items/inventoryItemSync.js"
  );
  const {
    buildQueuedInventoryItemOpeningBatch,
    mergeInventoryBatchesWithSyncStatus,
  } = await import("../src/offline/mayorInventoryOfflineModel.js");

  const localItemCreate = {
    id: "item-create-queue",
    moduleName: "mayor-inventory",
    actionKey: "INVENTORY_ITEM_CREATE",
    entityType: "INVENTORY_ITEM",
    entityLocalId: "local-rice-1",
    status: "CONFLICT",
    payload: {
      item_name: "Rice",
      packaging: "sack",
      packaging_count: 2,
      quantity: 25,
    },
  };
  const localChild = makeBatchEntry({ status: "CONFLICT" });
  const [localItem] = mergeInventoryItemsWithSyncStatus([], [localItemCreate, localChild]);

  assert.equal(localItem.id, "local-rice-1");
  assert.equal(localItem.stock_forms.length, 2);
  assert.equal(localItem.stock_forms[1].inventory_item_id, "local-rice-1");

  const openingBatch = buildQueuedInventoryItemOpeningBatch(localItemCreate, [localItem]);
  const mergedBatches = mergeInventoryBatchesWithSyncStatus({
    inventoryBatches: [],
    inventoryItems: [localItem],
    syncQueueEntries: [localItemCreate, localChild],
  });
  assert.equal(openingBatch.quantity_available, 50);
  assert.equal(mergedBatches.length, 2);
  assert.equal(mergedBatches[0].inventory_item_id, "local-rice-1");
  assert.equal(mergedBatches[1].inventory_item_id, "local-rice-1");
  assert.equal(
    Object.prototype.hasOwnProperty.call(localChild, "queueDisplayContext"),
    false,
  );
});

test("projection alias is durable queue metadata and does not alter IndexedDB schema or payload authority", async () => {
  const [queueSource, syncServiceSource, dbSource, batchPageSource] =
    await Promise.all([
      fs.readFile(new URL("../src/offline/syncQueue.js", import.meta.url), "utf8"),
      fs.readFile(new URL("../src/offline/syncService.js", import.meta.url), "utf8"),
      fs.readFile(new URL("../src/offline/db.js", import.meta.url), "utf8"),
      fs.readFile(
        new URL("../src/pages/inventory/InventoryBatchesPage.jsx", import.meta.url),
        "utf8",
      ),
    ]);

  assert.match(queueSource, /persistResolvedInventoryItemProjectionId/);
  assert.match(queueSource, /queueDisplayContext/);
  assert.match(queueSource, /resolved_inventory_item_id/);
  assert.match(queueSource, /db\.transaction\("rw", db\.syncQueue/);
  assert.match(syncServiceSource, /persistResolvedInventoryItemProjectionId\(\{/);
  assert.ok(
    syncServiceSource.indexOf("await persistResolvedInventoryItemProjectionId") <
      syncServiceSource.indexOf("await clearSyncedEntries()"),
  );
  assert.match(batchPageSource, /getInventoryBatchProjectionItemId/);
  assert.doesNotMatch(dbSource, /queueDisplayContext/);
  assert.match(dbSource, /this\.version\(5\)\.stores/);
});
