import { LOCAL_SYNC_STATUS } from "./syncStatusConstants.js";
import { normalizeInventoryBarcode } from "../features/inventory-items/inventoryBarcode.js";
import { buildQueuedInventoryItem } from "../features/inventory-items/inventoryItemSync.js";

export const MAYOR_INVENTORY_CACHE_VERSION = 1;

export const MAYOR_INVENTORY_OFFLINE_ACTIONS = Object.freeze([
  "INVENTORY_ITEM_CREATE",
  "INVENTORY_ITEM_UPDATE",
  "INVENTORY_BATCH_CREATE",
]);

const MAYOR_INVENTORY_MODULE = "mayor-inventory";
const LOCAL_BATCH_ID_PREFIX = "local-inventory-batch:";

const normalizeId = (value) => String(value || "").trim();

const normalizePositiveQuantity = (value) => {
  const quantity = Number(value);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
};

export const isMayorInventoryOfflineAction = (entry = {}) =>
  entry?.moduleName === MAYOR_INVENTORY_MODULE &&
  MAYOR_INVENTORY_OFFLINE_ACTIONS.includes(entry?.actionKey);

export const isOutstandingMayorInventoryQueueEntry = (entry = {}) =>
  isMayorInventoryOfflineAction(entry) &&
  [
    LOCAL_SYNC_STATUS.PENDING,
    LOCAL_SYNC_STATUS.FAILED,
    LOCAL_SYNC_STATUS.CONFLICT,
  ].includes(entry?.status);

export const getInventoryItemIdForBatch = (batch = {}) =>
  normalizeId(batch?.inventory_item_id || batch?.inventory_item?.id || batch?.item_id);

export const getInventoryBatchIdentity = (batch = {}) =>
  `${getInventoryItemIdForBatch(batch)}|${normalizeId(batch?.batch_no).toUpperCase()}`;

export { buildQueuedInventoryItem };

export const buildQueuedInventoryBatch = (
  entry = {},
  inventoryItems = [],
  suppliers = [],
) => {
  const payload = entry.payload || {};
  const availableItems = Array.isArray(inventoryItems) ? inventoryItems : [];
  const availableSuppliers = Array.isArray(suppliers) ? suppliers : [];
  const inventoryItemId = normalizeId(payload.inventory_item_id);
  const inventoryItem =
    availableItems.find((item) => normalizeId(item?.id) === inventoryItemId) ||
    null;
  const supplierId = normalizeId(payload.supplier_id);
  const supplier =
    availableSuppliers.find((candidate) => normalizeId(candidate?.id) === supplierId) ||
    null;
  const quantityReceived = normalizePositiveQuantity(payload.quantity_received);
  const stockForm = inventoryItem
    ? (inventoryItem.stock_forms || []).find(
        (candidate) =>
          normalizeId(candidate?.id) ===
          normalizeId(payload.inventory_item_stock_form_id),
      ) || null
    : null;

  return {
    id: `${LOCAL_BATCH_ID_PREFIX}${entry.id || entry.entityLocalId || Date.now()}`,
    batch_no: payload.batch_no || entry.entityLocalId || "Pending batch",
    inventory_item_id: inventoryItemId,
    inventory_item_stock_form_id:
      payload.inventory_item_stock_form_id || stockForm?.id || null,
    supplier_id: supplierId || null,
    inventory_item: inventoryItem,
    supplier,
    inventory_item_stock_form: stockForm,
    source_type: payload.source_type || "OTHER",
    quantity_received: quantityReceived,
    quantity_available:
      normalizePositiveQuantity(payload.quantity_available) || quantityReceived,
    expiration_date: payload.expiration_date || null,
    received_at: entry.clientTimestamp || null,
    created_at: entry.clientTimestamp || null,
    updated_at: entry.clientUpdatedAt || entry.clientTimestamp || null,
    status: payload.status || "AVAILABLE",
    sync_status: entry.status || LOCAL_SYNC_STATUS.PENDING,
    is_local_only: true,
    client_sync_id: entry.id || null,
  };
};

export const mergeInventoryBatchesWithSyncStatus = ({
  inventoryBatches = [],
  inventoryItems = [],
  suppliers = [],
  syncQueueEntries = [],
} = {}) => {
  const serverRows = (Array.isArray(inventoryBatches) ? inventoryBatches : []).map(
    (batch) => {
      const matchingEntry = syncQueueEntries.find(
        (entry) =>
          entry?.moduleName === MAYOR_INVENTORY_MODULE &&
          entry?.entityType === "INVENTORY_BATCH" &&
          ([entry.entityServerId, entry.entityLocalId].some(
            (value) => normalizeId(value) && normalizeId(value) === normalizeId(batch.id),
          ) ||
            getInventoryBatchIdentity({
              inventory_item_id: entry.payload?.inventory_item_id,
              batch_no: entry.payload?.batch_no || entry.entityLocalId,
            }) === getInventoryBatchIdentity(batch)),
      );

      return {
        ...batch,
        sync_status: matchingEntry?.status || "SYNCED",
        is_local_only: false,
      };
    },
  );

  const serverIdentities = new Set(
    serverRows.map((batch) => getInventoryBatchIdentity(batch)),
  );
  const optimisticRows = (Array.isArray(syncQueueEntries) ? syncQueueEntries : [])
    .filter(
      (entry) =>
        entry?.moduleName === MAYOR_INVENTORY_MODULE &&
        entry?.actionKey === "INVENTORY_BATCH_CREATE" &&
        isOutstandingMayorInventoryQueueEntry(entry),
    )
    .map((entry) => buildQueuedInventoryBatch(entry, inventoryItems, suppliers))
    .filter((batch) => !serverIdentities.has(getInventoryBatchIdentity(batch)));

  return [...optimisticRows, ...serverRows];
};

export const getMayorInventoryPendingQueueEntries = (syncQueueEntries = []) =>
  (Array.isArray(syncQueueEntries) ? syncQueueEntries : []).filter(
    (entry) =>
      entry?.moduleName === MAYOR_INVENTORY_MODULE &&
      isOutstandingMayorInventoryQueueEntry(entry),
  );

export const buildReservedBatchRows = (reservations = [], inventoryItems = []) =>
  (Array.isArray(reservations) ? reservations : []).map((reservation) => {
    const item = (Array.isArray(inventoryItems) ? inventoryItems : []).find(
      (candidate) => normalizeId(candidate?.id) === normalizeId(reservation.itemId),
    );

    return {
      id: `${LOCAL_BATCH_ID_PREFIX}reserved:${reservation.key}`,
      inventory_item_id: reservation.itemId,
      batch_no: reservation.batchNo,
      inventory_item: item || null,
      quantity_received: 0,
      quantity_available: 0,
      is_local_reservation: true,
      is_local_only: true,
    };
  });

export const buildNextInventoryBatchNumber = (item, relatedBatches = []) => {
  const identifier =
    String(item?.item_code || item?.barcode || item?.id || "ITEM")
      .replace(/[^a-z0-9]/gi, "")
      .slice(-8)
      .toUpperCase() || "ITEM";
  const batchPrefix = `${identifier}-BATCH-`;
  const batches = Array.isArray(relatedBatches) ? relatedBatches : [];
  const existingSequences = batches
    .map((batch) => {
      const batchNumber = normalizeId(batch?.batch_no).toUpperCase();

      if (!batchNumber.startsWith(batchPrefix)) {
        return null;
      }

      const parsedValue = Number(batchNumber.slice(batchPrefix.length));
      return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
    })
    .filter(Boolean);
  const nextSequence = Math.max(batches.length, 0, ...existingSequences) + 1;

  return `${batchPrefix}${String(nextSequence).padStart(3, "0")}`;
};

export const findMayorInventoryItemByBarcode = (inventoryItems = [], barcode) => {
  const normalizedBarcode = normalizeInventoryBarcode(barcode);

  if (!normalizedBarcode) {
    return null;
  }

  for (const item of Array.isArray(inventoryItems) ? inventoryItems : []) {
    if (item?.is_active === false) {
      continue;
    }

    const stockForm = (Array.isArray(item?.stock_forms) ? item.stock_forms : []).find(
      (candidate) =>
        candidate?.is_active !== false &&
        normalizeInventoryBarcode(candidate?.barcode) === normalizedBarcode,
    );

    if (stockForm) {
      return { item, stockForm };
    }

    if (normalizeInventoryBarcode(item?.barcode) === normalizedBarcode) {
      return {
        item,
        stockForm:
          (Array.isArray(item?.stock_forms) ? item.stock_forms : []).find(
            (candidate) => candidate?.is_active !== false,
          ) || null,
      };
    }
  }

  return null;
};
