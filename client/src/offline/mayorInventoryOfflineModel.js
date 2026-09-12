import { LOCAL_SYNC_STATUS } from "./syncStatusConstants.js";
import { normalizeInventoryBarcode } from "../features/inventory-items/inventoryBarcode.js";
import { findInventoryItemBarcodeMatch } from "../features/inventory-items/inventoryBarcodeLookup.js";
import {
  buildQueuedInventoryItem,
  buildQueuedInventoryStockForm,
} from "../features/inventory-items/inventoryItemSync.js";

export const MAYOR_INVENTORY_CACHE_VERSION = 2;

export const MAYOR_INVENTORY_OFFLINE_ACTIONS = Object.freeze([
  "INVENTORY_ITEM_CREATE",
  // Keep legacy queued edits visible in Sync Center. New edits are blocked by
  // the online-only item service, but an edit captured before that policy
  // changed should not disappear from the user's queue summary.
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

const getInventoryItemIdForTransaction = (transaction = {}) =>
  normalizeId(
    transaction?.inventory_item_id ||
      transaction?.inventory_item?.id ||
      transaction?.inventory_batch?.inventory_item_id ||
      transaction?.inventory_batch?.inventory_item?.id,
  );

/**
 * Build the same item-detail shape used by the live detail endpoint from the
 * verified Mayor inventory graph. The modal currently needs the item,
 * stock-form, and related-batch portions of that response; optional live-only
 * sections remain explicit empty values instead of triggering a network read.
 */
export const buildMayorInventoryItemDetailFromLocalGraph = ({
  inventoryItemId,
  inventoryItems = [],
  inventoryBatches = [],
  inventoryTransactions = [],
} = {}) => {
  const normalizedItemId = normalizeId(inventoryItemId);
  if (!normalizedItemId) {
    return null;
  }

  const item = (Array.isArray(inventoryItems) ? inventoryItems : []).find(
    (candidate) => normalizeId(candidate?.id) === normalizedItemId,
  );

  if (!item) {
    return null;
  }

  const relatedBatches = (Array.isArray(inventoryBatches) ? inventoryBatches : []).filter(
    (batch) => getInventoryItemIdForBatch(batch) === normalizedItemId,
  );
  const relatedTransactions = (
    Array.isArray(inventoryTransactions) ? inventoryTransactions : []
  ).filter(
    (transaction) =>
      getInventoryItemIdForTransaction(transaction) === normalizedItemId,
  );
  const currentStock = relatedBatches.reduce(
    (total, batch) => total + Number(batch?.quantity_available || 0),
    0,
  );

  return {
    item: {
      ...item,
      current_stock: currentStock,
      low_stock_threshold:
        item?.low_stock_threshold ?? item?.reorder_level ?? null,
    },
    stock_forms: Array.isArray(item?.stock_forms) ? item.stock_forms : [],
    related_batches: relatedBatches,
    related_transactions: relatedTransactions,
    forecast_summary: null,
    audit_history: [],
  };
};

export const buildQueuedInventoryBatch = (entry = {}, inventoryItems = []) => {
  const payload = entry.payload || {};
  const availableItems = Array.isArray(inventoryItems) ? inventoryItems : [];
  const inventoryItemId = normalizeId(payload.inventory_item_id);
  const inventoryItem =
    availableItems.find((item) => normalizeId(item?.id) === inventoryItemId) ||
    null;
  const quantityReceived = normalizePositiveQuantity(payload.quantity_received);
  const stockForm = inventoryItem
    ? (inventoryItem.stock_forms || []).find(
        (candidate) =>
          normalizeId(candidate?.id) ===
          normalizeId(payload.inventory_item_stock_form_id),
      ) || buildQueuedInventoryStockForm(entry, inventoryItem)
    : null;

  return {
    id: `${LOCAL_BATCH_ID_PREFIX}${entry.id || entry.entityLocalId || Date.now()}`,
    batch_no: payload.batch_no || entry.entityLocalId || "Pending batch",
    inventory_item_id: inventoryItemId,
    inventory_item_stock_form_id:
      payload.inventory_item_stock_form_id || stockForm?.id || null,
    inventory_item: inventoryItem,
    inventory_item_stock_form: stockForm,
    stock_form_barcode:
      normalizeInventoryBarcode(payload.stock_form_barcode || stockForm?.barcode) ||
      null,
    stock_form_packaging:
      payload.stock_form_packaging || stockForm?.packaging || null,
    stock_form_units_per_packaging:
      payload.stock_form_units_per_packaging ||
      stockForm?.units_per_packaging ||
      null,
    stock_form_unit_of_measure:
      payload.stock_form_unit_of_measure || stockForm?.unit_of_measure || null,
    stock_form_unit_of_measure_value:
      payload.stock_form_unit_of_measure_value ||
      stockForm?.unit_of_measure_value ||
      null,
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

export const buildQueuedInventoryItemOpeningBatch = (
  entry = {},
  inventoryItems = [],
) => {
  const payload = entry.payload || {};
  const inventoryItemId = normalizeId(entry.entityLocalId || entry.id);
  const inventoryItem =
    (Array.isArray(inventoryItems) ? inventoryItems : []).find(
      (item) => normalizeId(item?.id) === inventoryItemId,
    ) || null;

  if (!inventoryItem) {
    return null;
  }

  const packaging = String(payload.packaging || "piece").trim().toLowerCase();
  const packagingCount = normalizePositiveQuantity(payload.packaging_count);
  const unitsPerPackaging =
    normalizePositiveQuantity(payload.quantity) || (packaging === "piece" ? 1 : 0);
  const quantityReceived = packagingCount * unitsPerPackaging;
  const stockForm = (Array.isArray(inventoryItem.stock_forms)
    ? inventoryItem.stock_forms
    : [])[0] || null;

  return {
    id: `${LOCAL_BATCH_ID_PREFIX}opening:${entry.id || inventoryItemId}`,
    batch_no: payload.batch_no || "Pending opening batch",
    inventory_item_id: inventoryItemId,
    inventory_item_stock_form_id: stockForm?.id || null,
    inventory_item: inventoryItem,
    inventory_item_stock_form: stockForm,
    stock_form_barcode:
      normalizeInventoryBarcode(stockForm?.barcode || payload.barcode) || null,
    stock_form_packaging: stockForm?.packaging || packaging,
    stock_form_units_per_packaging:
      stockForm?.units_per_packaging || unitsPerPackaging || null,
    stock_form_unit_of_measure:
      stockForm?.unit_of_measure || payload.unit_of_measure || "pc",
    stock_form_unit_of_measure_value:
      stockForm?.unit_of_measure_value || payload.unit_of_measure_value || 1,
    source_type: "LGU",
    quantity_received: quantityReceived,
    quantity_available: quantityReceived,
    expiration_date: payload.expiration_date || null,
    received_at: entry.clientTimestamp || null,
    created_at: entry.clientTimestamp || null,
    updated_at: entry.clientUpdatedAt || entry.clientTimestamp || null,
    status: "AVAILABLE",
    sync_status: entry.status || LOCAL_SYNC_STATUS.PENDING,
    is_local_only: true,
    client_sync_id: entry.id || null,
  };
};

export const mergeInventoryBatchesWithSyncStatus = ({
  inventoryBatches = [],
  inventoryItems = [],
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
        ["INVENTORY_ITEM_CREATE", "INVENTORY_BATCH_CREATE"].includes(
          entry?.actionKey,
        ) &&
        isOutstandingMayorInventoryQueueEntry(entry),
    )
    .map((entry) =>
      entry.actionKey === "INVENTORY_ITEM_CREATE"
        ? buildQueuedInventoryItemOpeningBatch(entry, inventoryItems)
        : buildQueuedInventoryBatch(entry, inventoryItems),
    )
    .filter(Boolean)
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
  const match = findInventoryItemBarcodeMatch(inventoryItems, barcode);

  return match?.ambiguous || match?.inactive ? null : match;
};
