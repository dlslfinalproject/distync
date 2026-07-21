import { ROLE_CODES } from "../../utils/roleSession";
import {
  BARANGAY_NOTIFICATION_OPTIONS,
  BARANGAY_POSITION_LABEL,
  ROLE_DISPLAY_NAMES,
} from "./settingsConfig";

const DASHBOARD_DESCRIPTIONS = {
  [ROLE_CODES.BARANGAY]:
    "Choose a category below to keep the Settings workspace focused and uncluttered. Detailed forms, tables, and logs only appear after you open a section.",
  [ROLE_CODES.MSWDO]:
    "Choose a category below to keep the MSWDO Settings workspace focused and uncluttered. Detailed forms, sync details, and notification controls only appear after you open a section.",
  [ROLE_CODES.MAYOR]:
    "Choose a category below to keep the Mayor Settings workspace focused and uncluttered. Detailed forms and system summaries only appear after you open a section.",
};

const NOTIFICATION_SECTION_COPY = {
  [ROLE_CODES.BARANGAY]: {
    description:
      "Manage local alert preferences for barangay coordination. These settings are saved on this device for the current account while the live system rules shown below still depend on the existing backend notification mappings.",
    alertChannelsDescription:
      "Choose which alert types stay enabled locally and which channel you prefer when available.",
  },
  [ROLE_CODES.MSWDO]: {
    description:
      "Review the local notification rule preferences for MSWDO coordination. These selections are stored on this device and do not rewrite backend notification mappings.",
    alertChannelsDescription:
      "Choose which alert types stay enabled locally and which delivery channel you prefer when available.",
  },
  [ROLE_CODES.MAYOR]: {
    description:
      "Review the local executive notification rule preferences for the Office of the Mayor. These selections are stored on this device and do not rewrite backend notification mappings.",
    alertChannelsDescription:
      "Choose which alert types stay enabled locally and which delivery channel you prefer when available.",
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
  authenticatedUser: ctx.authenticatedUser,
  formatPhilippineContactNumberForDisplay:
    ctx.formatPhilippineContactNumberForDisplay,
  handleProfileFieldChange: ctx.handleProfileFieldChange,
  handleProfileFieldBlur: ctx.handleProfileFieldBlur,
  profilePictureInputRef: ctx.profilePictureInputRef,
  handleProfilePictureChange: ctx.handleProfilePictureChange,
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

const buildNotificationSummaryRows = (ctx) => {
  if (ctx.roleCode === ROLE_CODES.BARANGAY) {
    return [];
  }

  return [
    {
      label: "Unread Notifications",
      value: `${ctx.unreadCount}`,
    },
    {
      label: "Active Rules for This Role",
      value: `${ctx.notificationRuleCount}`,
    },
    {
      label: "Rules Enabled Locally",
      value: `${ctx.enabledRuleCodes.length}`,
    },
  ];
};

export const getSettingsDashboardDescription = (roleCode) =>
  DASHBOARD_DESCRIPTIONS[roleCode] || DASHBOARD_DESCRIPTIONS[ROLE_CODES.BARANGAY];

export const buildBarangayProfileSectionProps = (ctx) => ({
  ...buildSharedSectionComponentProps(ctx),
  summaryRows: [
    {
      title: "Profile Summary",
      rows: [
        {
          label: "Account Name",
          value: ctx.preferences.profile.fullName || "--",
        },
        {
          label: "Position",
          value: BARANGAY_POSITION_LABEL,
        },
        {
          label: "Barangay Name",
          value: ctx.assignedBarangayName || "--",
          muted: true,
        },
      ],
    },
    {
      title: "Account Contact",
      rows: [
        {
          label: "Email Address",
          value:
            ctx.authenticatedUser?.email ||
            ctx.preferences.profile.emailAddress ||
            "--",
          muted: true,
        },
        {
          label: "Contact Number",
          value: ctx.preferences.profile.contactNumber
            ? `PH +63 ${ctx.formatPhilippineContactNumberForDisplay(
                ctx.preferences.profile.contactNumber,
              )}`
            : "--",
        },
      ],
    },
  ],
  fullNameId: "barangay-profile-full-name",
  positionField: {
    id: "barangay-profile-position",
    label: "Position",
    value: BARANGAY_POSITION_LABEL,
  },
  assignmentField: {
    id: "barangay-profile-name",
    label: "Barangay Name",
    value: ctx.assignedBarangayName,
  },
  contactId: "barangay-profile-contact",
  emailId: "barangay-profile-email",
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
    summaryRows: [
      {
        title: "Profile Summary",
        rows: [
          {
            label: "Account Name",
            value: ctx.preferences.profile.fullName || "--",
          },
          {
            label: "Position",
            value: positionLabel,
          },
          {
            label: "Office / Unit",
            value: officeLabel,
            muted: true,
          },
        ],
      },
      {
        title: "Account Contact",
        rows: [
          {
            label: "Email Address",
            value:
              ctx.authenticatedUser?.email ||
              ctx.preferences.profile.emailAddress ||
              "--",
            muted: true,
          },
          {
            label: "Contact Number",
            value: ctx.preferences.profile.contactNumber
              ? `PH +63 ${ctx.formatPhilippineContactNumberForDisplay(
                  ctx.preferences.profile.contactNumber,
                )}`
              : "--",
          },
        ],
      },
    ],
    fullNameId: isMayor ? "mayor-profile-full-name" : "mswdo-profile-full-name",
    positionField: {
      id: isMayor ? "mayor-profile-position" : "mswdo-profile-position",
      label: isMayor ? "Position" : "Position / Designation",
      value: positionLabel,
    },
    assignmentField: {
      id: isMayor ? "mayor-profile-office" : "mswdo-profile-office",
      label: "Office / Unit",
      value: officeLabel,
    },
    contactId: isMayor ? "mayor-profile-contact" : "mswdo-profile-contact",
    emailId: isMayor ? "mayor-profile-email" : "mswdo-profile-email",
    pictureAlt: isMayor ? "Mayor profile preview" : "MSWDO profile preview"
  };
};

export const buildNotificationSectionProps = (ctx) => ({
  ...buildSharedSectionComponentProps(ctx),
  notificationOptions: BARANGAY_NOTIFICATION_OPTIONS,
  summaryRows: buildNotificationSummaryRows(ctx),
  ...NOTIFICATION_SECTION_COPY[ctx.roleCode],
});
