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
const DEFAULT_USER_SEGMENT = "anonymous";
const VALID_SCOPES = new Set(["active", "ended"]);

const getSessionStorage = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage;
};

const normalizeRoleCode = (roleCode) =>
  Object.values(ROLE_CODES).includes(roleCode) ? roleCode : "UNKNOWN";

const normalizeUserSegment = (userId) =>
  encodeURIComponent(String(userId || DEFAULT_USER_SEGMENT));

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

export const readOperationalDisasterEventId = ({
  roleCode,
  userId = "",
  mode = getAccessMode(),
} = {}) =>
  readStorageValue(
    getOperationalDisasterEventStorageKey({
      roleCode,
      userId,
      field: EVENT_ID_FIELD,
      mode,
    }),
    getSessionStorage(),
  ) || "";

export const readOperationalDisasterEventScope = ({
  roleCode,
  userId = "",
  mode = getAccessMode(),
} = {}) => {
  const storedScope = readStorageValue(
    getOperationalDisasterEventStorageKey({
      roleCode,
      userId,
      field: EVENT_SCOPE_FIELD,
      mode,
    }),
    getSessionStorage(),
  );

  return VALID_SCOPES.has(storedScope) ? storedScope : "";
};

export const persistOperationalDisasterEventSelection = ({
  roleCode,
  userId = "",
  eventId = "",
  eventScope = "",
  mode = getAccessMode(),
} = {}) => {
  const storage = getSessionStorage();
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

  if (eventId) {
    writeStorageValue(eventIdKey, eventId, storage);
  } else {
    removeStorageKey(eventIdKey, storage);
  }

  if (VALID_SCOPES.has(eventScope)) {
    writeStorageValue(eventScopeKey, eventScope, storage);
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
