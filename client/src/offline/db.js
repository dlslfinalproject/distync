import Dexie from "dexie";
import { ACCESS_MODES, getAccessMode } from "../utils/accessMode.js";
import { getModeDatabaseName } from "../utils/modeStorage.js";

export const LOCAL_SYNC_STATUS = {
  PENDING: "PENDING",
  SYNCED: "SYNCED",
  FAILED: "FAILED",
  CONFLICT: "CONFLICT",
};

export const DISTYNC_OFFLINE_DB_BASE_NAME = "distyncOfflineDb";

const getResolvedOfflineDatabaseMode = () => {
  if (typeof window === "undefined") {
    return ACCESS_MODES.DEVELOPMENT;
  }

  return getAccessMode();
};

export const getOfflineDatabaseName = (mode = getResolvedOfflineDatabaseMode()) => {
  return getModeDatabaseName(DISTYNC_OFFLINE_DB_BASE_NAME, mode);
};

class DistyncOfflineDb extends Dexie {
  constructor() {
    super(getOfflineDatabaseName());

    this.version(2).stores({
      syncQueue:
        "id, queueGroupKey, status, accessMode, userId, roleCode, moduleName, actionKey, entityType, entityLocalId, entityServerId, clientTimestamp, syncedAt, createdAt, updatedAt",
    });

    this.version(3).stores({
      syncQueue:
        "id, queueGroupKey, status, accessMode, userId, roleCode, moduleName, actionKey, entityType, entityLocalId, entityServerId, clientTimestamp, syncedAt, createdAt, updatedAt",
      offlineStubCache:
        "id, stubId, qr_code_value, accessMode, userId, roleCode, disaster_event_id, barangay_id, status, cached_at, [accessMode+userId+roleCode+stubId], [accessMode+userId+roleCode+qr_code_value], [accessMode+userId+roleCode+disaster_event_id+barangay_id]",
    });
  }
}

const db = new DistyncOfflineDb();

export default db;
