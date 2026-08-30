import db from "./db.js";
import { getSyncQueueActorContext } from "./syncQueue.js";
import { ROLE_CODES } from "../utils/roleSession.js";
import {
  getMayorInventoryCacheScope,
  getMayorInventoryCacheSnapshot,
  persistMayorInventoryCacheSnapshot,
} from "./mayorInventoryCache.js";
import { MAYOR_INVENTORY_CACHE_VERSION } from "./mayorInventoryOfflineModel.js";
import { fetchInventoryItems } from "../features/inventory-items/inventoryItemService.js";
import {
  fetchInventoryBatches,
  fetchSuppliers,
} from "../features/inventory-batches/inventoryBatchService.js";
import { fetchInventoryTransactions } from "../features/inventory-transactions/inventoryTransactionService.js";

export const MAYOR_INVENTORY_PREPARATION_ID_PREFIX = "MAYOR_INVENTORY|";
export const MAYOR_INVENTORY_PREPARATION_STATUS = Object.freeze({
  NOT_PREPARED: "NOT_PREPARED",
  PREPARING: "PREPARING",
  READY: "READY",
  NOT_READY: "NOT_READY",
  NEEDS_REFRESH: "NEEDS_REFRESH",
});

const jobs = new Map();
const REQUEST_TIMEOUT_MS = 45_000;

const getPreparationId = (scope) =>
  `${MAYOR_INVENTORY_PREPARATION_ID_PREFIX}${scope?.accessMode || ""}|${scope?.userId || ""}|${scope?.roleCode || ""}|${scope?.deviceId || "browser"}`;

const publishPreparationUpdate = (diagnostics) => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("distync-offline-preparation-updated", {
        detail: diagnostics,
      }),
    );
  }
};

const readPreparation = async (ownerContext = getSyncQueueActorContext()) => {
  const scope = getMayorInventoryCacheScope(ownerContext);

  if (!scope || !db.offlinePreparation) {
    return null;
  }

  let preparation = null;

  try {
    preparation = await db.offlinePreparation.get(getPreparationId(scope));
  } catch (_error) {
    return null;
  }

  if (!preparation || preparation.accessMode !== scope.accessMode || preparation.userId !== scope.userId || preparation.roleCode !== ROLE_CODES.MAYOR) {
    return null;
  }

  if (preparation.device_id !== scope.deviceId) {
    return null;
  }

  return preparation;
};

const savePreparation = async (scope, status, details = {}) => {
  const record = {
    id: getPreparationId(scope),
    accessMode: scope.accessMode,
    userId: scope.userId,
    roleCode: scope.roleCode,
    device_id: scope.deviceId || null,
    disaster_event_id: null,
    barangay_id: null,
    cache_version: MAYOR_INVENTORY_CACHE_VERSION,
    status,
    ...details,
    updated_at: new Date().toISOString(),
  };

  await db.offlinePreparation.put(record);
  return record;
};

const withTimeout = (promise, label) => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`${label} timed out`);
      error.code = "MAYOR_INVENTORY_PREPARATION_TIMEOUT";
      reject(error);
    }, REQUEST_TIMEOUT_MS);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

export const getMayorInventoryPreparation = async (
  ownerContext = getSyncQueueActorContext(),
) => readPreparation(ownerContext);

export const prepareMayorInventoryOfflineData = ({ userId } = {}) => {
  const ownerContext = getSyncQueueActorContext();
  const scope = getMayorInventoryCacheScope(ownerContext);

  if (!scope || !userId || ownerContext.userId !== userId) {
    return Promise.resolve({
      status: MAYOR_INVENTORY_PREPARATION_STATUS.NOT_PREPARED,
    });
  }

  const jobKey = getPreparationId(scope);
  if (jobs.has(jobKey)) {
    return jobs.get(jobKey);
  }

  const job = (async () => {
    let previousCompleteCache = false;
    const diagnostics = {
      scope: {
        accessMode: scope.accessMode,
        userId: scope.userId,
        roleCode: scope.roleCode,
        deviceId: scope.deviceId,
      },
      status: MAYOR_INVENTORY_PREPARATION_STATUS.PREPARING,
      startedAt: new Date().toISOString(),
      online: typeof navigator === "undefined" ? true : navigator.onLine !== false,
      previousCompleteCache: false,
      cacheVersion: MAYOR_INVENTORY_CACHE_VERSION,
      datasets: {
        items: { complete: false, count: 0 },
        batches: { complete: false, count: 0 },
        transactions: { complete: false, count: 0 },
        suppliers: { complete: false, count: 0 },
      },
      stage: "FETCHING_FULL_INVENTORY_GRAPH",
    };

    try {
      const previousCache = await getMayorInventoryCacheSnapshot(ownerContext);
      previousCompleteCache = Boolean(previousCache);
      diagnostics.previousCompleteCache = previousCompleteCache;
      publishPreparationUpdate(diagnostics);
      await savePreparation(scope, MAYOR_INVENTORY_PREPARATION_STATUS.PREPARING, {
        previous_complete_cache: previousCompleteCache,
        datasets: diagnostics.datasets,
      });

      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        const offlineStatus = previousCompleteCache
          ? MAYOR_INVENTORY_PREPARATION_STATUS.READY
          : MAYOR_INVENTORY_PREPARATION_STATUS.NOT_READY;
        const saved = await savePreparation(scope, offlineStatus, {
          previous_complete_cache: previousCompleteCache,
          error_code: previousCompleteCache ? null : "OFFLINE_CACHE_MISSING",
          datasets: diagnostics.datasets,
        });
        publishPreparationUpdate({
          ...diagnostics,
          status: offlineStatus,
          error: previousCompleteCache ? null : "Inventory data is not prepared on this device.",
          updatedAt: saved.updated_at,
        });
        return { status: offlineStatus, diagnostics: saved };
      }

      const [items, batches, transactions, suppliers] = await withTimeout(
        Promise.all([
          fetchInventoryItems({ search: "" }),
          fetchInventoryBatches(),
          fetchInventoryTransactions(),
          fetchSuppliers(),
        ]),
        "Mayor inventory preparation",
      );

      const datasets = { items, batches, transactions, suppliers };
      Object.keys(diagnostics.datasets).forEach((dataset) => {
        diagnostics.datasets[dataset] = {
          complete: Array.isArray(datasets[dataset]),
          count: Array.isArray(datasets[dataset]) ? datasets[dataset].length : 0,
        };
      });

      if (Object.values(diagnostics.datasets).some((dataset) => !dataset.complete)) {
        const error = new Error("Mayor inventory preparation returned an incomplete dataset.");
        error.code = "MAYOR_INVENTORY_PREPARATION_INCOMPLETE";
        throw error;
      }

      diagnostics.stage = "PERSISTING_AND_VERIFYING_FULL_INVENTORY_GRAPH";
      publishPreparationUpdate({ ...diagnostics });
      await persistMayorInventoryCacheSnapshot({
        items,
        batches,
        transactions,
        suppliers,
        ownerContext,
      });

      const readBack = await getMayorInventoryCacheSnapshot(ownerContext);
      if (!readBack) {
        const error = new Error("Mayor inventory preparation read-back verification failed.");
        error.code = "MAYOR_INVENTORY_PREPARATION_READBACK_FAILED";
        throw error;
      }

      const saved = await savePreparation(scope, MAYOR_INVENTORY_PREPARATION_STATUS.READY, {
        previous_complete_cache: previousCompleteCache,
        datasets: diagnostics.datasets,
        items_count: items.length,
        batches_count: batches.length,
        transactions_count: transactions.length,
        suppliers_count: suppliers.length,
        cached_at: readBack.cached_at,
      });
      publishPreparationUpdate({
        ...diagnostics,
        status: MAYOR_INVENTORY_PREPARATION_STATUS.READY,
        completedAt: new Date().toISOString(),
        updatedAt: saved.updated_at,
      });
      return { status: MAYOR_INVENTORY_PREPARATION_STATUS.READY, diagnostics: saved };
    } catch (error) {
      const terminalStatus = previousCompleteCache
        ? MAYOR_INVENTORY_PREPARATION_STATUS.NEEDS_REFRESH
        : MAYOR_INVENTORY_PREPARATION_STATUS.NOT_READY;
      const saved = await savePreparation(scope, terminalStatus, {
        previous_complete_cache: previousCompleteCache,
        error_code: error?.code || "MAYOR_INVENTORY_PREPARATION_FAILED",
        datasets: diagnostics.datasets,
      });
      publishPreparationUpdate({
        ...diagnostics,
        status: terminalStatus,
        completedAt: new Date().toISOString(),
        error: "Inventory information could not be refreshed for offline use.",
        updatedAt: saved.updated_at,
      });
      throw error;
    } finally {
      jobs.delete(jobKey);
    }
  })();

  jobs.set(jobKey, job);
  return job;
};
