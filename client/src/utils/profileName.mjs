const normalizeProfileNameField = (value) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";

const buildDisplayName = ({
  firstName = "",
  middleName = "",
  lastName = "",
} = {}) =>
  [firstName, middleName, lastName]
    .map(normalizeProfileNameField)
    .filter(Boolean)
    .join(" ");

const getProfileDisplayName = (profile) => {
  const safeProfile =
    profile && typeof profile === "object" ? profile : {};

  return buildDisplayName({
    firstName: safeProfile.firstName || safeProfile.first_name,
    middleName: safeProfile.middleName || safeProfile.middle_name,
    lastName: safeProfile.lastName || safeProfile.last_name,
  });
};

export const getStoredUserDisplayName = ({
  authenticatedUser = {},
  storedProfile = {},
} = {}) => {
  const safeAuthenticatedUser =
    authenticatedUser && typeof authenticatedUser === "object"
      ? authenticatedUser
      : {};

  return (
    getProfileDisplayName(storedProfile) ||
    getProfileDisplayName(safeAuthenticatedUser) ||
    normalizeProfileNameField(safeAuthenticatedUser.email) ||
    "DISTYNC User"
  );
};
