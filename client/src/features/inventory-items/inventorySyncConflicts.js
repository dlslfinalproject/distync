const MAYOR_INVENTORY_ENTITY_TYPES = new Set([
  "INVENTORY_ITEM",
  "INVENTORY_BATCH",
  "INVENTORY_TRANSACTION",
]);

const normalizeKey = (value) => String(value || "").trim().toUpperCase();

const normalizeId = (value) => String(value || "").trim();

const parseJsonValue = (value) => {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
};

const collectPayloadObjects = (value) => {
  const parsedValue = parseJsonValue(value);

  if (!parsedValue || typeof parsedValue !== "object") {
    return [];
  }

  const objects = [];
  const pendingValues = [parsedValue];
  const visited = new Set();

  while (pendingValues.length > 0) {
    const currentValue = pendingValues.shift();

    if (
      !currentValue ||
      typeof currentValue !== "object" ||
      visited.has(currentValue)
    ) {
      continue;
    }

    visited.add(currentValue);

    if (Array.isArray(currentValue)) {
      pendingValues.push(...currentValue);
      continue;
    }

    objects.push(currentValue);
    pendingValues.push(
      ...Object.values(currentValue).filter(
        (nestedValue) => nestedValue && typeof nestedValue === "object",
      ),
    );
  }

  return objects;
};

const getConflictPayloadObjects = (conflict = {}) => [
  ...collectPayloadObjects(conflict.local_payload_json),
  ...collectPayloadObjects(conflict.server_payload_json),
  ...collectPayloadObjects(conflict.payload_json),
  ...collectPayloadObjects(conflict.resolved_payload_json),
];

const getPayloadInventoryItemId = (payloadObjects = []) => {
  for (const payloadObject of payloadObjects) {
    const directId = normalizeId(
      payloadObject.inventory_item_id ||
        payloadObject.inventoryItemId ||
        payloadObject.item_id ||
        payloadObject.itemId,
    );

    if (directId) {
      return directId;
    }

    for (const nestedItem of [payloadObject.inventory_item, payloadObject.item]) {
      const nestedItemObject = parseJsonValue(nestedItem);
      const nestedItemId = normalizeId(
        nestedItemObject?.id || nestedItemObject?.inventory_item_id,
      );

      if (nestedItemId) {
        return nestedItemId;
      }
    }
  }

  return "";
};

const getPayloadInventoryBatchId = (payloadObjects = []) => {
  for (const payloadObject of payloadObjects) {
    const batchId = normalizeId(
      payloadObject.inventory_batch_id ||
        payloadObject.inventoryBatchId ||
        payloadObject.batch_id ||
        payloadObject.batchId,
    );

    if (batchId) {
      return batchId;
    }
  }

  return "";
};

const getPayloadItemRecordId = (payloadObjects = []) => {
  for (const payloadObject of payloadObjects) {
    if (
      payloadObject.item_name ||
      payloadObject.item_code ||
      payloadObject.stock_forms
    ) {
      const itemId = normalizeId(payloadObject.id);

      if (itemId) {
        return itemId;
      }
    }
  }

  return "";
};

export const isMayorInventorySyncConflict = (conflict = {}) =>
  MAYOR_INVENTORY_ENTITY_TYPES.has(
    normalizeKey(conflict.entity_type || conflict.entityType),
  );

export const getSyncConflictStatus = (conflict = {}) =>
  normalizeKey(
    conflict.status ||
      conflict.conflict_status ||
      conflict.sync_conflict_status ||
      conflict.resolution_status,
  );

export const getInventoryItemIdFromSyncConflict = (
  conflict = {},
  { inventoryBatches = [] } = {},
) => {
  if (!isMayorInventorySyncConflict(conflict)) {
    return "";
  }

  const entityType = normalizeKey(conflict.entity_type || conflict.entityType);
  const payloadObjects = getConflictPayloadObjects(conflict);

  const explicitItemId = normalizeId(
    conflict.affected_inventory_item_id ||
      conflict.affectedInventoryItemId ||
      conflict.inventory_item_id ||
      conflict.inventoryItemId,
  );

  if (explicitItemId) {
    return explicitItemId;
  }

  if (entityType === "INVENTORY_ITEM") {
    return (
      normalizeId(conflict.entity_server_id || conflict.entityServerId) ||
      getPayloadInventoryItemId(payloadObjects) ||
      getPayloadItemRecordId(payloadObjects)
    );
  }

  const payloadItemId = getPayloadInventoryItemId(payloadObjects);

  if (payloadItemId) {
    return payloadItemId;
  }

  const payloadBatchId = getPayloadInventoryBatchId(payloadObjects);
  const batchId =
    (entityType === "INVENTORY_BATCH"
      ? normalizeId(conflict.entity_server_id || conflict.entityServerId)
      : "") || payloadBatchId;
  const matchingBatch = (Array.isArray(inventoryBatches) ? inventoryBatches : []).find(
    (batch) => normalizeId(batch?.id) === batchId,
  );

  return normalizeId(
    matchingBatch?.inventory_item_id || matchingBatch?.inventoryItemId,
  );
};

export const getMayorInventoryConflictState = (
  conflicts = [],
  { inventoryBatches = [] } = {},
) => {
  const openItemIds = new Set();
  const resolvedTransactionIds = new Set();

  (Array.isArray(conflicts) ? conflicts : []).forEach((conflict) => {
    if (!isMayorInventorySyncConflict(conflict)) {
      return;
    }

    const conflictStatus = getSyncConflictStatus(conflict);

    if (conflictStatus === "OPEN") {
      const itemId = getInventoryItemIdFromSyncConflict(conflict, {
        inventoryBatches,
      });

      if (itemId) {
        openItemIds.add(itemId);
      }
    }

    if (conflictStatus === "RESOLVED") {
      const syncTransactionId = normalizeId(
        conflict.sync_transaction_id || conflict.syncTransactionId,
      );

      if (syncTransactionId) {
        resolvedTransactionIds.add(syncTransactionId);
      }
    }
  });

  return { openItemIds, resolvedTransactionIds };
};
