export const SYSTEM_CONNECTION_STATUSES = {
  CHECKING: "CHECKING",
  ONLINE: "ONLINE",
  OFFLINE: "OFFLINE",
  LIMITED: "LIMITED",
  UNABLE_TO_VERIFY: "UNABLE_TO_VERIFY",
};

export const SERVICE_WORKER_STATUSES = {
  CHECKING: "CHECKING",
  ACTIVE: "ACTIVE",
  INSTALLING: "INSTALLING",
  WAITING: "WAITING",
  NOT_REGISTERED: "NOT_REGISTERED",
  REGISTRATION_FAILED: "REGISTRATION_FAILED",
  UNSUPPORTED: "UNSUPPORTED",
};

export const getApplicationVersion = () => {
  if (typeof __APP_VERSION__ === "string" && __APP_VERSION__.trim()) {
    return __APP_VERSION__.trim();
  }

  return "Not available";
};

export const getOfflineFeatureDescription = (roleCode) => {
  switch (roleCode) {
    case "BARANGAY":
    case "MSWDO":
      return "Evacuee registration, departure updates, and relief claim confirmation";
    case "MAYOR":
      return "Inventory inflow recording, donation encoding, and inventory item updates";
    default:
      return "Evacuee registration, departure updates, relief claim confirmation, and inventory inflow recording";
  }
};

export const getConnectionDisplay = (status) => {
  switch (status) {
    case SYSTEM_CONNECTION_STATUSES.ONLINE:
      return { label: "Online", tone: "success" };
    case SYSTEM_CONNECTION_STATUSES.OFFLINE:
      return { label: "Offline", tone: "info" };
    case SYSTEM_CONNECTION_STATUSES.LIMITED:
      return { label: "Limited connectivity", tone: "warning" };
    case SYSTEM_CONNECTION_STATUSES.CHECKING:
      return { label: "Checking connection", tone: "info" };
    default:
      return { label: "Unable to verify", tone: "warning" };
  }
};

export const getServiceWorkerDisplay = (status) => {
  switch (status) {
    case SERVICE_WORKER_STATUSES.ACTIVE:
      return { label: "Active", tone: "success" };
    case SERVICE_WORKER_STATUSES.INSTALLING:
      return { label: "Installing", tone: "warning" };
    case SERVICE_WORKER_STATUSES.WAITING:
      return { label: "Waiting to activate", tone: "warning" };
    case SERVICE_WORKER_STATUSES.NOT_REGISTERED:
      return { label: "Not registered", tone: "warning" };
    case SERVICE_WORKER_STATUSES.REGISTRATION_FAILED:
      return { label: "Registration failed", tone: "error" };
    case SERVICE_WORKER_STATUSES.UNSUPPORTED:
      return { label: "Unsupported by this browser", tone: "info" };
    default:
      return { label: "Checking status", tone: "info" };
  }
};

export const formatCountValue = (value) =>
  Number.isFinite(value) ? String(value) : "Unable to determine";

export const formatLastSuccessfulSyncValue = (value, formatDateTime) => {
  if (value === undefined) {
    return "Unable to determine";
  }

  if (value === null || value === "") {
    return "Not yet synchronized";
  }

  return formatDateTime(value);
};

export const getCountBadge = (
  count,
  { zeroTone = "success", positiveTone = "warning" } = {},
) => {
  if (!Number.isFinite(count)) {
    return null;
  }

  return {
    label: String(count),
    tone: count > 0 ? positiveTone : zeroTone,
  };
};

export const getOfflineFeaturesDisplay = ({ serviceWorkerStatus, roleCode }) => {
  const supportedFeatures = getOfflineFeatureDescription(roleCode);

  if (
    serviceWorkerStatus === SERVICE_WORKER_STATUSES.ACTIVE ||
    serviceWorkerStatus === SERVICE_WORKER_STATUSES.INSTALLING ||
    serviceWorkerStatus === SERVICE_WORKER_STATUSES.WAITING
  ) {
    return {
      value: "Supported features available",
      description: supportedFeatures,
      badge: { label: "Verified", tone: "success" },
    };
  }

  if (
    serviceWorkerStatus === SERVICE_WORKER_STATUSES.REGISTRATION_FAILED ||
    serviceWorkerStatus === SERVICE_WORKER_STATUSES.NOT_REGISTERED
  ) {
    return {
      value: "Offline features currently unavailable",
      description: supportedFeatures,
      badge: { label: "Unavailable", tone: "warning" },
    };
  }

  return {
    value: "Offline support could not be verified",
    description: supportedFeatures,
    badge: { label: "Unverified", tone: "info" },
  };
};

export const buildSystemInformationViewModel = ({
  roleCode,
  connectionStatus,
  serviceWorkerStatus,
  pendingCount,
  failedCount,
  conflictCount,
  lastSuccessfulSyncAt,
  formatDateTime,
  loading = false,
  refresh,
  isRefreshing = false,
  errorMessage = "",
}) => {
  const connectionDisplay = getConnectionDisplay(connectionStatus);
  const serviceWorkerDisplay = getServiceWorkerDisplay(serviceWorkerStatus);
  const offlineFeatures = getOfflineFeaturesDisplay({
    serviceWorkerStatus,
    roleCode,
  });

  return {
    loading,
    refresh,
    isRefreshing,
    errorMessage,
    application: {
      rows: [
        { label: "Application Name", value: "DISTYNC" },
        { label: "Application Version", value: getApplicationVersion() },
        { label: "Application Type", value: "Progressive Web Application" },
      ],
    },
    offline: {
      rows: [
        {
          label: "Offline Features",
          value: offlineFeatures.value,
          description: offlineFeatures.description,
          badge: offlineFeatures.badge,
        },
        {
          label: "Current Connection",
          value: connectionDisplay.label,
          badge: connectionDisplay,
        },
        {
          label: "Pending Sync Records",
          value: formatCountValue(pendingCount),
          description: "Pending records on this device",
          badge: getCountBadge(pendingCount),
        },
        {
          label: "Failed Sync Records",
          value: formatCountValue(failedCount),
          description: "Current failed records on this device",
          badge: getCountBadge(failedCount, {
            zeroTone: "success",
            positiveTone: "error",
          }),
        },
        {
          label: "Conflicts Requiring Review",
          value: formatCountValue(conflictCount),
          description: "Authorized unresolved conflicts for the current account",
          badge: getCountBadge(conflictCount, {
            zeroTone: "success",
            positiveTone: "error",
          }),
        },
        {
          label: "Last Successful Sync",
          value: formatLastSuccessfulSyncValue(lastSuccessfulSyncAt, formatDateTime),
        },
        {
          label: "Service Worker Status",
          value: serviceWorkerDisplay.label,
          badge: serviceWorkerDisplay,
        },
      ],
    },
    about: {
      rows: [
        {
          label: "Full Project Title",
          value:
            "DISTYNC: A Web-Based Disaster Relief Management System Integrating Attendance, Distribution, and Inventory for Selected LGU Offices in Malvar, Batangas",
        },
        {
          label: "Purpose",
          value:
            "A centralized disaster relief management system that supports evacuee monitoring, relief distribution tracking, inventory management, reporting, and data-driven decision support.",
        },
        {
          label: "Supported LGU Offices",
          value:
            "Municipal Social Welfare and Development Office, Office of the Mayor, and Barangay Officials",
          description:
            "Donors and NGOs use the limited public donation information portal.",
        },
      ],
    },
  };
};
