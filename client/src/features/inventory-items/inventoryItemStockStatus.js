export const isItemExpiring = (item) => {
  if (!item.expiration_date) {
    return false;
  }

  const today = new Date();
  const comparisonDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const expirationDate = new Date(`${item.expiration_date}T00:00:00`);

  if (Number.isNaN(expirationDate.getTime())) {
    return false;
  }

  const millisecondsUntilExpiration =
    expirationDate.getTime() - comparisonDate.getTime();
  const daysUntilExpiration = millisecondsUntilExpiration / (1000 * 60 * 60 * 24);

  return daysUntilExpiration >= 0 && daysUntilExpiration <= 30;
};

export const isDateExpired = (dateValue) => {
  if (!dateValue) {
    return false;
  }

  const today = new Date();
  const comparisonDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const targetDate = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(targetDate.getTime())) {
    return false;
  }

  return targetDate < comparisonDate;
};

export const normalizeQuantity = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

export const getEarlierDate = (currentDate, nextDate) => {
  if (!currentDate) {
    return nextDate;
  }

  if (!nextDate) {
    return currentDate;
  }

  return new Date(`${nextDate}T00:00:00`) < new Date(`${currentDate}T00:00:00`)
    ? nextDate
    : currentDate;
};

export const createEmptyTrackingStats = () => ({
  totalReceived: 0,
  onHand: 0,
  distributed: 0,
  expired: 0,
  expiredOnHand: 0,
  damaged: 0,
  missing: 0,
  spoiled: 0,
  stolen: 0,
  nearestExpirationDate: null,
  hasExpiringStock: false,
});

export const buildInventoryTrackingMap = (
  inventoryItems,
  inventoryBatches,
  inventoryTransactions,
) => {
  const trackingMap = new Map(
    inventoryItems.map((item) => [item.id, createEmptyTrackingStats()]),
  );

  const ensureTrackingEntry = (itemId) => {
    if (!itemId) {
      return createEmptyTrackingStats();
    }

    if (!trackingMap.has(itemId)) {
      trackingMap.set(itemId, createEmptyTrackingStats());
    }

    return trackingMap.get(itemId);
  };

  inventoryBatches.forEach((batch) => {
    const itemId = batch.inventory_item?.id || batch.inventory_item_id;
    const tracking = ensureTrackingEntry(itemId);

    tracking.totalReceived += normalizeQuantity(batch.quantity_received);
    tracking.onHand += normalizeQuantity(batch.quantity_available);

    if (batch.expiration_date) {
      tracking.nearestExpirationDate = getEarlierDate(
        tracking.nearestExpirationDate,
        batch.expiration_date,
      );

      if (isItemExpiring({ expiration_date: batch.expiration_date })) {
        tracking.hasExpiringStock = true;
      }

      if (isDateExpired(batch.expiration_date)) {
        tracking.expiredOnHand += normalizeQuantity(batch.quantity_available);
      }
    }
  });

  inventoryTransactions.forEach((transaction) => {
    const itemId = transaction.inventory_item?.id || transaction.inventory_item_id;
    const tracking = ensureTrackingEntry(itemId);

    if (
      transaction.transaction_type === "OUTFLOW" &&
      transaction.reference_type === "DISTRIBUTION"
    ) {
      tracking.distributed += normalizeQuantity(transaction.quantity);
    }

    if (transaction.transaction_type === "EXPIRED") {
      tracking.expired += normalizeQuantity(transaction.quantity);
    }

    if (transaction.transaction_type === "DAMAGED") {
      tracking.damaged += normalizeQuantity(transaction.quantity);
    }

    if (transaction.transaction_type === "MISSING") {
      tracking.missing += normalizeQuantity(transaction.quantity);
    }

    if (transaction.transaction_type === "SPOILED") {
      tracking.spoiled += normalizeQuantity(transaction.quantity);
    }

    if (transaction.transaction_type === "STOLEN") {
      tracking.stolen += normalizeQuantity(transaction.quantity);
    }
  });

  return trackingMap;
};

export const getTrackedExpirationDate = (item, trackingStats) => {
  return getEarlierDate(
    item.expiration_date || null,
    trackingStats.nearestExpirationDate,
  );
};

export const getItemStatus = (item, trackingStats) => {
  const trackedExpirationDate = getTrackedExpirationDate(item, trackingStats);

  if (!item.is_active) {
    return "Inactive";
  }

  if (trackingStats.expiredOnHand > 0 || isDateExpired(trackedExpirationDate)) {
    return "Expired";
  }

  if (
    trackingStats.distributed > 0 &&
    trackingStats.onHand === 0 &&
    trackingStats.totalReceived > 0
  ) {
    return "Distributed";
  }

  if (trackingStats.hasExpiringStock || isItemExpiring(item)) {
    return "Expiring";
  }

  return "Available";
};

export const getItemStatusStyle = (status) => {
  if (status === "Low Stock") {
    return {
      background: "#ffedd5",
      color: "#c2410c",
    };
  }

  if (status === "Expired") {
    return {
      background: "#fee2e2",
      color: "#b91c1c",
    };
  }

  if (status === "Near Expiry") {
    return {
      background: "#ede9fe",
      color: "#6d28d9",
    };
  }

  return {
    background: "#e0f2fe",
    color: "#075985",
  };
};
