import { getCachedRegistrationReferenceData } from "../household-registration/householdRegistrationService.js";
import { ACCESS_MODES, getAccessMode } from "../../utils/accessMode.js";
import {
  MODE_STORAGE_SEGMENTS,
  getModeStoragePrefix,
  getRoleSettingsStorageKey,
  listStorageKeys,
  readStorageValue,
  removeStorageKey,
  removeStorageKeysByPrefix,
  writeStorageValue,
} from "../../utils/modeStorage.js";

const API_BASE_URL =
  import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000";

const DEFAULT_PREFERENCES = {
  enabledNotificationRuleCodes: [],
};

export const ROLE_SETTINGS_CACHE_VERSION = "2026-07-31-v1";

export const buildRoleSettingsCacheKey = ({ roleCode, userId, mode }) =>
  getRoleSettingsStorageKey({ roleCode, userId, mode });

const getKnownAccessModes = () => Object.values(ACCESS_MODES);

const getRoleSettingsStoragePrefix = (mode) =>
  `${getModeStoragePrefix(mode)}:${MODE_STORAGE_SEGMENTS.ROLE_SETTINGS}:`;

const isPlainObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value);

const safeReadJson = (storageKey) => {
  if (typeof window === "undefined") {
    return {
      isPresent: false,
      isMalformed: false,
      value: null,
    };
  }

  try {
    const rawValue = readStorageValue(storageKey);

    if (!rawValue) {
      return {
        isPresent: false,
        isMalformed: false,
        value: null,
      };
    }

    return {
      isPresent: true,
      isMalformed: false,
      value: JSON.parse(rawValue),
    };
  } catch (_error) {
    return {
      isPresent: true,
      isMalformed: true,
      value: null,
    };
  }
};

const safeWriteJson = (storageKey, value) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    writeStorageValue(storageKey, JSON.stringify(value));
  } catch (_error) {
    // Ignore storage write failures so settings pages can still render.
  }
};

const handleJsonResponse = async (response, fallbackMessage) => {
  const payload = await response.json();

  if (!response.ok) {
    const error = new Error(payload.message || fallbackMessage);
    error.status = response.status;
    throw error;
  }

  return payload;
};

const normalizeStoredSettings = (storedValue = {}) => {
  const {
    preferredExportFormat: _removedPreferredExportFormat,
    ...remainingStoredSettings
  } = storedValue || {};

  return {
    ...DEFAULT_PREFERENCES,
    ...remainingStoredSettings,
    enabledNotificationRuleCodes: Array.isArray(
      storedValue?.enabledNotificationRuleCodes,
    )
      ? storedValue.enabledNotificationRuleCodes
      : [],
  };
};

const isValidRoleSettingsEnvelope = ({
  envelope,
  expectedAccessMode,
  expectedRoleCode,
  expectedUserId,
}) => {
  return (
    isPlainObject(envelope) &&
    envelope.version === ROLE_SETTINGS_CACHE_VERSION &&
    envelope.accessMode === expectedAccessMode &&
    envelope.roleCode === (expectedRoleCode || "UNKNOWN") &&
    envelope.userId === (expectedUserId || "anonymous") &&
    typeof envelope.cachedAt === "string" &&
    Boolean(envelope.cachedAt.trim()) &&
    isPlainObject(envelope.data)
  );
};

export const readRoleSettingsCache = ({
  roleCode,
  userId,
  mode = getAccessMode(),
}) => {
  if (!roleCode || !userId) {
    return null;
  }

  const storageKey = buildRoleSettingsCacheKey({ roleCode, userId, mode });
  const cachedEnvelopeResult = safeReadJson(storageKey);

  if (!cachedEnvelopeResult.isPresent) {
    return null;
  }

  if (cachedEnvelopeResult.isMalformed) {
    removeStorageKey(storageKey);
    return null;
  }

  if (
    !isValidRoleSettingsEnvelope({
      envelope: cachedEnvelopeResult.value,
      expectedAccessMode: mode,
      expectedRoleCode: roleCode,
      expectedUserId: userId,
    })
  ) {
    removeStorageKey(storageKey);
    return null;
  }

  return normalizeStoredSettings(cachedEnvelopeResult.value.data);
};

export const writeRoleSettingsCache = ({
  roleCode,
  userId,
  settings,
  mode = getAccessMode(),
}) => {
  if (!roleCode || !userId) {
    return;
  }

  const storageKey = buildRoleSettingsCacheKey({ roleCode, userId, mode });
  const normalizedSettings = normalizeStoredSettings(settings);

  safeWriteJson(storageKey, {
    version: ROLE_SETTINGS_CACHE_VERSION,
    accessMode: mode,
    roleCode: roleCode || "UNKNOWN",
    userId: userId || "anonymous",
    cachedAt: new Date().toISOString(),
    data: normalizedSettings,
  });
};

export const listRoleSettingsCacheKeys = ({
  mode,
  userId,
} = {}) => {
  const knownAccessModes = getKnownAccessModes();
  const modePrefixes = mode
    ? [getRoleSettingsStoragePrefix(mode)]
    : knownAccessModes.map((accessMode) =>
        getRoleSettingsStoragePrefix(accessMode),
      );

  return listStorageKeys().filter((key) => {
    const matchesModePrefix = modePrefixes.some((prefix) =>
      key.startsWith(prefix),
    );

    if (!matchesModePrefix) {
      return false;
    }

    if (!userId) {
      return true;
    }

    return key.endsWith(`:${userId}`);
  });
};

export const clearRoleSettingsCache = ({ roleCode, userId, mode }) => {
  if (!roleCode || !userId) {
    return;
  }

  removeStorageKey(buildRoleSettingsCacheKey({ roleCode, userId, mode }));
};

export const clearUserRoleSettingsCaches = ({
  userId,
  mode = getAccessMode(),
}) => {
  if (!userId) {
    return;
  }

  listRoleSettingsCacheKeys({ mode, userId }).forEach((key) =>
    removeStorageKey(key),
  );
};

export const clearModeRoleSettingsCaches = ({
  mode = getAccessMode(),
} = {}) => {
  listRoleSettingsCacheKeys({ mode }).forEach((key) => removeStorageKey(key));
};

export const clearLegacyRoleSettingsCaches = () => {
  removeStorageKeysByPrefix("distync-role-settings:");
};

export const loadRoleSettings = async ({
  roleCode,
  userId,
  mode = getAccessMode(),
}) => {
  if (!roleCode || !userId) {
    return normalizeStoredSettings({});
  }

  const cachedSettings =
    readRoleSettingsCache({
      roleCode,
      userId,
      mode,
    }) || normalizeStoredSettings({});

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/settings/current`);
    const payload = await handleJsonResponse(response, "Failed to load settings");
    const resolvedSettings = normalizeStoredSettings(payload?.data || {});

    writeRoleSettingsCache({
      roleCode,
      userId,
      settings: resolvedSettings,
      mode,
    });

    return resolvedSettings;
  } catch (error) {
    if (error?.status === 401 || error?.status === 403) {
      clearRoleSettingsCache({
        roleCode,
        userId,
        mode,
      });
      return normalizeStoredSettings({});
    }

    return cachedSettings;
  }
};

export const saveRoleSettings = async ({
  roleCode,
  userId,
  settings,
  mode = getAccessMode(),
}) => {
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

  writeRoleSettingsCache({
    roleCode,
    userId,
    settings: resolvedSettings,
    mode,
  });

  return {
    success: true,
    data: resolvedSettings,
    user: payload?.user || null,
  };
};

export const clearAllRoleSettingsCaches = () => {
  listRoleSettingsCacheKeys().forEach((key) => removeStorageKey(key));
  clearLegacyRoleSettingsCaches();
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
