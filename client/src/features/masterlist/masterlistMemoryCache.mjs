export const MASTERLIST_MEMORY_CACHE_LIMIT = 24;

const masterlistDataCache = new Map();
let activeMasterlistOwnerKey = null;
let activeMasterlistOwnerAuthenticated = false;

const normalizeOwnerValue = (value) => String(value || "").trim();

export const buildMasterlistOwnerKey = (actorContext = {}) =>
  JSON.stringify({
    accessMode: normalizeOwnerValue(actorContext.accessMode),
    userId: normalizeOwnerValue(actorContext.userId),
    roleCode: normalizeOwnerValue(actorContext.roleCode),
    barangayId: normalizeOwnerValue(actorContext.barangayId),
    deviceId: normalizeOwnerValue(actorContext.deviceId),
  });

export const activateMasterlistMemoryOwner = (actorContext = {}) => {
  const ownerKey = buildMasterlistOwnerKey(actorContext);

  if (activeMasterlistOwnerKey !== ownerKey) {
    masterlistDataCache.clear();
    activeMasterlistOwnerKey = ownerKey;
  }
  activeMasterlistOwnerAuthenticated = Boolean(
    normalizeOwnerValue(actorContext.userId),
  );

  return ownerKey;
};

export const isMasterlistMemoryOwnerCurrent = (ownerKey) =>
  activeMasterlistOwnerAuthenticated && activeMasterlistOwnerKey === ownerKey;

export const buildMasterlistRequestKey = ({
  disasterEventId,
  barangayId,
  recordStatus,
  page,
  pageSize,
  search,
  sectorIds,
  sortOrder,
  actorContext = {},
}) =>
  JSON.stringify({
    role: "barangay",
    accessMode: normalizeOwnerValue(actorContext.accessMode),
    userId: normalizeOwnerValue(actorContext.userId),
    roleCode: normalizeOwnerValue(actorContext.roleCode),
    actorBarangayId: normalizeOwnerValue(actorContext.barangayId),
    deviceId: normalizeOwnerValue(actorContext.deviceId),
    disasterEventId: String(disasterEventId || ""),
    barangayId: String(barangayId || ""),
    recordStatus: recordStatus || "",
    page,
    pageSize,
    search: search || "",
    sectorIds: Array.isArray(sectorIds) ? sectorIds : [],
    sortOrder: sortOrder || "",
  });

export const getMasterlistCacheEntry = (requestKey) => {
  const entry = masterlistDataCache.get(requestKey);

  if (!entry) {
    return null;
  }

  masterlistDataCache.delete(requestKey);
  masterlistDataCache.set(requestKey, entry);
  return entry;
};

export const setMasterlistCacheEntry = (requestKey, entry) => {
  masterlistDataCache.delete(requestKey);
  masterlistDataCache.set(requestKey, entry);

  while (masterlistDataCache.size > MASTERLIST_MEMORY_CACHE_LIMIT) {
    const oldestRequestKey = masterlistDataCache.keys().next().value;
    masterlistDataCache.delete(oldestRequestKey);
  }
};

export const clearMasterlistMemoryCache = () => {
  masterlistDataCache.clear();
  activeMasterlistOwnerKey = null;
  activeMasterlistOwnerAuthenticated = false;
};

export const selectMasterlistFallbackData = ({
  requestKey,
  cachedData = null,
  lastSuccessfulData = null,
  lastSuccessfulRequestKey = "",
} = {}) =>
  cachedData ||
  (lastSuccessfulRequestKey === requestKey ? lastSuccessfulData : null);
