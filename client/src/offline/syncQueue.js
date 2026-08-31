import db, { LOCAL_SYNC_STATUS } from "./db.js";
import { getAccessMode } from "../utils/accessMode.js";
import {
  getAuthenticatedUser,
  getCurrentRole,
} from "../utils/roleSession.js";
import { isSyncIdempotencyMismatch } from "./syncStatus.js";
import {
  SYNC_ERROR_CODES,
  SYNC_PRESENTATION_MESSAGES,
} from "./syncStatus.js";
import { getOfflineDeviceId } from "./deviceIdentity.js";

const unsupportedOfflineActionKeys = new Set([
  "DONATION_NEED_CREATE",
  "DONATION_NEED_UPDATE",
  "DONATION_CREATE",
  "DONATION_UPDATE",
  "DONATION_ITEM_CREATE",
  "DONATION_ITEM_UPDATE",
  "DISASTER_EVENT_CREATE",
  "DISASTER_EVENT_UPDATE",
  "DISASTER_EVENT_EXTEND",
  "DISASTER_EVENT_END",
]);
const legacySupplierActionKeys = new Set([
  "SUPPLIER_CREATE",
  "SUPPLIER_UPDATE",
]);

const getIsoNow = () => new Date().toISOString();
const SYNC_PROCESSING_LEASE_MS = 60 * 1000;

const normalizeScopeValue = (value) => String(value || "").trim();

const getQueueBarangayId = ({ payload = {}, barangayId = null, user = null } = {}) =>
  normalizeScopeValue(
    barangayId ||
      payload?.barangay_id ||
      payload?.override_barangay_id ||
      payload?.barangay?.id ||
      user?.default_barangay_id ||
      "",
  ) || null;

export const isUnsupportedOfflineActionKey = (actionKey) =>
  unsupportedOfflineActionKeys.has(String(actionKey || "").trim().toUpperCase());

const isLegacySupplierActionKey = (actionKey) =>
  legacySupplierActionKeys.has(String(actionKey || "").trim().toUpperCase());

export const isLegacySupplierSyncEntry = (entry = {}) =>
  String(entry?.entityType || "").trim().toUpperCase() === "SUPPLIER" &&
  isLegacySupplierActionKey(entry?.actionKey);

export const isMalformedSyncEntry = (entry = {}) => {
  if (!entry || typeof entry !== "object") {
    return true;
  }

  const hasQueueIdentity =
    entry.id || entry.actionKey || entry.entityType || entry.clientTimestamp || entry.payload;

  if (!hasQueueIdentity) {
    return false;
  }

  return Boolean(
    !normalizeScopeValue(entry.id) ||
      !normalizeScopeValue(entry.actionKey) ||
      !normalizeScopeValue(entry.entityType) ||
      !normalizeScopeValue(entry.clientTimestamp) ||
      !entry.payload ||
      typeof entry.payload !== "object" ||
      Array.isArray(entry.payload),
  );
};

export const isNonRetryableSyncEntry = (entry = {}) =>
  isUnsupportedOfflineActionKey(entry.actionKey) ||
  isMalformedSyncEntry(entry) ||
  isSyncIdempotencyMismatch(entry) ||
  // Supplier CRUD is retained only for stale queue compatibility. A server
  // result of FAILED is final for that legacy action so reconnect processing
  // cannot retry it forever; transport failures remain PENDING and retryable.
  (isLegacySupplierSyncEntry(entry) && entry.status === LOCAL_SYNC_STATUS.FAILED);

export const getUnsupportedOfflineActionMessage = (actionKey, entry = {}) => {
  if (isUnsupportedOfflineActionKey(actionKey)) {
    return "This operation is no longer supported for offline synchronization. Please complete the action while online.";
  }

  if (isLegacySupplierActionKey(actionKey)) {
    const status = String(entry?.status || entry?.sync_status || "")
      .trim()
      .toUpperCase();

    if (status && status !== LOCAL_SYNC_STATUS.FAILED) {
      return "";
    }

    return "This legacy supplier synchronization result is retained for review and will not be retried automatically.";
  }

  return "";
};

export const getSyncQueueActorContext = () => {
  const authenticatedUser = getAuthenticatedUser();

  return {
    accessMode: getAccessMode(),
    userId: authenticatedUser?.id || null,
    roleCode: getCurrentRole() || null,
    barangayId: authenticatedUser?.default_barangay_id || null,
    deviceId: getOfflineDeviceId(),
  };
};

export const buildStoredSyncEntry = (
  entry,
  actorContext = getSyncQueueActorContext(),
) => {
  return {
    ...entry,
    accessMode: actorContext.accessMode,
    userId: actorContext.userId,
    roleCode: actorContext.roleCode,
    deviceId: entry?.deviceId || actorContext.deviceId || null,
    barangayId: getQueueBarangayId({
      payload: entry?.payload,
      barangayId: entry?.barangayId || actorContext.barangayId,
      user: actorContext.user || null,
    }),
  };
};

export const isSyncEntryVisibleForContext = (
  entry,
  actorContext = getSyncQueueActorContext(),
) => {
  if (!entry || entry.accessMode !== actorContext.accessMode) {
    return false;
  }

  if (!entry.userId || !actorContext.userId || entry.userId !== actorContext.userId) {
    return false;
  }

  if (!entry.roleCode || !actorContext.roleCode || entry.roleCode !== actorContext.roleCode) {
    return false;
  }

  // IndexedDB is device-local, but retain the device identity on every new
  // row so copied profiles and future shared-storage adapters cannot surface
  // another device's work. Legacy rows without a device id remain visible.
  if (
    entry.deviceId &&
    actorContext.deviceId &&
    entry.deviceId !== actorContext.deviceId
  ) {
    return false;
  }

  if (
    entry.barangayId &&
    actorContext.roleCode === "BARANGAY" &&
    (!actorContext.barangayId || entry.barangayId !== actorContext.barangayId)
  ) {
    return false;
  }

  if (entry.resolutionStatus === "RESOLVED_AUTOMATICALLY") {
    return false;
  }

  return true;
};

export const emitSyncQueueUpdated = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("distync-sync-queue-updated"));
  }
};

export const getSyncQueueSnapshot = async () => {
  return db.syncQueue
    .orderBy("clientTimestamp")
    .filter((entry) => isSyncEntryVisibleForContext(entry))
    .reverse()
    .toArray();
};

export const getVisibleSyncQueueEntries = async () => {
  return db.syncQueue
    .orderBy("clientTimestamp")
    .filter((entry) => isSyncEntryVisibleForContext(entry))
    .toArray();
};

export const getVisibleSyncQueueEntriesByUpdatedAt = async () => {
  return db.syncQueue
    .orderBy("updatedAt")
    .filter((entry) => isSyncEntryVisibleForContext(entry))
    .reverse()
    .toArray();
};

export const getRetryableSyncEntries = async () => {
  return db.syncQueue
    .orderBy("clientTimestamp")
    .filter(
      (entry) =>
        isSyncEntryVisibleForContext(entry) &&
        !isNonRetryableSyncEntry(entry) &&
        (entry.status === LOCAL_SYNC_STATUS.PENDING ||
          entry.status === LOCAL_SYNC_STATUS.FAILED),
    )
    .toArray();
};

export const getFailedSyncEntries = async (entryIds = []) => {
  const requestedIds = Array.isArray(entryIds) ? entryIds.filter(Boolean) : [];

  return db.syncQueue
    .orderBy("clientTimestamp")
    .filter(
      (entry) =>
        isSyncEntryVisibleForContext(entry) &&
        !isNonRetryableSyncEntry(entry) &&
        entry.status === LOCAL_SYNC_STATUS.FAILED &&
        (requestedIds.length === 0 || requestedIds.includes(entry.id)),
    )
    .toArray();
};

export const queueSyncEntry = async (entry) => {
  const now = getIsoNow();
  const actorContext = getSyncQueueActorContext();
  const storedEntry = buildStoredSyncEntry(entry, actorContext);

  // Each locally created mutation already has its own client_sync_id. Never
  // replace an earlier queue row under the same ID: that ID may already be
  // known by the server even when the browser still shows the row as failed.
  // queueGroupKey remains stored for grouping/filtering, but is not an
  // idempotency boundary.

  try {
    await db.syncQueue.put({
      ...storedEntry,
      status: LOCAL_SYNC_STATUS.PENDING,
      lastError: null,
      lastErrorCode: null,
      syncedAt: null,
      processingOwner: null,
      processingUntil: null,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    const storageError = new Error(SYNC_PRESENTATION_MESSAGES.LOCAL_STORAGE);
    storageError.code = SYNC_ERROR_CODES.LOCAL_STORAGE_FAILURE;
    storageError.cause = error;
    throw storageError;
  }

  emitSyncQueueUpdated();
  return entry.id;
};

export const updateSyncEntryStatus = async (entryId, updates) => {
  try {
    await db.syncQueue.update(entryId, {
      ...updates,
      updatedAt: getIsoNow(),
    });
  } catch (error) {
    const storageError = new Error(SYNC_PRESENTATION_MESSAGES.LOCAL_STORAGE);
    storageError.code = SYNC_ERROR_CODES.LOCAL_STORAGE_FAILURE;
    storageError.cause = error;
    throw storageError;
  }

  emitSyncQueueUpdated();
};

export const claimSyncEntries = async (
  entries = [],
  processingOwner,
  now = Date.now(),
) => {
  const requestedIds = entries.map((entry) => entry?.id).filter(Boolean);
  const claimedEntries = [];

  if (!processingOwner || requestedIds.length === 0) {
    return claimedEntries;
  }

  try {
    await db.transaction("rw", db.syncQueue, async () => {
      for (const entryId of requestedIds) {
        const currentEntry = await db.syncQueue.get(entryId);

        if (
          !currentEntry ||
          !isSyncEntryVisibleForContext(currentEntry) ||
          isNonRetryableSyncEntry(currentEntry) ||
          ![LOCAL_SYNC_STATUS.PENDING, LOCAL_SYNC_STATUS.FAILED].includes(
            currentEntry.status,
          )
        ) {
          continue;
        }

        const processingUntil = new Date(currentEntry.processingUntil || 0).getTime();
        const hasActiveClaim =
          currentEntry.processingOwner &&
          currentEntry.processingOwner !== processingOwner &&
          Number.isFinite(processingUntil) &&
          processingUntil > now;

        if (hasActiveClaim) {
          continue;
        }

        await db.syncQueue.update(entryId, {
          processingOwner,
          processingUntil: new Date(now + SYNC_PROCESSING_LEASE_MS).toISOString(),
          updatedAt: getIsoNow(),
        });
        claimedEntries.push({
          ...currentEntry,
          processingOwner,
          processingUntil: new Date(now + SYNC_PROCESSING_LEASE_MS).toISOString(),
        });
      }
    });
  } catch (error) {
    const storageError = new Error(SYNC_PRESENTATION_MESSAGES.LOCAL_STORAGE);
    storageError.code = SYNC_ERROR_CODES.LOCAL_STORAGE_FAILURE;
    storageError.cause = error;
    throw storageError;
  }

  return claimedEntries;
};

export const clearSyncedEntries = async () => {
  const syncedEntries = await db.syncQueue
    .orderBy("updatedAt")
    .filter(
      (entry) =>
        (isSyncEntryVisibleForContext(entry) ||
          entry.resolutionStatus === "RESOLVED_AUTOMATICALLY") &&
        (entry.status === LOCAL_SYNC_STATUS.SYNCED ||
          entry.resolutionStatus === "RESOLVED_AUTOMATICALLY"),
    )
    .toArray();

  try {
    await db.syncQueue.bulkDelete(syncedEntries.map((entry) => entry.id));
  } catch (error) {
    const storageError = new Error(SYNC_PRESENTATION_MESSAGES.LOCAL_STORAGE);
    storageError.code = SYNC_ERROR_CODES.LOCAL_STORAGE_FAILURE;
    storageError.cause = error;
    throw storageError;
  }
  emitSyncQueueUpdated();
};
