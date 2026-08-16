import { buildSyncDescriptor, findSyncEntry } from "../../offline/syncStatus";

export const buildQueuedDonation = (entry, inventoryItems, disasterEvents) => {
  const disasterEvent = disasterEvents.find(
    (event) => event.id === entry.payload?.disaster_event_id,
  );
  const itemRows = Array.isArray(entry.payload?.items) ? entry.payload.items : [];
  const totalQuantityReceived = itemRows.reduce((sum, item) => {
    return sum + Number(item.quantity_received || 0);
  }, 0);

  return {
    id: entry.entityLocalId || entry.id,
    donor_name: entry.payload?.donor_name || "Pending donation",
    donor_type: entry.payload?.donor_type || "INDIVIDUAL",
    contact_information: entry.payload?.contact_information || "",
    received_at: entry.payload?.received_at || entry.clientTimestamp,
    status: entry.payload?.status || "RECEIVED",
    remarks: entry.payload?.remarks || "",
    disaster_event: disasterEvent || null,
    items: itemRows.map((item, index) => ({
      id: `${entry.id}-${index}`,
      ...item,
      inventory_item: inventoryItems.find(
        (inventoryItem) => inventoryItem.id === item.inventory_item_id,
      ),
    })),
    item_count: itemRows.length,
    total_quantity_received: totalQuantityReceived,
    sync_status: entry.status,
    is_local_only: true,
  };
};

export const mergeDonationsWithSyncStatus = ({
  donations,
  syncQueueEntries,
  selectedEventId,
  inventoryItems,
  disasterEvents,
}) => {
  const syncedRows = donations.map((donation) => {
    const matchingEntry = findSyncEntry(syncQueueEntries, (entry) => {
      if (entry.moduleName !== "mayor-donations") {
        return false;
      }

      return (
        entry.entityType === "DONATION" &&
        (entry.entityServerId === donation.id || entry.entityLocalId === donation.id)
      );
    });

    return {
      ...donation,
      sync_status: buildSyncDescriptor(matchingEntry).status,
      is_local_only: false,
    };
  });

  const optimisticRows = syncQueueEntries
    .filter((entry) => {
      return (
        entry.moduleName === "mayor-donations" &&
        entry.actionKey === "DONATION_CREATE" &&
        !syncedRows.some(
          (donation) =>
            donation.id === entry.entityServerId ||
            donation.id === entry.entityLocalId,
        ) &&
        (!selectedEventId || entry.payload?.disaster_event_id === selectedEventId)
      );
    })
    .map((entry) => buildQueuedDonation(entry, inventoryItems, disasterEvents));

  return [...optimisticRows, ...syncedRows];
};
