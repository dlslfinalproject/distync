import { ROLE_CODES } from "../../utils/roleSession";
import {
  BARANGAY_NOTIFICATION_OPTIONS,
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
    description:
      "Manage the notification preferences that control which barangay coordination alerts reach your account.",
    alertChannelsDescription:
      "Choose which notification categories stay enabled for your account and whether DISTYNC should deliver them in-app, by email, or both.",
  },
  [ROLE_CODES.MSWDO]: {
    description:
      "Manage the notification preferences that control which MSWDO coordination alerts reach your account.",
    alertChannelsDescription:
      "Choose which notification categories stay enabled for your account and whether DISTYNC should deliver them in-app, by email, or both.",
  },
  [ROLE_CODES.MAYOR]: {
    description:
      "Manage the notification preferences that control which Office of the Mayor alerts reach your account.",
    alertChannelsDescription:
      "Choose which notification categories stay enabled for your account and whether DISTYNC should deliver them in-app, by email, or both.",
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
  sectionTitle: "Account Settings",
  description:
    "Review your profile information, profile picture, contact number, and account details. Role, barangay assignment, and sign-in identity remain controlled by the system.",
  summaryRows: [
    {
      title: "Profile Information",
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
      title: "Account Information",
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
        {
          label: "Assigned Role",
          value: ROLE_DISPLAY_NAMES[ROLE_CODES.BARANGAY],
        },
      ],
    },
  ],
  fullNameId: "barangay-profile-full-name",
  fullNameHelper: "Use your official full name for DISTYNC records and coordination.",
  positionField: {
    id: "barangay-profile-position",
    label: "Position",
    value: BARANGAY_POSITION_LABEL,
    helper: "Your assigned role is controlled by DISTYNC and cannot be edited here.",
  },
  assignmentField: {
    id: "barangay-profile-name",
    label: "Barangay Name",
    value: ctx.assignedBarangayName,
    helper: "Your barangay assignment is managed by the system.",
  },
  contactId: "barangay-profile-contact",
  contactHelper: "Use the Philippine mobile format shown in the field.",
  emailId: "barangay-profile-email",
  emailHelper: "Your sign-in email is managed by your DISTYNC account.",
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
    description:
      "Review your profile information, profile picture, contact number, and account details. Role, office assignment, and sign-in identity remain controlled by the system.",
    summaryRows: [
      {
        title: "Profile Information",
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
        title: "Account Information",
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
          {
            label: "Assigned Role",
            value: positionLabel,
          },
        ],
      },
    ],
    fullNameId: isMayor ? "mayor-profile-full-name" : "mswdo-profile-full-name",
    fullNameHelper: "Use your official full name for DISTYNC records and coordination.",
    positionField: {
      id: isMayor ? "mayor-profile-position" : "mswdo-profile-position",
      label: isMayor ? "Position" : "Position / Designation",
      value: positionLabel,
      helper: "Your assigned role is controlled by DISTYNC and cannot be edited here.",
    },
    assignmentField: {
      id: isMayor ? "mayor-profile-office" : "mswdo-profile-office",
      label: "Office / Unit",
      value: officeLabel,
      helper: "Your office assignment is managed by the system.",
    },
    contactId: isMayor ? "mayor-profile-contact" : "mswdo-profile-contact",
    contactHelper: "Use the Philippine mobile format shown in the field.",
    emailId: isMayor ? "mayor-profile-email" : "mswdo-profile-email",
    emailHelper: "Your sign-in email is managed by your DISTYNC account.",
    pictureAlt: isMayor ? "Mayor profile preview" : "MSWDO profile preview"
  };
};

export const buildNotificationSectionProps = (ctx) => ({
  ...buildSharedSectionComponentProps(ctx),
  notificationOptions: getNotificationOptionsForRole(ctx.roleCode),
  summaryRows: buildNotificationSummaryRows(ctx),
  ...NOTIFICATION_SECTION_COPY[ctx.roleCode],
});
