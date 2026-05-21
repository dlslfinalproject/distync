import { getCachedRegistrationReferenceData } from "../household-registration/householdRegistrationService";

const SETTINGS_STORAGE_KEY_PREFIX = "distync-role-settings";

const DEFAULT_PREFERENCES = {
  enabledNotificationRuleCodes: [],
  preferredExportFormat: "excel",
};

const buildStorageKey = ({ roleCode, userId }) => {
  return `${SETTINGS_STORAGE_KEY_PREFIX}:${roleCode || "UNKNOWN"}:${userId || "anonymous"}`;
};

const safeReadJson = (storageKey, fallbackValue) => {
  if (typeof window === "undefined") {
    return fallbackValue;
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey);

    if (!rawValue) {
      return fallbackValue;
    }

    return JSON.parse(rawValue);
  } catch (_error) {
    return fallbackValue;
  }
};

const safeWriteJson = (storageKey, value) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  } catch (_error) {
    // Ignore storage write failures so settings pages can still render.
  }
};

export const loadRoleSettings = ({ roleCode, userId }) => {
  const storageKey = buildStorageKey({ roleCode, userId });
  const storedValue = safeReadJson(storageKey, {});

  return {
    ...DEFAULT_PREFERENCES,
    ...(storedValue || {}),
    enabledNotificationRuleCodes: Array.isArray(
      storedValue?.enabledNotificationRuleCodes,
    )
      ? storedValue.enabledNotificationRuleCodes
      : [],
    preferredExportFormat:
      storedValue?.preferredExportFormat || DEFAULT_PREFERENCES.preferredExportFormat,
  };
};

export const saveRoleSettings = ({ roleCode, userId, settings }) => {
  const storageKey = buildStorageKey({ roleCode, userId });
  safeWriteJson(storageKey, {
    ...DEFAULT_PREFERENCES,
    ...(settings || {}),
  });

  return {
    success: true,
  };
};

export const summarizeCachedRegistrationData = () => {
  const cachedData = getCachedRegistrationReferenceData();
  const sectors = Array.isArray(cachedData.sectors?.data)
    ? cachedData.sectors.data
    : Array.isArray(cachedData.sectors)
      ? cachedData.sectors
      : [];
  const allEvacuationCenters = Array.isArray(cachedData.evacuationCentersAll)
    ? cachedData.evacuationCentersAll
    : [];
  const barangayCenterMap = cachedData.evacuationCentersByBarangay || {};
  const barangayCenterCount = Object.values(barangayCenterMap).reduce(
    (total, centers) => total + (Array.isArray(centers) ? centers.length : 0),
    0,
  );

  return {
    activeDisasterEventCount: Array.isArray(cachedData.activeDisasterEvents)
      ? cachedData.activeDisasterEvents.length
      : 0,
    selectedDisasterEvent: cachedData.selectedDisasterEvent || null,
    selectedDisasterEventId: cachedData.selectedDisasterEventId || "",
    sectorCount: sectors.length,
    barangayCount: Array.isArray(cachedData.barangays)
      ? cachedData.barangays.length
      : 0,
    evacuationCenterCount: allEvacuationCenters.length || barangayCenterCount,
  };
};
