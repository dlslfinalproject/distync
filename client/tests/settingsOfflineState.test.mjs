import test from "node:test";
import assert from "node:assert/strict";

import { ACCESS_MODES } from "../src/utils/accessMode.js";
import {
  buildRoleSettingsCacheKey,
  loadRoleSettingsState,
  writeRoleSettingsCache,
} from "../src/features/settings/settingsService.js";

class MemoryStorage {
  constructor(initialEntries = {}) {
    this.map = new Map(Object.entries(initialEntries));
  }

  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }

  setItem(key, value) {
    this.map.set(key, String(value));
  }

  removeItem(key) {
    this.map.delete(key);
  }

  key(index) {
    return Array.from(this.map.keys())[index] || null;
  }

  get length() {
    return this.map.size;
  }
}

const createOfflineWindow = (storage = new MemoryStorage()) => {
  process.env.VITE_ACCESS_MODE = ACCESS_MODES.DEMO;
  globalThis.window = {
    localStorage: storage,
    location: {
      origin: "http://localhost:5173",
    },
    fetch: async () => {
      throw new Error("Failed to fetch");
    },
  };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    writable: true,
    value: {
      onLine: false,
    },
  });
  globalThis.fetch = globalThis.window.fetch;

  return storage;
};

test.afterEach(() => {
  delete globalThis.window;
  Reflect.deleteProperty(globalThis, "navigator");
  delete globalThis.fetch;
  delete process.env.VITE_ACCESS_MODE;
});

test("loadRoleSettingsState returns offline-empty when offline and no safe cache exists", async () => {
  createOfflineWindow();

  const result = await loadRoleSettingsState({
    roleCode: "BARANGAY",
    userId: "user-offline",
  });

  assert.equal(result.source, "offline-empty");
  assert.equal(
    result.errorMessage,
    "Connect to the internet to load your account settings.",
  );
});

test("loadRoleSettingsState returns cache when offline and safe cached settings exist", async () => {
  const storage = createOfflineWindow();

  writeRoleSettingsCache({
    mode: ACCESS_MODES.DEMO,
    roleCode: "BARANGAY",
    userId: "user-cache",
    settings: {
      roleCode: "BARANGAY",
      profile: {
        firstName: "Cached",
        lastName: "User",
        emailAddress: "cached@example.com",
      },
    },
  });

  const result = await loadRoleSettingsState({
    roleCode: "BARANGAY",
    userId: "user-cache",
  });

  assert.equal(result.source, "cache");
  assert.equal(result.settings.profile.firstName, "Cached");
  assert.notEqual(
    storage.getItem(
      buildRoleSettingsCacheKey({
        mode: ACCESS_MODES.DEMO,
        roleCode: "BARANGAY",
        userId: "user-cache",
      }),
    ),
    null,
  );
});
