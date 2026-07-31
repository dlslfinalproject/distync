import Dexie from "dexie";
import {
  clearLegacyRoleSettingsCaches,
  clearModeRoleSettingsCaches,
} from "../features/settings/settingsService.js";
import {
  getKnownObsoleteCacheNames,
} from "../pwa/cacheNames.js";
import { ACCESS_MODES, getAccessMode } from "./accessMode.js";
import {
  LAST_ACCESS_MODE_STORAGE_KEY,
  STORAGE_MIGRATION_MARKER_KEY,
  STORAGE_MIGRATION_MARKER_VALUE,
  clearAllModeAuthStorage,
  clearLegacyStorage,
  readStorageValue,
  removeStorageKey,
  writeStorageValue,
} from "./modeStorage.js";

const LEGACY_OFFLINE_DATABASE_NAME = "distyncOfflineDb";

const getCacheStorage = (cacheStorage) => {
  if (cacheStorage) {
    return cacheStorage;
  }

  if (typeof caches === "undefined") {
    return null;
  }

  return caches;
};

export const cleanupLegacyOfflineDatabase = async () => {
  const legacyDatabaseExists = await Dexie.exists(LEGACY_OFFLINE_DATABASE_NAME);

  if (!legacyDatabaseExists) {
    return false;
  }

  await Dexie.delete(LEGACY_OFFLINE_DATABASE_NAME);
  return true;
};

export const cleanupKnownDistyncCaches = async ({
  previousMode,
  currentMode = getAccessMode(),
  cacheStorage,
} = {}) => {
  const resolvedCacheStorage = getCacheStorage(cacheStorage);

  if (!resolvedCacheStorage) {
    return [];
  }

  const obsoleteCacheNames = getKnownObsoleteCacheNames({
    previousMode,
    currentMode,
  });
  const deletedCacheNames = [];

  for (const cacheName of obsoleteCacheNames) {
    try {
      const wasDeleted = await resolvedCacheStorage.delete(cacheName);

      if (wasDeleted) {
        deletedCacheNames.push(cacheName);
      }
    } catch (_error) {
      // Ignore cache cleanup failures so the current mode can still load.
    }
  }

  return deletedCacheNames;
};

export const prepareModeScopedBrowserState = async ({
  currentMode = getAccessMode(),
  storage,
  cacheStorage,
  deleteLegacyOfflineDatabase = cleanupLegacyOfflineDatabase,
} = {}) => {
  const previousMode = readStorageValue(LAST_ACCESS_MODE_STORAGE_KEY, storage);
  const hasModeChanged =
    previousMode &&
    Object.values(ACCESS_MODES).includes(previousMode) &&
    previousMode !== currentMode;

  clearLegacyStorage(storage);
  clearLegacyRoleSettingsCaches();

  if (hasModeChanged) {
    clearAllModeAuthStorage(storage);
    clearModeRoleSettingsCaches({ mode: previousMode });
    clearModeRoleSettingsCaches({ mode: currentMode });
  }

  await deleteLegacyOfflineDatabase();
  await cleanupKnownDistyncCaches({
    previousMode,
    currentMode,
    cacheStorage,
  });

  writeStorageValue(
    STORAGE_MIGRATION_MARKER_KEY,
    STORAGE_MIGRATION_MARKER_VALUE,
    storage,
  );
  writeStorageValue(LAST_ACCESS_MODE_STORAGE_KEY, currentMode, storage);

  return {
    currentMode,
    previousMode: Object.values(ACCESS_MODES).includes(previousMode)
      ? previousMode
      : null,
    hasModeChanged: Boolean(hasModeChanged),
  };
};

export const clearModeMarker = (storage) => {
  removeStorageKey(LAST_ACCESS_MODE_STORAGE_KEY, storage);
  removeStorageKey(STORAGE_MIGRATION_MARKER_KEY, storage);
};
