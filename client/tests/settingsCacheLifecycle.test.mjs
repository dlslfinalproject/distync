import test from "node:test";
import assert from "node:assert/strict";

import { ACCESS_MODES } from "../src/utils/accessMode.js";
import { prepareModeScopedBrowserState } from "../src/utils/browserStorageIsolation.js";
import {
  AUTH_SESSION_INVALIDATED_EVENT,
  consumePendingAuthSessionInvalidation,
  getAuthenticatedSessionForMode,
} from "../src/utils/roleSession.js";
import {
  buildRoleSettingsCacheKey,
  clearLegacyRoleSettingsCaches,
  clearRoleSettingsCache,
  clearUserRoleSettingsCaches,
  loadRoleSettings,
  readRoleSettingsCache,
  writeRoleSettingsCache,
} from "../src/features/settings/settingsService.js";
import { installAuthenticatedFetch } from "../src/utils/apiClient.js";

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

const createWindow = (
  storage = new MemoryStorage(),
  { mode = ACCESS_MODES.DEMO } = {},
) => {
  const listeners = new Map();
  process.env.VITE_ACCESS_MODE = mode;

  globalThis.window = {
    localStorage: storage,
    location: {
      origin: "http://localhost:5173",
    },
    __distyncAuthenticatedFetchInstalled: false,
    addEventListener(type, handler) {
      const handlers = listeners.get(type) || new Set();
      handlers.add(handler);
      listeners.set(type, handlers);
    },
    removeEventListener(type, handler) {
      const handlers = listeners.get(type);

      if (!handlers) {
        return;
      }

      handlers.delete(handler);
    },
    dispatchEvent(event) {
      const handlers = listeners.get(event.type) || [];

      for (const handler of handlers) {
        handler(event);
      }

      return true;
    },
    fetch: async () =>
      new Response(JSON.stringify({ message: "ok" }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
  };

  globalThis.CustomEvent = class CustomEvent extends Event {
    constructor(type, init = {}) {
      super(type, init);
      this.detail = init.detail;
    }
  };
  globalThis.fetch = globalThis.window.fetch;

  return storage;
};

test.afterEach(() => {
  delete globalThis.window;
  delete globalThis.CustomEvent;
  delete globalThis.fetch;
  delete process.env.VITE_ACCESS_MODE;
});

test("same mode user and role cache is readable, while mismatched mode/user/role caches are rejected", () => {
  createWindow();

  writeRoleSettingsCache({
    mode: ACCESS_MODES.DEVELOPMENT,
    roleCode: "BARANGAY",
    userId: "user-1",
    settings: {
      profile: {
        firstName: "User",
        middleName: "",
        lastName: "One",
      },
    },
  });

  assert.equal(
    readRoleSettingsCache({
      mode: ACCESS_MODES.DEVELOPMENT,
      roleCode: "BARANGAY",
      userId: "user-1",
    })?.profile?.firstName,
    "User",
  );
  assert.equal(
    readRoleSettingsCache({
      mode: ACCESS_MODES.DEMO,
      roleCode: "BARANGAY",
      userId: "user-1",
    }),
    null,
  );
  assert.equal(
    readRoleSettingsCache({
      mode: ACCESS_MODES.DEVELOPMENT,
      roleCode: "MSWDO",
      userId: "user-1",
    }),
    null,
  );
  assert.equal(
    readRoleSettingsCache({
      mode: ACCESS_MODES.DEVELOPMENT,
      roleCode: "BARANGAY",
      userId: "user-2",
    }),
    null,
  );
});

test("envelope ownership mismatches and malformed role settings caches are removed", () => {
  const storage = createWindow();
  const storageKey = buildRoleSettingsCacheKey({
    mode: ACCESS_MODES.DEMO,
    roleCode: "MSWDO",
    userId: "user-1",
  });

  storage.setItem(
    storageKey,
    JSON.stringify({
      version: "2026-07-31-v2",
      accessMode: ACCESS_MODES.DEVELOPMENT,
      roleCode: "MSWDO",
      userId: "user-1",
      cachedAt: new Date("2026-07-31T08:00:00.000Z").toISOString(),
      data: {
        profile: {
          firstName: "Wrong",
          lastName: "Mode",
        },
      },
    }),
  );

  assert.equal(
    readRoleSettingsCache({
      mode: ACCESS_MODES.DEMO,
      roleCode: "MSWDO",
      userId: "user-1",
    }),
    null,
  );
  assert.equal(storage.getItem(storageKey), null);

  storage.setItem(storageKey, "{");

  assert.equal(
    readRoleSettingsCache({
      mode: ACCESS_MODES.DEMO,
      roleCode: "MSWDO",
      userId: "user-1",
    }),
    null,
  );
  assert.equal(storage.getItem(storageKey), null);
});

test("legacy role settings cache is removed and never reused", () => {
  const storage = createWindow(
    new MemoryStorage({
      "distync-role-settings:BARANGAY:user-1": JSON.stringify({
        profile: {
          firstName: "Legacy",
          lastName: "User",
        },
      }),
    }),
  );

  clearLegacyRoleSettingsCaches();

  assert.equal(storage.getItem("distync-role-settings:BARANGAY:user-1"), null);
});

test("current user logout cleanup removes only that user's role settings caches in the current mode", () => {
  const storage = createWindow();
  const userOneBarangayKey = buildRoleSettingsCacheKey({
    mode: ACCESS_MODES.DEMO,
    roleCode: "BARANGAY",
    userId: "user-1",
  });
  const userOneMswdoKey = buildRoleSettingsCacheKey({
    mode: ACCESS_MODES.DEMO,
    roleCode: "MSWDO",
    userId: "user-1",
  });
  const userTwoBarangayKey = buildRoleSettingsCacheKey({
    mode: ACCESS_MODES.DEMO,
    roleCode: "BARANGAY",
    userId: "user-2",
  });

  writeRoleSettingsCache({
    mode: ACCESS_MODES.DEMO,
    roleCode: "BARANGAY",
    userId: "user-1",
    settings: { profile: { firstName: "User One", lastName: "Barangay" } },
  });
  writeRoleSettingsCache({
    mode: ACCESS_MODES.DEMO,
    roleCode: "MSWDO",
    userId: "user-1",
    settings: { profile: { firstName: "User One", lastName: "MSWDO" } },
  });
  writeRoleSettingsCache({
    mode: ACCESS_MODES.DEMO,
    roleCode: "BARANGAY",
    userId: "user-2",
    settings: { profile: { firstName: "User Two", lastName: "Barangay" } },
  });

  clearUserRoleSettingsCaches({
    mode: ACCESS_MODES.DEMO,
    userId: "user-1",
  });

  assert.equal(storage.getItem(userOneBarangayKey), null);
  assert.equal(storage.getItem(userOneMswdoKey), null);
  assert.notEqual(storage.getItem(userTwoBarangayKey), null);
});

test("mode switch cleanup clears role settings caches for both development and demo without touching unrelated keys", async () => {
  const developmentKey = buildRoleSettingsCacheKey({
    mode: ACCESS_MODES.DEVELOPMENT,
    roleCode: "BARANGAY",
    userId: "dev-user",
  });
  const demoKey = buildRoleSettingsCacheKey({
    mode: ACCESS_MODES.DEMO,
    roleCode: "BARANGAY",
    userId: "demo-user",
  });
  const storage = createWindow(
    new MemoryStorage({
      "distync:unrelated:key": "keep-me",
      "distync:last-access-mode": ACCESS_MODES.DEVELOPMENT,
    }),
  );

  writeRoleSettingsCache({
    mode: ACCESS_MODES.DEVELOPMENT,
    roleCode: "BARANGAY",
    userId: "dev-user",
    settings: { profile: { firstName: "Dev", lastName: "User" } },
  });
  writeRoleSettingsCache({
    mode: ACCESS_MODES.DEMO,
    roleCode: "BARANGAY",
    userId: "demo-user",
    settings: { profile: { firstName: "Demo", lastName: "User" } },
  });

  await prepareModeScopedBrowserState({
    currentMode: ACCESS_MODES.DEMO,
    storage,
    cacheStorage: {
      delete: async () => true,
    },
    deleteLegacyOfflineDatabase: async () => false,
  });

  assert.equal(storage.getItem(developmentKey), null);
  assert.equal(storage.getItem(demoKey), null);
  assert.equal(storage.getItem("distync:unrelated:key"), "keep-me");
});

test("same-owner offline fallback is allowed on network failure, while authentication failure clears the current cache", async () => {
  createWindow();

  writeRoleSettingsCache({
    mode: ACCESS_MODES.DEVELOPMENT,
    roleCode: "BARANGAY",
    userId: "user-1",
    settings: {
      profile: {
        firstName: "Offline",
        lastName: "User",
      },
    },
  });

  globalThis.fetch = async () => {
    throw new Error("Failed to fetch");
  };

  const cachedSettings = await loadRoleSettings({
    mode: ACCESS_MODES.DEVELOPMENT,
    roleCode: "BARANGAY",
    userId: "user-1",
  });

  assert.equal(cachedSettings.profile.firstName, "Offline");

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ message: "Unauthorized" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
      },
    });

  const unauthorizedSettings = await loadRoleSettings({
    mode: ACCESS_MODES.DEVELOPMENT,
    roleCode: "BARANGAY",
    userId: "user-1",
  });

  assert.equal(unauthorizedSettings.profile?.firstName || "", "");
  assert.equal(
    readRoleSettingsCache({
      mode: ACCESS_MODES.DEVELOPMENT,
      roleCode: "BARANGAY",
      userId: "user-1",
    }),
    null,
  );
});

test("invalid stored auth sessions record a pending invalidation with the previous user id when available", () => {
  const storage = createWindow();
  const sessionKey = "distync:DEMO:auth-session";

  storage.setItem(
    sessionKey,
    JSON.stringify({
      access_token: "demo-token",
      accessMode: ACCESS_MODES.DEVELOPMENT,
      user: {
        id: "user-1",
        role: "BARANGAY",
      },
    }),
  );

  assert.equal(getAuthenticatedSessionForMode(ACCESS_MODES.DEMO), null);
  assert.deepEqual(consumePendingAuthSessionInvalidation(), {
    mode: ACCESS_MODES.DEMO,
    userId: "user-1",
    reason: "stored-session-mismatch",
  });
});

test("authenticated fetch dispatches an auth invalidation event on API 401 responses", async () => {
  const storage = createWindow();
  const receivedEvents = [];

  storage.setItem(
    "distync:DEMO:auth-session",
    JSON.stringify({
      access_token: "demo-token",
      accessMode: ACCESS_MODES.DEMO,
      user: {
        id: "user-1",
        role: "BARANGAY",
      },
    }),
  );

  window.addEventListener(AUTH_SESSION_INVALIDATED_EVENT, (event) => {
    receivedEvents.push(event.detail);
  });

  window.fetch = async () =>
    new Response(JSON.stringify({ message: "Unauthorized" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
      },
    });
  globalThis.fetch = window.fetch;

  installAuthenticatedFetch();

  await window.fetch("http://localhost:5000/api/v1/settings/current");

  assert.deepEqual(receivedEvents, [
    {
      mode: ACCESS_MODES.DEMO,
      userId: "user-1",
      reason: "api-401",
    },
  ]);
});

test("targeted single-entry cache cleanup leaves unrelated storage untouched", () => {
  const storage = createWindow(
    new MemoryStorage({
      "distync:DEMO:registration:selected-disaster-event-id": "evt-1",
    }),
  );

  writeRoleSettingsCache({
    mode: ACCESS_MODES.DEMO,
    roleCode: "BARANGAY",
    userId: "user-1",
    settings: { profile: { firstName: "User", lastName: "One" } },
  });

  clearRoleSettingsCache({
    mode: ACCESS_MODES.DEMO,
    roleCode: "BARANGAY",
    userId: "user-1",
  });

  assert.equal(
    storage.getItem("distync:DEMO:registration:selected-disaster-event-id"),
    "evt-1",
  );
});

test("role settings cache strips unsafe profile picture sources and keeps only safe metadata", () => {
  createWindow();

  writeRoleSettingsCache({
    mode: ACCESS_MODES.DEMO,
    roleCode: "BARANGAY",
    userId: "user-1",
    settings: {
      profile: {
        profilePicturePath: "user-1/avatar.webp",
        profilePictureUrl: "data:image/png;base64,ZmFrZQ==",
        profilePictureUrlExpiresAt: "2099-01-01T00:00:00.000Z",
        profilePictureFileName: "avatar.webp",
        profilePictureUpdatedAt: "2026-07-31T09:00:00.000Z",
      },
    },
  });

  const cachedSettings = readRoleSettingsCache({
    mode: ACCESS_MODES.DEMO,
    roleCode: "BARANGAY",
    userId: "user-1",
  });

  assert.equal(cachedSettings.profile.profilePicturePath, "user-1/avatar.webp");
  assert.equal(cachedSettings.profile.profilePictureUrl, "");
  assert.equal(
    cachedSettings.profile.profilePictureUrlExpiresAt,
    "",
  );
  assert.equal(
    cachedSettings.profile.profilePictureFileName,
    "avatar.webp",
  );
});

test("expired signed profile picture URLs are not reused from cache", () => {
  createWindow();

  writeRoleSettingsCache({
    mode: ACCESS_MODES.DEMO,
    roleCode: "MSWDO",
    userId: "user-2",
    settings: {
      profile: {
        profilePicturePath: "user-2/avatar.jpg",
        profilePictureUrl:
          "https://your-project.supabase.co/storage/v1/object/sign/distync-profile-pictures/user-2/avatar.jpg?token=expired",
        profilePictureUrlExpiresAt: "2026-07-31T08:00:00.000Z",
      },
    },
  });

  const cachedSettings = readRoleSettingsCache({
    mode: ACCESS_MODES.DEMO,
    roleCode: "MSWDO",
    userId: "user-2",
  });

  assert.equal(cachedSettings.profile.profilePicturePath, "user-2/avatar.jpg");
  assert.equal(cachedSettings.profile.profilePictureUrl, "");
  assert.equal(cachedSettings.profile.profilePictureUrlExpiresAt, "");
});
