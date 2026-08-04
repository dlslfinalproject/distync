import { ACCESS_MODES, getAccessMode } from "./accessMode.js";
import {
  getAuthSessionStorageKey,
  getSelectedRoleStorageKey,
  isStoredModeCurrent,
  removeStorageKey,
} from "./modeStorage.js";

export const AUTH_SESSION_INVALIDATED_EVENT =
  "distync:auth-session-invalidated";

let pendingAuthSessionInvalidation = null;

const createBrowserEvent = (eventName, detail) => {
  if (typeof CustomEvent === "function") {
    return new CustomEvent(eventName, { detail });
  }

  const fallbackEvent = new Event(eventName);
  fallbackEvent.detail = detail;
  return fallbackEvent;
};

const dispatchAuthSessionInvalidated = ({ mode, userId, reason }) => {
  pendingAuthSessionInvalidation = {
    mode,
    userId: userId || "",
    reason,
  };

  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    createBrowserEvent(
      AUTH_SESSION_INVALIDATED_EVENT,
      pendingAuthSessionInvalidation,
    ),
  );
};

export const consumePendingAuthSessionInvalidation = () => {
  const invalidation = pendingAuthSessionInvalidation;
  pendingAuthSessionInvalidation = null;
  return invalidation;
};

export const ROLE_CODES = {
  BARANGAY: "BARANGAY",
  MSWDO: "MSWDO",
  MAYOR: "MAYOR",
  DONOR: "DONOR",
};

const validRoles = Object.values(ROLE_CODES);

export const getStoredRoleForMode = (mode) => {
  const roleStorageKey = getSelectedRoleStorageKey(mode);
  const storedRole = window.localStorage.getItem(roleStorageKey);

  if (!validRoles.includes(storedRole)) {
    if (storedRole) {
      removeStorageKey(roleStorageKey);
    }

    return null;
  }

  return storedRole;
};

const getStoredRole = () => getStoredRoleForMode(getAccessMode());

export const setCurrentRole = (role) => {
  setCurrentRoleForMode(role, getAccessMode());
};

export const setCurrentRoleForMode = (role, mode) => {
  if (!validRoles.includes(role)) {
    return;
  }

  window.localStorage.setItem(getSelectedRoleStorageKey(mode), role);
};

export const clearCurrentRole = () => {
  clearCurrentRoleForMode(getAccessMode());
};

export const clearCurrentRoleForMode = (mode) => {
  removeStorageKey(getSelectedRoleStorageKey(mode));
};

export const getAuthenticatedSessionForMode = (mode) => {
  const sessionStorageKey = getAuthSessionStorageKey(mode);
  const storedValue = window.localStorage.getItem(sessionStorageKey);

  if (!storedValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(storedValue);
    const authenticatedRole = parsedValue?.user?.role;
    const storedMode = parsedValue?.accessMode;
    const storedUserId = parsedValue?.user?.id || "";

    if (
      !validRoles.includes(authenticatedRole) ||
      !isStoredModeCurrent(storedMode, mode)
    ) {
      dispatchAuthSessionInvalidated({
        mode,
        userId: storedUserId,
        reason: "stored-session-mismatch",
      });
      removeStorageKey(sessionStorageKey);
      return null;
    }

    return parsedValue;
  } catch (error) {
    dispatchAuthSessionInvalidated({
      mode,
      userId: "",
      reason: "stored-session-malformed",
    });
    removeStorageKey(sessionStorageKey);
    return null;
  }
};

export const getAuthenticatedSession = () => {
  return getAuthenticatedSessionForMode(getAccessMode());
};

export const getAuthenticatedUser = () => {
  return getAuthenticatedSession()?.user || null;
};

export const setAuthenticatedSession = (sessionPayload) => {
  setAuthenticatedSessionForMode(sessionPayload, getAccessMode());
};

export const setAuthenticatedSessionForMode = (sessionPayload, mode) => {
  const authenticatedRole = sessionPayload?.user?.role;
  if (!validRoles.includes(authenticatedRole)) {
    return;
  }

  window.localStorage.setItem(
    getAuthSessionStorageKey(mode),
    JSON.stringify({
      ...sessionPayload,
      accessMode: mode,
    }),
  );
};

export const updateAuthenticatedSessionUser = (userUpdates) => {
  const currentSession = getAuthenticatedSession();

  if (!currentSession || !userUpdates || typeof userUpdates !== "object") {
    return;
  }

  setAuthenticatedSession({
    ...currentSession,
    user: {
      ...currentSession.user,
      ...userUpdates,
    },
  });
};

export const clearAuthenticatedSession = () => {
  clearAuthenticatedSessionForMode(getAccessMode());
};

export const clearAuthenticatedSessionForMode = (mode) => {
  removeStorageKey(getAuthSessionStorageKey(mode));
};

export const clearAllAccessSessions = () => {
  clearCurrentRole();
  clearAuthenticatedSession();
};

export const getDefaultRouteForRole = (role) => {
  const defaultRoutes = {
    BARANGAY: "/barangay/masterlist",
    MSWDO: "/mswdo/disaster-events",
    MAYOR: "/inventory/items",
    DONOR: "/donations",
  };

  return defaultRoutes[role] || "/role-switcher";
};

export const getRoleForAccessMode = (mode = getAccessMode()) => {
  const authenticatedRole = getAuthenticatedSession()?.user?.role || null;
  const storedRole = getStoredRole();

  if (mode === ACCESS_MODES.DEMO) {
    if (authenticatedRole) {
      return authenticatedRole;
    }

    return storedRole === ROLE_CODES.DONOR ? ROLE_CODES.DONOR : null;
  }

  return storedRole;
};

export const getCurrentRole = () => {
  return getRoleForAccessMode(getAccessMode());
};

export const isRouteAllowedForRole = (role, pathname) => {
  if (!role || !pathname) {
    return false;
  }

  const allowedPrefixesByRole = {
    BARANGAY: ["/barangay/"],
    MSWDO: ["/mswdo/"],
    MAYOR: ["/inventory/"],
    DONOR: ["/donations", "/donor/"],
  };

  return (allowedPrefixesByRole[role] || []).some((prefix) => {
    if (prefix.endsWith("/")) {
      return pathname.startsWith(prefix);
    }

    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
};
