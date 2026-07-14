import {
  FiActivity,
  FiBell,
  FiFileText,
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
    key: "reliefArrivalNotifications",
    label: "Relief Arrival Notifications",
    description:
      "Review supply arrival updates, release readiness, and allocation notices.",
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
    key: "profile",
    label: "Profile",
    description: "Update local identity details, contact information, and profile photo.",
    icon: FiUser,
  },
  {
    key: "notification-preferences",
    label: "Notification Preferences",
    description: "Control in-app and email alert preferences for barangay coordination.",
    icon: FiBell,
  },
  {
    key: "activity-logs",
    label: "Recent Local Activity",
    description: "Review recent sync and operational actions visible on this device.",
    icon: FiActivity,
  },
];

export const EDITABLE_BARANGAY_SECTION_KEYS = new Set([
  "profile",
  "notification-preferences",
]);

export const MSWDO_SETTINGS_SECTIONS = [
  {
    key: "profile",
    label: "Profile",
    description:
      "Review office identity details, assigned role, contact information, and profile picture.",
    icon: FiUser,
  },
  {
    key: "notification-preferences",
    label: "Notification Preferences",
    description:
      "Manage local notification rule preferences used for MSWDO coordination.",
    icon: FiBell,
  },
  {
    key: "sync-center",
    label: "Sync Center",
    description:
      "Monitor pending queue records, sync health, and recent synchronization logs.",
    icon: FiRefreshCw,
  },
];

export const EDITABLE_MSWDO_SECTION_KEYS = new Set([
  "profile",
  "notification-preferences",
]);

export const MAYOR_SETTINGS_SECTIONS = [
  {
    key: "profile",
    label: "Profile",
    description:
      "Review account identity details, assigned role, contact information, and profile picture.",
    icon: FiUser,
  },
  {
    key: "notification-preferences",
    label: "Notification Preferences",
    description:
      "Manage local executive notification rule preferences for the Office of the Mayor.",
    icon: FiBell,
  },
  {
    key: "sync-status",
    label: "Sync Center",
    description:
      "Monitor pending queue records, sync health, and recent synchronization activity.",
    icon: FiRefreshCw,
  },
  {
    key: "analytics-service",
    label: "Analytics Service",
    description:
      "Review read-only analytics availability and service health for executive visibility.",
    icon: FiActivity,
  },
  {
    key: "inventory-alert-thresholds",
    label: "Inventory Alert Thresholds",
    description:
      "Review read-only inventory threshold coverage without changing operational rules.",
    icon: FiFileText,
  },
];

export const EDITABLE_MAYOR_SECTION_KEYS = new Set([
  "profile",
  "notification-preferences",
]);
