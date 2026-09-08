export const BARANGAY_MASTERLIST_ROUTE = "/barangay/masterlist";
export const BARANGAY_STUB_DISTRIBUTION_ROUTE = "/barangay/stub-distribution";
export const BARANGAY_DISTRIBUTION_TRANSACTION_ROUTE =
  "/barangay/distribution-transaction";
export const BARANGAY_SYNC_CENTER_ROUTE = "/barangay/sync";
export const BARANGAY_OFFLINE_ACCESS_MESSAGE = "Connect online to access this page.";

// The distribution transaction route is not a sidebar tab, but it is part of
// the supported offline relief-claim flow and must remain reachable.
export const isBarangayOfflineRouteAvailable = (pathname) =>
  [
    BARANGAY_MASTERLIST_ROUTE,
    BARANGAY_STUB_DISTRIBUTION_ROUTE,
    BARANGAY_DISTRIBUTION_TRANSACTION_ROUTE,
    BARANGAY_SYNC_CENTER_ROUTE,
  ].includes(pathname);

export const isBarangayOfflineBlockedRoute = (pathname) =>
  typeof pathname === "string" &&
  pathname.startsWith("/barangay/") &&
  !isBarangayOfflineRouteAvailable(pathname);
