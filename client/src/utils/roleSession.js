import { ACCESS_MODES, getAccessMode } from "./accessMode";

const ROLE_STORAGE_KEY = "distync_selected_role";
const AUTH_SESSION_STORAGE_KEY = "distync_auth_session";

export const ROLE_CODES = {
  BARANGAY: "BARANGAY",
  MSWDO: "MSWDO",
  MAYOR: "MAYOR",
  DONOR: "DONOR",
};

const validRoles = Object.values(ROLE_CODES);

const getStoredRole = () => {
  const storedRole = window.localStorage.getItem(ROLE_STORAGE_KEY);
  return validRoles.includes(storedRole) ? storedRole : null;
};

export const setCurrentRole = (role) => {
  if (!validRoles.includes(role)) {
    return;
  }

  window.localStorage.setItem(ROLE_STORAGE_KEY, role);
};

export const clearCurrentRole = () => {
  window.localStorage.removeItem(ROLE_STORAGE_KEY);
};

export const getAuthenticatedSession = () => {
  const storedValue = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);

  if (!storedValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(storedValue);
    const authenticatedRole = parsedValue?.user?.role;

    if (!validRoles.includes(authenticatedRole)) {
      return null;
    }

    return parsedValue;
  } catch (error) {
    return null;
  }
};

export const getAuthenticatedUser = () => {
  return getAuthenticatedSession()?.user || null;
};

export const setAuthenticatedSession = (sessionPayload) => {
  const authenticatedRole = sessionPayload?.user?.role;

  if (!validRoles.includes(authenticatedRole)) {
    return;
  }

  window.localStorage.setItem(
    AUTH_SESSION_STORAGE_KEY,
    JSON.stringify(sessionPayload),
  );
};

export const clearAuthenticatedSession = () => {
  window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
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

  if (mode === ACCESS_MODES.DEMO || mode === ACCESS_MODES.PRODUCTION) {
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
