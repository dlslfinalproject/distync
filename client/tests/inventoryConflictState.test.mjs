import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

test("Mayor inventory conflict state maps item and batch conflicts to the affected item", async () => {
  const {
    getInventoryItemIdFromSyncConflict,
    getMayorInventoryConflictState,
  } = await import("../src/features/inventory-items/inventorySyncConflicts.js");

  const itemConflict = {
    entity_type: "INVENTORY_ITEM",
    entity_server_id: "item-1",
    status: "OPEN",
  };
  const batchConflict = {
    entity_type: "INVENTORY_BATCH",
    local_payload_json: {
      payload: {
        inventory_item_id: "item-2",
      },
    },
    status: "OPEN",
  };

  assert.equal(getInventoryItemIdFromSyncConflict(itemConflict), "item-1");
  assert.equal(getInventoryItemIdFromSyncConflict(batchConflict), "item-2");
  assert.equal(
    getInventoryItemIdFromSyncConflict({
      entity_type: "INVENTORY_BATCH",
      entity_server_id: "batch-3",
      status: "OPEN",
    }, {
      inventoryBatches: [
        { id: "batch-3", inventory_item_id: "item-3" },
      ],
    }),
    "item-3",
  );
  assert.equal(
    getInventoryItemIdFromSyncConflict({
      entity_type: "INVENTORY_TRANSACTION",
      local_payload_json: {
        inventory_state_basis: { inventoryItemId: "item-4" },
      },
      status: "OPEN",
    }),
    "item-4",
  );

  const state = getMayorInventoryConflictState([
    itemConflict,
    batchConflict,
    {
      ...batchConflict,
      status: "RESOLVED",
      sync_transaction_id: "transaction-2",
    },
    {
      entity_type: "HOUSEHOLD",
      entity_server_id: "household-1",
      status: "OPEN",
    },
  ]);

  assert.deepEqual([...state.openItemIds].sort(), ["item-1", "item-2"]);
  assert.deepEqual([...state.resolvedTransactionIds], ["transaction-2"]);
});

test("server open conflicts override local status and resolved transactions stop stale local projection", async () => {
  const { mergeInventoryItemsWithSyncStatus } = await import(
    "../src/features/inventory-items/inventoryItemSync.js"
  );

  const items = [
    {
      id: "item-1",
      item_name: "Rice",
      stock_forms: [],
    },
    {
      id: "item-2",
      item_name: "Water",
      stock_forms: [],
    },
  ];
  const staleConflictEntry = {
    id: "queue-1",
    syncTransactionId: "transaction-1",
    moduleName: "mayor-inventory",
    actionKey: "INVENTORY_BATCH_CREATE",
    entityType: "INVENTORY_BATCH",
    status: "CONFLICT",
    payload: {
      inventory_item_id: "item-1",
      stock_form_packaging: "box",
      stock_form_barcode: "12345678",
      quantity_received: 10,
    },
  };

  const merged = mergeInventoryItemsWithSyncStatus(items, [staleConflictEntry], {
    serverConflictItemIds: new Set(["item-2"]),
    resolvedConflictTransactionIds: new Set(["transaction-1"]),
  });

  assert.equal(merged.find((item) => item.id === "item-1").sync_status, "SYNCED");
  assert.equal(merged.find((item) => item.id === "item-2").sync_status, "CONFLICT");
  assert.equal(
    merged.find((item) => item.id === "item-1").stock_forms.length,
    0,
  );
});

test("inventory and Sync Center pages refresh shared conflicts and reconcile local rows", async () => {
  const [inventoryPageSource, syncCenterSource, queueSource] = await Promise.all([
    fs.readFile(
      new URL("../src/pages/inventory/InventoryItemsPage.jsx", import.meta.url),
      "utf8",
    ),
    fs.readFile(
      new URL("../src/pages/SyncManagementPage.jsx", import.meta.url),
      "utf8",
    ),
    fs.readFile(new URL("../src/offline/syncQueue.js", import.meta.url), "utf8"),
  ]);

  assert.match(inventoryPageSource, /conflict_status: "OPEN"/);
  assert.match(inventoryPageSource, /conflict_status: "RESOLVED"/);
  assert.match(inventoryPageSource, /serverConflictItemIds/);
  assert.match(inventoryPageSource, /reconcileResolvedSyncEntries/);
  assert.match(syncCenterSource, /reconcileResolvedSyncEntries/);
  assert.match(syncCenterSource, /setInterval\(refreshSyncHistory, 30000\)/);
  assert.match(queueSource, /syncTransactionId \|\| entry\.sync_transaction_id/);
});
