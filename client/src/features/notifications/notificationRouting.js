import { ROLE_CODES } from "../../utils/roleSession";

const getNotificationHomeRoute = (roleCode) => {
  if (roleCode === ROLE_CODES.BARANGAY) return "/barangay/notifications";
  if (roleCode === ROLE_CODES.MSWDO) return "/mswdo/notifications";
  return "/inventory/notifications";
};

const routeForRole = (roleCode, routes, label) => {
  const to = routes[roleCode];
  return to ? { to, label, kind: "destination" } : null;
};

// This allow-list deliberately maps stable reference types to routes already protected
// by the application. Notification records never supply a URL to navigate to.
export const getNotificationDeepLink = (notification, roleCode) => {
  const home = getNotificationHomeRoute(roleCode);
  const type = String(notification?.type || "EVENT").toUpperCase();
  const referenceType = String(notification?.reference_type || "").toUpperCase();

  if (type === "SUMMARY" || referenceType === "NOTIFICATION_SUMMARY") {
    return { to: home, label: "Open details", kind: "details" };
  }

  const destinations = {
    INVENTORY_ITEM: routeForRole(roleCode, { [ROLE_CODES.MAYOR]: "/inventory/items" }, "Open inventory"),
    INVENTORY_BATCH: routeForRole(roleCode, { [ROLE_CODES.MAYOR]: "/inventory/batches" }, "Open inventory"),
    INVENTORY_TRANSACTION: routeForRole(roleCode, { [ROLE_CODES.MAYOR]: "/inventory/transactions" }, "Open inventory tracking"),
    DONATION: routeForRole(roleCode, { [ROLE_CODES.MAYOR]: "/inventory/donations" }, "Open donations"),
    DONATION_ITEM: routeForRole(roleCode, { [ROLE_CODES.MAYOR]: "/inventory/donations" }, "Open donations"),
    DISASTER_EVENT: routeForRole(roleCode, { [ROLE_CODES.BARANGAY]: "/barangay/masterlist", [ROLE_CODES.MSWDO]: "/mswdo/disaster-events" }, "Open disaster context"),
    HOUSEHOLD: routeForRole(roleCode, { [ROLE_CODES.BARANGAY]: "/barangay/masterlist", [ROLE_CODES.MSWDO]: "/mswdo/consolidated-masterlist" }, "Open masterlist"),
    DISTRIBUTION: routeForRole(roleCode, { [ROLE_CODES.BARANGAY]: "/barangay/distribution-history", [ROLE_CODES.MSWDO]: "/mswdo/distribution-history", [ROLE_CODES.MAYOR]: "/inventory/distribution-history" }, "Open distribution"),
    DISTRIBUTION_TRANSACTION: routeForRole(roleCode, { [ROLE_CODES.BARANGAY]: "/barangay/distribution-history", [ROLE_CODES.MSWDO]: "/mswdo/distribution-history", [ROLE_CODES.MAYOR]: "/inventory/distribution-history" }, "Open distribution"),
    STUB: routeForRole(roleCode, { [ROLE_CODES.BARANGAY]: "/barangay/stub-distribution", [ROLE_CODES.MSWDO]: "/mswdo/stub-distribution" }, "Open distribution"),
    SYNC_TRANSACTION: routeForRole(roleCode, { [ROLE_CODES.BARANGAY]: "/barangay/sync", [ROLE_CODES.MSWDO]: "/mswdo/sync", [ROLE_CODES.MAYOR]: "/inventory/sync" }, "Open Sync Center"),
    SYNC_CONFLICT: routeForRole(roleCode, { [ROLE_CODES.BARANGAY]: "/barangay/sync", [ROLE_CODES.MSWDO]: "/mswdo/sync", [ROLE_CODES.MAYOR]: "/inventory/sync" }, "Open Sync Center"),
  };

  return destinations[referenceType] || { to: home, label: "Open details", kind: "details" };
};

export const getNotificationHomeRouteByRole = getNotificationHomeRoute;
