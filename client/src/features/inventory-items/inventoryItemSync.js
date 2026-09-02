import { buildSyncDescriptor, findSyncEntry } from "../../offline/syncStatus.js";

export const buildQueuedInventoryItem = (entry) => {
  const payload = entry.payload || {};
  const localItemId = entry.entityLocalId || entry.id;
  const packaging = payload.packaging || "piece";
  const unitsPerPackaging =
    Number(payload.quantity || payload.units_per_packaging || 0) ||
    (packaging === "piece" ? 1 : 0);

  return {
    id: localItemId,
    item_code: payload.item_code || localItemId,
    item_name: payload.item_name || "Pending inventory item",
    category: payload.category || "--",
    quantity: payload.quantity || unitsPerPackaging || 1,
    packaging_count: payload.packaging_count || 0,
    unit_of_measure: payload.unit_of_measure || "--",
    unit_of_measure_value: payload.unit_of_measure_value || 1,
    packaging,
    barcode: payload.barcode || null,
    reorder_level: payload.reorder_level ?? null,
    expiration_date: payload.expiration_date || null,
    is_active: true,
    is_perishable: Boolean(payload.is_perishable),
    stock_forms: [
      {
        id: `local-stock-form:${entry.id || localItemId}`,
        inventory_item_id: localItemId,
        barcode: payload.barcode || null,
        packaging,
        units_per_packaging: unitsPerPackaging || 1,
        unit_of_measure: payload.unit_of_measure || "pc",
        unit_of_measure_value: payload.unit_of_measure_value || 1,
        is_active: true,
        is_local_only: true,
      },
    ],
    is_local_only: true,
    sync_status: entry.status,
    client_sync_id: entry.id || null,
    created_at: entry.clientTimestamp || null,
    updated_at: entry.clientUpdatedAt || entry.clientTimestamp || null,
  };
};

export const mergeInventoryItemsWithSyncStatus = (
  inventoryItems,
  syncQueueEntries,
) => {
  const syncedItems = inventoryItems.map((item) => {
    const matchingEntry = findSyncEntry(syncQueueEntries, (entry) => {
      if (entry.moduleName !== "mayor-inventory") {
        return false;
      }

      return (
        entry.entityType === "INVENTORY_ITEM" &&
        (entry.entityServerId === item.id || entry.entityLocalId === item.id)
      );
    });

    return {
      ...item,
      sync_status: buildSyncDescriptor(matchingEntry).status,
      is_local_only: false,
    };
  });

  const optimisticItems = syncQueueEntries
    .filter((entry) => {
      return (
        entry.moduleName === "mayor-inventory" &&
        entry.actionKey === "INVENTORY_ITEM_CREATE" &&
        !syncedItems.some(
          (item) =>
            item.id === entry.entityServerId || item.id === entry.entityLocalId,
        )
      );
    })
    .map(buildQueuedInventoryItem);

  return [...optimisticItems, ...syncedItems];
};
