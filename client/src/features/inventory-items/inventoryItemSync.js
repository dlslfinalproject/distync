import { normalizeInventoryBarcode } from "./inventoryBarcode.js";
import { buildSyncDescriptor, findSyncEntry } from "../../offline/syncStatus.js";

const MAYOR_INVENTORY_MODULE = "mayor-inventory";
const OUTSTANDING_SYNC_STATUSES = new Set([
  "PENDING",
  "FAILED",
  "CONFLICT",
]);

const normalizeId = (value) => String(value || "").trim();

const getPositiveNumber = (value) => {
  const normalizedValue = Number(value);
  return Number.isFinite(normalizedValue) && normalizedValue > 0
    ? normalizedValue
    : 0;
};

const isOutstandingBatchCreateEntry = (entry = {}) =>
  entry?.moduleName === MAYOR_INVENTORY_MODULE &&
  entry?.actionKey === "INVENTORY_BATCH_CREATE" &&
  OUTSTANDING_SYNC_STATUSES.has(entry?.status);

const isInventoryBatchEntryForItem = (entry = {}, item = null) =>
  isOutstandingBatchCreateEntry(entry) &&
  normalizeId(entry.payload?.inventory_item_id) === normalizeId(item?.id);

const getItemStockForms = (item) =>
  Array.isArray(item?.stock_forms) ? item.stock_forms : [];

export const buildQueuedInventoryStockForm = (entry = {}, item = null) => {
  const payload = entry.payload || {};
  const inventoryItemId = normalizeId(payload.inventory_item_id || item?.id);
  const stockFormId = normalizeId(payload.inventory_item_stock_form_id);
  const existingStockForm = getItemStockForms(item).find(
    (stockForm) => stockFormId && normalizeId(stockForm?.id) === stockFormId,
  );

  if (existingStockForm) {
    return existingStockForm;
  }

  const packaging = String(
    payload.stock_form_packaging || payload.packaging || "",
  ).trim();
  const barcode = normalizeInventoryBarcode(
    payload.stock_form_barcode || payload.barcode,
  );

  if (!packaging && !barcode) {
    return null;
  }

  const unitsPerPackaging =
    getPositiveNumber(
      payload.stock_form_units_per_packaging ||
        payload.units_per_packaging ||
        payload.quantity,
    ) || (packaging.toLowerCase() === "piece" ? 1 : 0);

  return {
    id: stockFormId || `local-stock-form:${entry.id || entry.entityLocalId}`,
    inventory_item_id: inventoryItemId,
    barcode: barcode || null,
    packaging: packaging || "piece",
    units_per_packaging: unitsPerPackaging || 1,
    unit_of_measure:
      payload.stock_form_unit_of_measure || payload.unit_of_measure || "pc",
    unit_of_measure_value:
      payload.stock_form_unit_of_measure_value ||
      payload.unit_of_measure_value ||
      1,
    is_active: true,
    is_local_only: true,
    client_sync_id: entry.id || null,
  };
};

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
    barcode: normalizeInventoryBarcode(payload.barcode) || null,
    reorder_level: payload.reorder_level ?? null,
    expiration_date: payload.expiration_date || null,
    is_perishable: Boolean(payload.is_perishable),
    stock_forms: [
      {
        id: `local-stock-form:${entry.id || localItemId}`,
        inventory_item_id: localItemId,
        barcode: normalizeInventoryBarcode(payload.barcode) || null,
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
  inventoryItems = [],
  syncQueueEntries = [],
  {
    serverConflictItemIds = new Set(),
    resolvedConflictTransactionIds = new Set(),
  } = {},
) => {
  const safeSyncQueueEntries = Array.isArray(syncQueueEntries)
    ? syncQueueEntries
    : [];
  const normalizedServerConflictItemIds = new Set(
    (serverConflictItemIds instanceof Set
      ? [...serverConflictItemIds]
      : Array.isArray(serverConflictItemIds)
        ? serverConflictItemIds
        : []
    )
      .map(normalizeId)
      .filter(Boolean),
  );
  const normalizedResolvedConflictTransactionIds = new Set(
    (resolvedConflictTransactionIds instanceof Set
      ? [...resolvedConflictTransactionIds]
      : Array.isArray(resolvedConflictTransactionIds)
        ? resolvedConflictTransactionIds
        : []
    )
      .map(normalizeId)
      .filter(Boolean),
  );
  const activeSyncQueueEntries = safeSyncQueueEntries.filter(
    (entry) =>
      !normalizedResolvedConflictTransactionIds.has(
        normalizeId(entry.syncTransactionId || entry.sync_transaction_id),
      ),
  );

  const syncedItems = (Array.isArray(inventoryItems) ? inventoryItems : []).map((item) => {
    const matchingEntry = findSyncEntry(activeSyncQueueEntries, (entry) => {
      if (entry.moduleName !== MAYOR_INVENTORY_MODULE) {
        return false;
      }

      const isItemEntry =
        entry.entityType === "INVENTORY_ITEM" &&
        (entry.entityServerId === item.id || entry.entityLocalId === item.id);

      return isItemEntry || isInventoryBatchEntryForItem(entry, item);
    });

    return {
      ...item,
      sync_status: normalizedServerConflictItemIds.has(normalizeId(item.id))
        ? "CONFLICT"
        : buildSyncDescriptor(matchingEntry).status,
      is_local_only: false,
    };
  });

  const optimisticItems = activeSyncQueueEntries
    .filter((entry) => {
      return (
        entry.moduleName === MAYOR_INVENTORY_MODULE &&
        entry.actionKey === "INVENTORY_ITEM_CREATE" &&
        !syncedItems.some(
          (item) =>
            item.id === entry.entityServerId || item.id === entry.entityLocalId,
        )
      );
    })
    .map(buildQueuedInventoryItem);

  const mergedItems = [...optimisticItems, ...syncedItems];

  return mergedItems.map((item) => {
    const pendingStockForms = activeSyncQueueEntries
      .filter((entry) => isInventoryBatchEntryForItem(entry, item))
      .map((entry) => buildQueuedInventoryStockForm(entry, item))
      .filter(Boolean);

    if (pendingStockForms.length === 0) {
      return item;
    }

    const stockForms = getItemStockForms(item);
    const stockFormIds = new Set(stockForms.map((stockForm) => normalizeId(stockForm?.id)));
    const nextStockForms = [...stockForms];

    pendingStockForms.forEach((stockForm) => {
      const stockFormId = normalizeId(stockForm.id);

      if (stockFormIds.has(stockFormId)) {
        return;
      }

      stockFormIds.add(stockFormId);
      nextStockForms.push(stockForm);
    });

    return {
      ...item,
      stock_forms: nextStockForms,
    };
  });
};
