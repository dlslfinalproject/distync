import { getAccessMode } from "../../utils/accessMode.js";
import {
  getModeStorageKey,
  readStorageValue,
  removeStorageKey,
  removeStorageKeysByPrefix,
  writeStorageValue,
} from "../../utils/modeStorage.js";
import { ROLE_CODES } from "../../utils/roleSession.js";

const STORAGE_SEGMENT = "operational-disaster-event";
const EVENT_ID_FIELD = "event-id";
const EVENT_SCOPE_FIELD = "event-scope";
const EVENT_CONTEXT_FIELD = "event-context";
const DEFAULT_USER_SEGMENT = "anonymous";
const VALID_SCOPES = new Set(["active", "ended"]);

const getSessionStorage = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage;
};

const getDurableStorage = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
};

const usesDurableOperationalSelection = (roleCode) =>
  roleCode === ROLE_CODES.BARANGAY;

const normalizeRoleCode = (roleCode) =>
  Object.values(ROLE_CODES).includes(roleCode) ? roleCode : "UNKNOWN";

const normalizeUserSegment = (userId) =>
  encodeURIComponent(String(userId || DEFAULT_USER_SEGMENT));

const normalizeEventId = (eventId) => String(eventId ?? "").trim().toLowerCase();

const toOperationalDisasterEventSnapshot = (event) => {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    return null;
  }

  const id = String(event.id ?? "").trim();

  if (!id) {
    return null;
  }

  return Object.fromEntries(
    Object.entries({
      id,
      event_code: event.event_code,
      title: event.title,
      status: event.status,
      start_date: event.start_date,
      end_date: event.end_date,
      ended_at: event.ended_at,
      created_at: event.created_at,
    }).filter(([, value]) => value !== undefined),
  );
};

export const getOperationalDisasterEventStoragePrefix = ({
  roleCode,
  userId = "",
  mode = getAccessMode(),
}) =>
  getModeStorageKey(
    `${STORAGE_SEGMENT}:${normalizeRoleCode(roleCode)}:${normalizeUserSegment(
      userId,
    )}`,
    mode,
  );

const getOperationalDisasterEventStorageKey = ({
  roleCode,
  userId = "",
  field,
  mode = getAccessMode(),
}) => `${getOperationalDisasterEventStoragePrefix({ roleCode, userId, mode })}:${field}`;

const getOperationalDisasterEventContextStorageKey = ({
  roleCode,
  userId = "",
  mode = getAccessMode(),
}) =>
  getOperationalDisasterEventStorageKey({
    roleCode,
    userId,
    field: EVENT_CONTEXT_FIELD,
    mode,
  });

export const readOperationalDisasterEventId = ({
  roleCode,
  userId = "",
  mode = getAccessMode(),
} = {}) => {
  const key = getOperationalDisasterEventStorageKey({
    roleCode,
    userId,
    field: EVENT_ID_FIELD,
    mode,
  });
  const sessionValue = readStorageValue(key, getSessionStorage());

  if (sessionValue || !usesDurableOperationalSelection(roleCode)) {
    return sessionValue || "";
  }

  return readStorageValue(key, getDurableStorage()) || "";
};

export const readOperationalDisasterEventScope = ({
  roleCode,
  userId = "",
  mode = getAccessMode(),
} = {}) => {
  const key = getOperationalDisasterEventStorageKey({
    roleCode,
    userId,
    field: EVENT_SCOPE_FIELD,
    mode,
  });
  const sessionStorage = getSessionStorage();
  const storedScope =
    readStorageValue(key, sessionStorage) ||
    (usesDurableOperationalSelection(roleCode)
      ? readStorageValue(key, getDurableStorage())
      : "");

  return VALID_SCOPES.has(storedScope) ? storedScope : "";
};

export const readOperationalDisasterEventContext = ({
  roleCode,
  userId = "",
  eventScope = "",
  mode = getAccessMode(),
} = {}) => {
  const contextKey = getOperationalDisasterEventContextStorageKey({
    roleCode,
    userId,
    mode,
  });
  const contextValue =
    readStorageValue(contextKey, getSessionStorage()) ||
    (usesDurableOperationalSelection(roleCode)
      ? readStorageValue(contextKey, getDurableStorage())
      : "");

  if (!contextValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(contextValue);
    const storedEvent =
      parsedValue?.event && typeof parsedValue.event === "object"
        ? parsedValue.event
        : parsedValue;
    const eventSnapshot = toOperationalDisasterEventSnapshot(storedEvent);
    const selectedEventId = readOperationalDisasterEventId({
      roleCode,
      userId,
      mode,
    });

    if (
      !eventSnapshot ||
      normalizeEventId(eventSnapshot.id) !== normalizeEventId(selectedEventId)
    ) {
      return null;
    }

    const storedEventScope = parsedValue?.eventScope || "";

    if (
      VALID_SCOPES.has(eventScope) &&
      VALID_SCOPES.has(storedEventScope) &&
      storedEventScope !== eventScope
    ) {
      return null;
    }

    return eventSnapshot;
  } catch (_error) {
    return null;
  }
};

export const persistOperationalDisasterEventSelection = ({
  roleCode,
  userId = "",
  eventId = "",
  eventScope = "",
  event = null,
  mode = getAccessMode(),
  persistDurably = true,
} = {}) => {
  const storage = getSessionStorage();
  const durableStorage = persistDurably && usesDurableOperationalSelection(roleCode)
    ? getDurableStorage()
    : null;
  const eventIdKey = getOperationalDisasterEventStorageKey({
    roleCode,
    userId,
    field: EVENT_ID_FIELD,
    mode,
  });
  const eventScopeKey = getOperationalDisasterEventStorageKey({
    roleCode,
    userId,
    field: EVENT_SCOPE_FIELD,
    mode,
  });
  const eventContextKey = getOperationalDisasterEventContextStorageKey({
    roleCode,
    userId,
    mode,
  });
  const previousEventId = readStorageValue(eventIdKey, storage) || "";

  if (eventId) {
    writeStorageValue(eventIdKey, eventId, storage);
    writeStorageValue(eventIdKey, eventId, durableStorage);
  } else {
    removeStorageKey(eventIdKey, storage);
    removeStorageKey(eventContextKey, storage);
    removeStorageKey(eventIdKey, durableStorage);
    removeStorageKey(eventContextKey, durableStorage);
  }

  const eventSnapshot = toOperationalDisasterEventSnapshot(event);

  if (
    eventSnapshot &&
    normalizeEventId(eventSnapshot.id) === normalizeEventId(eventId)
  ) {
    writeStorageValue(
      eventContextKey,
      JSON.stringify({
        event: eventSnapshot,
        eventScope: VALID_SCOPES.has(eventScope) ? eventScope : "",
      }),
      storage,
    );
    writeStorageValue(
      eventContextKey,
      JSON.stringify({
        event: eventSnapshot,
        eventScope: VALID_SCOPES.has(eventScope) ? eventScope : "",
      }),
      durableStorage,
    );
  } else if (
    !eventId ||
    normalizeEventId(previousEventId) !== normalizeEventId(eventId)
  ) {
    removeStorageKey(eventContextKey, storage);
    removeStorageKey(eventContextKey, durableStorage);
  }

  if (VALID_SCOPES.has(eventScope)) {
    writeStorageValue(eventScopeKey, eventScope, storage);
    writeStorageValue(eventScopeKey, eventScope, durableStorage);
  }
};

export const clearOperationalDisasterEventSelection = ({
  roleCode,
  userId = "",
  mode = getAccessMode(),
} = {}) => {
  removeStorageKeysByPrefix(
    getOperationalDisasterEventStoragePrefix({ roleCode, userId, mode }),
    getSessionStorage(),
  );
  if (usesDurableOperationalSelection(roleCode)) {
    removeStorageKeysByPrefix(
      getOperationalDisasterEventStoragePrefix({ roleCode, userId, mode }),
      getDurableStorage(),
    );
  }
};

export const clearUserOperationalDisasterEventSelections = ({
  userId = "",
  mode = getAccessMode(),
} = {}) => {
  if (!userId) {
    return;
  }

  Object.values(ROLE_CODES).forEach((roleCode) => {
    clearOperationalDisasterEventSelection({ roleCode, userId, mode });
  });
};

export const resolveOperationalDisasterEventId = ({
  availableEvents,
  preferredEventId = "",
  fallbackEventId = "",
} = {}) => {
  const events = Array.isArray(availableEvents) ? availableEvents : [];

  if (
    preferredEventId &&
    events.some((event) => event?.id === preferredEventId)
  ) {
    return preferredEventId;
  }

  if (fallbackEventId && events.some((event) => event?.id === fallbackEventId)) {
    return fallbackEventId;
  }

  return events[0]?.id || "";
};
