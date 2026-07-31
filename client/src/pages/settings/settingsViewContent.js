import { ROLE_CODES } from "../../utils/roleSession";
import {
  BARANGAY_POSITION_LABEL,
  getNotificationOptionsForRole,
  ROLE_DISPLAY_NAMES,
} from "./settingsConfig";

const DASHBOARD_DESCRIPTIONS = {
  [ROLE_CODES.BARANGAY]:
    "Choose a category below to manage your DISTYNC account details, notification preferences, and sync information.",
  [ROLE_CODES.MSWDO]:
    "Choose a category below to manage your DISTYNC account details, notification preferences, and sync information.",
  [ROLE_CODES.MAYOR]:
    "Choose a category below to manage your DISTYNC account details, notification preferences, and sync information.",
};

const NOTIFICATION_SECTION_COPY = {
  [ROLE_CODES.BARANGAY]: {
    description: "",
    alertChannelsDescription: "",
  },
  [ROLE_CODES.MSWDO]: {
    description: "",
    alertChannelsDescription: "",
  },
  [ROLE_CODES.MAYOR]: {
    description: "",
    alertChannelsDescription: "",
  },
};

const buildSharedSectionComponentProps = (ctx) => ({
  shellStyles: ctx.shellStyles,
  gridStyles: ctx.gridStyles,
  cardStyles: ctx.cardStyles,
  inputStyles: ctx.inputStyles,
  helperTextStyles: ctx.helperTextStyles,
  errorTextStyles: ctx.errorTextStyles,
  tableStyles: ctx.tableStyles,
  pageHeaderStyles: ctx.pageHeaderStyles,
  labelStyles: ctx.labelStyles,
  mutedValueStyles: ctx.mutedValueStyles,
  StatusChip: ctx.StatusChip,
  InfoRow: ctx.InfoRow,
  EmptyState: ctx.EmptyState,
  preferences: ctx.preferences,
  profileTouched: ctx.profileTouched,
  profileErrors: ctx.profileErrors,
  isSavingPreferences: ctx.isSavingPreferences,
  authenticatedUser: ctx.authenticatedUser,
  formatPhilippineContactNumberForDisplay:
    ctx.formatPhilippineContactNumberForDisplay,
  handleProfileFieldChange: ctx.handleProfileFieldChange,
  handleProfileFieldBlur: ctx.handleProfileFieldBlur,
  profilePictureInputRef: ctx.profilePictureInputRef,
  handleProfilePictureChange: ctx.handleProfilePictureChange,
  handleCancelProfileChanges: ctx.handleCancelProfileChanges,
  handleSaveProfileChanges: ctx.handleSaveProfileChanges,
  setPreferences: ctx.setPreferences,
  formatDateTime: ctx.formatDateTime,
  isLoading: ctx.isLoading,
  notificationTouched: ctx.notificationTouched,
  notificationValidationErrors: ctx.notificationValidationErrors,
  handleResetNotificationPreferences: ctx.handleResetNotificationPreferences,
  handleNotificationChannelToggle: ctx.handleNotificationChannelToggle,
  notificationRules: ctx.notificationRules,
  enabledRuleCodes: ctx.enabledRuleCodes,
  toggleNotificationRule: ctx.toggleNotificationRule,
});

export const getSettingsDashboardDescription = (roleCode) =>
  DASHBOARD_DESCRIPTIONS[roleCode] || DASHBOARD_DESCRIPTIONS[ROLE_CODES.BARANGAY];

export const buildBarangayProfileSectionProps = (ctx) => ({
  ...buildSharedSectionComponentProps(ctx),
  sectionTitle: "Account Settings",
  description: "",
  firstNameId: "barangay-profile-first-name",
  firstNameHelper: "",
  lastNameId: "barangay-profile-last-name",
  lastNameHelper: "",
  positionField: {
    id: "barangay-profile-position",
    label: "Role",
    value: ROLE_DISPLAY_NAMES[ROLE_CODES.BARANGAY],
    helper: "Your assigned role is controlled by DISTYNC and cannot be edited here.",
  },
  contactId: "barangay-profile-contact",
  contactHelper: "",
  emailHelper: "",
  pictureAlt: "Barangay profile preview"
});

export const buildOfficeProfileSectionProps = (ctx) => {
  const isMayor = ctx.roleCode === ROLE_CODES.MAYOR;
  const positionLabel = isMayor
    ? ROLE_DISPLAY_NAMES[ROLE_CODES.MAYOR]
    : ROLE_DISPLAY_NAMES[ROLE_CODES.MSWDO];
  const officeLabel = isMayor
    ? "Office of the Mayor"
    : "Municipal Social Welfare and Development Office";

  return {
    ...buildSharedSectionComponentProps(ctx),
    sectionTitle: "Account Settings",
    description: "",
    firstNameId:
      isMayor ? "mayor-profile-first-name" : "mswdo-profile-first-name",
    firstNameHelper: "",
    lastNameId:
      isMayor ? "mayor-profile-last-name" : "mswdo-profile-last-name",
    lastNameHelper: "",
    positionField: {
      id: isMayor ? "mayor-profile-position" : "mswdo-profile-position",
      label: "Role",
      value: positionLabel,
      helper: "Your assigned role is controlled by DISTYNC and cannot be edited here.",
    },
    contactId: isMayor ? "mayor-profile-contact" : "mswdo-profile-contact",
    contactHelper: "",
    emailHelper: "",
    pictureAlt: isMayor ? "Mayor profile preview" : "MSWDO profile preview"
  };
};

export const buildNotificationSectionProps = (ctx) => ({
  ...buildSharedSectionComponentProps(ctx),
  notificationOptions: getNotificationOptionsForRole(ctx.roleCode),
  ...NOTIFICATION_SECTION_COPY[ctx.roleCode],
});
