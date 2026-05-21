import Dexie from "dexie";

export const LOCAL_SYNC_STATUS = {
  PENDING: "PENDING",
  SYNCED: "SYNCED",
  FAILED: "FAILED",
  CONFLICT: "CONFLICT",
};

class DistyncOfflineDb extends Dexie {
  constructor() {
    super("distyncOfflineDb");

    this.version(1).stores({
      syncQueue:
        "id, queueGroupKey, status, moduleName, actionKey, entityType, entityLocalId, entityServerId, clientTimestamp, syncedAt, createdAt, updatedAt",
    });
  }
}

const db = new DistyncOfflineDb();

export default db;
