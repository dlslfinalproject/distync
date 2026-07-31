import { ACCESS_MODES, getAccessMode } from "./accessMode.js";

export const DISTYNC_STORAGE_PREFIX = "distync";
export const LAST_ACCESS_MODE_STORAGE_KEY = "distync:last-access-mode";
export const STORAGE_MIGRATION_MARKER_KEY = "distync:storage-migration-version";
export const STORAGE_MIGRATION_MARKER_VALUE = "2026-07-31-mode-isolation";

export const LEGACY_AUTH_SESSION_STORAGE_KEY = "distync_auth_session";
export const LEGACY_SELECTED_ROLE_STORAGE_KEY = "distync_selected_role";
export const LEGACY_ROLE_SETTINGS_STORAGE_PREFIX = "distync-role-settings:";
export const LEGACY_REGISTRATION_STORAGE_KEYS = [
  "distync-registration-active-disaster-events",
  "distync-registration-sectors",
  "distync-registration-barangays",
  "distync-registration-selected-disaster-event-id",
  "distync-registration-selected-disaster-event",
  "distync-registration-evacuation-centers-all",
  "distync-registration-evacuation-centers-by-barangay",
];

export const LEGACY_STORAGE_KEYS = [
  LEGACY_AUTH_SESSION_STORAGE_KEY,
  LEGACY_SELECTED_ROLE_STORAGE_KEY,
  ...LEGACY_REGISTRATION_STORAGE_KEYS,
];

export const MODE_STORAGE_SEGMENTS = {
  AUTH_SESSION: "auth-session",
  SELECTED_ROLE: "selected-role",
  ROLE_SETTINGS: "role-settings",
  REGISTRATION: "registration",
};

const validAccessModes = Object.values(ACCESS_MODES);

const getStorage = (storage) => {
  if (storage) {
    return storage;
  }

  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
};

export const getModeStoragePrefix = (mode = getAccessMode()) => {
  return `${DISTYNC_STORAGE_PREFIX}:${mode}`;
};

export const getModeStorageKey = (baseKey, mode = getAccessMode()) => {
  return `${getModeStoragePrefix(mode)}:${baseKey}`;
};

export const getModeDatabaseName = (baseName, mode = getAccessMode()) => {
  return `${baseName}-${mode}`;
};

export const isStoredModeCurrent = (
  storedMode,
  currentMode = getAccessMode(),
) => {
  return storedMode === currentMode;
};

export const getAuthSessionStorageKey = (mode = getAccessMode()) => {
  return getModeStorageKey(MODE_STORAGE_SEGMENTS.AUTH_SESSION, mode);
};

export const getSelectedRoleStorageKey = (mode = getAccessMode()) => {
  return getModeStorageKey(MODE_STORAGE_SEGMENTS.SELECTED_ROLE, mode);
};

export const getRoleSettingsStorageKey = ({
  roleCode,
  userId,
  mode = getAccessMode(),
}) => {
  return getModeStorageKey(
    `${MODE_STORAGE_SEGMENTS.ROLE_SETTINGS}:${roleCode || "UNKNOWN"}:${userId || "anonymous"}`,
    mode,
  );
};

export const getRegistrationStorageKey = (
  baseKey,
  mode = getAccessMode(),
) => {
  return getModeStorageKey(
    `${MODE_STORAGE_SEGMENTS.REGISTRATION}:${baseKey}`,
    mode,
  );
};

export const getAllModeAuthSessionStorageKeys = () => {
  return validAccessModes.map((mode) => getAuthSessionStorageKey(mode));
};

export const getAllModeSelectedRoleStorageKeys = () => {
  return validAccessModes.map((mode) => getSelectedRoleStorageKey(mode));
};

export const removeStorageKey = (key, storage) => {
  const resolvedStorage = getStorage(storage);

  if (!resolvedStorage || !key) {
    return;
  }

  try {
    resolvedStorage.removeItem(key);
  } catch (_error) {
    // Ignore storage cleanup failures to avoid blocking app startup.
  }
};

export const readStorageValue = (key, storage) => {
  const resolvedStorage = getStorage(storage);

  if (!resolvedStorage || !key) {
    return null;
  }

  try {
    return resolvedStorage.getItem(key);
  } catch (_error) {
    return null;
  }
};

export const writeStorageValue = (key, value, storage) => {
  const resolvedStorage = getStorage(storage);

  if (!resolvedStorage || !key) {
    return;
  }

  try {
    resolvedStorage.setItem(key, value);
  } catch (_error) {
    // Ignore storage write failures so the app can still run.
  }
};

export const listStorageKeys = (storage) => {
  const resolvedStorage = getStorage(storage);

  if (!resolvedStorage) {
    return [];
  }

  const keys = [];

  for (let index = 0; index < resolvedStorage.length; index += 1) {
    const key = resolvedStorage.key(index);

    if (key) {
      keys.push(key);
    }
  }

  return keys;
};

export const removeStorageKeysByPrefix = (prefix, storage) => {
  listStorageKeys(storage)
    .filter((key) => key.startsWith(prefix))
    .forEach((key) => removeStorageKey(key, storage));
};

export const clearLegacyStorage = (storage) => {
  LEGACY_STORAGE_KEYS.forEach((key) => removeStorageKey(key, storage));
  removeStorageKeysByPrefix(LEGACY_ROLE_SETTINGS_STORAGE_PREFIX, storage);
};

export const clearCurrentModeAuthStorage = (
  mode = getAccessMode(),
  storage,
) => {
  removeStorageKey(getAuthSessionStorageKey(mode), storage);
  removeStorageKey(getSelectedRoleStorageKey(mode), storage);
};

export const clearAllModeAuthStorage = (storage) => {
  getAllModeAuthSessionStorageKeys().forEach((key) =>
    removeStorageKey(key, storage),
  );
  getAllModeSelectedRoleStorageKeys().forEach((key) =>
    removeStorageKey(key, storage),
  );
};
