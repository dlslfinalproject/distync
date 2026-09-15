import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  acknowledgeOfflineReady,
  getOfflineReadyIdentity,
  isOfflineReadyAcknowledged,
  OFFLINE_READY_ACKNOWLEDGEMENTS_STORAGE_KEY,
} from "../src/components/layout/offlineReadyDismissal.js";

const storage = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  },
};

const diagnostics = (overrides = {}) => ({
  accessMode: "development",
  userId: "user-1",
  roleCode: "BARANGAY",
  disaster_event_id: "event-1",
  barangay_id: "barangay-1",
  cache_version: 2,
  readiness_generation: 1,
  ...overrides,
});

afterEach(() => storage.clear());

test("READY acknowledgement persists for the exact preparation identity", () => {
  const identity = getOfflineReadyIdentity({ readiness: "READY", diagnostics: diagnostics() });
  assert.equal(isOfflineReadyAcknowledged(identity), false);
  acknowledgeOfflineReady(identity);
  assert.equal(isOfflineReadyAcknowledged(identity), true);
  assert.equal(storage.has(OFFLINE_READY_ACKNOWLEDGEMENTS_STORAGE_KEY), true);
});

test("Barangay scoped diagnostics can use the existing nested cache version", () => {
  const source = diagnostics();
  delete source.cache_version;
  source.scope = { cacheVersion: 2 };
  const identity = getOfflineReadyIdentity({ readiness: "READY", diagnostics: source });
  assert.ok(identity);
});

test("same READY rerun and remount remain dismissed, while a new generation is eligible", () => {
  const identity = getOfflineReadyIdentity({ readiness: "READY", diagnostics: diagnostics() });
  acknowledgeOfflineReady(identity);
  assert.equal(isOfflineReadyAcknowledged(getOfflineReadyIdentity({ readiness: "READY", diagnostics: diagnostics() })), true);
  assert.equal(isOfflineReadyAcknowledged(getOfflineReadyIdentity({ readiness: "READY", diagnostics: diagnostics({ readiness_generation: 2 }) })), false);
});

test("event and Barangay scopes do not leak acknowledgement", () => {
  const identity = getOfflineReadyIdentity({ readiness: "READY", diagnostics: diagnostics() });
  acknowledgeOfflineReady(identity);
  assert.equal(isOfflineReadyAcknowledged(getOfflineReadyIdentity({ readiness: "READY", diagnostics: diagnostics({ disaster_event_id: "event-2" }) })), false);
  assert.equal(isOfflineReadyAcknowledged(getOfflineReadyIdentity({ readiness: "READY", diagnostics: diagnostics({ barangay_id: "barangay-2" }) })), false);
});

test("non-READY states have no acknowledgement identity", () => {
  assert.equal(getOfflineReadyIdentity({ readiness: "PREPARING", diagnostics: diagnostics() }), null);
  assert.equal(getOfflineReadyIdentity({ readiness: "NEEDS_REFRESH", diagnostics: diagnostics() }), null);
  assert.equal(getOfflineReadyIdentity({ readiness: "NOT_READY", diagnostics: diagnostics() }), null);
});
