import { LOCAL_SYNC_STATUS } from "./db.js";
import {
  getSafeSyncErrorMessage,
  SYNC_PRESENTATION_MESSAGES,
} from "./syncStatus.js";
import {
  clearSyncedEntries,
  getFailedSyncEntries,
  getRetryableSyncEntries,
  isLegacyInventoryTransactionEntry,
  queueSyncEntry,
  updateSyncEntryStatus,
} from "./syncQueue.js";
import { reconcileOfflineStubCacheForSyncResult } from "../features/stubs/stubCache.js";

const API_BASE_URL =
  import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000";

const NETWORK_ERROR_MESSAGES = [
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
const SYNC_ENDPOINT = `${API_BASE_URL}/api/v1/sync/process`;
const syncListeners = new Set();
let isInitialized = false;
let isSyncInFlight = false;

const getIsoNow = () => new Date().toISOString();

const generateLocalId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const isNetworkFailure = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return NETWORK_ERROR_MESSAGES.some((fragment) => message.includes(fragment));
};

const validateRequiredFields = (payload, requiredFields = []) => {
  for (const fieldName of requiredFields) {
    const value = payload?.[fieldName];

    if (value === undefined || value === null || value === "") {
      throw new Error(`${fieldName} is required before saving offline.`);
    }

    if (Array.isArray(value) && value.length === 0) {
      throw new Error(`${fieldName} is required before saving offline.`);
    }
  }
};

const notifySyncListeners = () => {
  syncListeners.forEach((listener) => {
    try {
      listener();
    } catch (_error) {
      // Listener failures should not block sync state changes.
    }
  });
};

const emitSyncFeedbackEvent = (detail) => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("distync-sync-feedback", {
        detail,
      }),
    );
  }
};

export const subscribeToSyncUpdates = (listener) => {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
};

export const flushPendingSyncEntries = async () => {
  const queuedEntries = await getRetryableSyncEntries();
  return flushSelectedSyncEntries(queuedEntries);
};

export const retryFailedSyncEntries = async (entryIds = []) => {
  const failedEntries = await getFailedSyncEntries(entryIds);
  return flushSelectedSyncEntries(failedEntries);
};

const flushSelectedSyncEntries = async (queuedEntries = []) => {
  const requestedIds = queuedEntries.map((entry) => entry.id).filter(Boolean);

  if (isSyncInFlight) {
    return {
      outcome: "IN_FLIGHT",
      attemptedIds: requestedIds,
      syncedIds: [],
      failedIds: [],
      conflictIds: [],
      pendingIds: [],
    };
  }

  if (typeof navigator === "undefined" || !navigator.onLine) {
    return {
      outcome: "OFFLINE",
      attemptedIds: requestedIds,
      syncedIds: [],
      failedIds: [],
      conflictIds: [],
      pendingIds: [],
    };
  }

  if (queuedEntries.length === 0) {
    return {
      outcome: "NO_ENTRIES",
      attemptedIds: [],
      syncedIds: [],
      failedIds: [],
      conflictIds: [],
      pendingIds: [],
    };
  }

  const legacyInventoryEntries = queuedEntries.filter(
    isLegacyInventoryTransactionEntry,
  );
  const entriesToSync = queuedEntries.filter(
    (entry) => !isLegacyInventoryTransactionEntry(entry),
  );

  for (const entry of legacyInventoryEntries) {
    await updateSyncEntryStatus(entry.id, {
      status: LOCAL_SYNC_STATUS.FAILED,
      lastError:
        "Legacy pre-ITR inventory transaction. Keep this entry for reconciliation, assign a real official ITR to the written transaction, then re-enter it under the new process.",
      serverMessage:
        "Legacy pre-ITR inventory transaction requires reconciliation and re-entry with an official ITR.",
    });
  }

  if (entriesToSync.length === 0) {
    emitSyncFeedbackEvent({
      type: "failed",
      message: SYNC_PRESENTATION_MESSAGES.UNSUPPORTED,
    });
    return {
      outcome: "NON_RETRYABLE",
      attemptedIds: requestedIds,
      syncedIds: [],
      failedIds: legacyInventoryEntries.map((entry) => entry.id),
      conflictIds: [],
      pendingIds: [],
    };
  }

  isSyncInFlight = true;
  notifySyncListeners();

  const attemptedIds = entriesToSync.map((entry) => entry.id);
  const syncedIds = [];
  const failedIds = legacyInventoryEntries.map((entry) => entry.id);
  const conflictIds = [];
  const pendingIds = [];

  try {
    const response = await fetch(SYNC_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        entries: entriesToSync.map((entry) => ({
          client_sync_id: entry.id,
          action_key: entry.actionKey,
          entity_type: entry.entityType,
          entity_local_id: entry.entityLocalId,
          entity_server_id: entry.entityServerId,
          device_id: entry.deviceId || null,
          client_timestamp: entry.clientTimestamp,
          client_updated_at: entry.clientUpdatedAt || entry.clientTimestamp,
          payload: entry.payload,
        })),
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const error = new Error(
        payload?.message || "Failed to process pending sync entries.",
      );
      error.statusCode = response.status;
      error.code = payload?.code || payload?.error_code || null;
      throw error;
    }

    const syncResults = Array.isArray(payload?.data) ? payload.data : [];

    for (const entry of entriesToSync) {
      const result = syncResults.find(
        (candidate) => candidate.client_sync_id === entry.id,
      );
      const resultStatus = result?.sync_status || LOCAL_SYNC_STATUS.FAILED;
      const isTerminalResult =
        resultStatus === LOCAL_SYNC_STATUS.SYNCED ||
        resultStatus === LOCAL_SYNC_STATUS.CONFLICT;

      if (!result) {
        failedIds.push(entry.id);
        await updateSyncEntryStatus(entry.id, {
          status: LOCAL_SYNC_STATUS.FAILED,
          lastError:
            "DISTYNC did not return a final result for this action. Try again.",
          serverMessage:
            "DISTYNC did not return a final result for this action. Try again.",
        });
        continue;
      }

      if (resultStatus === LOCAL_SYNC_STATUS.SYNCED) {
        syncedIds.push(entry.id);
      } else if (resultStatus === LOCAL_SYNC_STATUS.CONFLICT) {
        conflictIds.push(entry.id);
      } else if (resultStatus === LOCAL_SYNC_STATUS.PENDING) {
        pendingIds.push(entry.id);
      } else {
        failedIds.push(entry.id);
      }

      await updateSyncEntryStatus(entry.id, {
        status: resultStatus,
        syncTransactionId: result.sync_transaction_id || null,
        entityServerId:
          result.data?.id ||
          result.data?.household?.id ||
          result.data?.distribution_transaction_id ||
          result.data?.transaction_id ||
          null,
        syncedAt: isTerminalResult ? getIsoNow() : null,
        lastError:
          resultStatus === LOCAL_SYNC_STATUS.FAILED
            ? result.message || SYNC_PRESENTATION_MESSAGES.SERVER
            : null,
        serverMessage: result.message || null,
        lastErrorCode: result.error_code || null,
        lastErrorStatusCode: result.status_code || null,
        conflict: result.conflict || null,
      });

      await reconcileOfflineStubCacheForSyncResult(entry, result);
    }

    await clearSyncedEntries();

    const failedCount = failedIds.length;
    const conflictCount = conflictIds.length;
    const pendingCount = pendingIds.length;
    const outcome =
      failedCount > 0 && (syncedIds.length > 0 || conflictCount > 0)
        ? "PARTIAL"
        : failedCount > 0
          ? "FAILED"
          : conflictCount > 0
            ? "CONFLICT"
            : pendingCount > 0
              ? "PENDING"
              : "SUCCESS";

    emitSyncFeedbackEvent({
      type:
        failedCount > 0
          ? "failed"
          : conflictCount > 0
            ? "conflict"
            : "success",
      message:
        failedCount > 0
          ? "Some offline changes could not be synchronized."
          : conflictCount > 0
            ? SYNC_PRESENTATION_MESSAGES.CONFLICT
            : "Offline changes synchronized successfully.",
    });

    return {
      outcome,
      attemptedIds,
      syncedIds,
      failedIds,
      conflictIds,
      pendingIds,
    };
  } catch (error) {
    for (const entry of entriesToSync) {
      if (syncedIds.includes(entry.id) || conflictIds.includes(entry.id)) {
        continue;
      }

      if (!failedIds.includes(entry.id)) {
        failedIds.push(entry.id);
      }

      await updateSyncEntryStatus(entry.id, {
        status: LOCAL_SYNC_STATUS.FAILED,
        lastError: error.message || "Sync failed.",
        serverMessage: error.message || "Sync failed.",
        lastErrorCode: error.code || null,
        lastErrorStatusCode: error.statusCode || null,
      });
    }

    emitSyncFeedbackEvent({
      type: "failed",
      message: getSafeSyncErrorMessage(
        error,
        SYNC_PRESENTATION_MESSAGES.SERVER,
      ),
    });

    return {
      outcome: isNetworkFailure(error) ? "NETWORK_FAILURE" : "FAILED",
      attemptedIds,
      syncedIds,
      failedIds,
      conflictIds,
      pendingIds,
    };
  } finally {
    isSyncInFlight = false;
    notifySyncListeners();
  }
};

export const initializeSyncService = () => {
  if (isInitialized || typeof window === "undefined") {
    return;
  }

  isInitialized = true;

  window.addEventListener("online", () => {
    void flushPendingSyncEntries();
  });

  window.setInterval(() => {
    void flushPendingSyncEntries();
  }, 30000);

  if (navigator.onLine) {
    void flushPendingSyncEntries();
  }
};

export const performSyncableMutation = async ({
  moduleName,
  actionKey,
  entityType,
  entityServerId = null,
  entityLocalId = null,
  payload,
  requiredFields = [],
  request,
  allowOffline = true,
  buildQueuedResponse,
}) => {
  validateRequiredFields(payload, requiredFields);
  // Delete/deactivate operations require online connection to avoid unsafe
  // rollback conflicts. Only safe create/update actions should use this queue.

  const effectiveEntityLocalId = entityLocalId || generateLocalId();
  const clientSyncId = generateLocalId();
  const clientTimestamp = getIsoNow();
  const clientUpdatedAt = payload?.updated_at || clientTimestamp;
  const queueGroupKey = `${actionKey}:${entityServerId || effectiveEntityLocalId}`;

  if (typeof navigator !== "undefined" && !navigator.onLine && allowOffline) {
    await queueSyncEntry({
      id: clientSyncId,
      queueGroupKey,
      moduleName,
      actionKey,
      entityType,
      entityLocalId: effectiveEntityLocalId,
      entityServerId,
      clientTimestamp,
      clientUpdatedAt,
      payload,
    });

    emitSyncFeedbackEvent({
      type: "pending",
      message: "Offline mode active. Your change was queued for sync.",
    });

    return buildQueuedResponse({
      clientSyncId,
      entityLocalId: effectiveEntityLocalId,
      clientTimestamp,
    });
  }

  try {
    return await request();
  } catch (error) {
    if (!allowOffline || !isNetworkFailure(error)) {
      throw error;
    }

    await queueSyncEntry({
      id: clientSyncId,
      queueGroupKey,
      moduleName,
      actionKey,
      entityType,
      entityLocalId: effectiveEntityLocalId,
      entityServerId,
      clientTimestamp,
      clientUpdatedAt,
      payload,
    });

    emitSyncFeedbackEvent({
      type: "pending",
      message: "Connection lost. Your change was saved offline and will sync later.",
    });

    return buildQueuedResponse({
      clientSyncId,
      entityLocalId: effectiveEntityLocalId,
      clientTimestamp,
    });
  }
};

export const performOnlineOnlyMutation = async ({
  payload,
  requiredFields = [],
  request,
  offlineMessage,
}) => {
  validateRequiredFields(payload, requiredFields);

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const message =
      offlineMessage || "An internet connection is required to complete this action.";

    emitSyncFeedbackEvent({
      type: "failed",
      message,
    });

    throw new Error(message);
  }

  return request();
};

export const buildOfflineQueuedResponse = ({
  message,
  data = null,
  clientSyncId,
  entityLocalId,
  clientTimestamp,
}) => {
  return {
    message,
    data,
    queued_offline: true,
    sync_status: LOCAL_SYNC_STATUS.PENDING,
    sync_status_label: "Pending Sync",
    client_sync_id: clientSyncId,
    entity_local_id: entityLocalId,
    client_timestamp: clientTimestamp,
  };
};
