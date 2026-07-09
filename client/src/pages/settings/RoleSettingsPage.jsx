import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  FiActivity,
  FiBell,
  FiFileText,
  FiRefreshCw,
  FiShield,
  FiUser,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import PageHeader, { pageHeaderStyles } from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import FeedbackToast from "../../components/shared/FeedbackToast";
import { useAuth } from "../../context/AuthContext";
import {
  fetchActiveDisasterEvents,
  fetchBarangays,
} from "../../features/disaster-events/disasterEventService";
import { fetchDistributionHistory } from "../../features/distribution/distributionService";
import {
  fetchForecastHealth,
  fetchInventoryItems,
} from "../../features/inventory-items/inventoryItemService";
import {
  fetchCurrentNotificationRules,
  fetchUnreadNotificationCount,
} from "../../features/notifications/notificationService";
import {
  loadRoleSettings,
  saveRoleSettings,
} from "../../features/settings/settingsService";
import {
  buildPayloadSummary,
  formatSyncDateTime,
} from "../../features/sync/syncManagementHelpers";
import { fetchSyncHistory } from "../../features/sync/syncHistoryService";
import db, { LOCAL_SYNC_STATUS } from "../../offline/db";
import {
  flushPendingSyncEntries,
  subscribeToSyncUpdates,
} from "../../offline/syncService";
import {
  ROLE_CODES,
  updateAuthenticatedSessionUser,
} from "../../utils/roleSession";
import BarangaySettingsView from "./views/BarangaySettingsView";
import MayorSettingsView from "./views/MayorSettingsView";
import MswdoSettingsView from "./views/MswdoSettingsView";

const gridStyles = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "16px",
};

const cardStyles = {
  border: "1px solid #dbe6f0",
  borderRadius: "18px",
  padding: "18px",
  backgroundColor: "#fbfdff",
  display: "grid",
  gap: "12px",
};

const settingsHubStyles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
  },
  button: {
    border: "1px solid #dbe6f0",
    borderRadius: "20px",
    padding: "20px",
    background:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(244, 249, 255, 0.98) 100%)",
    display: "grid",
    gap: "18px",
    width: "100%",
    textAlign: "left",
    cursor: "pointer",
    color: "#17324d",
    boxShadow: "0 14px 28px rgba(70, 101, 136, 0.08)",
    transition:
      "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
  },
  iconBadge: {
    width: "48px",
    height: "48px",
    borderRadius: "16px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e8f1fb",
    color: "#2f6499",
    flexShrink: 0,
  },
  openLabel: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#2f6499",
  },
};

const labelStyles = {
  fontSize: "12px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#66809c",
  fontWeight: 700,
  margin: 0,
};

const valueStyles = {
  margin: 0,
  color: "#17324d",
  fontSize: "16px",
  fontWeight: 700,
};

const mutedValueStyles = {
  margin: 0,
  color: "#60738a",
  fontSize: "14px",
  lineHeight: 1.6,
};

const helperTextStyles = {
  ...mutedValueStyles,
  fontSize: "12px",
  lineHeight: 1.5,
};

const errorTextStyles = {
  ...helperTextStyles,
  color: "#b2434f",
  fontWeight: 700,
};

const inputStyles = {
  field: {
    minHeight: "44px",
    borderRadius: "12px",
    border: "1px solid #c9d7e6",
    backgroundColor: "#ffffff",
    padding: "10px 12px",
    color: "#21405f",
    fontSize: "14px",
    width: "100%",
    boxSizing: "border-box",
  },
  lockedField: {
    backgroundColor: "#eef5fc",
    color: "#4f6780",
  },
  errorField: {
    borderColor: "#d46975",
    boxShadow: "0 0 0 1px rgba(212, 105, 117, 0.12)",
  },
  phoneInputGroup: {
    display: "flex",
    alignItems: "stretch",
    width: "100%",
  },
  phonePrefix: {
    minHeight: "44px",
    minWidth: "124px",
    border: "1px solid #c9d7e6",
    borderRight: "none",
    borderRadius: "12px 0 0 12px",
    padding: "10px 12px",
    fontSize: "14px",
    color: "#21405f",
    backgroundColor: "#eef5fc",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    flexShrink: 0,
  },
  phoneField: {
    borderRadius: "0 12px 12px 0",
    flex: 1,
  },
  passwordWrapper: {
    position: "relative",
  },
  passwordField: {
    paddingRight: "44px",
  },
  visibilityButton: {
    position: "absolute",
    top: "50%",
    right: "12px",
    transform: "translateY(-50%)",
    border: "none",
    background: "transparent",
    padding: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#60738a",
    cursor: "pointer",
  },
  textarea: {
    minHeight: "96px",
    resize: "vertical",
  },
};

const statusChipStyles = {
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    borderRadius: "999px",
    padding: "6px 10px",
    fontSize: "12px",
    fontWeight: 800,
  },
  success: {
    backgroundColor: "#edf8f1",
    color: "#2f6c47",
  },
  warning: {
    backgroundColor: "#fff6e8",
    color: "#9a6519",
  },
  error: {
    backgroundColor: "#fff3f1",
    color: "#9d4d58",
  },
  info: {
    backgroundColor: "#eef6ff",
    color: "#2a4c6f",
  },
};

const tableStyles = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    padding: "12px 14px",
    textAlign: "left",
    fontSize: "12px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#66809c",
    borderBottom: "1px solid #e0eaf4",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "14px",
    borderBottom: "1px solid #edf3f8",
    color: "#21405f",
    fontSize: "14px",
    verticalAlign: "top",
    lineHeight: 1.5,
  },
};

const BARANGAY_SETTINGS_SECTIONS = [
  {
    key: "profile",
    label: "Profile",
    description: "Update local identity details, contact information, and profile photo.",
    icon: FiUser,
  },
  {
    key: "security",
    label: "Security",
    description: "Review device-level security preferences and password-related checks.",
    icon: FiShield,
  },
  {
    key: "notification-preferences",
    label: "Notification Preferences",
    description: "Control in-app and email alert preferences for barangay coordination.",
    icon: FiBell,
  },
  {
    key: "activity-logs",
    label: "Recent Local Activity",
    description: "Review recent sync and operational actions visible on this device.",
    icon: FiActivity,
  },
];

const EDITABLE_BARANGAY_SECTION_KEYS = new Set([
  "profile",
  "security",
  "notification-preferences",
]);

const MSWDO_SETTINGS_SECTIONS = [
  {
    key: "profile",
    label: "Profile",
    description:
      "Review office identity details, assigned role, contact information, and profile picture.",
    icon: FiUser,
  },
  {
    key: "security",
    label: "Security",
    description:
      "Keep password review, two-factor preference, and security activity grouped together.",
    icon: FiShield,
  },
  {
    key: "notification-preferences",
    label: "Notification Preferences",
    description:
      "Manage local notification rule preferences used for MSWDO coordination.",
    icon: FiBell,
  },
  {
    key: "sync-center",
    label: "Sync Center",
    description:
      "Monitor pending queue records, sync health, and recent synchronization logs.",
    icon: FiRefreshCw,
  },
  {
    key: "report-preferences",
    label: "Report Preferences",
    description:
      "Choose the preferred local export format for reports generated by this account.",
    icon: FiFileText,
  },
];

const EDITABLE_MSWDO_SECTION_KEYS = new Set([
  "profile",
  "security",
  "notification-preferences",
  "report-preferences",
]);

const MAYOR_SETTINGS_SECTIONS = [
  {
    key: "profile",
    label: "Profile",
    description:
      "Review account identity details, assigned role, contact information, and profile picture.",
    icon: FiUser,
  },
  {
    key: "security",
    label: "Security",
    description:
      "Keep password review, two-factor preference, and security activity grouped together.",
    icon: FiShield,
  },
  {
    key: "notification-preferences",
    label: "Notification Preferences",
    description:
      "Manage local executive notification rule preferences for the Office of the Mayor.",
    icon: FiBell,
  },
  {
    key: "sync-status",
    label: "Sync Status",
    description:
      "Review sync health, recent queue activity, and full sync monitoring access from the sidebar.",
    icon: FiRefreshCw,
  },
  {
    key: "analytics-service",
    label: "Analytics Service",
    description:
      "Review read-only analytics availability and service health for executive visibility.",
    icon: FiActivity,
  },
  {
    key: "inventory-alert-thresholds",
    label: "Inventory Alert Thresholds",
    description:
      "Review read-only inventory threshold coverage without changing operational rules.",
    icon: FiFileText,
  },
  {
    key: "local-preferences",
    label: "Local Preferences",
    description:
      "Manage export format and view locally saved preference summaries for this account.",
    icon: FiFileText,
  },
];

const EDITABLE_MAYOR_SECTION_KEYS = new Set([
  "profile",
  "security",
  "notification-preferences",
  "local-preferences",
]);

const BARANGAY_POSITION_LABEL = "Barangay Official";

const BARANGAY_NOTIFICATION_OPTIONS = [
  {
    key: "disasterAlerts",
    label: "Disaster Alerts",
    description:
      "Receive local preferences for flood warnings, fire incidents, evacuation notices, and urgent LGU advisories.",
  },
  {
    key: "distributionSchedules",
    label: "Distribution Schedules",
    description:
      "Track upcoming relief distribution schedules, assignment changes, and related coordination notices.",
  },
  {
    key: "reliefArrivalNotifications",
    label: "Relief Arrival Notifications",
    description:
      "Review local preferences for supply arrival updates, release readiness, and barangay allocation notices.",
  },
  {
    key: "attendanceReminders",
    label: "Attendance Reminders",
    description:
      "Keep reminders visible for evacuation attendance submission follow-ups and attendance record completion.",
  },
  {
    key: "systemAnnouncements",
    label: "System Announcements",
    description:
      "Show maintenance announcements, policy updates, and general system notices relevant to barangay coordination.",
  },
];

const createDefaultNotificationChannels = () =>
  BARANGAY_NOTIFICATION_OPTIONS.reduce((current, option) => {
    current[option.key] = {
      inApp: true,
      email: false,
    };
    return current;
  }, {});

const createDefaultRolePreferences = () => ({
  enabledNotificationRuleCodes: [],
  preferredExportFormat: "excel",
  profile: {
    fullName: "",
    position: BARANGAY_POSITION_LABEL,
    contactNumber: "",
    emailAddress: "",
    profilePictureDataUrl: "",
    profilePictureFileName: "",
  },
  notificationChannels: createDefaultNotificationChannels(),
  security: {
    twoFactorEnabled: false,
    lastLocalPasswordChangeAt: "",
    lastTwoFactorPreferenceUpdateAt: "",
  },
  metadata: {
    lastProfileUpdateAt: "",
    lastPreferenceSaveAt: "",
  },
});

const normalizePhilippineContactNumber = (value = "") => {
  const rawValue = String(value || "").trim();

  if (!rawValue) {
    return "";
  }

  const compactValue = rawValue.replace(/[^\d+]/g, "");

  if (compactValue.startsWith("+")) {
    return `+${compactValue.slice(1).replace(/\D/g, "").slice(0, 12)}`;
  }

  const digitsOnly = compactValue.replace(/\D/g, "");

  if (!digitsOnly) {
    return "";
  }

  if (digitsOnly.startsWith("09")) {
    return `+63${digitsOnly.slice(1, 11)}`;
  }

  if (digitsOnly.startsWith("639")) {
    return `+${digitsOnly.slice(0, 12)}`;
  }

  if (digitsOnly.startsWith("9")) {
    return `+63${digitsOnly.slice(0, 10)}`;
  }

  if (digitsOnly.startsWith("63")) {
    return `+${digitsOnly.slice(0, 12)}`;
  }

  return `+63${digitsOnly.slice(0, 10)}`;
};

const formatPhilippineContactNumberForDisplay = (value = "") => {
  const normalizedValue = normalizePhilippineContactNumber(value);

  if (!normalizedValue.startsWith("+639")) {
    return normalizedValue.replace(/^\+63/, "");
  }

  const localDigits = normalizedValue.slice(3, 13);
  const firstBlock = localDigits.slice(0, 3);
  const secondBlock = localDigits.slice(3, 6);
  const thirdBlock = localDigits.slice(6, 10);

  return [firstBlock, secondBlock, thirdBlock].filter(Boolean).join(" ");
};

const getBarangayProfileValidationErrors = (profile = {}) => {
  const errors = {};
  const fullName = String(profile.fullName || "").trim();
  const contactNumber = String(profile.contactNumber || "").trim();

  if (!fullName) {
    errors.fullName = "Full name is required.";
  }

  if (!contactNumber) {
    errors.contactNumber = "Contact number is required.";
  } else if (!/^\+639\d{9}$/.test(contactNumber)) {
    errors.contactNumber = "Use the format 912 345 6789 after PH +63.";
  }

  return errors;
};

const getSecurityPasswordValidationErrors = (form = {}) => {
  const errors = {};
  const currentPassword = String(form.currentPassword || "");
  const newPassword = String(form.newPassword || "");
  const confirmPassword = String(form.confirmPassword || "");

  if (!currentPassword) {
    errors.currentPassword = "Current password is required.";
  }

  if (!newPassword) {
    errors.newPassword = "New password is required.";
  } else if (newPassword.length < 8) {
    errors.newPassword = "Password must be at least 8 characters long.";
  } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/.test(newPassword)) {
    errors.newPassword =
      "Password must contain at least one uppercase letter, one lowercase letter, and one number.";
  } else if (currentPassword && newPassword === currentPassword) {
    errors.newPassword = "New password cannot be the same as your current password.";
  }

  if (!confirmPassword) {
    errors.confirmPassword = "Please confirm your new password.";
  } else if (confirmPassword !== newPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
};

const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getNotificationPreferenceValidationErrors = ({
  notificationChannels = {},
  emailAddress = "",
}) => {
  const errors = {};
  const optionStates = BARANGAY_NOTIFICATION_OPTIONS.map((option) => ({
    inApp: Boolean(notificationChannels[option.key]?.inApp),
    email: Boolean(notificationChannels[option.key]?.email),
  }));

  const enabledTypeCount = optionStates.filter((option) => option.inApp || option.email)
    .length;
  const hasAtLeastOneChannel =
    optionStates.some((option) => option.inApp) ||
    optionStates.some((option) => option.email);
  const hasAnyEmailChannel = optionStates.some((option) => option.email);
  const trimmedEmailAddress = String(emailAddress || "").trim();

  if (enabledTypeCount === 0) {
    errors.notificationTypes = "Please select at least one notification type.";
  }

  if (!hasAtLeastOneChannel) {
    errors.notificationChannels = "Please select at least one notification channel.";
  }

  if (hasAnyEmailChannel && !EMAIL_ADDRESS_PATTERN.test(trimmedEmailAddress)) {
    errors.emailAddress =
      "A valid email address is required to receive email notifications.";
  }

  return errors;
};

const normalizeRolePreferences = (value = {}) => {
  const defaults = createDefaultRolePreferences();
  const notificationChannels = {
    ...defaults.notificationChannels,
  };

  Object.entries(value?.notificationChannels || {}).forEach(([key, channels]) => {
    notificationChannels[key] = {
      ...(defaults.notificationChannels[key] || { inApp: true, email: false }),
      ...(channels || {}),
    };
  });

  return {
    ...defaults,
    ...(value || {}),
    enabledNotificationRuleCodes: Array.isArray(value?.enabledNotificationRuleCodes)
      ? value.enabledNotificationRuleCodes
      : [],
    profile: {
      ...defaults.profile,
      ...(value?.profile || {}),
    },
    notificationChannels,
    security: {
      ...defaults.security,
      ...(value?.security || {}),
    },
    metadata: {
      ...defaults.metadata,
      ...(value?.metadata || {}),
    },
  };
};

const formatDateTime = (value) => {
  if (!value) {
    return "--";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsedDate);
};

const buildSyncSummary = (syncEntries) => {
  return syncEntries.reduce(
    (summary, entry) => {
      summary.total += 1;
      summary[entry.status] = (summary[entry.status] || 0) + 1;
      return summary;
    },
    {
      total: 0,
      [LOCAL_SYNC_STATUS.PENDING]: 0,
      [LOCAL_SYNC_STATUS.SYNCED]: 0,
      [LOCAL_SYNC_STATUS.FAILED]: 0,
      [LOCAL_SYNC_STATUS.CONFLICT]: 0,
    },
  );
};

const getRoleMeta = (roleCode) => {
  switch (roleCode) {
    case ROLE_CODES.BARANGAY:
      return {
        title: "BARANGAY SETTINGS",
        description:
          "Manage barangay coordination settings, distribution visibility, sync readiness, and local notification preferences.",
      };
    case ROLE_CODES.MSWDO:
      return {
        title: "MSWDO SETTINGS",
        description:
          "Manage MSWDO profile, security, notification preferences, sync visibility, and local report settings.",
      };
    case ROLE_CODES.MAYOR:
      return {
        title: "MAYOR SETTINGS",
        description:
          "Manage mayor profile, security, notification preferences, sync visibility, and executive system summaries.",
      };
    default:
      return {
        title: "SETTINGS",
        description: "Review account and operational settings.",
      };
  }
};

const ROLE_DISPLAY_NAMES = {
  [ROLE_CODES.BARANGAY]: "Barangay Official",
  [ROLE_CODES.MSWDO]: "MSWDO Personnel",
  [ROLE_CODES.MAYOR]: "Office of the Mayor",
};

const getSyncStatusMeta = (syncSummary, isOnline) => {
  if (!isOnline) {
    return {
      tone: "warning",
      label: "Pending",
      description: "Offline mode is active. Local changes will sync later.",
    };
  }

  if (
    syncSummary[LOCAL_SYNC_STATUS.FAILED] > 0 ||
    syncSummary[LOCAL_SYNC_STATUS.CONFLICT] > 0
  ) {
    return {
      tone: "error",
      label: "Failed",
      description: "Some records need sync review before LGU coordination is complete.",
    };
  }

  if (syncSummary[LOCAL_SYNC_STATUS.PENDING] > 0) {
    return {
      tone: "warning",
      label: "Pending",
      description: "Queued records are waiting to be synced with the LGU.",
    };
  }

  return {
    tone: "success",
    label: "Synced",
    description: "Barangay records are currently aligned with the LGU data flow.",
  };
};

const safeParsePayload = (value) => {
  if (!value) {
    return {};
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (_error) {
      return {};
    }
  }

  return typeof value === "object" ? value : {};
};

const buildDistributionSummaryRows = (rows = []) => {
  const groupedRows = new Map();

  rows.forEach((row) => {
    const groupKey = [
      row.receipt_no || "",
      row.event_code || "",
      row.disaster_event_title || "",
      row.distribution_date ? new Date(row.distribution_date).toDateString() : row.id,
      row.barangay_name || "",
    ].join("|");

    if (!groupedRows.has(groupKey)) {
      groupedRows.set(groupKey, {
        id: groupKey,
        distributionDate: row.distribution_date || "",
        disasterEventTitle: row.disaster_event_title || "--",
        eventCode: row.event_code || "--",
        reliefGoods: new Set(),
        totalQuantityReceived: 0,
        familyIds: new Set(),
        rawStatuses: new Set(),
        distributionReportLabel: row.receipt_no || "",
        distributionReportReceipt: row.receipt_no || "",
        photosSubmitted: 0,
      });
    }

    const currentGroup = groupedRows.get(groupKey);
    const reliefLabel =
      row.relief_pack_template_name || row.released_items_summary || "--";

    currentGroup.reliefGoods.add(reliefLabel);
    currentGroup.totalQuantityReceived += Number(row.total_quantity_released || 0);

    if (row.household_id) {
      currentGroup.familyIds.add(row.household_id);
    }

    if (row.distribution_status) {
      currentGroup.rawStatuses.add(row.distribution_status);
    }
  });

  return Array.from(groupedRows.values()).map((group) => {
    const hasOngoingStatus = Array.from(group.rawStatuses).some(
      (status) => !["CLAIMED", "CANCELLED", "REVERSED"].includes(status),
    );

    return {
      id: group.id,
      distributionDate: group.distributionDate,
      disasterEventTitle: group.disasterEventTitle,
      eventCode: group.eventCode,
      reliefGoodsReceived: Array.from(group.reliefGoods).join(", "),
      quantityReceived: group.totalQuantityReceived,
      familiesServed: group.familyIds.size,
      statusLabel: hasOngoingStatus ? "Ongoing" : "Completed",
      distributionReportLabel: group.distributionReportReceipt
        ? `Receipt ${group.distributionReportReceipt}`
        : "Open full history",
      photosSubmitted: group.photosSubmitted,
    };
  });
};

const formatQueueEntryTitle = (entry) => {
  const moduleLabel = entry?.moduleName
    ? String(entry.moduleName).replace(/[_-]/g, " ")
    : "record";
  const actionLabel = entry?.actionKey
    ? String(entry.actionKey).replace(/[_-]/g, " ")
    : "queued";

  return `${actionLabel} ${moduleLabel}`.replace(/\s+/g, " ").trim();
};

const buildActivityLogs = ({
  distributionRows,
  syncEntries,
  syncHistory,
}) => {
  const localActivityEntries = syncEntries.map((entry) => ({
    id: `queue-${entry.id}`,
    timestamp:
      entry.updatedAt || entry.createdAt || entry.clientTimestamp || entry.syncedAt || "",
    title: formatQueueEntryTitle(entry),
    detail: `Local sync queue - ${entry.status || "--"}`,
    moduleLabel: "Sync",
    tone:
      entry.status === LOCAL_SYNC_STATUS.FAILED ||
      entry.status === LOCAL_SYNC_STATUS.CONFLICT
        ? "error"
        : entry.status === LOCAL_SYNC_STATUS.PENDING
          ? "warning"
          : "success",
  }));

  const syncHistoryEntries = [
    ...(syncHistory.transactions || []).map((transaction, index) => {
      const payload = safeParsePayload(
        transaction.payload_json || transaction.payload || {},
      );

      return {
        id: `transaction-${transaction.id || index}`,
        timestamp:
          transaction.synced_at ||
          transaction.created_at ||
          transaction.client_timestamp ||
          transaction.updated_at ||
          "",
        title: `Synced ${String(transaction.module_name || "record").replace(
          /[_-]/g,
          " ",
        )}`,
        detail: buildPayloadSummary(payload),
        moduleLabel: "Sync",
        tone:
          transaction.sync_status === LOCAL_SYNC_STATUS.FAILED
            ? "error"
            : transaction.sync_status === LOCAL_SYNC_STATUS.CONFLICT
              ? "warning"
              : "success",
      };
    }),
    ...(syncHistory.conflicts || []).map((conflict, index) => ({
      id: `conflict-${conflict.id || index}`,
      timestamp:
        conflict.created_at || conflict.updated_at || conflict.resolved_at || "",
      title: `Sync conflict review for ${String(conflict.entity_type || "record").replace(
        /[_-]/g,
        " ",
      )}`,
      detail: conflict.conflict_type || "Conflict detected during sync.",
      moduleLabel: "Sync",
      tone: conflict.status === "RESOLVED" ? "success" : "warning",
    })),
  ];

  const distributionEntries = distributionRows.slice(0, 12).map((row) => ({
    id: `distribution-${row.id}`,
    timestamp: row.distribution_date || "",
    title: `Recorded distribution for ${row.disaster_event_title || row.event_code || "response"}`,
    detail:
      row.relief_pack_template_name || row.released_items_summary || "Relief goods released",
    moduleLabel: "Distribution",
    tone: "info",
  }));

  return [
    ...localActivityEntries,
    ...syncHistoryEntries,
    ...distributionEntries,
  ]
    .filter((entry) => entry.timestamp || entry.title)
    .sort((left, right) => {
      const leftTime = left.timestamp ? new Date(left.timestamp).getTime() : 0;
      const rightTime = right.timestamp ? new Date(right.timestamp).getTime() : 0;
      return rightTime - leftTime;
    });
};

const buildSecurityActivityLogs = (preferences) => {
  return [
    preferences.security?.lastLocalPasswordChangeAt
      ? {
          id: "password-update",
          timestamp: preferences.security.lastLocalPasswordChangeAt,
          title: "Password change reviewed",
          detail:
            "Password changes were reviewed in this frontend security form for the current account.",
          moduleLabel: "Security",
          tone: "success",
        }
      : null,
    preferences.security?.lastTwoFactorPreferenceUpdateAt
      ? {
          id: "two-factor-update",
          timestamp: preferences.security.lastTwoFactorPreferenceUpdateAt,
          title: preferences.security.twoFactorEnabled
            ? "Two-factor preference enabled"
            : "Two-factor preference disabled",
          detail:
            "Two-factor authentication preference was updated in local security settings.",
          moduleLabel: "Security",
          tone: preferences.security.twoFactorEnabled ? "success" : "warning",
        }
      : null,
  ]
    .filter(Boolean)
    .sort((left, right) => {
      const leftTime = left.timestamp ? new Date(left.timestamp).getTime() : 0;
      const rightTime = right.timestamp ? new Date(right.timestamp).getTime() : 0;
      return rightTime - leftTime;
    });
};

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const ensureObject = (value, fallback = {}) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : fallback;

const StatusChip = ({ tone = "info", label }) => (
  <span
    style={{
      ...statusChipStyles.base,
      ...(statusChipStyles[tone] || statusChipStyles.info),
    }}
  >
    {label}
  </span>
);

const InfoRow = ({ label, value, muted = false }) => (
  <div style={{ display: "grid", gap: "6px" }}>
    <p style={labelStyles}>{label}</p>
    <p style={muted ? mutedValueStyles : valueStyles}>{value}</p>
  </div>
);

const EmptyState = ({ message }) => (
  <p style={{ margin: 0, color: "#60738a", lineHeight: 1.6 }}>{message}</p>
);

const RoleSettingsPage = () => {
  const navigate = useNavigate();
  const { currentRole, authenticatedUser, syncAuthState } = useAuth();
  const syncEntries =
    useLiveQuery(() => db.syncQueue.orderBy("updatedAt").reverse().toArray(), [], []) ||
    [];
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [notificationRules, setNotificationRules] = useState([]);
  const [assignedBarangayName, setAssignedBarangayName] = useState("--");
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeDisasterEvents, setActiveDisasterEvents] = useState([]);
  const [forecastHealth, setForecastHealth] = useState(null);
  const [inventoryThresholdSummary, setInventoryThresholdSummary] = useState(null);
  const [preferences, setPreferences] = useState(createDefaultRolePreferences());
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [distributionFilters, setDistributionFilters] = useState({
    disaster_event_id: "",
    status: "",
    date_from: "",
    date_to: "",
    sort_order: "latest",
  });
  const [distributionRows, setDistributionRows] = useState([]);
  const [isLoadingDistributionHistory, setIsLoadingDistributionHistory] =
    useState(false);
  const [distributionErrorMessage, setDistributionErrorMessage] = useState("");
  const [syncHistory, setSyncHistory] = useState({
    transactions: [],
    conflicts: [],
  });
  const [isLoadingSyncHistory, setIsLoadingSyncHistory] = useState(false);
  const [syncHistoryErrorMessage, setSyncHistoryErrorMessage] = useState("");
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [securityForm, setSecurityForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [securityTouched, setSecurityTouched] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const [securityVisibility, setSecurityVisibility] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const [notificationTouched, setNotificationTouched] = useState(false);
  const [activeSection, setActiveSection] = useState(null);
  const [toast, setToast] = useState({
    message: "",
    type: "info",
    title: "",
  });
  const [profileErrors, setProfileErrors] = useState({
    fullName: "",
    contactNumber: "",
  });
  const [profileTouched, setProfileTouched] = useState({
    fullName: false,
    contactNumber: false,
  });
  const profilePictureInputRef = useRef(null);

  const roleMeta = useMemo(() => getRoleMeta(currentRole), [currentRole]);
  const syncSummary = useMemo(() => buildSyncSummary(syncEntries), [syncEntries]);
  const isOnline = typeof navigator === "undefined" ? true : navigator.onLine;
  const isBarangayRole = currentRole === ROLE_CODES.BARANGAY;
  const isMswdoRole = currentRole === ROLE_CODES.MSWDO;
  const isMayorRole = currentRole === ROLE_CODES.MAYOR;
  const securityValidationErrors = useMemo(
    () => getSecurityPasswordValidationErrors(securityForm),
    [securityForm],
  );
  const notificationValidationErrors = useMemo(
    () =>
      getNotificationPreferenceValidationErrors({
        notificationChannels: preferences.notificationChannels,
        emailAddress:
          authenticatedUser?.email || preferences.profile.emailAddress || "",
      }),
    [authenticatedUser?.email, preferences.notificationChannels, preferences.profile.emailAddress],
  );

  useEffect(() => {
    const availableSections = isBarangayRole
      ? BARANGAY_SETTINGS_SECTIONS
      : isMswdoRole
        ? MSWDO_SETTINGS_SECTIONS
        : isMayorRole
          ? MAYOR_SETTINGS_SECTIONS
        : [];

    if (availableSections.length === 0) {
      setActiveSection(null);
      return;
    }

    setActiveSection((current) => {
      if (!current) {
        return null;
      }

      return availableSections.some((section) => section.key === current)
        ? current
        : null;
    });
  }, [isBarangayRole, isMayorRole, isMswdoRole]);

  useEffect(() => {
    if (!currentRole || !authenticatedUser) {
      return;
    }

    let isMounted = true;

    const loadPersistedRoleSettings = async () => {
      const loadedSettings = await loadRoleSettings({
        roleCode: currentRole,
        userId: authenticatedUser.id,
      });

      if (!isMounted) {
        return;
      }

      setPreferences(normalizeRolePreferences(loadedSettings));
    };

    void loadPersistedRoleSettings();

    return () => {
      isMounted = false;
    };
  }, [authenticatedUser, currentRole]);

  useEffect(() => {
    if (!authenticatedUser) {
      return;
    }

    setPreferences((current) => {
      const normalized = normalizeRolePreferences(current);
      const fallbackFullName =
        [authenticatedUser.first_name, authenticatedUser.last_name]
          .filter(Boolean)
          .join(" ")
          .trim() || "";
      const fallbackEmail = authenticatedUser.email || "";

      if (
        normalized.profile.fullName === fallbackFullName &&
        normalized.profile.emailAddress === fallbackEmail
      ) {
        return current;
      }

      if (normalized.profile.fullName && normalized.profile.emailAddress) {
        return current;
      }

      return {
        ...normalized,
        profile: {
          ...normalized.profile,
          fullName: normalized.profile.fullName || fallbackFullName,
          emailAddress: normalized.profile.emailAddress || fallbackEmail,
        },
      };
    });
  }, [authenticatedUser]);

  useEffect(() => {
    if (!isBarangayRole) {
      setProfileErrors({
        fullName: "",
        contactNumber: "",
      });
      setProfileTouched({
        fullName: false,
        contactNumber: false,
      });
      return;
    }

    const lockedEmailAddress = authenticatedUser?.email || "";
    const normalizedContactNumber = preferences.profile.contactNumber
      ? normalizePhilippineContactNumber(preferences.profile.contactNumber)
      : "";

    setPreferences((current) => {
      if (
        current.profile.position === BARANGAY_POSITION_LABEL &&
        current.profile.emailAddress === lockedEmailAddress &&
        current.profile.contactNumber === normalizedContactNumber
      ) {
        return current;
      }

      return {
        ...current,
        profile: {
          ...current.profile,
          position: BARANGAY_POSITION_LABEL,
          contactNumber: normalizedContactNumber,
          emailAddress: lockedEmailAddress,
        },
      };
    });
  }, [authenticatedUser?.email, isBarangayRole, preferences.profile.contactNumber]);

  useEffect(() => {
    if (!isBarangayRole && !isMswdoRole && !isMayorRole) {
      return;
    }

    const validationErrors = getBarangayProfileValidationErrors(preferences.profile);

    setProfileErrors({
      fullName: validationErrors.fullName || "",
      contactNumber: validationErrors.contactNumber || "",
    });
  }, [
    isBarangayRole,
    isMayorRole,
    isMswdoRole,
    preferences.profile.contactNumber,
    preferences.profile.fullName,
  ]);

  useEffect(() => {
    if (!notificationRules.length) {
      return;
    }

    setPreferences((current) => {
      if (current.enabledNotificationRuleCodes?.length > 0) {
        return current;
      }

      return {
        ...current,
        enabledNotificationRuleCodes: notificationRules.map((rule) => rule.code),
      };
    });
  }, [notificationRules]);

  useEffect(() => {
    if (!isBarangayRole) {
      setSecurityTouched({
        currentPassword: false,
        newPassword: false,
        confirmPassword: false,
      });
      setSecurityVisibility({
        currentPassword: false,
        newPassword: false,
        confirmPassword: false,
      });
      setNotificationTouched(false);
    }
  }, [isBarangayRole]);

  useEffect(() => {
    const loadSettingsData = async () => {
      if (!currentRole || !authenticatedUser) {
        return;
      }

      setIsLoading(true);
      setErrorMessage("");

      try {
        const requests = [
          fetchCurrentNotificationRules(),
          fetchUnreadNotificationCount(),
        ];

        if (authenticatedUser.default_barangay_id) {
          requests.push(fetchBarangays());
        } else {
          requests.push(Promise.resolve([]));
        }

        if (currentRole === ROLE_CODES.BARANGAY || currentRole === ROLE_CODES.MSWDO) {
          requests.push(fetchActiveDisasterEvents());
        } else {
          requests.push(Promise.resolve([]));
        }

        if (currentRole === ROLE_CODES.MAYOR) {
          requests.push(fetchForecastHealth().catch(() => null));
          requests.push(fetchInventoryItems({ is_active: true }).catch(() => []));
        } else {
          requests.push(Promise.resolve(null));
          requests.push(Promise.resolve([]));
        }

        const [
          notificationRuleResponse,
          unreadResponse,
          barangayResponse,
          activeDisasterResponse,
          forecastHealthResponse,
          inventoryItemsResponse,
        ] = await Promise.all(requests);

        const rules = Array.isArray(notificationRuleResponse?.data)
          ? notificationRuleResponse.data
          : [];
        setNotificationRules(rules);
        setUnreadCount(Number(unreadResponse?.unread_count || 0));

        if (authenticatedUser.default_barangay_id && Array.isArray(barangayResponse)) {
          const assignedBarangay = barangayResponse.find(
            (barangay) => barangay.id === authenticatedUser.default_barangay_id,
          );
          setAssignedBarangayName(assignedBarangay?.name || "--");
        } else {
          setAssignedBarangayName("--");
        }

        const activeEvents = Array.isArray(activeDisasterResponse)
          ? activeDisasterResponse
          : Array.isArray(activeDisasterResponse?.data)
            ? activeDisasterResponse.data
            : [];
        setActiveDisasterEvents(activeEvents);

        setForecastHealth(forecastHealthResponse?.data || null);

        const inventoryItems = Array.isArray(inventoryItemsResponse)
          ? inventoryItemsResponse
          : Array.isArray(inventoryItemsResponse?.data)
            ? inventoryItemsResponse.data
            : [];

        if (inventoryItems.length > 0) {
          const distinctThresholds = [
            ...new Set(
              inventoryItems
                .map((item) => item.low_stock_threshold)
                .filter((value) => value !== null && value !== undefined),
            ),
          ];

          setInventoryThresholdSummary({
            configured_items: inventoryItems.length,
            distinct_thresholds: distinctThresholds,
          });
        } else {
          setInventoryThresholdSummary({
            configured_items: 0,
            distinct_thresholds: [],
          });
        }
      } catch (error) {
        setErrorMessage(error.message || "Failed to load settings.");
      } finally {
        setIsLoading(false);
      }
    };

    loadSettingsData();
  }, [authenticatedUser, currentRole]);

  useEffect(() => {
    if (!isBarangayRole && !isMswdoRole) {
      return;
    }

    let isMounted = true;

    const loadDistributionData = async () => {
      setIsLoadingDistributionHistory(true);
      setDistributionErrorMessage("");

      try {
        const response = await fetchDistributionHistory({
          disaster_event_id: distributionFilters.disaster_event_id,
          date_from: distributionFilters.date_from,
          date_to: distributionFilters.date_to,
          limit: 100,
        });

        if (!isMounted) {
          return;
        }

        setDistributionRows(Array.isArray(response?.data) ? response.data : []);
      } catch (error) {
        if (isMounted) {
          setDistributionRows([]);
          setDistributionErrorMessage(
            error.message || "Failed to load barangay distribution history.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingDistributionHistory(false);
        }
      }
    };

    loadDistributionData();

    return () => {
      isMounted = false;
    };
  }, [
    distributionFilters.date_from,
    distributionFilters.date_to,
    distributionFilters.disaster_event_id,
    isBarangayRole,
  ]);

  useEffect(() => {
    if (!isBarangayRole) {
      return;
    }

    let isMounted = true;

    const loadRoleSyncHistory = async () => {
      setIsLoadingSyncHistory(true);
      setSyncHistoryErrorMessage("");

      try {
        const response = await fetchSyncHistory({ limit: 20 });

        if (!isMounted) {
          return;
        }

        setSyncHistory({
          transactions: Array.isArray(response?.transactions)
            ? response.transactions
            : [],
          conflicts: Array.isArray(response?.conflicts) ? response.conflicts : [],
        });
      } catch (error) {
        if (isMounted) {
          setSyncHistory({
            transactions: [],
            conflicts: [],
          });
          setSyncHistoryErrorMessage(
            error.message || "Failed to load sync history.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingSyncHistory(false);
        }
      }
    };

    loadRoleSyncHistory();

    const unsubscribe = subscribeToSyncUpdates(() => {
      if (typeof navigator === "undefined" || navigator.onLine) {
        void loadRoleSyncHistory();
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isBarangayRole]);

  const toggleNotificationRule = (ruleCode) => {
    setNotificationTouched(true);
    setPreferences((current) => {
      const selectedCodes = new Set(current.enabledNotificationRuleCodes || []);

      if (selectedCodes.has(ruleCode)) {
        selectedCodes.delete(ruleCode);
      } else {
        selectedCodes.add(ruleCode);
      }

      return {
        ...current,
        enabledNotificationRuleCodes: Array.from(selectedCodes),
      };
    });
  };

  const handleSavePreferences = async () => {
    if (!currentRole || !authenticatedUser) {
      return;
    }

    const trimmedFullName = preferences.profile.fullName.trim();
    const usesPhilippineContactFormat =
      isBarangayRole || isMswdoRole || isMayorRole;
    const normalizedContactNumber = usesPhilippineContactFormat
      ? normalizePhilippineContactNumber(preferences.profile.contactNumber)
      : preferences.profile.contactNumber;
    const lockedEmailAddress = authenticatedUser.email || preferences.profile.emailAddress;

    if (isBarangayRole || isMswdoRole || isMayorRole) {
      const lockedPosition = isBarangayRole
        ? BARANGAY_POSITION_LABEL
        : isMswdoRole
          ? ROLE_DISPLAY_NAMES[ROLE_CODES.MSWDO]
          : ROLE_DISPLAY_NAMES[ROLE_CODES.MAYOR];
      const validationErrors = getBarangayProfileValidationErrors({
        ...preferences.profile,
        fullName: trimmedFullName,
        position: lockedPosition,
        contactNumber: normalizedContactNumber,
        emailAddress: lockedEmailAddress,
      });

      setProfileTouched({
        fullName: true,
        contactNumber: true,
      });
      setProfileErrors({
        fullName: validationErrors.fullName || "",
        contactNumber: validationErrors.contactNumber || "",
      });

      if (Object.values(validationErrors).some(Boolean)) {
        setToast({
          type: "error",
          title: "Profile Settings Incomplete",
          message: isBarangayRole
            ? "Review the barangay profile fields before saving."
            : isMswdoRole
              ? "Review the MSWDO profile fields before saving."
              : "Review the mayor profile fields before saving.",
        });
        return;
      }
    }

    if (
      (isBarangayRole || isMayorRole) &&
      activeSection === "notification-preferences"
    ) {
      setNotificationTouched(true);

      if (Object.values(notificationValidationErrors).some(Boolean)) {
        setToast({
          type: "error",
          title: "Notification Preferences Incomplete",
          message: "Review the local notification preferences before saving.",
        });
        return;
      }
    }

    setIsSavingPreferences(true);

    try {
      const updatedProfile = isBarangayRole
        ? {
            ...preferences.profile,
            fullName: trimmedFullName,
            position: BARANGAY_POSITION_LABEL,
            contactNumber: normalizedContactNumber,
            emailAddress: lockedEmailAddress,
          }
        : isMswdoRole
          ? {
              ...preferences.profile,
              fullName: trimmedFullName,
              position: ROLE_DISPLAY_NAMES[ROLE_CODES.MSWDO],
              contactNumber: normalizedContactNumber,
              emailAddress: lockedEmailAddress,
            }
        : isMayorRole
          ? {
              ...preferences.profile,
              fullName: trimmedFullName,
              position: ROLE_DISPLAY_NAMES[ROLE_CODES.MAYOR],
              contactNumber: normalizedContactNumber,
              emailAddress: lockedEmailAddress,
            }
        : preferences.profile;
      const updatedSettings = {
        ...preferences,
        profile: updatedProfile,
        metadata: {
          ...preferences.metadata,
          lastPreferenceSaveAt: new Date().toISOString(),
        },
      };

      const saveResult = await saveRoleSettings({
        roleCode: currentRole,
        userId: authenticatedUser.id,
        settings: updatedSettings,
      });

      if (saveResult?.user) {
        updateAuthenticatedSessionUser(saveResult.user);
        syncAuthState();
      }

      setPreferences(normalizeRolePreferences(saveResult?.data || updatedSettings));
      setToast({
        type: "success",
        title: "Settings Saved",
        message: "Your role settings were saved successfully.",
      });
    } catch (error) {
      setToast({
        type: "error",
        title: "Save Failed",
        message: error.message || "Failed to save role settings.",
      });
    } finally {
      setIsSavingPreferences(false);
    }
  };

  const handleProfileFieldChange = (field, value) => {
    const nextValue =
      (isBarangayRole || isMswdoRole || isMayorRole) &&
      field === "contactNumber"
        ? normalizePhilippineContactNumber(value)
        : value;

    setPreferences((current) => ({
      ...current,
      profile: {
        ...current.profile,
        [field]: nextValue,
      },
      metadata: {
        ...current.metadata,
        lastProfileUpdateAt: new Date().toISOString(),
      },
    }));
  };

  const handleProfileFieldBlur = (field) => {
    if (!isBarangayRole && !isMswdoRole && !isMayorRole) {
      return;
    }

    setProfileTouched((current) => ({
      ...current,
      [field]: true,
    }));
  };

  const handleNotificationChannelToggle = (channelKey, type) => {
    setNotificationTouched(true);
    setPreferences((current) => ({
      ...current,
      notificationChannels: {
        ...current.notificationChannels,
        [channelKey]: {
          ...current.notificationChannels[channelKey],
          [type]: !current.notificationChannels[channelKey]?.[type],
        },
      },
    }));
  };

  const handleResetNotificationPreferences = () => {
    setNotificationTouched(false);
    setPreferences((current) => ({
      ...current,
      enabledNotificationRuleCodes:
        notificationRules.length > 0 ? notificationRules.map((rule) => rule.code) : [],
      notificationChannels: createDefaultNotificationChannels(),
    }));
    setToast({
      type: "info",
      title: "Notification Preferences Reset",
      message: "Local notification settings were reset to their default values.",
    });
  };

  const handleProfilePictureChange = async (event) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    if (!selectedFile.type.startsWith("image/")) {
      setToast({
        type: "error",
        title: "Profile Picture Error",
        message: "Please choose a valid image file for the profile picture.",
      });
      return;
    }

    const fileReader = new FileReader();

    fileReader.onload = () => {
      setPreferences((current) => ({
        ...current,
        profile: {
          ...current.profile,
          profilePictureDataUrl: String(fileReader.result || ""),
          profilePictureFileName: selectedFile.name || "Profile picture",
        },
        metadata: {
          ...current.metadata,
          lastProfileUpdateAt: new Date().toISOString(),
        },
      }));
    };

    fileReader.onerror = () => {
      setToast({
        type: "error",
        title: "Profile Picture Error",
        message: "Failed to read the selected image file.",
      });
    };

    fileReader.readAsDataURL(selectedFile);
  };

  const handlePasswordFieldBlur = (field) => {
    setSecurityTouched((current) => ({
      ...current,
      [field]: true,
    }));
  };

  const togglePasswordVisibility = (field) => {
    setSecurityVisibility((current) => ({
      ...current,
      [field]: !current[field],
    }));
  };

  const handleLocalPasswordReview = () => {
    setSecurityTouched({
      currentPassword: true,
      newPassword: true,
      confirmPassword: true,
    });

    if (Object.values(securityValidationErrors).some(Boolean)) {
      setToast({
        type: "error",
        title: "Password Update Incomplete",
        message: "Review the password fields and try again.",
      });
      return;
    }

    setPreferences((current) => ({
      ...current,
      security: {
        ...current.security,
        lastLocalPasswordChangeAt: new Date().toISOString(),
      },
    }));
    setSecurityForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setSecurityTouched({
      currentPassword: false,
      newPassword: false,
      confirmPassword: false,
    });
    setSecurityVisibility({
      currentPassword: false,
      newPassword: false,
      confirmPassword: false,
    });
    setToast({
      type: "success",
      title: "Password Updated",
      message:
        "Password changed successfully. This frontend-only review did not modify backend authentication.",
    });
  };

  const handleSyncNow = async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setToast({
        type: "warning",
        title: "Offline Mode",
        message: "Reconnect to the internet before syncing DISTYNC records.",
      });
      return;
    }

    if (
      syncSummary[LOCAL_SYNC_STATUS.PENDING] === 0 &&
      syncSummary[LOCAL_SYNC_STATUS.FAILED] === 0
    ) {
      setToast({
        type: "info",
        title: "Nothing To Sync",
        message: "No pending records are waiting for sync right now.",
      });
      return;
    }

    setIsSyncingNow(true);

    try {
      await flushPendingSyncEntries();
      setToast({
        type: "success",
        title: "Sync Requested",
        message: "Sync processing started using the existing DISTYNC queue.",
      });
    } catch (error) {
      setToast({
        type: "error",
        title: "Sync Failed",
        message: error.message || "Failed to start the current sync request.",
      });
    } finally {
      setIsSyncingNow(false);
    }
  };

  const notificationRuleCount = notificationRules.length;
  const enabledRuleCodes =
    preferences.enabledNotificationRuleCodes?.length > 0
      ? preferences.enabledNotificationRuleCodes
      : notificationRules.map((rule) => rule.code);

  const distributionHistoryRows = useMemo(() => {
    const summaryRows = buildDistributionSummaryRows(distributionRows);
    const filteredRows = distributionFilters.status
      ? summaryRows.filter(
          (row) => row.statusLabel.toUpperCase() === distributionFilters.status,
        )
      : summaryRows;

    return filteredRows.sort((left, right) => {
      const leftTime = left.distributionDate
        ? new Date(left.distributionDate).getTime()
        : 0;
      const rightTime = right.distributionDate
        ? new Date(right.distributionDate).getTime()
        : 0;

      return distributionFilters.sort_order === "oldest"
        ? leftTime - rightTime
        : rightTime - leftTime;
    });
  }, [distributionFilters.sort_order, distributionFilters.status, distributionRows]);

  const distributionEventOptions = useMemo(() => {
    const options = new Map();

    activeDisasterEvents.forEach((eventRow) => {
      options.set(eventRow.id, {
        id: eventRow.id,
        label: `${eventRow.event_code || "--"} - ${eventRow.title || "--"}`,
      });
    });

    distributionRows.forEach((row) => {
      if (!row.disaster_event_id) {
        return;
      }

      if (!options.has(row.disaster_event_id)) {
        options.set(row.disaster_event_id, {
          id: row.disaster_event_id,
          label: `${row.event_code || "--"} - ${row.disaster_event_title || "--"}`,
        });
      }
    });

    return Array.from(options.values());
  }, [activeDisasterEvents, distributionRows]);

  const syncHistoryLogRows = useMemo(() => {
    return [
      ...(syncHistory.transactions || []).map((transaction, index) => ({
        id: `transaction-${transaction.id || index}`,
        timestamp:
          transaction.synced_at ||
          transaction.created_at ||
          transaction.client_timestamp ||
          transaction.updated_at ||
          "",
        label: String(transaction.module_name || "record").replace(/[_-]/g, " "),
        status:
          transaction.sync_status ||
          transaction.status ||
          LOCAL_SYNC_STATUS.SYNCED,
        detail: buildPayloadSummary(
          safeParsePayload(transaction.payload_json || transaction.payload || {}),
        ),
      })),
      ...(syncHistory.conflicts || []).map((conflict, index) => ({
        id: `conflict-${conflict.id || index}`,
        timestamp:
          conflict.updated_at || conflict.created_at || conflict.resolved_at || "",
        label: String(conflict.entity_type || "record").replace(/[_-]/g, " "),
        status: conflict.status === "RESOLVED" ? "RESOLVED" : "CONFLICT",
        detail: conflict.conflict_type || "Conflict detected during sync.",
      })),
    ].sort((left, right) => {
      const leftTime = left.timestamp ? new Date(left.timestamp).getTime() : 0;
      const rightTime = right.timestamp ? new Date(right.timestamp).getTime() : 0;
      return rightTime - leftTime;
    });
  }, [syncHistory]);

  const activityLogs = useMemo(
    () =>
      buildActivityLogs({
        distributionRows,
        syncEntries,
        syncHistory,
      }).slice(0, 16),
    [distributionRows, syncEntries, syncHistory],
  );
  const securityActivityLogs = useMemo(
    () => buildSecurityActivityLogs(preferences),
    [preferences],
  );
  const localSyncLogRows = useMemo(
    () =>
      syncEntries
        .map((entry) => ({
          id: entry.id,
          timestamp:
            entry.updatedAt ||
            entry.createdAt ||
            entry.clientTimestamp ||
            entry.syncedAt ||
            "",
          label: formatQueueEntryTitle(entry),
          status: entry.status || LOCAL_SYNC_STATUS.PENDING,
          detail: entry.moduleName
            ? String(entry.moduleName).replace(/[_-]/g, " ")
            : entry.actionKey || "--",
        }))
        .sort((left, right) => {
          const leftTime = left.timestamp ? new Date(left.timestamp).getTime() : 0;
          const rightTime = right.timestamp ? new Date(right.timestamp).getTime() : 0;
          return rightTime - leftTime;
        }),
    [syncEntries],
  );

  const activeBarangaySection = useMemo(
    () =>
      BARANGAY_SETTINGS_SECTIONS.find((section) => section.key === activeSection) ||
      null,
    [activeSection],
  );
  const activeMswdoSection = useMemo(
    () =>
      MSWDO_SETTINGS_SECTIONS.find((section) => section.key === activeSection) || null,
    [activeSection],
  );
  const activeMayorSection = useMemo(
    () =>
      MAYOR_SETTINGS_SECTIONS.find((section) => section.key === activeSection) || null,
    [activeSection],
  );

  const barangaySectionCards = useMemo(() => {
    const syncStatus = getSyncStatusMeta(syncSummary, isOnline);

    return BARANGAY_SETTINGS_SECTIONS.map((section) => {
      switch (section.key) {
        case "profile":
          return {
            ...section,
            statusTone: preferences.profile.fullName ? "success" : "warning",
            statusLabel: preferences.profile.fullName
              ? "Profile ready"
              : "Needs details",
          };
        case "security":
          return {
            ...section,
            statusTone: preferences.security.twoFactorEnabled ? "success" : "info",
            statusLabel: preferences.security.twoFactorEnabled
              ? "2FA preferred"
              : "Review settings",
          };
        case "notification-preferences":
          return {
            ...section,
            statusTone: enabledRuleCodes.length > 0 ? "success" : "warning",
            statusLabel: `${enabledRuleCodes.length} rules enabled`,
          };
        case "distribution-history":
          return {
            ...section,
            statusTone: distributionHistoryRows.length > 0 ? "info" : "warning",
            statusLabel: `${distributionHistoryRows.length} records`,
          };
        case "sync-center":
          return {
            ...section,
            statusTone: syncStatus.tone,
            statusLabel: syncStatus.label,
          };
        case "activity-logs":
          return {
            ...section,
            statusTone: activityLogs.length > 0 ? "info" : "warning",
            statusLabel:
              activityLogs.length > 0
                ? `${activityLogs.length} recent items`
                : "No recent items",
          };
        default:
          return {
            ...section,
            statusTone: "info",
            statusLabel: "Open section",
          };
      }
    });
  }, [
    activityLogs.length,
    distributionHistoryRows.length,
    enabledRuleCodes.length,
    isOnline,
    preferences.profile.fullName,
    preferences.security.twoFactorEnabled,
    syncSummary,
  ]);
  const mswdoSectionCards = useMemo(() => {
    const syncStatus = getSyncStatusMeta(syncSummary, isOnline);

    return MSWDO_SETTINGS_SECTIONS.map((section) => {
      switch (section.key) {
        case "profile":
          return {
            ...section,
            statusTone: preferences.profile.fullName ? "success" : "warning",
            statusLabel: preferences.profile.fullName
              ? "Profile ready"
              : "Needs details",
          };
        case "security":
          return {
            ...section,
            statusTone: preferences.security.twoFactorEnabled ? "success" : "info",
            statusLabel: preferences.security.twoFactorEnabled
              ? "2FA preferred"
              : "Review settings",
          };
        case "notification-preferences":
          return {
            ...section,
            statusTone: enabledRuleCodes.length > 0 ? "success" : "warning",
            statusLabel:
              notificationRuleCount > 0
                ? `${enabledRuleCodes.length} rules enabled`
                : "No role rules found",
          };
        case "sync-center":
          return {
            ...section,
            statusTone: syncStatus.tone,
            statusLabel: syncStatus.label,
          };
        case "report-preferences":
          return {
            ...section,
            statusTone: "info",
            statusLabel: `${(
              preferences.preferredExportFormat || "excel"
            ).toUpperCase()} selected`,
          };
        default:
          return {
            ...section,
            statusTone: "info",
            statusLabel: "Open section",
          };
      }
    });
  }, [
    enabledRuleCodes.length,
    isOnline,
    notificationRuleCount,
    preferences.preferredExportFormat,
    preferences.profile.fullName,
    preferences.security.twoFactorEnabled,
    syncSummary,
  ]);
  const mayorSectionCards = useMemo(() => {
    const syncStatus = getSyncStatusMeta(syncSummary, isOnline);

    return MAYOR_SETTINGS_SECTIONS.map((section) => {
      switch (section.key) {
        case "profile":
          return {
            ...section,
            statusTone: preferences.profile.fullName ? "success" : "warning",
            statusLabel: preferences.profile.fullName
              ? "Profile ready"
              : "Needs details",
          };
        case "security":
          return {
            ...section,
            statusTone: preferences.security.twoFactorEnabled ? "success" : "info",
            statusLabel: preferences.security.twoFactorEnabled
              ? "2FA preferred"
              : "Review settings",
          };
        case "notification-preferences":
          return {
            ...section,
            statusTone: enabledRuleCodes.length > 0 ? "success" : "warning",
            statusLabel:
              notificationRuleCount > 0
                ? `${enabledRuleCodes.length} rules enabled`
                : "No role rules found",
          };
        case "sync-status":
          return {
            ...section,
            statusTone: syncStatus.tone,
            statusLabel: syncStatus.label,
          };
        case "analytics-service":
          return {
            ...section,
            statusTone: forecastHealth
              ? forecastHealth.status === "Online"
                ? "success"
                : forecastHealth.status === "Offline"
                  ? "error"
                  : "warning"
              : "warning",
            statusLabel: forecastHealth?.status || "Unavailable",
          };
        case "inventory-alert-thresholds":
          return {
            ...section,
            statusTone:
              (inventoryThresholdSummary?.configured_items || 0) > 0
                ? "info"
                : "warning",
            statusLabel: `${
              inventoryThresholdSummary?.configured_items || 0
            } items tracked`,
          };
        case "local-preferences":
          return {
            ...section,
            statusTone: "info",
            statusLabel: `${(
              preferences.preferredExportFormat || "excel"
            ).toUpperCase()} selected`,
          };
        default:
          return {
            ...section,
            statusTone: "info",
            statusLabel: "Open section",
          };
      }
    });
  }, [
    enabledRuleCodes.length,
    forecastHealth,
    inventoryThresholdSummary?.configured_items,
    isOnline,
    notificationRuleCount,
    preferences.preferredExportFormat,
    preferences.profile.fullName,
    preferences.security.twoFactorEnabled,
    syncSummary,
  ]);

  const barangayPageActions = activeBarangaySection
    ? [
        {
          label: "Back to Categories",
          onClick: () => setActiveSection(null),
          variant: "secondary",
        },
        ...(
          EDITABLE_BARANGAY_SECTION_KEYS.has(activeBarangaySection.key)
            ? [
                {
                  label: isSavingPreferences ? "Saving..." : "Save Barangay Settings",
                  onClick: handleSavePreferences,
                  disabled: isSavingPreferences,
                },
              ]
            : []
        ),
      ]
    : [];
  const mswdoPageActions = activeMswdoSection
    ? [
        {
          label: "Back to Categories",
          onClick: () => setActiveSection(null),
          variant: "secondary",
        },
        ...(
          EDITABLE_MSWDO_SECTION_KEYS.has(activeMswdoSection.key)
            ? [
                {
                  label: isSavingPreferences ? "Saving..." : "Save MSWDO Settings",
                  onClick: handleSavePreferences,
                  disabled: isSavingPreferences,
                },
              ]
            : []
        ),
      ]
    : [];
  const mayorPageActions = activeMayorSection
    ? [
        {
          label: "Back to Categories",
          onClick: () => setActiveSection(null),
          variant: "secondary",
        },
        ...(
          EDITABLE_MAYOR_SECTION_KEYS.has(activeMayorSection.key)
            ? [
                {
                  label: isSavingPreferences ? "Saving..." : "Save Mayor Settings",
                  onClick: handleSavePreferences,
                  disabled: isSavingPreferences,
                },
              ]
            : []
        ),
      ]
    : [];

  const safePreferences = normalizeRolePreferences(preferences);
  const safeNotificationRules = ensureArray(notificationRules);
  const safeSecurityActivityLogs = ensureArray(securityActivityLogs);
  const safeEnabledRuleCodes = ensureArray(enabledRuleCodes);
  const safeSyncSummary = {
    total: Number(syncSummary?.total || 0),
    [LOCAL_SYNC_STATUS.PENDING]: Number(syncSummary?.[LOCAL_SYNC_STATUS.PENDING] || 0),
    [LOCAL_SYNC_STATUS.SYNCED]: Number(syncSummary?.[LOCAL_SYNC_STATUS.SYNCED] || 0),
    [LOCAL_SYNC_STATUS.FAILED]: Number(syncSummary?.[LOCAL_SYNC_STATUS.FAILED] || 0),
    [LOCAL_SYNC_STATUS.CONFLICT]: Number(syncSummary?.[LOCAL_SYNC_STATUS.CONFLICT] || 0),
  };
  const safeUnreadCount = Number(unreadCount || 0);
  const safeNotificationRuleCount = Number(notificationRuleCount || 0);
  const safeDistributionFilters = ensureObject(distributionFilters, {
    disaster_event_id: "",
    status: "",
    date_from: "",
    date_to: "",
    sort_order: "latest",
  });
  const safeDistributionEventOptions = ensureArray(distributionEventOptions);
  const safeDistributionHistoryRows = ensureArray(distributionHistoryRows);
  const safeSyncHistoryLogRows = ensureArray(syncHistoryLogRows);
  const safeActivityLogs = ensureArray(activityLogs);
  const safeLocalSyncLogRows = ensureArray(localSyncLogRows);
  const safeForecastHealth = ensureObject(forecastHealth, null);
  const safeInventoryThresholdSummary = {
    configured_items: Number(inventoryThresholdSummary?.configured_items || 0),
    distinct_thresholds: ensureArray(inventoryThresholdSummary?.distinct_thresholds),
  };
  const safeNotificationValidationErrors = ensureObject(
    notificationValidationErrors,
    {},
  );

  const sharedRoleViewContext = {
    shellStyles,
    gridStyles,
    cardStyles,
    inputStyles,
    helperTextStyles,
    errorTextStyles,
    tableStyles,
    pageHeaderStyles,
    preferences: safePreferences,
    profileTouched,
    profileErrors,
    authenticatedUser,
    formatPhilippineContactNumberForDisplay,
    handleProfileFieldChange,
    handleProfileFieldBlur,
    profilePictureInputRef,
    handleProfilePictureChange,
    setPreferences,
    securityVisibility,
    securityForm,
    setSecurityForm,
    handlePasswordFieldBlur,
    securityTouched,
    securityValidationErrors,
    togglePasswordVisibility,
    handleLocalPasswordReview,
    formatDateTime,
    formatSyncDateTime,
    InfoRow,
    EmptyState,
    isLoading,
    securityActivityLogs: safeSecurityActivityLogs,
    notificationRules: safeNotificationRules,
    enabledRuleCodes: safeEnabledRuleCodes,
    toggleNotificationRule,
    navigate,
    handleSyncNow,
    isSyncingNow,
    syncSummary: safeSyncSummary,
    LOCAL_SYNC_STATUS,
    getSyncStatusMeta,
    isOnline,
    ROLE_DISPLAY_NAMES,
    ROLE_CODES,
    unreadCount: safeUnreadCount,
    notificationRuleCount: safeNotificationRuleCount,
  };

  const barangayViewContext = {
    ...sharedRoleViewContext,
    BARANGAY_POSITION_LABEL,
    assignedBarangayName,
    notificationTouched,
    notificationValidationErrors: safeNotificationValidationErrors,
    handleResetNotificationPreferences,
    BARANGAY_NOTIFICATION_OPTIONS,
    handleNotificationChannelToggle,
    distributionFilters: safeDistributionFilters,
    setDistributionFilters,
    distributionEventOptions: safeDistributionEventOptions,
    distributionErrorMessage,
    isLoadingDistributionHistory,
    distributionHistoryRows: safeDistributionHistoryRows,
    syncHistoryLogRows: safeSyncHistoryLogRows,
    syncHistoryErrorMessage,
    isLoadingSyncHistory,
    activityLogs: safeActivityLogs,
  };

  const mswdoViewContext = {
    ...sharedRoleViewContext,
    notificationTouched,
    notificationValidationErrors: safeNotificationValidationErrors,
    handleResetNotificationPreferences,
    BARANGAY_NOTIFICATION_OPTIONS,
    handleNotificationChannelToggle,
    localSyncLogRows: safeLocalSyncLogRows,
  };

  const mayorViewContext = {
    ...sharedRoleViewContext,
    notificationTouched,
    notificationValidationErrors: safeNotificationValidationErrors,
    handleResetNotificationPreferences,
    BARANGAY_NOTIFICATION_OPTIONS,
    handleNotificationChannelToggle,
    localSyncLogRows: safeLocalSyncLogRows,
    forecastHealth: safeForecastHealth,
    inventoryThresholdSummary: safeInventoryThresholdSummary,
  };
  if (isBarangayRole) {
    return (
      <BarangaySettingsView
        activeSection={activeSection}
        activeSectionMeta={activeBarangaySection}
        roleMeta={roleMeta}
        pageActions={barangayPageActions}
        errorMessage={errorMessage}
        sectionCards={barangaySectionCards}
        onOpenSection={setActiveSection}
        toast={toast}
        onCloseToast={() => setToast({ message: "", type: "info", title: "" })}
        settingsHubStyles={settingsHubStyles}
        labelStyles={labelStyles}
        mutedValueStyles={mutedValueStyles}
        StatusChip={StatusChip}
        ctx={barangayViewContext}
      />
    );
  }

  if (isMswdoRole) {
    return (
      <MswdoSettingsView
        activeSection={activeSection}
        activeSectionMeta={activeMswdoSection}
        roleMeta={roleMeta}
        pageActions={mswdoPageActions}
        errorMessage={errorMessage}
        sectionCards={mswdoSectionCards}
        onOpenSection={setActiveSection}
        toast={toast}
        onCloseToast={() => setToast({ message: "", type: "info", title: "" })}
        settingsHubStyles={settingsHubStyles}
        labelStyles={labelStyles}
        mutedValueStyles={mutedValueStyles}
        StatusChip={StatusChip}
        ctx={mswdoViewContext}
      />
    );
  }

  if (isMayorRole) {
    return (
      <MayorSettingsView
        activeSection={activeSection}
        activeSectionMeta={activeMayorSection}
        roleMeta={roleMeta}
        pageActions={mayorPageActions}
        errorMessage={errorMessage}
        sectionCards={mayorSectionCards}
        onOpenSection={setActiveSection}
        toast={toast}
        onCloseToast={() => setToast({ message: "", type: "info", title: "" })}
        settingsHubStyles={settingsHubStyles}
        labelStyles={labelStyles}
        mutedValueStyles={mutedValueStyles}
        StatusChip={StatusChip}
        ctx={mayorViewContext}
      />
    );
  }

  return (
    <>
      <PageHeader title={roleMeta.title} description={roleMeta.description} />

      {errorMessage ? (
        <section style={shellStyles.card}>
          <p style={{ margin: 0, color: "#9d4d58", fontWeight: 700 }}>
            {errorMessage}
          </p>
        </section>
      ) : null}

      <section style={shellStyles.card}>
        <div style={gridStyles}>
          <article style={cardStyles}>
            <h3 style={{ margin: 0, color: "#17324d" }}>Office Profile</h3>
            <InfoRow
              label="Account Name"
              value={
                [authenticatedUser?.first_name, authenticatedUser?.last_name]
                  .filter(Boolean)
                  .join(" ") || "--"
              }
            />
            <InfoRow label="Email" value={authenticatedUser?.email || "--"} muted />
            <InfoRow label="Role" value={currentRole || "--"} />
          </article>

          <article style={cardStyles}>
            <h3 style={{ margin: 0, color: "#17324d" }}>Notification Status</h3>
            {isLoading ? (
              <EmptyState message="Loading notification settings..." />
            ) : (
              <>
                <InfoRow label="Unread Notifications" value={`${unreadCount}`} />
                <InfoRow
                  label="Active Rules for This Role"
                  value={`${notificationRuleCount}`}
                />
                <StatusChip
                  tone={notificationRuleCount > 0 ? "success" : "warning"}
                  label={
                    notificationRuleCount > 0
                      ? "Rules Available"
                      : "No Role Rules Found"
                  }
                />
              </>
            )}
          </article>

          <article style={cardStyles}>
            <h3 style={{ margin: 0, color: "#17324d" }}>Sync Status</h3>
            <InfoRow label="Connection" value={isOnline ? "Online" : "Offline"} />
            <InfoRow
              label="Pending Queue Entries"
              value={`${syncSummary[LOCAL_SYNC_STATUS.PENDING] || 0}`}
            />
            <InfoRow
              label="Failed / Conflict Entries"
              value={`${
                (syncSummary[LOCAL_SYNC_STATUS.FAILED] || 0) +
                (syncSummary[LOCAL_SYNC_STATUS.CONFLICT] || 0)
              }`}
            />
            <StatusChip
              tone={
                syncSummary[LOCAL_SYNC_STATUS.FAILED] > 0 ||
                syncSummary[LOCAL_SYNC_STATUS.CONFLICT] > 0
                  ? "error"
                  : syncSummary[LOCAL_SYNC_STATUS.PENDING] > 0
                    ? "warning"
                    : "success"
              }
              label={
                syncSummary[LOCAL_SYNC_STATUS.FAILED] > 0 ||
                syncSummary[LOCAL_SYNC_STATUS.CONFLICT] > 0
                  ? "Needs Review"
                  : syncSummary[LOCAL_SYNC_STATUS.PENDING] > 0
                    ? "Pending Sync"
                    : "Synced"
              }
            />
          </article>
        </div>
      </section>

      {currentRole === ROLE_CODES.MAYOR ? (
        <section style={shellStyles.card}>
          <div style={gridStyles}>
            <article style={cardStyles}>
              <h3 style={{ margin: 0, color: "#17324d" }}>Analytics Service</h3>
              {isLoading ? (
                <EmptyState message="Checking analytics service..." />
              ) : forecastHealth ? (
                <>
                  <InfoRow
                    label="Service Status"
                    value={forecastHealth.status || "Online"}
                  />
                  <InfoRow
                    label="Checked Endpoint"
                    value={forecastHealth.analytics_url || "--"}
                    muted
                  />
                  <StatusChip
                    tone={
                      forecastHealth.status === "Online"
                        ? "success"
                        : forecastHealth.status === "Offline"
                          ? "error"
                          : "warning"
                    }
                    label={forecastHealth.status || "Unavailable"}
                  />
                </>
              ) : (
                <>
                  <EmptyState message="Analytics service unavailable." />
                  <StatusChip tone="error" label="Unavailable" />
                </>
              )}
            </article>

            <article style={cardStyles}>
              <h3 style={{ margin: 0, color: "#17324d" }}>Inventory Alert Thresholds</h3>
              <p style={mutedValueStyles}>
                Thresholds are currently operational values tied to inventory records
                and service logic. This page shows them read-only for safety.
              </p>
              <InfoRow
                label="Configured Active Items"
                value={`${inventoryThresholdSummary?.configured_items || 0}`}
              />
              <InfoRow
                label="Distinct Threshold Values"
                value={
                  inventoryThresholdSummary?.distinct_thresholds?.length
                    ? inventoryThresholdSummary.distinct_thresholds.join(", ")
                    : "No thresholds loaded"
                }
              />
            </article>

            <article style={cardStyles}>
              <h3 style={{ margin: 0, color: "#17324d" }}>Export Preferences</h3>
              <p style={mutedValueStyles}>
                This export format preference is saved locally for this account and can
                be reused by future report screens safely.
              </p>
              <select
                value={preferences.preferredExportFormat}
                onChange={(event) =>
                  setPreferences((current) => ({
                    ...current,
                    preferredExportFormat: event.target.value,
                  }))
                }
                style={inputStyles.field}
              >
                <option value="csv">CSV</option>
                <option value="excel">Excel</option>
                <option value="pdf">PDF</option>
              </select>
            </article>
          </div>
        </section>
      ) : null}

      <section style={shellStyles.card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "20px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "grid", gap: "8px", flex: "1 1 320px" }}>
            <h3 style={{ margin: 0, color: "#17324d" }}>Local Preferences</h3>
            <p style={mutedValueStyles}>
              These preferences are stored locally for this signed-in role. They do
              not change backend permission rules or core workflow behavior.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSavePreferences}
            disabled={isSavingPreferences}
            style={pageHeaderStyles.primaryButton}
          >
            {isSavingPreferences ? "Saving..." : "Save Preferences"}
          </button>
        </div>

        <div style={{ ...gridStyles, marginTop: "18px" }}>
          <article style={cardStyles}>
            <h3 style={{ margin: 0, color: "#17324d" }}>Notification Preferences</h3>
            {notificationRules.length === 0 ? (
              <EmptyState message="No notification rules are currently mapped to this role." />
            ) : (
              <div style={{ display: "grid", gap: "10px" }}>
                {notificationRules.map((rule) => {
                  const isEnabled = enabledRuleCodes.includes(rule.code);

                  return (
                    <label
                      key={rule.id}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        color: "#21405f",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => toggleNotificationRule(rule.code)}
                        style={{ marginTop: "3px" }}
                      />
                      <span>
                        <strong>{rule.name}</strong>
                        <span style={{ ...mutedValueStyles, display: "block" }}>
                          {rule.trigger_type} ({rule.is_active ? "Active" : "Inactive"})
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </article>

          <article style={cardStyles}>
            <h3 style={{ margin: 0, color: "#17324d" }}>Preference Summary</h3>
            <InfoRow
              label="Notification Rules Enabled Locally"
              value={`${enabledRuleCodes.length}`}
            />
            <InfoRow
              label="Preferred Export Format"
              value={preferences.preferredExportFormat?.toUpperCase() || "EXCEL"}
            />
          </article>
        </div>
      </section>

      <FeedbackToast
        message={toast.message}
        type={toast.type}
        title={toast.title}
        onClose={() => setToast({ message: "", type: "info", title: "" })}
      />
    </>
  );
};

export default RoleSettingsPage;
