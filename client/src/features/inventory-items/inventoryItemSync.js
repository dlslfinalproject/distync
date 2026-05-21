import { buildSyncDescriptor, findSyncEntry } from "../../offline/syncStatus";

export const buildQueuedInventoryItem = (entry) => {
  return {
    id: entry.entityLocalId || entry.id,
    item_name: entry.payload?.item_name || "Pending inventory item",
    category: entry.payload?.category || "--",
    quantity: entry.payload?.quantity || 0,
    packaging_count: entry.payload?.packaging_count || 0,
    unit_of_measure: entry.payload?.unit_of_measure || "--",
    unit_of_measure_value: entry.payload?.unit_of_measure_value || 1,
    expiration_date: entry.payload?.expiration_date || null,
    is_active: true,
    is_perishable: Boolean(entry.payload?.is_perishable),
    is_local_only: true,
    sync_status: entry.status,
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
