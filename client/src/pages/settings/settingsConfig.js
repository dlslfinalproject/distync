import {
  FiBell,
  FiRefreshCw,
  FiUser,
} from "react-icons/fi";
import { ROLE_CODES } from "../../utils/roleSession";

export const BARANGAY_POSITION_LABEL = "Barangay Official";

export const ROLE_DISPLAY_NAMES = {
  [ROLE_CODES.BARANGAY]: "Barangay Official",
  [ROLE_CODES.MSWDO]: "MSWDO Personnel",
  [ROLE_CODES.MAYOR]: "Office of the Mayor",
};

export const BARANGAY_NOTIFICATION_OPTIONS = [
  {
    key: "disasterAlerts",
    label: "Disaster Alerts",
    description:
      "Receive flood warnings, fire incidents, evacuation notices, and urgent LGU advisories.",
  },
  {
    key: "distributionSchedules",
    label: "Distribution Schedules",
    description:
      "Track upcoming relief distribution schedules, assignment changes, and related coordination notices.",
  },
  {
    key: "attendanceReminders",
    label: "Attendance Reminders",
    description:
      "Keep reminders visible for attendance submission follow-ups and record completion.",
  },
  {
    key: "systemAnnouncements",
    label: "System Announcements",
    description:
      "Show maintenance announcements, policy updates, and general system notices relevant to your role.",
  },
];

export const BARANGAY_SETTINGS_SECTIONS = [
  {
    key: "account-settings",
    label: "Account Settings",
    icon: FiUser,
    description: "View and manage your account information.",
  },
  {
    key: "notification-preferences",
    label: "Notification Preferences",
    icon: FiBell,
    description:
      "Manage which DISTYNC notification categories can reach your account.",
  },
  {
    key: "sync-preferences",
    label: "System Information",
    icon: FiRefreshCw,
    description:
      "View general information about the DISTYNC application.",
  },
];

export const ROLE_NOTIFICATION_OPTIONS = {
  [ROLE_CODES.BARANGAY]: [
    {
      key: "disasterAlerts",
      label: "Disaster Coordination",
      description:
        "Receive disaster event activations, status changes, affected area updates, and evacuation coordination notices.",
    },
    {
      key: "attendanceReminders",
      label: "Evacuee Management",
      description:
        "Receive evacuee registration, attendance activity, and household verification updates.",
    },
    {
      key: "systemAnnouncements",
      label: "System Operations",
      description:
        "Receive sync failures and system alerts that affect barangay operations.",
    },
  ],
  [ROLE_CODES.MSWDO]: [
    {
      key: "disasterAlerts",
      label: "Disaster Management",
      description:
        "Receive newly created disaster events and disaster coordination updates for centralized operations.",
    },
    {
      key: "attendanceReminders",
      label: "Evacuee Management",
      description:
        "Receive evacuee registration, attendance activity, and household verification updates.",
    },
    {
      key: "distributionSchedules",
      label: "Relief Operations",
      description:
        "Receive completed distribution updates and related relief operation notices.",
    },
    {
      key: "systemAnnouncements",
      label: "System Operations",
      description:
        "Receive sync failures and broader system alerts for MSWDO workflows.",
    },
  ],
  [ROLE_CODES.MAYOR]: [
    {
      key: "disasterAlerts",
      label: "Disaster Monitoring",
      description:
        "Receive strategic disaster updates and evacuation monitoring summaries.",
    },
    {
      key: "reliefOperations",
      label: "Relief Operations",
      description:
        "Receive inventory shortages, completed distribution updates, donation received alerts, and operational anomaly alerts.",
    },
    {
      key: "systemAnnouncements",
      label: "System Monitoring",
      description:
        "Receive high-level system alerts that affect operational monitoring.",
    },
  ],
};

export const getNotificationOptionsForRole = (roleCode) =>
  ROLE_NOTIFICATION_OPTIONS[roleCode] || BARANGAY_NOTIFICATION_OPTIONS;

export const EDITABLE_BARANGAY_SECTION_KEYS = new Set([
  "account-settings",
  "notification-preferences",
]);

export const MSWDO_SETTINGS_SECTIONS = [
  {
    key: "account-settings",
    label: "Account Settings",
    icon: FiUser,
    description: "View and manage your account information.",
  },
  {
    key: "notification-preferences",
    label: "Notification Preferences",
    icon: FiBell,
    description:
      "Manage which DISTYNC notification categories can reach your account.",
  },
  {
    key: "sync-preferences",
    label: "System Information",
    icon: FiRefreshCw,
    description:
      "View general information about the DISTYNC application.",
  },
];

export const EDITABLE_MSWDO_SECTION_KEYS = new Set([
  "account-settings",
  "notification-preferences",
]);

export const MAYOR_SETTINGS_SECTIONS = [
  {
    key: "account-settings",
    label: "Account Settings",
    icon: FiUser,
    description: "View and manage your account information.",
  },
  {
    key: "notification-preferences",
    label: "Notification Preferences",
    icon: FiBell,
    description:
      "Manage which DISTYNC notification categories can reach your account.",
  },
  {
    key: "sync-preferences",
    label: "System Information",
    icon: FiRefreshCw,
    description:
      "View general information about the DISTYNC application.",
  },
];

export const EDITABLE_MAYOR_SECTION_KEYS = new Set([
  "account-settings",
  "notification-preferences",
]);
