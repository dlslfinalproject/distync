import { getCachedRegistrationReferenceData } from "../household-registration/householdRegistrationService";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

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

const handleJsonResponse = async (response, fallbackMessage) => {
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.message || fallbackMessage);
  }

  return payload;
};

const normalizeStoredSettings = (storedValue = {}) => {
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

export const loadRoleSettings = async ({ roleCode, userId }) => {
  const storageKey = buildStorageKey({ roleCode, userId });
  const cachedSettings = normalizeStoredSettings(safeReadJson(storageKey, {}));

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/settings/current`);
    const payload = await handleJsonResponse(response, "Failed to load settings");
    const resolvedSettings = normalizeStoredSettings(payload?.data || {});

    safeWriteJson(storageKey, resolvedSettings);

    return resolvedSettings;
  } catch (_error) {
    return cachedSettings;
  }
};

export const saveRoleSettings = async ({ roleCode, userId, settings }) => {
  const storageKey = buildStorageKey({ roleCode, userId });
  const response = await fetch(`${API_BASE_URL}/api/v1/settings/current`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      settings: {
        ...DEFAULT_PREFERENCES,
        ...(settings || {}),
      },
    }),
  });

  const payload = await handleJsonResponse(response, "Failed to save settings");
  const resolvedSettings = normalizeStoredSettings(payload?.data || {});

  safeWriteJson(storageKey, resolvedSettings);

  return {
    success: true,
    data: resolvedSettings,
    user: payload?.user || null,
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
