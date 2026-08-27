const INVENTORY_BATCH_STATUS = Object.freeze({
  AVAILABLE: "AVAILABLE",
  LOW_STOCK: "LOW_STOCK",
  EXPIRED: "EXPIRED",
  DEPLETED: "DEPLETED",
});

const normalizeQuantity = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const parseCalendarDate = (value) => {
  if (!value) {
    return null;
  }

  const normalizedValue =
    value instanceof Date ? value : `${String(value).slice(0, 10)}T00:00:00`;
  const parsedDate = new Date(normalizedValue);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const getCalendarDate = (value = new Date()) => {
  const date = new Date(value);

  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const isInventoryBatchExpired = (expirationDate, today = new Date()) => {
  const parsedExpirationDate = parseCalendarDate(expirationDate);

  if (!parsedExpirationDate) {
    return false;
  }

  return parsedExpirationDate.getTime() <= getCalendarDate(today).getTime();
};

const isInventoryBatchNearExpiry = (
  expirationDate,
  thresholdDays = 30,
  today = new Date(),
) => {
  const parsedExpirationDate = parseCalendarDate(expirationDate);

  if (!parsedExpirationDate || isInventoryBatchExpired(expirationDate, today)) {
    return false;
  }

  const normalizedThresholdDays = Number(thresholdDays);
  if (!Number.isFinite(normalizedThresholdDays) || normalizedThresholdDays < 0) {
    return false;
  }

  const todayDate = getCalendarDate(today);
  const thresholdDate = new Date(todayDate);
  thresholdDate.setDate(thresholdDate.getDate() + normalizedThresholdDays);

  return (
    parsedExpirationDate.getTime() > todayDate.getTime() &&
    parsedExpirationDate.getTime() <= thresholdDate.getTime()
  );
};

const isInventoryBatchLowStock = ({
  quantityAvailable,
  totalQuantityAvailable = quantityAvailable,
  reorderLevel,
}) => {
  const normalizedQuantity = normalizeQuantity(quantityAvailable);
  const normalizedTotalQuantity = normalizeQuantity(totalQuantityAvailable);
  const normalizedReorderLevel = normalizeQuantity(reorderLevel);

  return (
    normalizedQuantity > 0 &&
    normalizedTotalQuantity > 0 &&
    normalizedReorderLevel > 0 &&
    normalizedTotalQuantity <= normalizedReorderLevel
  );
};

const getInventoryBatchStatus = ({
  quantityAvailable,
  expirationDate,
  reorderLevel,
  totalQuantityAvailable,
}) => {
  const normalizedQuantity = normalizeQuantity(quantityAvailable);

  if (normalizedQuantity <= 0) {
    return INVENTORY_BATCH_STATUS.DEPLETED;
  }

  if (isInventoryBatchExpired(expirationDate)) {
    return INVENTORY_BATCH_STATUS.EXPIRED;
  }

  if (
    isInventoryBatchLowStock({
      quantityAvailable: normalizedQuantity,
      totalQuantityAvailable:
        totalQuantityAvailable === undefined
          ? normalizedQuantity
          : totalQuantityAvailable,
      reorderLevel,
    })
  ) {
    return INVENTORY_BATCH_STATUS.LOW_STOCK;
  }

  return INVENTORY_BATCH_STATUS.AVAILABLE;
};

module.exports = {
  INVENTORY_BATCH_STATUS,
  isInventoryBatchExpired,
  isInventoryBatchNearExpiry,
  isInventoryBatchLowStock,
  getInventoryBatchStatus,
};
