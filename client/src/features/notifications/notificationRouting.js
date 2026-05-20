import { ROLE_CODES } from "../../utils/roleSession";

const getNotificationHomeRoute = (roleCode) => {
  if (roleCode === ROLE_CODES.BARANGAY) {
    return "/barangay/notifications";
  }

  if (roleCode === ROLE_CODES.MSWDO) {
    return "/mswdo/notifications";
  }

  return "/inventory/notifications";
};

export const getNotificationDeepLink = (notification, roleCode) => {
  const referenceType = String(notification?.reference_type || "").toUpperCase();
  const referenceId = notification?.reference_id || "";
  const notificationHomeRoute = getNotificationHomeRoute(roleCode);

  switch (referenceType) {
    case "INVENTORY_ITEM":
      return {
        to: "/inventory/items",
        label: "Open inventory items",
      };
    case "INVENTORY_BATCH":
      return {
        to: "/inventory/batches",
        label: "Open inventory batches",
      };
    case "INVENTORY_TRANSACTION":
      return {
        to: "/inventory/transactions",
        label: "Open inventory tracking",
      };
    case "DONATION":
    case "DONATION_ITEM":
      return {
        to:
          roleCode === ROLE_CODES.MSWDO
            ? "/mswdo/donations"
            : "/inventory/donations",
        label: "Open donations",
      };
    case "DISASTER_EVENT":
      if (roleCode === ROLE_CODES.MSWDO) {
        return {
          to: "/mswdo/disaster-events",
          label: "Open disaster events",
        };
      }

      return {
        to: roleCode === ROLE_CODES.BARANGAY ? "/barangay/masterlist" : notificationHomeRoute,
        label:
          roleCode === ROLE_CODES.BARANGAY
            ? "Open barangay masterlist"
            : "Open notifications",
      };
    case "HOUSEHOLD":
      return {
        to:
          roleCode === ROLE_CODES.MSWDO
            ? "/mswdo/consolidated-masterlist"
            : "/barangay/masterlist",
        label:
          roleCode === ROLE_CODES.MSWDO
            ? "Open masterlist"
            : "Open barangay masterlist",
      };
    case "DISTRIBUTION_TRANSACTION":
    case "STUB":
      return {
        to:
          roleCode === ROLE_CODES.MSWDO
            ? "/mswdo/stub-distribution"
            : "/barangay/stub-distribution",
        label: "Open distribution",
      };
    case "SYNC_TRANSACTION":
    case "SYNC_CONFLICT":
      return {
        to: notificationHomeRoute,
        label: "View sync alert",
        note: "Full sync management is a future enhancement. Review this alert here for now.",
      };
    default:
      return {
        to: notificationHomeRoute,
        label: "View notification",
        referenceId,
      };
  }
};

export const getNotificationHomeRouteByRole = getNotificationHomeRoute;
