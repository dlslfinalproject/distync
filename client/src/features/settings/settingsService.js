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
const WINDOW_ORIGIN =
  typeof window === "undefined" ? "http://localhost" : window.location.origin;
const API_BASE_ORIGIN = new URL(API_BASE_URL, WINDOW_ORIGIN).origin;
const SUPABASE_ORIGIN = import.meta.env?.VITE_SUPABASE_URL
  ? new URL(import.meta.env.VITE_SUPABASE_URL).origin
  : "";

const DEFAULT_PREFERENCES = {
  notificationRulePreferences: {},
  effectiveNotificationChannels: {},
  categories: [],
};

export const ROLE_SETTINGS_CACHE_VERSION = "2026-07-31-v2";

export const buildRoleSettingsCacheKey = ({ roleCode, userId, mode }) =>
  getRoleSettingsStorageKey({ roleCode, userId, mode });

const getKnownAccessModes = () => Object.values(ACCESS_MODES);

const getRoleSettingsStoragePrefix = (mode) =>
  `${getModeStoragePrefix(mode)}:${MODE_STORAGE_SEGMENTS.ROLE_SETTINGS}:`;

const isPlainObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value);

const sanitizeString = (value) =>
  typeof value === "string" ? value.trim() : "";

const normalizeProfileNameField = (value) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";

const isSafeProfilePicturePath = (value = "") => {
  const trimmedValue = sanitizeString(value);

  if (
    !trimmedValue ||
    trimmedValue.startsWith("/") ||
    trimmedValue.includes("..") ||
    trimmedValue.includes("\\")
  ) {
    return false;
  }

  return !/^[a-z]+:/i.test(trimmedValue);
};

const isSafeProfilePictureUrl = (value = "") => {
  const trimmedValue = sanitizeString(value);

  if (!trimmedValue) {
    return false;
  }

  try {
    const parsedUrl = new URL(trimmedValue, WINDOW_ORIGIN);

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return false;
    }

    return (
      parsedUrl.origin === API_BASE_ORIGIN ||
      (SUPABASE_ORIGIN && parsedUrl.origin === SUPABASE_ORIGIN)
    );
  } catch (_error) {
    return false;
  }
};

const isExpiredTimestamp = (value = "") => {
  const trimmedValue = sanitizeString(value);

  if (!trimmedValue) {
    return true;
  }

  const parsedTimestamp = new Date(trimmedValue);

  if (Number.isNaN(parsedTimestamp.getTime())) {
    return true;
  }

  return parsedTimestamp.getTime() <= Date.now();
};

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
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.message || fallbackMessage);
    error.status = response.status;
    throw error;
  }

  return payload;
};

const hasStructuredProfileFields = (profile = {}) =>
  Boolean(
    normalizeProfileNameField(profile.firstName) ||
      normalizeProfileNameField(profile.middleName) ||
      normalizeProfileNameField(profile.lastName),
  );

const normalizeStoredSettings = (storedValue = {}) => {
  const {
    preferredExportFormat: _removedPreferredExportFormat,
    ...remainingStoredSettings
  } = storedValue || {};
  const normalizedProfile = isPlainObject(storedValue?.profile)
    ? storedValue.profile
    : {};
  const hasLegacyOnlyFullName =
    Boolean(sanitizeString(normalizedProfile.fullName)) &&
    !hasStructuredProfileFields(normalizedProfile);
  const normalizedProfilePicturePath = isSafeProfilePicturePath(
    normalizedProfile.profilePicturePath,
  )
    ? sanitizeString(normalizedProfile.profilePicturePath)
    : "";
  const normalizedProfilePictureUrlExpiresAt = sanitizeString(
    normalizedProfile.profilePictureUrlExpiresAt,
  );
  const normalizedProfilePictureUrl =
    normalizedProfilePicturePath &&
    !isExpiredTimestamp(normalizedProfilePictureUrlExpiresAt) &&
    isSafeProfilePictureUrl(normalizedProfile.profilePictureUrl)
      ? sanitizeString(normalizedProfile.profilePictureUrl)
      : "";

  return {
    ...DEFAULT_PREFERENCES,
    ...remainingStoredSettings,
    notificationRulePreferences:
      isPlainObject(storedValue?.notificationRulePreferences)
        ? storedValue.notificationRulePreferences
        : {},
    effectiveNotificationChannels:
      isPlainObject(storedValue?.effectiveNotificationChannels)
        ? storedValue.effectiveNotificationChannels
        : {},
    categories: Array.isArray(storedValue?.categories)
      ? storedValue.categories
      : [],
    profile: {
      ...(isPlainObject(remainingStoredSettings.profile)
        ? remainingStoredSettings.profile
        : {}),
      firstName: hasLegacyOnlyFullName
        ? ""
        : normalizeProfileNameField(normalizedProfile.firstName),
      middleName: hasLegacyOnlyFullName
        ? ""
        : normalizeProfileNameField(normalizedProfile.middleName),
      lastName: hasLegacyOnlyFullName
        ? ""
        : normalizeProfileNameField(normalizedProfile.lastName),
      fullName: "",
      assignedBarangay: isPlainObject(normalizedProfile.assignedBarangay)
        ? {
            id: sanitizeString(normalizedProfile.assignedBarangay.id),
            name: sanitizeString(normalizedProfile.assignedBarangay.name),
          }
        : null,
      profilePicturePath: normalizedProfilePicturePath,
      profilePictureUrl: normalizedProfilePictureUrl,
      profilePictureUrlExpiresAt: normalizedProfilePictureUrl
        ? normalizedProfilePictureUrlExpiresAt
        : "",
      profilePictureFileName: sanitizeString(
        normalizedProfile.profilePictureFileName,
      ),
      profilePictureUpdatedAt: sanitizeString(
        normalizedProfile.profilePictureUpdatedAt,
      ),
    },
    cacheMeta: {
      hasLegacyOnlyFullName,
    },
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

  const normalizedSettings = normalizeStoredSettings(cachedEnvelopeResult.value.data);

  if (normalizedSettings.cacheMeta?.hasLegacyOnlyFullName) {
    removeStorageKey(storageKey);
    return null;
  }

  return normalizedSettings;
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

export const loadRoleSettingsState = async ({
  roleCode,
  userId,
  mode = getAccessMode(),
}) => {
  if (!roleCode || !userId) {
    return {
      settings: normalizeStoredSettings({}),
      source: "empty",
      errorMessage: "",
    };
  }

  const cachedSettings =
    readRoleSettingsCache({
      roleCode,
      userId,
      mode,
    }) || null;

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

    return {
      settings: resolvedSettings,
      source: "network",
      errorMessage: "",
    };
  } catch (error) {
    if (error?.status === 401 || error?.status === 403) {
      clearRoleSettingsCache({
        roleCode,
        userId,
        mode,
      });

      return {
        settings: normalizeStoredSettings({}),
        source: "unauthorized",
        errorMessage: "",
      };
    }

    if (cachedSettings) {
      return {
        settings: cachedSettings,
        source: "cache",
        errorMessage: "",
      };
    }

    return {
      settings: normalizeStoredSettings({}),
      source: "error",
      errorMessage: "Notification preferences could not be loaded.",
    };
  }
};

export const saveRoleSettings = async ({
  roleCode,
  userId,
  settings,
  mode = getAccessMode(),
}) => {
  const payload = {
    settings: {},
  };

  if (isPlainObject(settings?.profile)) {
    const profile = settings.profile;
    const normalizedFirstName = normalizeProfileNameField(profile.firstName);
    const normalizedMiddleName = normalizeProfileNameField(profile.middleName);
    const normalizedLastName = normalizeProfileNameField(profile.lastName);
    const normalizedContactNumber = sanitizeString(profile.contactNumber);

    payload.settings.profile = {
      firstName: normalizedFirstName,
      middleName: normalizedMiddleName || null,
      lastName: normalizedLastName,
      contactNumber: normalizedContactNumber,
    };
  }

  if (isPlainObject(settings?.notificationRulePreferences)) {
    payload.settings.notificationRulePreferences =
      settings.notificationRulePreferences;
  }

  if (isPlainObject(settings?.metadata)) {
    payload.settings.metadata = settings.metadata;
  }

  const response = await fetch(`${API_BASE_URL}/api/v1/settings/current`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responsePayload = await handleJsonResponse(
    response,
    "Failed to save settings",
  );
  const resolvedSettings = normalizeStoredSettings(responsePayload?.data || {});

  writeRoleSettingsCache({
    roleCode,
    userId,
    settings: resolvedSettings,
    mode,
  });

  return {
    success: true,
    data: resolvedSettings,
    user: responsePayload?.user || null,
  };
};

export const uploadCurrentProfilePicture = async ({
  fileName,
  mimeType,
  fileDataBase64,
}) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/settings/current/profile-picture`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileName,
      mimeType,
      fileDataBase64,
    }),
  });
  const payload = await handleJsonResponse(
    response,
    "Failed to upload the profile picture",
  );

  return normalizeStoredSettings({
    profile: payload?.data || {},
  }).profile;
};

export const removeCurrentProfilePicture = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/settings/current/profile-picture`, {
    method: "DELETE",
  });
  const payload = await handleJsonResponse(
    response,
    "Failed to remove the profile picture",
  );

  return normalizeStoredSettings({
    profile: payload?.data || {},
  }).profile;
};

export const refreshCurrentProfilePicture = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/settings/current/profile-picture`);
  const payload = await handleJsonResponse(
    response,
    "Failed to refresh the profile picture",
  );

  return normalizeStoredSettings({
    profile: payload?.data || {},
  }).profile;
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
