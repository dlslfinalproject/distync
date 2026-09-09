export const MSWDO_OFFLINE_SUPPORTED_ROUTES = new Set([
  "/mswdo/consolidated-masterlist",
  "/mswdo/analytics",
  "/mswdo/analytics-dashboard",
]);

export const isMswdoOfflineBlockedRoute = (pathname) =>
  typeof pathname === "string" && pathname.startsWith("/mswdo/") &&
  !MSWDO_OFFLINE_SUPPORTED_ROUTES.has(pathname) && !pathname.endsWith("/sync");

export const MSWDO_OFFLINE_ACCESS_MESSAGE = "Connect online to access this page.";
