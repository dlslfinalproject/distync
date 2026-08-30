import db from "./db.js";
import { getSyncQueueActorContext } from "./syncQueue.js";
import { ROLE_CODES } from "../utils/roleSession.js";
import { MAYOR_INVENTORY_CACHE_VERSION } from "./mayorInventoryOfflineModel.js";

export const MAYOR_INVENTORY_CACHE_DATASETS = Object.freeze([
  "items",
  "batches",
  "transactions",
  "suppliers",
]);

const trim = (value) => String(value || "").trim();
const getIsoNow = () => new Date().toISOString();
const NETWORK_FAILURE_PATTERNS = [
  "failed to fetch",
  "fetch failed",
  "networkerror",
  "network error",
  "load failed",
  "econnrefused",
  "enotfound",
  "timeout",
  "timed out",
];

export const canUseMayorInventoryCacheAfterError = (error) => {
  const statusCode = Number(
    error?.statusCode || error?.status || error?.response?.status || 0,
  );

  if ([408, 425, 429].includes(statusCode)) {
    return true;
  }

  if (statusCode >= 400 && statusCode < 500) {
    return false;
  }

  if (statusCode >= 500) {
    return true;
  }

  const message = String(error?.message || "").toLowerCase();
  return NETWORK_FAILURE_PATTERNS.some((pattern) => message.includes(pattern));
};

export const getMayorInventoryCacheScope = (
  ownerContext = getSyncQueueActorContext(),
) => {
  const accessMode = trim(ownerContext?.accessMode);
  const userId = trim(ownerContext?.userId);
  const roleCode = trim(ownerContext?.roleCode);
  const deviceId = trim(ownerContext?.deviceId);

  if (!accessMode || !userId || roleCode !== ROLE_CODES.MAYOR) {
    return null;
  }

  return {
    accessMode,
    userId,
    roleCode,
    deviceId: deviceId || null,
  };
};

export const buildMayorInventoryCacheId = (scope) =>
  [scope?.accessMode, scope?.userId, scope?.roleCode, scope?.deviceId || "browser"]
    .map(trim)
    .join("|");

export const isMayorInventoryCacheVisible = (
  cacheRow,
  ownerContext = getSyncQueueActorContext(),
) => {
  const scope = getMayorInventoryCacheScope(ownerContext);

  if (!cacheRow || !scope) {
    return false;
  }

  if (
    cacheRow.accessMode !== scope.accessMode ||
    cacheRow.userId !== scope.userId ||
    cacheRow.roleCode !== scope.roleCode
  ) {
    return false;
  }

  if (cacheRow.device_id !== scope.deviceId) {
    return false;
  }

  return true;
};

const isRecordArray = (value) =>
  Array.isArray(value) && value.every((row) => row && typeof row === "object");

export const isCompleteMayorInventoryCache = (cacheRow) =>
  Boolean(
    cacheRow?.status === "READY" &&
      cacheRow?.cache_version === MAYOR_INVENTORY_CACHE_VERSION &&
      MAYOR_INVENTORY_CACHE_DATASETS.every((dataset) =>
        isRecordArray(cacheRow?.[dataset]),
      ) &&
      cacheRow?.coverage?.complete === true,
  );

const normalizeRows = (rows) =>
  (Array.isArray(rows) ? rows : []).filter(
    (row) => row && typeof row === "object" && !row.is_local_only,
  );

export const buildMayorInventoryCacheRecord = ({
  scope,
  items,
  batches,
  transactions,
  suppliers,
  cachedAt = getIsoNow(),
}) => {
  const normalizedRows = {
    items: normalizeRows(items),
    batches: normalizeRows(batches),
    transactions: normalizeRows(transactions),
    suppliers: normalizeRows(suppliers),
  };

  return {
    id: buildMayorInventoryCacheId(scope),
    accessMode: scope.accessMode,
    userId: scope.userId,
    roleCode: scope.roleCode,
    device_id: scope.deviceId || null,
    cache_version: MAYOR_INVENTORY_CACHE_VERSION,
    status: "READY",
    cached_at: cachedAt,
    coverage: {
      complete: true,
      source: "full-collection",
      datasets: Object.fromEntries(
        MAYOR_INVENTORY_CACHE_DATASETS.map((dataset) => [dataset, {
          complete: true,
          count: normalizedRows[dataset].length,
        }]),
      ),
    },
    ...normalizedRows,
  };
};

const publishCacheUpdate = (detail) => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("distync-mayor-inventory-cache-updated", { detail }),
    );
  }
};

export const getMayorInventoryCacheSnapshot = async (
  ownerContext = getSyncQueueActorContext(),
) => {
  const scope = getMayorInventoryCacheScope(ownerContext);

  if (!scope || !db.offlineInventoryCache) {
    return null;
  }

  let cacheRow = null;

  try {
    cacheRow = await db.offlineInventoryCache.get(buildMayorInventoryCacheId(scope));
  } catch (_error) {
    // Treat an unavailable local read as not-ready. The caller can keep the
    // operation online and the preparation workflow can report the problem.
    return null;
  }

  if (!isMayorInventoryCacheVisible(cacheRow, ownerContext)) {
    return null;
  }

  return isCompleteMayorInventoryCache(cacheRow) ? cacheRow : null;
};

export const persistMayorInventoryCacheSnapshot = async ({
  items,
  batches,
  transactions,
  suppliers,
  ownerContext = getSyncQueueActorContext(),
}) => {
  const scope = getMayorInventoryCacheScope(ownerContext);

  if (!scope) {
    throw new Error("Mayor inventory cache requires an authenticated Mayor context.");
  }

  const datasetRows = { items, batches, transactions, suppliers };

  for (const dataset of MAYOR_INVENTORY_CACHE_DATASETS) {
    if (!isRecordArray(datasetRows[dataset])) {
      throw new Error(`Mayor inventory cache dataset ${dataset} is incomplete.`);
    }
  }

  const cacheRow = buildMayorInventoryCacheRecord({
    scope,
    items,
    batches,
    transactions,
    suppliers,
  });

  try {
    await db.transaction("rw", db.offlineInventoryCache, async () => {
      await db.offlineInventoryCache.put(cacheRow);
      const readBack = await db.offlineInventoryCache.get(cacheRow.id);

      if (
        !isCompleteMayorInventoryCache(readBack) ||
        MAYOR_INVENTORY_CACHE_DATASETS.some(
          (dataset) => readBack[dataset].length !== cacheRow[dataset].length,
        )
      ) {
        const error = new Error("Mayor inventory cache read-back verification failed.");
        error.code = "MAYOR_INVENTORY_CACHE_READBACK_FAILED";
        throw error;
      }
    });
  } catch (error) {
    const storageError = new Error(
      "The inventory information could not be saved on this device for offline use.",
    );
    storageError.code = error.code || "MAYOR_INVENTORY_CACHE_STORAGE_FAILURE";
    storageError.cause = error;
    throw storageError;
  }

  publishCacheUpdate({
    status: "READY",
    cachedAt: cacheRow.cached_at,
    counts: Object.fromEntries(
      MAYOR_INVENTORY_CACHE_DATASETS.map((dataset) => [dataset, cacheRow[dataset].length]),
    ),
  });

  return cacheRow;
};
