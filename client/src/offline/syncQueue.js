import db, { LOCAL_SYNC_STATUS } from "./db.js";
import { getAccessMode } from "../utils/accessMode.js";
import {
  getAuthenticatedUser,
  getCurrentRole,
} from "../utils/roleSession.js";

const terminalStatuses = new Set([
  LOCAL_SYNC_STATUS.SYNCED,
  LOCAL_SYNC_STATUS.CONFLICT,
]);

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

const getIsoNow = () => new Date().toISOString();

export const isUnsupportedOfflineActionKey = (actionKey) =>
  unsupportedOfflineActionKeys.has(String(actionKey || "").trim().toUpperCase());

export const getUnsupportedOfflineActionMessage = (actionKey) => {
  if (isUnsupportedOfflineActionKey(actionKey)) {
    return "This operation is no longer supported for offline synchronization. Please complete the action while online.";
  }

  return "";
};

export const getSyncQueueActorContext = () => {
  return {
    accessMode: getAccessMode(),
    userId: getAuthenticatedUser()?.id || null,
    roleCode: getCurrentRole() || null,
  };
};

export const buildStoredSyncEntry = (entry, actorContext = getSyncQueueActorContext()) => {
  return {
    ...entry,
    accessMode: actorContext.accessMode,
    userId: actorContext.userId,
    roleCode: actorContext.roleCode,
  };
};

export const isSyncEntryVisibleForContext = (
  entry,
  actorContext = getSyncQueueActorContext(),
) => {
  if (!entry || entry.accessMode !== actorContext.accessMode) {
    return false;
  }

  if (entry.userId && entry.userId !== actorContext.userId) {
    return false;
  }

  if (entry.roleCode && actorContext.roleCode && entry.roleCode !== actorContext.roleCode) {
    return false;
  }

  if (entry.roleCode && !actorContext.roleCode) {
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
        !isUnsupportedOfflineActionKey(entry.actionKey) &&
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
        !isUnsupportedOfflineActionKey(entry.actionKey) &&
        entry.status === LOCAL_SYNC_STATUS.FAILED &&
        (requestedIds.length === 0 || requestedIds.includes(entry.id)),
    )
    .toArray();
};

export const queueSyncEntry = async (entry) => {
  const now = getIsoNow();
  const actorContext = getSyncQueueActorContext();
  const storedEntry = buildStoredSyncEntry(entry, actorContext);
  const existingEntry = entry.queueGroupKey
    ? await db.syncQueue
        .where("queueGroupKey")
        .equals(entry.queueGroupKey)
        .and(
          (row) =>
            !terminalStatuses.has(row.status) &&
            isSyncEntryVisibleForContext(row, actorContext),
        )
        .first()
    : null;

  if (existingEntry) {
    await db.syncQueue.update(existingEntry.id, {
      ...storedEntry,
      id: existingEntry.id,
      clientTimestamp: existingEntry.clientTimestamp || storedEntry.clientTimestamp,
      status: LOCAL_SYNC_STATUS.PENDING,
      lastError: null,
      syncedAt: null,
      updatedAt: now,
    });

    emitSyncQueueUpdated();
    return existingEntry.id;
  }

  await db.syncQueue.put({
    ...storedEntry,
    status: LOCAL_SYNC_STATUS.PENDING,
    lastError: null,
    syncedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  emitSyncQueueUpdated();
  return entry.id;
};

export const updateSyncEntryStatus = async (entryId, updates) => {
  await db.syncQueue.update(entryId, {
    ...updates,
    updatedAt: getIsoNow(),
  });

  emitSyncQueueUpdated();
};

export const clearSyncedEntries = async () => {
  const syncedEntries = await db.syncQueue
    .orderBy("updatedAt")
    .filter(
      (entry) =>
        isSyncEntryVisibleForContext(entry) &&
        entry.status === LOCAL_SYNC_STATUS.SYNCED,
    )
    .toArray();

  await db.syncQueue.bulkDelete(syncedEntries.map((entry) => entry.id));
  emitSyncQueueUpdated();
};
