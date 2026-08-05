const normalizeString = (value = "") => String(value || "").trim();

export const SETTINGS_OFFLINE_MESSAGES = {
  account: {
    title: "You're offline",
    message:
      "Account settings are available for viewing. Connect to the internet to make changes.",
  },
  notifications: {
    title: "You're offline",
    message:
      "Notification preferences are available for viewing. Connect to the internet to update your preferences.",
  },
  system: {
    title: "You're offline",
    message:
      "System information remains available for viewing while you're offline.",
  },
  fallback: {
    title: "You're offline",
    message: "This page is available for viewing while you're offline.",
  },
};

const normalizeAssignedBarangay = (assignedBarangay) => {
  if (!assignedBarangay || typeof assignedBarangay !== "object") {
    return null;
  }

  return {
    id: normalizeString(assignedBarangay.id),
    name: normalizeString(assignedBarangay.name),
  };
};

export const hasCachedRoleSettingsData = (settings = {}) => {
  const profile = settings?.profile || {};
  const categories = Array.isArray(settings?.categories) ? settings.categories : [];

  return Boolean(
    normalizeString(settings?.roleCode) ||
      normalizeString(profile.firstName) ||
      normalizeString(profile.middleName) ||
      normalizeString(profile.lastName) ||
      normalizeString(profile.emailAddress) ||
      normalizeString(profile.position) ||
      normalizeString(profile.profilePicturePath) ||
      normalizeAssignedBarangay(profile.assignedBarangay)?.id ||
      categories.length > 0,
  );
};

export const buildSettingsConflictSnapshot = (settings = {}) => {
  const profile = settings?.profile || {};

  return {
    roleCode: normalizeString(settings?.roleCode),
    profile: {
      firstName: normalizeString(profile.firstName),
      middleName: normalizeString(profile.middleName),
      lastName: normalizeString(profile.lastName),
      contactNumber: normalizeString(profile.contactNumber),
      emailAddress: normalizeString(profile.emailAddress),
      position: normalizeString(profile.position),
      assignedBarangay: normalizeAssignedBarangay(profile.assignedBarangay),
      profilePicturePath: normalizeString(profile.profilePicturePath),
      profilePictureFileName: normalizeString(profile.profilePictureFileName),
    },
    notificationRulePreferences:
      settings?.notificationRulePreferences &&
      typeof settings.notificationRulePreferences === "object"
        ? settings.notificationRulePreferences
        : {},
  };
};

export const mergeRefreshedSettingsWithLocalDraft = ({
  refreshedSettings,
  currentPreferences,
  preserveProfileDraft = false,
  preserveNotificationDraft = false,
}) => {
  const nextSettings = {
    ...(refreshedSettings || {}),
    profile: {
      ...((refreshedSettings && refreshedSettings.profile) || {}),
    },
  };
  const currentProfile = currentPreferences?.profile || {};

  if (preserveProfileDraft) {
    nextSettings.profile.firstName = currentProfile.firstName || "";
    nextSettings.profile.middleName = currentProfile.middleName || "";
    nextSettings.profile.lastName = currentProfile.lastName || "";
    nextSettings.profile.contactNumber = currentProfile.contactNumber || "";
  }

  if (preserveNotificationDraft) {
    nextSettings.categories = Array.isArray(currentPreferences?.categories)
      ? currentPreferences.categories
      : [];
    nextSettings.notificationRulePreferences =
      currentPreferences?.notificationRulePreferences &&
      typeof currentPreferences.notificationRulePreferences === "object"
        ? currentPreferences.notificationRulePreferences
        : {};
    nextSettings.effectiveNotificationChannels =
      currentPreferences?.effectiveNotificationChannels &&
      typeof currentPreferences.effectiveNotificationChannels === "object"
        ? currentPreferences.effectiveNotificationChannels
        : {};
  }

  return nextSettings;
};

export const getSettingsOfflineMessage = (sectionKey) =>
  SETTINGS_OFFLINE_MESSAGES[sectionKey] || SETTINGS_OFFLINE_MESSAGES.fallback;

export const buildSettingsStatusBanner = ({
  activeSectionKey,
  isOnline,
  hasUnsavedChanges,
  isReconnectRefreshBlocked,
}) => {
  if (isReconnectRefreshBlocked) {
    return {
      title: "Settings could not be refreshed",
      message: "Please try again before saving changes.",
    };
  }

  if (isOnline) {
    return null;
  }

  if (hasUnsavedChanges) {
    return {
      title: "Connection lost",
      message: "Your changes are not saved. Reconnect to continue.",
    };
  }

  return getSettingsOfflineMessage(activeSectionKey);
};
