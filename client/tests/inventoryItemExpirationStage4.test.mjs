import assert from "node:assert/strict";
import test from "node:test";

test("STAGE4-01 item responses without parent expiration still derive current expiry from batches", async () => {
  const [offlineModel, stockStatus] = await Promise.all([
    import("../src/offline/mayorInventoryOfflineModel.js"),
    import("../src/features/inventory-items/inventoryItemStockStatus.js"),
  ]);
  const inventoryItem = {
    id: "item-without-parent-expiry",
    item_name: "Batch Owned Rice",
    is_perishable: true,
    stock_forms: [],
  };
  const inventoryBatch = {
    id: "batch-with-authoritative-expiry",
    inventory_item_id: inventoryItem.id,
    quantity_available: 4,
    expiration_date: "2099-12-31",
    status: "AVAILABLE",
  };

  const detail = offlineModel.buildMayorInventoryItemDetailFromLocalGraph({
    inventoryItemId: inventoryItem.id,
    inventoryItems: [inventoryItem],
    inventoryBatches: [inventoryBatch],
    inventoryTransactions: [],
  });
  const trackingStats = stockStatus.buildInventoryTrackingMap(
    [detail.item],
    [inventoryBatch],
    [],
  ).get(inventoryItem.id);

  assert.equal(detail.item.expiration_date, undefined);
  assert.equal(
    stockStatus.getTrackedExpirationDate(detail.item, trackingStats),
    "2099-12-31",
  );
});
