import db, { LOCAL_SYNC_STATUS } from "./db";

const terminalStatuses = new Set([
  LOCAL_SYNC_STATUS.SYNCED,
  LOCAL_SYNC_STATUS.CONFLICT,
]);

const getIsoNow = () => new Date().toISOString();

export const emitSyncQueueUpdated = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("distync-sync-queue-updated"));
  }
};

export const getSyncQueueSnapshot = async () => {
  return db.syncQueue.orderBy("clientTimestamp").reverse().toArray();
};

export const getRetryableSyncEntries = async () => {
  return db.syncQueue
    .orderBy("clientTimestamp")
    .filter(
      (entry) =>
        entry.status === LOCAL_SYNC_STATUS.PENDING ||
        entry.status === LOCAL_SYNC_STATUS.FAILED,
    )
    .toArray();
};

export const queueSyncEntry = async (entry) => {
  const now = getIsoNow();
  const existingEntry = entry.queueGroupKey
    ? await db.syncQueue
        .where("queueGroupKey")
        .equals(entry.queueGroupKey)
        .and((row) => !terminalStatuses.has(row.status))
        .first()
    : null;

  if (existingEntry) {
    await db.syncQueue.update(existingEntry.id, {
      ...entry,
      status: LOCAL_SYNC_STATUS.PENDING,
      lastError: null,
      syncedAt: null,
      updatedAt: now,
    });

    emitSyncQueueUpdated();
    return existingEntry.id;
  }

  await db.syncQueue.put({
    ...entry,
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
  await db.syncQueue.where("status").equals(LOCAL_SYNC_STATUS.SYNCED).delete();
  emitSyncQueueUpdated();
};
