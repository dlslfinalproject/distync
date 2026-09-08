import test from "node:test";
import assert from "node:assert/strict";

import { ACCESS_MODES, configureAccessMode } from "../src/utils/accessMode.js";
import {
  consumePendingAuthSessionInvalidation,
  getAuthenticatedSessionExpiresAt,
  getAuthenticatedSessionForMode,
  isAuthenticatedSessionExpired,
  setAuthenticatedSessionForMode,
} from "../src/utils/roleSession.js";
import { getAuthSessionStorageKey } from "../src/utils/modeStorage.js";

class MemoryStorage {
  constructor() {
    this.map = new Map();
  }

  get length() {
    return this.map.size;
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

const encodeJwtSegment = (value) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

const buildJwtWithExpiry = (expiresAt) =>
  [
    encodeJwtSegment({ alg: "none", typ: "JWT" }),
    encodeJwtSegment({ exp: Math.floor(expiresAt / 1000) }),
    "signature",
  ].join(".");

const createWindow = () => {
  const events = [];
  const storage = new MemoryStorage();

  globalThis.window = {
    localStorage: storage,
    dispatchEvent(event) {
      events.push(event);
      return true;
    },
  };

  configureAccessMode({ VITE_ACCESS_MODE: ACCESS_MODES.DEVELOPMENT });

  return { events, storage };
};

test.afterEach(() => {
  consumePendingAuthSessionInvalidation();
  delete globalThis.window;
});

test("a valid JWT session remains available after it is read from durable storage", () => {
  const { storage } = createWindow();
  const expiresAt = Date.now() + 60_000;
  const session = {
    access_token: buildJwtWithExpiry(expiresAt),
    user: { id: "user-1", role: "MAYOR" },
  };

  setAuthenticatedSessionForMode(session, ACCESS_MODES.DEVELOPMENT);

  assert.equal(
    getAuthenticatedSessionForMode(ACCESS_MODES.DEVELOPMENT)?.user.id,
    "user-1",
  );
  assert.equal(
    getAuthenticatedSessionExpiresAt(session),
    Math.floor(expiresAt / 1000) * 1000,
  );
  assert.equal(
    storage.getItem(getAuthSessionStorageKey(ACCESS_MODES.DEVELOPMENT)) !== null,
    true,
  );
});

test("an expired JWT session is cleared locally without removing offline data", () => {
  const { events, storage } = createWindow();
  const sessionKey = getAuthSessionStorageKey(ACCESS_MODES.DEVELOPMENT);
  const session = {
    access_token: buildJwtWithExpiry(Date.now() - 60_000),
    user: { id: "user-1", role: "BARANGAY" },
  };

  setAuthenticatedSessionForMode(session, ACCESS_MODES.DEVELOPMENT);

  assert.equal(isAuthenticatedSessionExpired(session), true);
  assert.equal(getAuthenticatedSessionForMode(ACCESS_MODES.DEVELOPMENT), null);
  assert.equal(storage.getItem(sessionKey), null);
  assert.equal(events.at(-1)?.detail?.reason, "session-expired");
});

test("legacy sessions without a readable JWT expiry remain compatible", () => {
  createWindow();
  const session = {
    access_token: "development-test-token",
    user: { id: "user-1", role: "MAYOR" },
  };

  setAuthenticatedSessionForMode(session, ACCESS_MODES.DEVELOPMENT);

  assert.equal(
    getAuthenticatedSessionForMode(ACCESS_MODES.DEVELOPMENT)?.access_token,
    "development-test-token",
  );
  assert.equal(isAuthenticatedSessionExpired(session), false);
});
