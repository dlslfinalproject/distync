export const formatNumericValue = (value) => {
  if (!Number.isFinite(value)) {
    return "--";
  }

  if (Number.isInteger(value)) {
    return value.toLocaleString();
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

export const formatUnitOfMeasurement = (item) => {
  const unitOfMeasureValue = Number(item.unit_of_measure_value || 0);

  if (
    Number.isFinite(unitOfMeasureValue) &&
    unitOfMeasureValue > 0 &&
    item.unit_of_measure
  ) {
    return `${formatNumericValue(unitOfMeasureValue)} ${item.unit_of_measure}`;
  }

  return item.unit_of_measure || "--";
};

export const formatPercentage = (value, total) => {
  if (!total) {
    return "0%";
  }

  return `${Math.round((value / total) * 100)}%`;
};

export const getTotalItemQuantity = (item) => {
  const packagingCount = Number(item.packaging_count || 0);
  const quantityPerPackaging = Number(item.quantity || 0);
  const normalizedPackagingCount =
    Number.isFinite(packagingCount) && packagingCount > 0 ? packagingCount : 0;
  const normalizedQuantityPerPackaging =
    Number.isFinite(quantityPerPackaging) && quantityPerPackaging > 0
      ? quantityPerPackaging
      : 0;
  const totalQuantity = normalizedPackagingCount * normalizedQuantityPerPackaging;

  return formatNumericValue(totalQuantity);
};

export const formatDisplayDate = (value) => {
  if (!value) {
    return "--";
  }

  const parsedDate = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return "--";
  }

  return parsedDate.toLocaleDateString();
};

const getSortableTimestamp = (value) => {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const parsedValue = new Date(value).getTime();
  return Number.isNaN(parsedValue) ? Number.POSITIVE_INFINITY : parsedValue;
};

// Batch Information follows the order in which the server established the
// records. Local timestamps remain a fallback for rows that do not have a
// server-created timestamp yet.
export const sortInventoryBatchesForDisplay = (batches = []) =>
  (Array.isArray(batches) ? [...batches] : []).sort((leftBatch, rightBatch) => {
    const createdAtDifference =
      getSortableTimestamp(leftBatch?.created_at || leftBatch?.received_at) -
      getSortableTimestamp(rightBatch?.created_at || rightBatch?.received_at);

    if (createdAtDifference !== 0) {
      return createdAtDifference;
    }

    const receivedAtDifference =
      getSortableTimestamp(leftBatch?.received_at) -
      getSortableTimestamp(rightBatch?.received_at);

    if (receivedAtDifference !== 0) {
      return receivedAtDifference;
    }

    return String(leftBatch?.id || "").localeCompare(String(rightBatch?.id || ""));
  });
