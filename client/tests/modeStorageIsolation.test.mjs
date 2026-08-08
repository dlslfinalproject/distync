import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import { ACCESS_MODES } from "../src/utils/accessMode.js";
import {
  buildStoredSyncEntry,
  isSyncEntryVisibleForContext,
} from "../src/offline/syncQueue.js";
import { getOfflineDatabaseName } from "../src/offline/db.js";
import {
  buildAllModeRuntimeCacheNames,
  buildModeRuntimeCacheNames,
  getKnownObsoleteCacheNames,
} from "../src/pwa/cacheNames.js";
import {
  prepareModeScopedBrowserState,
} from "../src/utils/browserStorageIsolation.js";
import {
  getAuthSessionStorageKey,
  getRoleSettingsStorageKey,
  getSelectedRoleStorageKey,
  LEGACY_AUTH_SESSION_STORAGE_KEY,
  LEGACY_SELECTED_ROLE_STORAGE_KEY,
  LAST_ACCESS_MODE_STORAGE_KEY,
} from "../src/utils/modeStorage.js";
import {
  clearAuthenticatedSessionForMode,
  getAuthenticatedSessionForMode,
  getStoredRoleForMode,
  setAuthenticatedSessionForMode,
  setCurrentRoleForMode,
} from "../src/utils/roleSession.js";
import { getAuthenticatedAccessTokenForMode } from "../src/utils/apiClient.js";

class MemoryStorage {
  constructor(initialEntries = {}) {
    this.map = new Map(Object.entries(initialEntries));
  }

  get length() {
    return this.map.size;
  }

  clear() {
    this.map.clear();
  }

  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }

  key(index) {
    return Array.from(this.map.keys())[index] || null;
  }

  removeItem(key) {
    this.map.delete(key);
  }

  setItem(key, value) {
    this.map.set(key, String(value));
  }
}

const createWindow = (storage = new MemoryStorage()) => {
  globalThis.window = {
    localStorage: storage,
    dispatchEvent() {
      return true;
    },
  };

  return storage;
};

test.afterEach(() => {
  delete globalThis.window;
});

test("development session is readable only in development and carries mode metadata", () => {
  createWindow();

  setAuthenticatedSessionForMode(
    {
      access_token: "dev-token",
      user: {
        id: "user-1",
        role: "BARANGAY",
      },
    },
    ACCESS_MODES.DEVELOPMENT,
  );

  assert.equal(
    getAuthenticatedSessionForMode(ACCESS_MODES.DEVELOPMENT)?.access_token,
    "dev-token",
  );
  assert.equal(
    getAuthenticatedSessionForMode(ACCESS_MODES.DEVELOPMENT)?.accessMode,
    ACCESS_MODES.DEVELOPMENT,
  );
  assert.equal(getAuthenticatedSessionForMode(ACCESS_MODES.DEMO), null);
  assert.equal(
    getAuthenticatedAccessTokenForMode(ACCESS_MODES.DEMO),
    null,
  );
});

test("mode-mismatched session metadata is rejected and cleared", () => {
  const storage = createWindow();
  const developmentSessionKey = getAuthSessionStorageKey(ACCESS_MODES.DEVELOPMENT);

  storage.setItem(
    developmentSessionKey,
    JSON.stringify({
      access_token: "unsafe-token",
      accessMode: ACCESS_MODES.DEMO,
      user: {
        id: "user-1",
        role: "BARANGAY",
      },
    }),
  );

  assert.equal(getAuthenticatedSessionForMode(ACCESS_MODES.DEVELOPMENT), null);
  assert.equal(storage.getItem(developmentSessionKey), null);
});

test("selected role stays isolated by mode and invalid stored roles are removed", () => {
  const storage = createWindow();

  setCurrentRoleForMode("MSWDO", ACCESS_MODES.DEVELOPMENT);

  assert.equal(getStoredRoleForMode(ACCESS_MODES.DEVELOPMENT), "MSWDO");
  assert.equal(getStoredRoleForMode(ACCESS_MODES.DEMO), null);

  const demoRoleKey = getSelectedRoleStorageKey(ACCESS_MODES.DEMO);
  storage.setItem(demoRoleKey, "INVALID");

  assert.equal(getStoredRoleForMode(ACCESS_MODES.DEMO), null);
  assert.equal(storage.getItem(demoRoleKey), null);
});

test("role settings cache key includes mode user and role", () => {
  assert.equal(
    getRoleSettingsStorageKey({
      mode: ACCESS_MODES.DEVELOPMENT,
      roleCode: "BARANGAY",
      userId: "user-1",
    }),
    "distync:DEVELOPMENT:role-settings:BARANGAY:user-1",
  );
  assert.equal(
    getRoleSettingsStorageKey({
      mode: ACCESS_MODES.DEMO,
      roleCode: "BARANGAY",
      userId: "user-1",
    }),
    "distync:DEMO:role-settings:BARANGAY:user-1",
  );
});

test("offline database names differ between development and demo", () => {
  assert.equal(
    getOfflineDatabaseName(ACCESS_MODES.DEVELOPMENT),
    "distyncOfflineDb-DEVELOPMENT",
  );
  assert.equal(
    getOfflineDatabaseName(ACCESS_MODES.DEMO),
    "distyncOfflineDb-DEMO",
  );
});

test("new sync queue records include mode metadata and remain hidden across mode or account boundaries", () => {
  const developmentEntry = buildStoredSyncEntry(
    {
      id: "entry-1",
      actionKey: "HOUSEHOLD_REGISTER",
    },
    {
      accessMode: ACCESS_MODES.DEVELOPMENT,
      userId: "user-1",
      roleCode: "BARANGAY",
    },
  );

  assert.equal(developmentEntry.accessMode, ACCESS_MODES.DEVELOPMENT);
  assert.equal(developmentEntry.userId, "user-1");
  assert.equal(developmentEntry.roleCode, "BARANGAY");
  assert.equal(
    isSyncEntryVisibleForContext(developmentEntry, {
      accessMode: ACCESS_MODES.DEVELOPMENT,
      userId: "user-1",
      roleCode: "BARANGAY",
    }),
    true,
  );
  assert.equal(
    isSyncEntryVisibleForContext(developmentEntry, {
      accessMode: ACCESS_MODES.DEMO,
      userId: "user-1",
      roleCode: "BARANGAY",
    }),
    false,
  );
  assert.equal(
    isSyncEntryVisibleForContext(developmentEntry, {
      accessMode: ACCESS_MODES.DEVELOPMENT,
      userId: "user-2",
      roleCode: "BARANGAY",
    }),
    false,
  );
  assert.equal(
    isSyncEntryVisibleForContext(
      {
        id: "legacy-entry",
        actionKey: "HOUSEHOLD_REGISTER",
      },
      {
        accessMode: ACCESS_MODES.DEVELOPMENT,
        userId: "user-1",
        roleCode: "BARANGAY",
      },
    ),
    false,
  );
});

test("sync queue preserves the original client sync id when updating an unsynced grouped entry", async () => {
  const source = await fs.readFile(
    new URL("../src/offline/syncQueue.js", import.meta.url),
    "utf8",
  );

  assert.match(source, /id:\s*existingEntry\.id/);
  assert.match(source, /clientTimestamp:\s*existingEntry\.clientTimestamp/);
});

test("sync service does not mark in-progress replay responses as synced locally", async () => {
  const source = await fs.readFile(
    new URL("../src/offline/syncService.js", import.meta.url),
    "utf8",
  );

  assert.match(source, /isTerminalResult/);
  assert.match(source, /syncedAt:\s*isTerminalResult \? getIsoNow\(\) : null/);
});

test("runtime cache names differ by mode and cleanup targets only known distync caches", () => {
  assert.deepEqual(buildModeRuntimeCacheNames(ACCESS_MODES.DEVELOPMENT), [
    "distync-DEVELOPMENT-pages",
    "distync-DEVELOPMENT-shell",
    "distync-DEVELOPMENT-static-assets",
  ]);
  assert.deepEqual(buildModeRuntimeCacheNames(ACCESS_MODES.DEMO), [
    "distync-DEMO-pages",
    "distync-DEMO-shell",
    "distync-DEMO-static-assets",
  ]);

  assert.deepEqual(buildAllModeRuntimeCacheNames(), [
    "distync-DEVELOPMENT-pages",
    "distync-DEVELOPMENT-shell",
    "distync-DEVELOPMENT-static-assets",
    "distync-DEMO-pages",
    "distync-DEMO-shell",
    "distync-DEMO-static-assets",
  ]);

  assert.deepEqual(
    getKnownObsoleteCacheNames({
      previousMode: ACCESS_MODES.DEVELOPMENT,
      currentMode: ACCESS_MODES.DEMO,
    }).sort(),
    [
      "distync-DEVELOPMENT-pages",
      "distync-DEVELOPMENT-shell",
      "distync-DEVELOPMENT-static-assets",
      "distync-pages",
      "distync-shell",
      "distync-static-assets",
    ].sort(),
  );
});

test("mode switch cleanup removes unsafe sessions while same-mode reload keeps valid same-mode session", async () => {
  const switchedStorage = new MemoryStorage({
    [LAST_ACCESS_MODE_STORAGE_KEY]: ACCESS_MODES.DEVELOPMENT,
    [LEGACY_AUTH_SESSION_STORAGE_KEY]: "{\"access_token\":\"legacy-token\"}",
    [LEGACY_SELECTED_ROLE_STORAGE_KEY]: "MSWDO",
    [getAuthSessionStorageKey(ACCESS_MODES.DEVELOPMENT)]:
      "{\"access_token\":\"dev-token\"}",
    [getSelectedRoleStorageKey(ACCESS_MODES.DEVELOPMENT)]: "BARANGAY",
    [getAuthSessionStorageKey(ACCESS_MODES.DEMO)]:
      "{\"access_token\":\"demo-token\"}",
  });
  const deletedCaches = [];
  let legacyDatabaseCleanupCalls = 0;

  const modeSwitchResult = await prepareModeScopedBrowserState({
    currentMode: ACCESS_MODES.DEMO,
    storage: switchedStorage,
    cacheStorage: {
      delete: async (cacheName) => {
        deletedCaches.push(cacheName);
        return cacheName !== "unrelated-cache";
      },
    },
    deleteLegacyOfflineDatabase: async () => {
      legacyDatabaseCleanupCalls += 1;
      return true;
    },
  });

  assert.equal(modeSwitchResult.hasModeChanged, true);
  assert.equal(switchedStorage.getItem(LEGACY_AUTH_SESSION_STORAGE_KEY), null);
  assert.equal(
    switchedStorage.getItem(getAuthSessionStorageKey(ACCESS_MODES.DEVELOPMENT)),
    null,
  );
  assert.equal(
    switchedStorage.getItem(getAuthSessionStorageKey(ACCESS_MODES.DEMO)),
    null,
  );
  assert.equal(
    switchedStorage.getItem(LAST_ACCESS_MODE_STORAGE_KEY),
    ACCESS_MODES.DEMO,
  );
  assert.equal(legacyDatabaseCleanupCalls, 1);
  assert.match(deletedCaches.join(","), /distync-DEVELOPMENT-pages/);
  assert.match(deletedCaches.join(","), /distync-pages/);

  const sameModeStorage = new MemoryStorage({
    [LAST_ACCESS_MODE_STORAGE_KEY]: ACCESS_MODES.DEMO,
    [getAuthSessionStorageKey(ACCESS_MODES.DEMO)]:
      "{\"access_token\":\"demo-token\"}",
  });

  const sameModeResult = await prepareModeScopedBrowserState({
    currentMode: ACCESS_MODES.DEMO,
    storage: sameModeStorage,
    cacheStorage: {
      delete: async () => true,
    },
    deleteLegacyOfflineDatabase: async () => false,
  });

  assert.equal(sameModeResult.hasModeChanged, false);
  assert.equal(
    sameModeStorage.getItem(getAuthSessionStorageKey(ACCESS_MODES.DEMO)),
    "{\"access_token\":\"demo-token\"}",
  );
});

test("logout helpers clear only the targeted mode session key", () => {
  createWindow();

  setAuthenticatedSessionForMode(
    {
      access_token: "dev-token",
      user: {
        id: "user-1",
        role: "BARANGAY",
      },
    },
    ACCESS_MODES.DEVELOPMENT,
  );
  setAuthenticatedSessionForMode(
    {
      access_token: "demo-token",
      user: {
        id: "user-1",
        role: "BARANGAY",
      },
    },
    ACCESS_MODES.DEMO,
  );

  clearAuthenticatedSessionForMode(ACCESS_MODES.DEVELOPMENT);

  assert.equal(getAuthenticatedSessionForMode(ACCESS_MODES.DEVELOPMENT), null);
  assert.equal(
    getAuthenticatedSessionForMode(ACCESS_MODES.DEMO)?.access_token,
    "demo-token",
  );
});
