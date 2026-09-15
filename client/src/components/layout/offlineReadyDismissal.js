const STORAGE_KEY = "distync.offlineReadyAcknowledgements.v1";

const normalize = (value) => String(value ?? "").trim();

export const getOfflineReadyIdentity = ({ readiness, diagnostics } = {}) => {
  if (readiness !== "READY" || !diagnostics) return null;
  const scope = diagnostics.scope || {};
  const identity = {
    accessMode: normalize(diagnostics.accessMode || scope.accessMode),
    userId: normalize(diagnostics.userId || scope.userId),
    roleCode: normalize(diagnostics.roleCode || scope.roleCode),
    disasterEventId: normalize(diagnostics.disaster_event_id || scope.disasterEventId),
    barangayId: normalize(diagnostics.barangay_id || scope.barangayId),
    deviceId: normalize(diagnostics.device_id || scope.deviceId),
    cacheVersion: normalize(
      diagnostics.cache_version || diagnostics.cacheVersion || scope.cache_version || scope.cacheVersion,
    ),
    preparationGeneration: normalize(
      diagnostics.readiness_generation || diagnostics.readinessGeneration,
    ),
  };
  if (!identity.accessMode || !identity.userId || !identity.roleCode || !identity.preparationGeneration) return null;
  return identity;
};

const identityKey = (identity) => JSON.stringify(identity);

const readAcknowledgements = () => {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
  } catch (_error) {
    return [];
  }
};

export const isOfflineReadyAcknowledged = (identity) =>
  Boolean(identity && readAcknowledgements().includes(identityKey(identity)));

export const acknowledgeOfflineReady = (identity) => {
  if (!identity || typeof window === "undefined" || !window.localStorage) return;
  try {
    const key = identityKey(identity);
    const acknowledgements = readAcknowledgements();
    if (!acknowledgements.includes(key)) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...acknowledgements, key]));
    }
  } catch (_error) {
    // Storage can be unavailable in private or restricted browser contexts.
  }
};

export { STORAGE_KEY as OFFLINE_READY_ACKNOWLEDGEMENTS_STORAGE_KEY };
