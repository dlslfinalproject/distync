import { formatSyncDateTime } from "../../features/sync/syncManagementHelpers";
import { ROLE_CODES } from "../../utils/roleSession";
import {
  BARANGAY_NOTIFICATION_OPTIONS,
  BARANGAY_POSITION_LABEL,
  BARANGAY_SETTINGS_SECTIONS,
  MAYOR_SETTINGS_SECTIONS,
  MSWDO_SETTINGS_SECTIONS,
  ROLE_DISPLAY_NAMES,
} from "./settingsConfig";
import {
  LOCAL_SYNC_STATUS,
  ensureArray,
  ensureObject,
  formatDateTime,
  formatPhilippineContactNumberForDisplay,
  getSyncStatusMeta,
  normalizeRolePreferences,
} from "./settingsHelpers";

const buildSafeSyncSummary = (syncSummary) => ({
  total: Number(syncSummary?.total || 0),
  [LOCAL_SYNC_STATUS.PENDING]: Number(syncSummary?.[LOCAL_SYNC_STATUS.PENDING] || 0),
  [LOCAL_SYNC_STATUS.SYNCED]: Number(syncSummary?.[LOCAL_SYNC_STATUS.SYNCED] || 0),
  [LOCAL_SYNC_STATUS.FAILED]: Number(syncSummary?.[LOCAL_SYNC_STATUS.FAILED] || 0),
  [LOCAL_SYNC_STATUS.CONFLICT]: Number(syncSummary?.[LOCAL_SYNC_STATUS.CONFLICT] || 0),
});

export const getSectionsForRole = ({
  isBarangayRole,
  isMswdoRole,
  isMayorRole,
}) => {
  if (isBarangayRole) {
    return BARANGAY_SETTINGS_SECTIONS;
  }

  if (isMswdoRole) {
    return MSWDO_SETTINGS_SECTIONS;
  }

  if (isMayorRole) {
    return MAYOR_SETTINGS_SECTIONS;
  }

  return [];
};

export const getActiveSettingsSection = (sections, activeSection) =>
  sections.find((section) => section.key === activeSection) || null;

export const buildBarangaySectionCards = ({
  preferences,
  enabledRuleCodes,
  activityLogs,
}) => {
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
};

export const buildMswdoSectionCards = ({
  preferences,
  enabledRuleCodes,
  notificationRuleCount,
  syncSummary,
  isOnline,
}) => {
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
      default:
        return {
          ...section,
          statusTone: "info",
          statusLabel: "Open section",
        };
    }
  });
};

export const buildMayorSectionCards = ({
  preferences,
  enabledRuleCodes,
  notificationRuleCount,
  syncSummary,
  isOnline,
  forecastHealth,
  inventoryThresholdSummary,
}) => {
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
      default:
        return {
          ...section,
          statusTone: "info",
          statusLabel: "Open section",
        };
    }
  });
};

export const buildSettingsPageActions = ({
  activeSectionMeta,
  editableSectionKeys,
  isSavingPreferences,
  saveLabel,
  onBack,
  onSave,
}) => {
  if (!activeSectionMeta) {
    return [];
  }

  return [
    {
      label: "Back to Categories",
      onClick: onBack,
      variant: "secondary",
    },
    ...(
      editableSectionKeys.has(activeSectionMeta.key)
        ? [
            {
              label: isSavingPreferences ? "Saving..." : saveLabel,
              onClick: onSave,
              disabled: isSavingPreferences,
            },
          ]
        : []
    ),
  ];
};

export const buildSharedRoleViewContext = ({
  shellStyles,
  gridStyles,
  cardStyles,
  inputStyles,
  helperTextStyles,
  errorTextStyles,
  tableStyles,
  pageHeaderStyles,
  preferences,
  profileTouched,
  profileErrors,
  authenticatedUser,
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
  InfoRow,
  EmptyState,
  isLoading,
  securityActivityLogs,
}) => ({
  shellStyles,
  gridStyles,
  cardStyles,
  inputStyles,
  helperTextStyles,
  errorTextStyles,
  tableStyles,
  pageHeaderStyles,
  preferences: normalizeRolePreferences(preferences),
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
  securityActivityLogs: ensureArray(securityActivityLogs),
});

export const buildBarangayViewContext = ({
  sharedContext,
  assignedBarangayName,
  notificationTouched,
  notificationValidationErrors,
  handleResetNotificationPreferences,
  handleNotificationChannelToggle,
  notificationRules,
  enabledRuleCodes,
  toggleNotificationRule,
  activityLogs,
}) => ({
  ...sharedContext,
  BARANGAY_POSITION_LABEL,
  assignedBarangayName,
  notificationTouched,
  notificationValidationErrors: ensureObject(notificationValidationErrors, {}),
  handleResetNotificationPreferences,
  BARANGAY_NOTIFICATION_OPTIONS,
  handleNotificationChannelToggle,
  notificationRules: ensureArray(notificationRules),
  enabledRuleCodes: ensureArray(enabledRuleCodes),
  toggleNotificationRule,
  activityLogs: ensureArray(activityLogs),
});

export const buildMswdoViewContext = ({
  sharedContext,
  notificationTouched,
  notificationValidationErrors,
  handleResetNotificationPreferences,
  handleNotificationChannelToggle,
  notificationRules,
  enabledRuleCodes,
  toggleNotificationRule,
  unreadCount,
  notificationRuleCount,
  navigate,
  handleSyncNow,
  isSyncingNow,
  syncSummary,
  isOnline,
  localSyncLogRows,
}) => ({
  ...sharedContext,
  notificationTouched,
  notificationValidationErrors: ensureObject(notificationValidationErrors, {}),
  handleResetNotificationPreferences,
  BARANGAY_NOTIFICATION_OPTIONS,
  handleNotificationChannelToggle,
  notificationRules: ensureArray(notificationRules),
  enabledRuleCodes: ensureArray(enabledRuleCodes),
  toggleNotificationRule,
  unreadCount: Number(unreadCount || 0),
  notificationRuleCount: Number(notificationRuleCount || 0),
  navigate,
  handleSyncNow,
  isSyncingNow,
  syncSummary: buildSafeSyncSummary(syncSummary),
  LOCAL_SYNC_STATUS,
  getSyncStatusMeta,
  isOnline,
  ROLE_DISPLAY_NAMES,
  ROLE_CODES,
  localSyncLogRows: ensureArray(localSyncLogRows),
});

export const buildMayorViewContext = ({
  sharedContext,
  notificationTouched,
  notificationValidationErrors,
  handleResetNotificationPreferences,
  handleNotificationChannelToggle,
  notificationRules,
  enabledRuleCodes,
  toggleNotificationRule,
  unreadCount,
  notificationRuleCount,
  navigate,
  handleSyncNow,
  isSyncingNow,
  syncSummary,
  isOnline,
  localSyncLogRows,
  forecastHealth,
  inventoryThresholdSummary,
}) => ({
  ...sharedContext,
  notificationTouched,
  notificationValidationErrors: ensureObject(notificationValidationErrors, {}),
  handleResetNotificationPreferences,
  BARANGAY_NOTIFICATION_OPTIONS,
  handleNotificationChannelToggle,
  notificationRules: ensureArray(notificationRules),
  enabledRuleCodes: ensureArray(enabledRuleCodes),
  toggleNotificationRule,
  unreadCount: Number(unreadCount || 0),
  notificationRuleCount: Number(notificationRuleCount || 0),
  navigate,
  handleSyncNow,
  isSyncingNow,
  syncSummary: buildSafeSyncSummary(syncSummary),
  LOCAL_SYNC_STATUS,
  getSyncStatusMeta,
  isOnline,
  ROLE_DISPLAY_NAMES,
  ROLE_CODES,
  localSyncLogRows: ensureArray(localSyncLogRows),
  forecastHealth: ensureObject(forecastHealth, null),
  inventoryThresholdSummary: {
    configured_items: Number(inventoryThresholdSummary?.configured_items || 0),
    distinct_thresholds: ensureArray(inventoryThresholdSummary?.distinct_thresholds),
  },
});
