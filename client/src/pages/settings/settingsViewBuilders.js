import { formatSyncDateTime } from "../../features/sync/syncManagementHelpers";
import { ROLE_CODES } from "../../utils/roleSession";
import {
  BARANGAY_SETTINGS_SECTIONS,
  MAYOR_SETTINGS_SECTIONS,
  MSWDO_SETTINGS_SECTIONS,
} from "./settingsConfig";
import {
  LOCAL_SYNC_STATUS,
  buildDisplayName,
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
    buildDisplayName(preferences.profile) ? "success" : "warning",
    buildDisplayName(preferences.profile) ? "Profile ready" : "Needs details",
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

const buildSyncSectionCard = (section) =>
  buildDefaultSectionCard(section, "info", "Information");

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
}) => {
  return BARANGAY_SETTINGS_SECTIONS.map((section) => {
    switch (section.key) {
      case "account-settings":
        return buildProfileSectionCard(section, preferences);
      case "notification-preferences":
        return buildDefaultSectionCard(
          section,
          enabledRuleCodes.length > 0 ? "success" : "warning",
          `${enabledRuleCodes.length} rules enabled`,
        );
      case "sync-preferences":
        return buildSyncSectionCard(section);
      default:
        return buildDefaultSectionCard(section);
    }
  });
};

export const buildMswdoSectionCards = ({
  preferences,
  enabledRuleCodes,
  notificationRuleCount,
}) => {
  return MSWDO_SETTINGS_SECTIONS.map((section) => {
    switch (section.key) {
      case "account-settings":
        return buildProfileSectionCard(section, preferences);
      case "notification-preferences":
        return buildNotificationSectionCard(
          section,
          enabledRuleCodes,
          notificationRuleCount,
        );
      case "sync-preferences":
        return buildSyncSectionCard(section);
      default:
        return buildDefaultSectionCard(section);
    }
  });
};

export const buildMayorSectionCards = ({
  preferences,
  enabledRuleCodes,
  notificationRuleCount,
}) => {
  return MAYOR_SETTINGS_SECTIONS.map((section) => {
    switch (section.key) {
      case "account-settings":
        return buildProfileSectionCard(section, preferences);
      case "notification-preferences":
        return buildNotificationSectionCard(
          section,
          enabledRuleCodes,
          notificationRuleCount,
        );
      case "sync-preferences":
        return buildSyncSectionCard(section);
      default:
        return buildDefaultSectionCard(section);
    }
  });
};

export const buildSettingsPageActions = ({
  activeSectionMeta,
  editableSectionKeys,
  isSavingPreferences,
  isSaveDisabled = false,
  saveLabel,
  onBack,
  onSave,
}) => {
  if (!activeSectionMeta) {
    return [];
  }

  return [
    {
      label: "Back",
      onClick: onBack,
      variant: "secondary",
    },
    ...(
      editableSectionKeys.has(activeSectionMeta.key)
        ? [
            {
              label: isSavingPreferences ? "Saving..." : saveLabel,
              onClick: onSave,
              disabled: isSavingPreferences || isSaveDisabled,
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
  handleOpenRemoveProfilePictureDialog,
  handleProfilePictureLoadError,
  handleUndoProfilePictureChange,
  profilePicturePresentation,
  profilePictureDraft,
  isRemoveProfilePictureModalOpen,
  handleCancelRemoveProfilePicture,
  handleConfirmRemoveProfilePicture,
  removeProfilePictureButtonRef,
  setPreferences,
  handleSaveProfileChanges,
  handleCancelProfileChanges,
  StatusChip,
  InfoRow,
  EmptyState,
  isLoading,
  syncSectionProps,
  isSavingPreferences,
  isOnline,
  isSettingsReadOnlyOffline,
  hasUnsavedChanges,
  isReconnectRefreshInFlight,
  isReconnectRefreshBlocked,
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
  handleOpenRemoveProfilePictureDialog,
  handleProfilePictureLoadError,
  handleUndoProfilePictureChange,
  profilePicturePresentation,
  profilePictureDraft,
  isRemoveProfilePictureModalOpen,
  handleCancelRemoveProfilePicture,
  handleConfirmRemoveProfilePicture,
  removeProfilePictureButtonRef,
  setPreferences,
  handleSaveProfileChanges,
  handleCancelProfileChanges,
  StatusChip,
  formatDateTime,
  formatSyncDateTime,
  InfoRow,
  EmptyState,
  isLoading,
  syncSectionProps,
  isSavingPreferences,
  isOnline,
  isSettingsReadOnlyOffline,
  hasUnsavedChanges,
  isReconnectRefreshInFlight,
  isReconnectRefreshBlocked,
});

export const buildBarangayViewContext = ({
  sharedContext,
  notificationTouched,
  notificationValidationErrors,
  handleOpenResetNotificationPreferences,
  handleNotificationRuleChannelToggle,
  notificationCategories,
  enabledRuleCodes,
  notificationLoadError,
  isNotificationPreferencesLoading,
  isNotificationPreferencesOffline,
  isNotificationPreferencesEmpty,
  hasNotificationPreferencesError,
  canResetNotificationPreferences,
  resetPreferencesButtonRef,
  handleRetryNotificationPreferencesLoad,
  navigate,
  handleSyncNow,
  isSyncingNow,
  syncSummary,
  isOnline,
  localSyncLogRows,
  syncHistoryErrorMessage,
  lastQueueActivityAt,
  lastSuccessfulSyncAt,
}) => ({
  ...sharedContext,
  roleCode: ROLE_CODES.BARANGAY,
  profileSectionProps: buildBarangayProfileSectionProps({
    ...sharedContext,
  }),
  notificationSectionProps: buildNotificationSectionProps({
    ...sharedContext,
    roleCode: ROLE_CODES.BARANGAY,
    notificationTouched,
    notificationValidationErrors: ensureObject(notificationValidationErrors, {}),
    handleOpenResetNotificationPreferences,
    handleNotificationRuleChannelToggle,
    notificationCategories: ensureArray(notificationCategories),
    notificationLoadError,
    isNotificationPreferencesLoading,
    isNotificationPreferencesOffline,
    isNotificationPreferencesEmpty,
    hasNotificationPreferencesError,
    canResetNotificationPreferences,
    resetPreferencesButtonRef,
    handleRetryNotificationPreferencesLoad,
  }),
  dashboardDescription: getSettingsDashboardDescription(ROLE_CODES.BARANGAY),
  navigate,
  handleSyncNow,
  isSyncingNow,
  syncSummary: buildSafeSyncSummary(syncSummary),
  LOCAL_SYNC_STATUS,
  getSyncStatusMeta,
  isOnline,
  localSyncLogRows: ensureArray(localSyncLogRows),
  syncHistoryErrorMessage,
  lastQueueActivityAt,
  lastSuccessfulSyncAt,
});

export const buildMswdoViewContext = ({
  sharedContext,
  notificationTouched,
  notificationValidationErrors,
  handleOpenResetNotificationPreferences,
  handleNotificationRuleChannelToggle,
  notificationCategories,
  enabledRuleCodes,
  notificationLoadError,
  isNotificationPreferencesLoading,
  isNotificationPreferencesOffline,
  isNotificationPreferencesEmpty,
  hasNotificationPreferencesError,
  canResetNotificationPreferences,
  resetPreferencesButtonRef,
  handleRetryNotificationPreferencesLoad,
  unreadCount,
  notificationRuleCount,
  navigate,
  handleSyncNow,
  isSyncingNow,
  syncSummary,
  isOnline,
  localSyncLogRows,
  syncHistoryErrorMessage,
  lastQueueActivityAt,
  lastSuccessfulSyncAt,
}) => ({
  ...sharedContext,
  roleCode: ROLE_CODES.MSWDO,
  profileSectionProps: buildOfficeProfileSectionProps({
    ...sharedContext,
    roleCode: ROLE_CODES.MSWDO,
  }),
  notificationSectionProps: buildNotificationSectionProps({
    ...sharedContext,
    roleCode: ROLE_CODES.MSWDO,
    notificationTouched,
    notificationValidationErrors: ensureObject(notificationValidationErrors, {}),
    handleOpenResetNotificationPreferences,
    handleNotificationRuleChannelToggle,
    notificationCategories: ensureArray(notificationCategories),
    notificationLoadError,
    isNotificationPreferencesLoading,
    isNotificationPreferencesOffline,
    isNotificationPreferencesEmpty,
    hasNotificationPreferencesError,
    canResetNotificationPreferences,
    resetPreferencesButtonRef,
    handleRetryNotificationPreferencesLoad,
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
  syncHistoryErrorMessage,
  lastQueueActivityAt,
  lastSuccessfulSyncAt,
});

export const buildMayorViewContext = ({
  sharedContext,
  notificationTouched,
  notificationValidationErrors,
  handleOpenResetNotificationPreferences,
  handleNotificationRuleChannelToggle,
  notificationCategories,
  enabledRuleCodes,
  notificationLoadError,
  isNotificationPreferencesLoading,
  isNotificationPreferencesOffline,
  isNotificationPreferencesEmpty,
  hasNotificationPreferencesError,
  canResetNotificationPreferences,
  resetPreferencesButtonRef,
  handleRetryNotificationPreferencesLoad,
  unreadCount,
  notificationRuleCount,
  navigate,
  handleSyncNow,
  isSyncingNow,
  syncSummary,
  isOnline,
  localSyncLogRows,
  syncHistoryErrorMessage,
  lastQueueActivityAt,
  lastSuccessfulSyncAt,
}) => ({
  ...sharedContext,
  roleCode: ROLE_CODES.MAYOR,
  profileSectionProps: buildOfficeProfileSectionProps({
    ...sharedContext,
    roleCode: ROLE_CODES.MAYOR,
  }),
  notificationSectionProps: buildNotificationSectionProps({
    ...sharedContext,
    roleCode: ROLE_CODES.MAYOR,
    notificationTouched,
    notificationValidationErrors: ensureObject(notificationValidationErrors, {}),
    handleOpenResetNotificationPreferences,
    handleNotificationRuleChannelToggle,
    notificationCategories: ensureArray(notificationCategories),
    notificationLoadError,
    isNotificationPreferencesLoading,
    isNotificationPreferencesOffline,
    isNotificationPreferencesEmpty,
    hasNotificationPreferencesError,
    canResetNotificationPreferences,
    resetPreferencesButtonRef,
    handleRetryNotificationPreferencesLoad,
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
  syncHistoryErrorMessage,
  lastQueueActivityAt,
  lastSuccessfulSyncAt,
});
