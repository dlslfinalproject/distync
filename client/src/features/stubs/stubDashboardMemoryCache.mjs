export const STUB_DASHBOARD_MEMORY_CACHE_LIMIT = 24;

const stubDashboardDataCache = new Map();
let activeStubDashboardOwnerKey = null;
let activeStubDashboardOwnerAuthenticated = false;

const normalizeOwnerValue = (value) => String(value || "").trim();

export const buildStubDashboardOwnerKey = (actorContext = {}) =>
  JSON.stringify({
    accessMode: normalizeOwnerValue(actorContext.accessMode),
    userId: normalizeOwnerValue(actorContext.userId),
    roleCode: normalizeOwnerValue(actorContext.roleCode),
    barangayId: normalizeOwnerValue(actorContext.barangayId),
    deviceId: normalizeOwnerValue(actorContext.deviceId),
  });

export const activateStubDashboardMemoryOwner = (actorContext = {}) => {
  const ownerKey = buildStubDashboardOwnerKey(actorContext);

  if (activeStubDashboardOwnerKey !== ownerKey) {
    stubDashboardDataCache.clear();
    activeStubDashboardOwnerKey = ownerKey;
  }
  activeStubDashboardOwnerAuthenticated = Boolean(
    normalizeOwnerValue(actorContext.userId),
  );

  return ownerKey;
};

export const isStubDashboardMemoryOwnerCurrent = (ownerKey) =>
  activeStubDashboardOwnerAuthenticated &&
  activeStubDashboardOwnerKey === ownerKey;

export const buildStubDashboardRequestKey = ({
  userId,
  disasterEventId,
  overrideBarangayId,
  allowFallback,
  assignedBarangayId,
  page,
  pageSize,
  search,
  status,
  selectedSectorIds,
  sortOrder,
  actorContext = {},
}) =>
  JSON.stringify({
    role: "barangay",
    accessMode: normalizeOwnerValue(actorContext.accessMode),
    actorUserId: normalizeOwnerValue(actorContext.userId),
    roleCode: normalizeOwnerValue(actorContext.roleCode),
    actorBarangayId: normalizeOwnerValue(actorContext.barangayId),
    deviceId: normalizeOwnerValue(actorContext.deviceId),
    userId: String(userId || ""),
    disasterEventId: String(disasterEventId || ""),
    overrideBarangayId: String(overrideBarangayId || ""),
    allowFallback: Boolean(allowFallback),
    assignedBarangayId: String(assignedBarangayId || ""),
    page,
    pageSize,
    search: search || "",
    status: status || "all",
    selectedSectorIds: Array.isArray(selectedSectorIds)
      ? selectedSectorIds
      : [],
    sortOrder: sortOrder || "",
  });

export const getStubDashboardCacheEntry = (requestKey) => {
  const entry = stubDashboardDataCache.get(requestKey);

  if (!entry) {
    return null;
  }

  stubDashboardDataCache.delete(requestKey);
  stubDashboardDataCache.set(requestKey, entry);
  return entry;
};

export const setStubDashboardCacheEntry = (requestKey, entry) => {
  stubDashboardDataCache.delete(requestKey);
  stubDashboardDataCache.set(requestKey, entry);

  while (stubDashboardDataCache.size > STUB_DASHBOARD_MEMORY_CACHE_LIMIT) {
    const oldestRequestKey = stubDashboardDataCache.keys().next().value;
    stubDashboardDataCache.delete(oldestRequestKey);
  }
};

export const clearStubDashboardMemoryCache = () => {
  stubDashboardDataCache.clear();
  activeStubDashboardOwnerKey = null;
  activeStubDashboardOwnerAuthenticated = false;
};
