export const MSWDO_OFFLINE_SUPPORTED_ROUTES = new Set([
  "/mswdo/consolidated-masterlist",
  "/mswdo/stub-distribution",
]);
export const MSWDO_OFFLINE_READINESS_ROUTES = new Set([
  "/mswdo/consolidated-masterlist",
  "/mswdo/stub-distribution",
]);
export const MSWDO_OFFLINE_DISTRIBUTION_ROUTE = "/mswdo/stub-distribution";
export const MSWDO_OFFLINE_SYNC_ROUTE = "/mswdo/sync";

export const isMswdoOfflineBlockedRoute = (pathname, { isPrepared = true } = {}) =>
  typeof pathname === "string" && pathname.startsWith("/mswdo/") &&
  ((!MSWDO_OFFLINE_SUPPORTED_ROUTES.has(pathname) && pathname !== MSWDO_OFFLINE_SYNC_ROUTE) ||
    (pathname === MSWDO_OFFLINE_DISTRIBUTION_ROUTE && !isPrepared));

export const MSWDO_OFFLINE_ACCESS_MESSAGE = "Connect online to access this page.";
