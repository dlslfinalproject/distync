import { formatSyncDateTime } from "../../features/sync/syncManagementHelpers";
import { ROLE_CODES } from "../../utils/roleSession";
import {
  BARANGAY_SETTINGS_SECTIONS,
  MAYOR_SETTINGS_SECTIONS,
  MSWDO_SETTINGS_SECTIONS,
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
import {
  buildBarangayProfileSectionProps,
  buildNotificationSectionProps,
  buildOfficeProfileSectionProps,
  buildSecuritySectionProps,
  getSettingsDashboardDescription,
} from "./settingsViewContent";

const buildSafeSyncSummary = (syncSummary) => ({
  total: Number(syncSummary?.total || 0),
  [LOCAL_SYNC_STATUS.PENDING]: Number(syncSummary?.[LOCAL_SYNC_STATUS.PENDING] || 0),
  [LOCAL_SYNC_STATUS.SYNCED]: Number(syncSummary?.[LOCAL_SYNC_STATUS.SYNCED] || 0),
  [LOCAL_SYNC_STATUS.FAILED]: Number(syncSummary?.[LOCAL_SYNC_STATUS.FAILED] || 0),
  [LOCAL_SYNC_STATUS.CONFLICT]: Number(syncSummary?.[LOCAL_SYNC_STATUS.CONFLICT] || 0),
});

const buildDefaultSectionCard = (section, statusTone = "info", statusLabel = "Open section") => ({
  ...section,
  statusTone,
  statusLabel,
});

const buildProfileSectionCard = (section, preferences) =>
  buildDefaultSectionCard(
    section,
    preferences.profile.fullName ? "success" : "warning",
    preferences.profile.fullName ? "Profile ready" : "Needs details",
  );

const buildSecuritySectionCard = (section, preferences) =>
  buildDefaultSectionCard(
    section,
    preferences.security.twoFactorEnabled ? "success" : "info",
    preferences.security.twoFactorEnabled ? "2FA preferred" : "Review settings",
  );

const buildNotificationSectionCard = (
  section,
  enabledRuleCodes,
  notificationRuleCount,
) =>
  buildDefaultSectionCard(
    section,
    enabledRuleCodes.length > 0 ? "success" : "warning",
    notificationRuleCount > 0
      ? `${enabledRuleCodes.length} rules enabled`
      : "No role rules found",
  );

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
        return buildProfileSectionCard(section, preferences);
      case "security":
        return buildSecuritySectionCard(section, preferences);
      case "notification-preferences":
        return buildDefaultSectionCard(
          section,
          enabledRuleCodes.length > 0 ? "success" : "warning",
          `${enabledRuleCodes.length} rules enabled`,
        );
      case "activity-logs":
        return buildDefaultSectionCard(
          section,
          activityLogs.length > 0 ? "info" : "warning",
          activityLogs.length > 0
            ? `${activityLogs.length} recent items`
            : "No recent items",
        );
      default:
        return buildDefaultSectionCard(section);
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
        return buildProfileSectionCard(section, preferences);
      case "security":
        return buildSecuritySectionCard(section, preferences);
      case "notification-preferences":
        return buildNotificationSectionCard(
          section,
          enabledRuleCodes,
          notificationRuleCount,
        );
      case "sync-center":
        return buildDefaultSectionCard(section, syncStatus.tone, syncStatus.label);
      default:
        return buildDefaultSectionCard(section);
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
        return buildProfileSectionCard(section, preferences);
      case "security":
        return buildSecuritySectionCard(section, preferences);
      case "notification-preferences":
        return buildNotificationSectionCard(
          section,
          enabledRuleCodes,
          notificationRuleCount,
        );
      case "sync-status":
        return buildDefaultSectionCard(section, syncStatus.tone, syncStatus.label);
      case "analytics-service":
        return buildDefaultSectionCard(
          section,
          forecastHealth
            ? forecastHealth.status === "Online"
              ? "success"
              : forecastHealth.status === "Offline"
                ? "error"
                : "warning"
            : "warning",
          forecastHealth?.status || "Unavailable",
        );
      case "inventory-alert-thresholds":
        return buildDefaultSectionCard(
          section,
          (inventoryThresholdSummary?.configured_items || 0) > 0
            ? "info"
            : "warning",
          `${inventoryThresholdSummary?.configured_items || 0} items tracked`,
        );
      default:
        return buildDefaultSectionCard(section);
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
  labelStyles,
  mutedValueStyles,
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
  StatusChip,
  InfoRow,
  EmptyState,
  isLoading,
  securityActivityLogs,
}) => ({
  shellStyles,
  gridStyles,
  cardStyles,
  inputStyles,
  labelStyles,
  mutedValueStyles,
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
  StatusChip,
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
  assignedBarangayName,
  roleCode: ROLE_CODES.BARANGAY,
  profileSectionProps: buildBarangayProfileSectionProps({
    ...sharedContext,
    assignedBarangayName,
  }),
  securitySectionProps: buildSecuritySectionProps({
    ...sharedContext,
    roleCode: ROLE_CODES.BARANGAY,
  }),
  notificationSectionProps: buildNotificationSectionProps({
    ...sharedContext,
    roleCode: ROLE_CODES.BARANGAY,
    notificationTouched,
    notificationValidationErrors: ensureObject(notificationValidationErrors, {}),
    handleResetNotificationPreferences,
    handleNotificationChannelToggle,
    notificationRules: ensureArray(notificationRules),
    enabledRuleCodes: ensureArray(enabledRuleCodes),
    toggleNotificationRule,
  }),
  dashboardDescription: getSettingsDashboardDescription(ROLE_CODES.BARANGAY),
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
  roleCode: ROLE_CODES.MSWDO,
  profileSectionProps: buildOfficeProfileSectionProps({
    ...sharedContext,
    roleCode: ROLE_CODES.MSWDO,
  }),
  securitySectionProps: buildSecuritySectionProps({
    ...sharedContext,
    roleCode: ROLE_CODES.MSWDO,
  }),
  notificationSectionProps: buildNotificationSectionProps({
    ...sharedContext,
    roleCode: ROLE_CODES.MSWDO,
    notificationTouched,
    notificationValidationErrors: ensureObject(notificationValidationErrors, {}),
    handleResetNotificationPreferences,
    handleNotificationChannelToggle,
    notificationRules: ensureArray(notificationRules),
    enabledRuleCodes: ensureArray(enabledRuleCodes),
    toggleNotificationRule,
    unreadCount: Number(unreadCount || 0),
    notificationRuleCount: Number(notificationRuleCount || 0),
  }),
  dashboardDescription: getSettingsDashboardDescription(ROLE_CODES.MSWDO),
  unreadCount: Number(unreadCount || 0),
  notificationRuleCount: Number(notificationRuleCount || 0),
  navigate,
  handleSyncNow,
  isSyncingNow,
  syncSummary: buildSafeSyncSummary(syncSummary),
  LOCAL_SYNC_STATUS,
  getSyncStatusMeta,
  isOnline,
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
  roleCode: ROLE_CODES.MAYOR,
  profileSectionProps: buildOfficeProfileSectionProps({
    ...sharedContext,
    roleCode: ROLE_CODES.MAYOR,
  }),
  securitySectionProps: buildSecuritySectionProps({
    ...sharedContext,
    roleCode: ROLE_CODES.MAYOR,
  }),
  notificationSectionProps: buildNotificationSectionProps({
    ...sharedContext,
    roleCode: ROLE_CODES.MAYOR,
    notificationTouched,
    notificationValidationErrors: ensureObject(notificationValidationErrors, {}),
    handleResetNotificationPreferences,
    handleNotificationChannelToggle,
    notificationRules: ensureArray(notificationRules),
    enabledRuleCodes: ensureArray(enabledRuleCodes),
    toggleNotificationRule,
    unreadCount: Number(unreadCount || 0),
    notificationRuleCount: Number(notificationRuleCount || 0),
  }),
  dashboardDescription: getSettingsDashboardDescription(ROLE_CODES.MAYOR),
  unreadCount: Number(unreadCount || 0),
  notificationRuleCount: Number(notificationRuleCount || 0),
  navigate,
  handleSyncNow,
  isSyncingNow,
  syncSummary: buildSafeSyncSummary(syncSummary),
  LOCAL_SYNC_STATUS,
  getSyncStatusMeta,
  isOnline,
  localSyncLogRows: ensureArray(localSyncLogRows),
  forecastHealth: ensureObject(forecastHealth, null),
  inventoryThresholdSummary: {
    configured_items: Number(inventoryThresholdSummary?.configured_items || 0),
    distinct_thresholds: ensureArray(inventoryThresholdSummary?.distinct_thresholds),
  },
});
