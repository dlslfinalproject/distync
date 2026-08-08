import { hasProfilePictureDraftChanges } from "./profilePictureDraft.js";
import {
  areNotificationPreferencesEqual,
  normalizePhilippineContactNumber,
} from "./settingsHelpers.js";

export const normalizeSettingsProfileForDirtyCheck = (
  preferences = {},
  authenticatedEmail = "",
) => {
  const profile = preferences.profile || {};

  return {
    firstName: String(profile.firstName || "").trim(),
    middleName: String(profile.middleName || "").trim(),
    lastName: String(profile.lastName || "").trim(),
    contactNumber: normalizePhilippineContactNumber(
      profile.contactNumber || "",
    ),
    emailAddress: String(authenticatedEmail || profile.emailAddress || "").trim(),
  };
};

export const hasProfileSettingsChanges = ({
  currentPreferences = {},
  savedPreferences = {},
  profilePictureDraft = {},
  authenticatedEmail = "",
} = {}) =>
  JSON.stringify(
    normalizeSettingsProfileForDirtyCheck(
      currentPreferences,
      authenticatedEmail,
    ),
  ) !==
    JSON.stringify(
      normalizeSettingsProfileForDirtyCheck(
        savedPreferences,
        authenticatedEmail,
      ),
    ) || hasProfilePictureDraftChanges(profilePictureDraft);

export const hasRoleSettingsUnsavedChanges = ({
  currentPreferences = {},
  savedPreferences = {},
  profilePictureDraft = {},
  authenticatedEmail = "",
} = {}) =>
  hasProfileSettingsChanges({
    currentPreferences,
    savedPreferences,
    profilePictureDraft,
    authenticatedEmail,
  }) || !areNotificationPreferencesEqual(currentPreferences, savedPreferences);

export const shouldBlockSettingsRouteLeave = ({
  hasUnsavedChanges = false,
  currentLocation = {},
  nextLocation = {},
} = {}) =>
  Boolean(hasUnsavedChanges) &&
  String(currentLocation.pathname || "") !==
    String(nextLocation.pathname || "");

export const createSettingsBeforeUnloadHandler = () => (event) => {
  event.preventDefault();
  event.returnValue = "";
  return "";
};
