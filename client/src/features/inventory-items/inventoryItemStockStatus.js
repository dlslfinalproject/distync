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

  return targetDate <= comparisonDate;
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
  hasBatchRecords: false,
  hasAvailableBatch: false,
  expired: 0,
  expiredOnHand: 0,
  nearExpiryOnHand: 0,
  damaged: 0,
  missing: 0,
  spoiled: 0,
  stolen: 0,
  other: 0,
  nearestExpirationDate: null,
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
    const quantityAvailable = normalizeQuantity(batch.quantity_available);

    tracking.hasBatchRecords = true;
    tracking.totalReceived += normalizeQuantity(batch.quantity_received);
    tracking.onHand += quantityAvailable;

    if (quantityAvailable <= 0) {
      return;
    }

    tracking.hasAvailableBatch = true;

    if (batch.expiration_date) {
      tracking.nearestExpirationDate = getEarlierDate(
        tracking.nearestExpirationDate,
        batch.expiration_date,
      );

      if (isDateExpired(batch.expiration_date)) {
        tracking.expiredOnHand += quantityAvailable;
      } else if (isItemExpiring({ expiration_date: batch.expiration_date })) {
        tracking.nearExpiryOnHand += quantityAvailable;
      }
    }
  });

  inventoryTransactions.forEach((transaction) => {
    const itemId = transaction.inventory_item?.id || transaction.inventory_item_id;
    const tracking = ensureTrackingEntry(itemId);

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

    if (transaction.transaction_type === "OTHER") {
      tracking.other += normalizeQuantity(transaction.quantity);
    }
  });

  return trackingMap;
};

export const getTrackedExpirationDate = (item, trackingStats = {}) => {
  if (trackingStats.hasBatchRecords) {
    return trackingStats.hasAvailableBatch
      ? trackingStats.nearestExpirationDate
      : null;
  }

  return item?.expiration_date || null;
};
