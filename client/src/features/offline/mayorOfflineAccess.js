export const MAYOR_INVENTORY_ITEMS_ROUTE = "/inventory/items";
export const MAYOR_SYNC_CENTER_ROUTE = "/inventory/sync";
export const MAYOR_OFFLINE_ACCESS_MESSAGE = "Connect online to access this page.";

export const isMayorOfflineRouteAvailable = (pathname) =>
  pathname === MAYOR_INVENTORY_ITEMS_ROUTE ||
  pathname === MAYOR_SYNC_CENTER_ROUTE;

export const isMayorOfflineBlockedRoute = (pathname) =>
  typeof pathname === "string" &&
  pathname.startsWith("/inventory/") &&
  !isMayorOfflineRouteAvailable(pathname);
