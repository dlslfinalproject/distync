import Dexie from "dexie";
import { ACCESS_MODES, getAccessMode } from "../utils/accessMode.js";
import { getModeDatabaseName } from "../utils/modeStorage.js";
import { LOCAL_SYNC_STATUS } from "./syncStatusConstants.js";

export { LOCAL_SYNC_STATUS };

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

    this.version(4).stores({
      syncQueue:
        "id, queueGroupKey, status, accessMode, userId, roleCode, moduleName, actionKey, entityType, entityLocalId, entityServerId, clientTimestamp, syncedAt, createdAt, updatedAt",
      offlineStubCache:
        "id, stubId, qr_code_value, accessMode, userId, roleCode, disaster_event_id, barangay_id, status, cached_at, [accessMode+userId+roleCode+stubId], [accessMode+userId+roleCode+qr_code_value], [accessMode+userId+roleCode+disaster_event_id+barangay_id]",
      offlineMasterlistCache:
        "id, household_id, accessMode, userId, roleCode, disaster_event_id, barangay_id, cached_at, [accessMode+userId+roleCode+disaster_event_id+barangay_id+household_id]",
      offlinePreparation:
        "id, accessMode, userId, roleCode, disaster_event_id, barangay_id, status, cache_version, updated_at, [accessMode+userId+roleCode+disaster_event_id+barangay_id]",
    });

    this.version(5).stores({
      syncQueue:
        "id, queueGroupKey, status, accessMode, userId, roleCode, moduleName, actionKey, entityType, entityLocalId, entityServerId, clientTimestamp, syncedAt, createdAt, updatedAt",
      offlineStubCache:
        "id, stubId, qr_code_value, accessMode, userId, roleCode, disaster_event_id, barangay_id, status, cached_at, [accessMode+userId+roleCode+stubId], [accessMode+userId+roleCode+qr_code_value], [accessMode+userId+roleCode+disaster_event_id+barangay_id]",
      offlineMasterlistCache:
        "id, household_id, accessMode, userId, roleCode, disaster_event_id, barangay_id, cached_at, [accessMode+userId+roleCode+disaster_event_id+barangay_id+household_id]",
      offlinePreparation:
        "id, accessMode, userId, roleCode, disaster_event_id, barangay_id, status, cache_version, updated_at, [accessMode+userId+roleCode+disaster_event_id+barangay_id]",
      offlineInventoryCache:
        "id, accessMode, userId, roleCode, device_id, cache_version, status, cached_at, [accessMode+userId+roleCode], [accessMode+userId+roleCode+device_id]",
    });
  }
}

const db = new DistyncOfflineDb();

export default db;
