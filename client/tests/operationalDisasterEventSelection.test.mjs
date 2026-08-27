import test from "node:test";
import assert from "node:assert/strict";

import { ACCESS_MODES } from "../src/utils/accessMode.js";
import { ROLE_CODES } from "../src/utils/roleSession.js";
import {
  clearUserOperationalDisasterEventSelections,
  getOperationalDisasterEventStoragePrefix,
  persistOperationalDisasterEventSelection,
  readOperationalDisasterEventContext,
  readOperationalDisasterEventId,
  readOperationalDisasterEventScope,
  resolveOperationalDisasterEventId,
} from "../src/features/disaster-events/operationalDisasterEventSelection.js";

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

const createWindow = () => {
  globalThis.window = {
    localStorage: new MemoryStorage(),
    sessionStorage: new MemoryStorage(),
  };
};

test.afterEach(() => {
  delete globalThis.window;
});

test("operational disaster event selection is scoped by role and user in session storage", () => {
  createWindow();

  persistOperationalDisasterEventSelection({
    roleCode: ROLE_CODES.BARANGAY,
    userId: "user-1",
    eventId: "event-a",
    eventScope: "active",
    mode: ACCESS_MODES.DEVELOPMENT,
  });
  persistOperationalDisasterEventSelection({
    roleCode: ROLE_CODES.MSWDO,
    userId: "user-1",
    eventId: "event-b",
    eventScope: "ended",
    mode: ACCESS_MODES.DEVELOPMENT,
  });

  assert.equal(
    readOperationalDisasterEventId({
      roleCode: ROLE_CODES.BARANGAY,
      userId: "user-1",
      mode: ACCESS_MODES.DEVELOPMENT,
    }),
    "event-a",
  );
  assert.equal(
    readOperationalDisasterEventId({
      roleCode: ROLE_CODES.MSWDO,
      userId: "user-1",
      mode: ACCESS_MODES.DEVELOPMENT,
    }),
    "event-b",
  );
  assert.equal(
    readOperationalDisasterEventId({
      roleCode: ROLE_CODES.BARANGAY,
      userId: "user-2",
      mode: ACCESS_MODES.DEVELOPMENT,
    }),
    "",
  );
  assert.equal(
    readOperationalDisasterEventScope({
      roleCode: ROLE_CODES.MSWDO,
      userId: "user-1",
      mode: ACCESS_MODES.DEVELOPMENT,
    }),
    "ended",
  );
});

test("operational disaster event selection falls back only when stored event is unavailable", () => {
  const availableEvents = [{ id: "event-a" }, { id: "event-b" }];

  assert.equal(
    resolveOperationalDisasterEventId({
      availableEvents,
      preferredEventId: "event-b",
      fallbackEventId: "event-a",
    }),
    "event-b",
  );
  assert.equal(
    resolveOperationalDisasterEventId({
      availableEvents,
      preferredEventId: "event-z",
      fallbackEventId: "event-a",
    }),
    "event-a",
  );
});

test("operational disaster event context is persisted for offline restoration", () => {
  createWindow();

  persistOperationalDisasterEventSelection({
    roleCode: ROLE_CODES.BARANGAY,
    userId: "user-1",
    eventId: "event-a",
    eventScope: "active",
    event: {
      id: "event-a",
      title: "Typhoon Relief",
      event_code: "DE-2026-0001",
      status: "ACTIVE",
      start_date: "2026-08-01",
      private_field: "must not be persisted",
    },
    mode: ACCESS_MODES.DEVELOPMENT,
  });

  assert.deepEqual(
    readOperationalDisasterEventContext({
      roleCode: ROLE_CODES.BARANGAY,
      userId: "user-1",
      eventScope: "active",
      mode: ACCESS_MODES.DEVELOPMENT,
    }),
    {
      id: "event-a",
      title: "Typhoon Relief",
      event_code: "DE-2026-0001",
      status: "ACTIVE",
      start_date: "2026-08-01",
    },
  );
  assert.equal(
    readOperationalDisasterEventContext({
      roleCode: ROLE_CODES.BARANGAY,
      userId: "user-1",
      eventScope: "ended",
      mode: ACCESS_MODES.DEVELOPMENT,
    }),
    null,
  );
});

test("user operational disaster event selections can be cleared on logout", () => {
  createWindow();

  persistOperationalDisasterEventSelection({
    roleCode: ROLE_CODES.BARANGAY,
    userId: "user-1",
    eventId: "event-a",
    eventScope: "active",
    mode: ACCESS_MODES.DEVELOPMENT,
  });
  persistOperationalDisasterEventSelection({
    roleCode: ROLE_CODES.MSWDO,
    userId: "user-1",
    eventId: "event-b",
    eventScope: "active",
    mode: ACCESS_MODES.DEVELOPMENT,
  });

  clearUserOperationalDisasterEventSelections({
    userId: "user-1",
    mode: ACCESS_MODES.DEVELOPMENT,
  });

  assert.equal(
    readOperationalDisasterEventId({
      roleCode: ROLE_CODES.BARANGAY,
      userId: "user-1",
      mode: ACCESS_MODES.DEVELOPMENT,
    }),
    "",
  );
  assert.equal(
    readOperationalDisasterEventId({
      roleCode: ROLE_CODES.MSWDO,
      userId: "user-1",
      mode: ACCESS_MODES.DEVELOPMENT,
    }),
    "",
  );
  assert.match(
    getOperationalDisasterEventStoragePrefix({
      roleCode: ROLE_CODES.BARANGAY,
      userId: "user-1",
      mode: ACCESS_MODES.DEVELOPMENT,
    }),
    /^distync:DEVELOPMENT:operational-disaster-event:BARANGAY:user-1$/,
  );
});
