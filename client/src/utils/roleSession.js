const ROLE_STORAGE_KEY = "distync_selected_role";

export const ROLE_CODES = {
  BARANGAY: "BARANGAY",
  MSWDO: "MSWDO",
  MAYOR: "MAYOR",
  DONOR: "DONOR",
};

const validRoles = Object.values(ROLE_CODES);

export const getCurrentRole = () => {
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

export const getDefaultRouteForRole = (role) => {
  const defaultRoutes = {
    BARANGAY: "/barangay/masterlist",
    MSWDO: "/mswdo/disaster-events",
    MAYOR: "/inventory/items",
    DONOR: "/donations",
  };

  return defaultRoutes[role] || "/role-switcher";
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
