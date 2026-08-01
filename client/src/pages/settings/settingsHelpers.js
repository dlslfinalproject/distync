import { buildPayloadSummary } from "../../features/sync/syncManagementHelpers.js";
import { LOCAL_SYNC_STATUS } from "../../offline/db.js";
import { ROLE_CODES } from "../../utils/roleSession.js";
import { BARANGAY_POSITION_LABEL, ROLE_DISPLAY_NAMES } from "./settingsConfig.js";

export const createDefaultRolePreferences = () => ({
  roleCode: "",
  profile: {
    firstName: "",
    middleName: "",
    lastName: "",
    position: BARANGAY_POSITION_LABEL,
    contactNumber: "",
    emailAddress: "",
    assignedBarangay: null,
    profilePicturePath: "",
    profilePictureUrl: "",
    profilePictureUrlExpiresAt: "",
    profilePictureFileName: "",
    profilePictureUpdatedAt: "",
  },
  notificationRulePreferences: {},
  effectiveNotificationChannels: {},
  categories: [],
  metadata: {
    lastProfileUpdateAt: "",
    lastPreferenceSaveAt: "",
  },
});

export const PRIORITY_LABELS = {
  CRITICAL: "Critical alert",
  WARNING: "Important alert",
  INFORMATIONAL: "General update",
};

export const DELIVERY_MODE_LABELS = {
  IMMEDIATE: "Sent immediately",
  HOURLY_SUMMARY: "Hourly summary",
  DAILY_SUMMARY: "Daily summary",
  THRESHOLD: "Sent when a limit is reached",
  SILENT_UI_FEEDBACK: "Shown in the current screen",
};

export const IN_APP_POLICY_LABELS = {
  MANDATORY: "Always on",
  OPTIONAL: "Optional",
  NOT_APPLICABLE: "Not available",
};

export const EMAIL_POLICY_LABELS = {
  DEFAULT_ON: "Enabled by default",
  OPTIONAL: "Optional",
  UNAVAILABLE: "Not available",
};

export const USER_CONFIGURABILITY_LABELS = {
  NONE: "Managed by the system",
  EMAIL_ONLY: "Email can be changed",
  ALL_SUPPORTED_CHANNELS: "You can change available channels",
};

const RULE_DESCRIPTION_BY_NAME = {
  "Disaster Event Update":
    "Important changes to active disaster events, affected barangays, and operation schedules.",
  "Newly Created Disaster Event":
    "Alerts your office when a new disaster event is created for official response.",
  "Household Registration Update":
    "Shows grouped updates for newly registered or updated household records.",
  "Household Verification Update":
    "Highlights household records that need follow-up or closer review.",
  "Evacuee Attendance Update":
    "Shows grouped attendance activity for evacuees during ongoing operations.",
  "Distribution Update":
    "Tracks relief distribution activity without sending one alert for every transaction.",
  "Synchronization Conflict Alert":
    "Warns you when offline and server records need manual review.",
  "System Anomaly Alert":
    "Warns you about serious system issues that may affect data reliability.",
  "Low Stock Alert":
    "Alerts you when available relief stock drops below the warning level.",
  "Critical Stock Alert":
    "Alerts you when relief stock reaches a critical shortage level.",
  "Near Expiry Stock Alert":
    "Warns you when relief goods are close to their expiry date.",
  "Expired Stock Alert":
    "Alerts you when relief goods are already expired and need action.",
  "Inventory Incident Alert":
    "Reports damage, loss, spoilage, theft, or other serious inventory issues.",
  "Donation Stock Update":
    "Provides grouped donation stock updates for routine monitoring.",
  "Donation Stock Anomaly":
    "Warns you about unusual or mismatched donation stock records.",
  "Evacuation Monitoring Summary":
    "Provides a grouped daily view of evacuation monitoring updates.",
};

export const getSafePolicyLabel = (value, labels, fallback) =>
  labels[value] || fallback;

export const getRuleDescription = (rule = {}) =>
  RULE_DESCRIPTION_BY_NAME[rule.name] ||
  "Notification details are available for this alert type.";

export const getRuleHelperText = (rule = {}) => {
  if (rule.deliveryMode === "HOURLY_SUMMARY") {
    return "Grouped into an hourly summary.";
  }

  if (rule.deliveryMode === "DAILY_SUMMARY") {
    return "Grouped into a daily summary.";
  }

  if (rule.deliveryMode === "THRESHOLD") {
    return "Sent when a limit is reached.";
  }

  if (rule.deliveryMode === "SILENT_UI_FEEDBACK") {
    return "Shown in the current screen.";
  }

  return "";
};

const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHILIPPINE_CONTACT_NUMBER_PATTERN = /^\+639\d{9}$/;

export const isValidEmailAddress = (value = "") =>
  EMAIL_ADDRESS_PATTERN.test(String(value || "").trim());

export const isValidPhilippineContactNumber = (value = "") =>
  PHILIPPINE_CONTACT_NUMBER_PATTERN.test(
    normalizePhilippineContactNumber(value),
  );

export const normalizePhilippineContactNumber = (value = "") => {
  const rawValue = String(value || "").trim();

  if (!rawValue) {
    return "";
  }

  const compactValue = rawValue.replace(/[^\d+]/g, "");

  if (compactValue.startsWith("+")) {
    return `+${compactValue.slice(1).replace(/\D/g, "").slice(0, 12)}`;
  }

  const digitsOnly = compactValue.replace(/\D/g, "");

  if (!digitsOnly) {
    return "";
  }

  if (digitsOnly.startsWith("09")) {
    return `+63${digitsOnly.slice(1, 11)}`;
  }

  if (digitsOnly.startsWith("639")) {
    return `+${digitsOnly.slice(0, 12)}`;
  }

  if (digitsOnly.startsWith("9")) {
    return `+63${digitsOnly.slice(0, 10)}`;
  }

  if (digitsOnly.startsWith("63")) {
    return `+${digitsOnly.slice(0, 12)}`;
  }

  return `+63${digitsOnly.slice(0, 10)}`;
};

export const formatPhilippineContactNumberForDisplay = (value = "") => {
  const normalizedValue = normalizePhilippineContactNumber(value);

  if (!normalizedValue.startsWith("+639")) {
    return normalizedValue.replace(/^\+63/, "");
  }

  const localDigits = normalizedValue.slice(3, 13);
  const firstBlock = localDigits.slice(0, 3);
  const secondBlock = localDigits.slice(3, 6);
  const thirdBlock = localDigits.slice(6, 10);

  return [firstBlock, secondBlock, thirdBlock].filter(Boolean).join(" ");
};

const NAME_FIELD_MAX_LENGTH = 100;
const NAME_VALUE_PATTERN =
  /^[\p{L}\p{M}][\p{L}\p{M}\p{N} .'-]*[\p{L}\p{M}\p{N}.']?$|^[\p{L}\p{M}]$/u;

const normalizeNameField = (value = "") =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ");

const validateProfileNameField = ({
  label,
  value,
  required = false,
}) => {
  const normalizedValue = normalizeNameField(value);

  if (!normalizedValue) {
    return required ? `${label} is required.` : "";
  }

  if (normalizedValue.length > NAME_FIELD_MAX_LENGTH) {
    return `${label} is too long.`;
  }

  if (!NAME_VALUE_PATTERN.test(normalizedValue)) {
    return "The name contains unsupported characters.";
  }

  return "";
};

export const buildDisplayName = ({
  firstName = "",
  middleName = "",
  lastName = "",
} = {}) =>
  [firstName, middleName, lastName]
    .map((value) => normalizeNameField(value))
    .filter(Boolean)
    .join(" ");

export const getBarangayProfileValidationErrors = (profile = {}) => {
  const errors = {};
  const firstName = normalizeNameField(profile.firstName);
  const middleName = normalizeNameField(profile.middleName);
  const lastName = normalizeNameField(profile.lastName);
  const contactNumber = normalizePhilippineContactNumber(
    String(profile.contactNumber || "").trim(),
  );

  errors.firstName = validateProfileNameField({
    label: "First name",
    value: firstName,
    required: true,
  });
  errors.middleName = validateProfileNameField({
    label: "Middle name",
    value: middleName,
  });
  errors.lastName = validateProfileNameField({
    label: "Last name",
    value: lastName,
    required: true,
  });

  if (!contactNumber) {
    errors.contactNumber = "Contact number is required.";
  } else if (!isValidPhilippineContactNumber(contactNumber)) {
    errors.contactNumber = "Please enter a valid contact number.";
  }

  return errors;
};

export const getNotificationPreferenceValidationErrors = ({
  categories = [],
  emailAddress = "",
  isOnline = true,
}) => {
  const errors = {};
  const flattenedRules = (categories || []).flatMap((category) => category.rules || []);
  const hasAnyEmailChannelEnabled = flattenedRules.some(
    (rule) => rule.effectiveChannels?.email,
  );
  const trimmedEmailAddress = String(emailAddress || "").trim();

  if (hasAnyEmailChannelEnabled && !EMAIL_ADDRESS_PATTERN.test(trimmedEmailAddress)) {
    errors.emailAddress =
      "A valid email address is required to receive email notifications.";
  }

  if (!isOnline) {
    errors.readOnly =
      "Notification preferences are view-only while offline. Reconnect before saving changes.";
  }

  return errors;
};

export const normalizeRolePreferences = (value = {}) => {
  const defaults = createDefaultRolePreferences();
  const normalizedCategories = Array.isArray(value?.categories)
    ? value.categories.map((category) => ({
        ...category,
        rules: Array.isArray(category?.rules) ? category.rules : [],
      }))
    : [];

  return {
    ...defaults,
    ...value,
    profile: {
      ...defaults.profile,
      ...(value?.profile || {}),
    },
    notificationRulePreferences:
      value?.notificationRulePreferences &&
      typeof value.notificationRulePreferences === "object"
        ? value.notificationRulePreferences
        : {},
    effectiveNotificationChannels:
      value?.effectiveNotificationChannels &&
      typeof value.effectiveNotificationChannels === "object"
        ? value.effectiveNotificationChannels
        : {},
    categories: normalizedCategories,
    metadata: {
      ...defaults.metadata,
      ...(value?.metadata || {}),
    },
  };
};

export const normalizeRoleSettingsError = (
  error,
  fallbackMessage = "Notification preferences could not be saved. Please try again.",
) => {
  const message = String(error?.message || "").trim();

  if (!message) {
    return fallbackMessage;
  }

  if (
    /must remain enabled|required in-app|cannot be disabled|locked/i.test(message)
  ) {
    return "Required in-app alerts cannot be disabled.";
  }

  if (/does not support email|email delivery/i.test(message)) {
    return "Email is not available for one or more notification types.";
  }

  if (/not available for your role|unknown/i.test(message)) {
    return "Some notification settings are no longer available for your account.";
  }

  if (/valid email address/i.test(message)) {
    return "Please enter a valid email address before saving notification preferences.";
  }

  if (/valid contact number/i.test(message)) {
    return "Please enter a valid contact number before saving notification preferences.";
  }

  return fallbackMessage;
};

export const areNotificationPreferencesEqual = (
  leftPreferences = {},
  rightPreferences = {},
) => {
  const leftPayload = getEditableNotificationPayload(leftPreferences);
  const rightPayload = getEditableNotificationPayload(rightPreferences);

  return JSON.stringify(leftPayload) === JSON.stringify(rightPayload);
};

export const getNotificationCategoryCountLabel = (rules = []) => {
  const count = Array.isArray(rules) ? rules.length : 0;
  return `${count} notification type${count === 1 ? "" : "s"}`;
};

export const getEditableNotificationPayload = (preferences = {}) => {
  const normalizedPreferences = normalizeRolePreferences(preferences);
  const editablePayload = {};

  normalizedPreferences.categories.forEach((category) => {
    category.rules.forEach((rule) => {
      const nextValue = {};

      if (rule.editableChannels?.inApp) {
        nextValue.inApp = Boolean(rule.effectiveChannels?.inApp);
      }

      if (rule.editableChannels?.email) {
        nextValue.email = Boolean(rule.effectiveChannels?.email);
      }

      if (Object.keys(nextValue).length > 0) {
        editablePayload[rule.code] = nextValue;
      }
    });
  });

  return editablePayload;
};

export const getEnabledRuleCodesFromCategories = (categories = []) =>
  (categories || [])
    .flatMap((category) => category.rules || [])
    .filter((rule) => rule.effectiveChannels?.inApp)
    .map((rule) => rule.code);

export const formatDateTime = (value) => {
  if (!value) {
    return "--";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsedDate);
};

export const buildSyncSummary = (syncEntries) => {
  return syncEntries.reduce(
    (summary, entry) => {
      summary.total += 1;
      summary[entry.status] = (summary[entry.status] || 0) + 1;
      return summary;
    },
    {
      total: 0,
      [LOCAL_SYNC_STATUS.PENDING]: 0,
      [LOCAL_SYNC_STATUS.SYNCED]: 0,
      [LOCAL_SYNC_STATUS.FAILED]: 0,
      [LOCAL_SYNC_STATUS.CONFLICT]: 0,
    },
  );
};

export const getRoleMeta = (roleCode) => {
  switch (roleCode) {
    case ROLE_CODES.BARANGAY:
      return { title: "BARANGAY SETTINGS" };
    case ROLE_CODES.MSWDO:
      return { title: "MSWDO SETTINGS" };
    case ROLE_CODES.MAYOR:
      return { title: "MAYOR SETTINGS" };
    default:
      return { title: "SETTINGS" };
  }
};

export const getRolePositionLabel = (roleCode) => {
  if (roleCode === ROLE_CODES.BARANGAY) {
    return BARANGAY_POSITION_LABEL;
  }

  return ROLE_DISPLAY_NAMES[roleCode] || "";
};

export const getSyncStatusMeta = (syncSummary, isOnline) => {
  if (!isOnline) {
    return {
      tone: "warning",
      label: "Pending Synchronization",
      displayLabel: "Pending Synchronization",
      description: "There are records waiting to be synchronized.",
    };
  }

  if (
    syncSummary[LOCAL_SYNC_STATUS.FAILED] > 0 ||
    syncSummary[LOCAL_SYNC_STATUS.CONFLICT] > 0
  ) {
    return {
      tone: "error",
      label: "Requires Attention",
      displayLabel: "Requires Attention",
      description: "Some records require review before synchronization can be completed.",
    };
  }

  if (syncSummary[LOCAL_SYNC_STATUS.PENDING] > 0) {
    return {
      tone: "warning",
      label: "Pending Synchronization",
      displayLabel: "Pending Synchronization",
      description: "There are records waiting to be synchronized.",
    };
  }

  return {
    tone: "success",
    label: "Synced",
    displayLabel: "Synced",
    description: "All data has been successfully synchronized.",
  };
};

export const safeParsePayload = (value) => {
  if (!value) {
    return {};
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (_error) {
      return {};
    }
  }

  return typeof value === "object" ? value : {};
};

export const formatQueueEntryTitle = (entry) => {
  const moduleLabel = entry?.moduleName
    ? String(entry.moduleName).replace(/[_-]/g, " ")
    : "record";
  const actionLabel = entry?.actionKey
    ? String(entry.actionKey).replace(/[_-]/g, " ")
    : "queued";

  return `${actionLabel} ${moduleLabel}`.replace(/\s+/g, " ").trim();
};

export const buildActivityLogs = ({
  distributionRows,
  syncEntries,
  syncHistory,
}) => {
  const localActivityEntries = syncEntries.map((entry) => ({
    id: `queue-${entry.id}`,
    timestamp:
      entry.updatedAt || entry.createdAt || entry.clientTimestamp || entry.syncedAt || "",
    title: formatQueueEntryTitle(entry),
    detail: `Local sync queue - ${entry.status || "--"}`,
    moduleLabel: "Sync",
    tone:
      entry.status === LOCAL_SYNC_STATUS.FAILED ||
      entry.status === LOCAL_SYNC_STATUS.CONFLICT
        ? "error"
        : entry.status === LOCAL_SYNC_STATUS.PENDING
          ? "warning"
          : "success",
  }));

  const syncHistoryEntries = [
    ...(syncHistory.transactions || []).map((transaction, index) => {
      const payload = safeParsePayload(
        transaction.payload_json || transaction.payload || {},
      );

      return {
        id: `transaction-${transaction.id || index}`,
        timestamp:
          transaction.synced_at ||
          transaction.created_at ||
          transaction.client_timestamp ||
          transaction.updated_at ||
          "",
        title: `Synced ${String(transaction.module_name || "record").replace(
          /[_-]/g,
          " ",
        )}`,
        detail: buildPayloadSummary(payload),
        moduleLabel: "Sync",
        tone:
          transaction.sync_status === LOCAL_SYNC_STATUS.FAILED
            ? "error"
            : transaction.sync_status === LOCAL_SYNC_STATUS.CONFLICT
              ? "warning"
              : "success",
      };
    }),
    ...(syncHistory.conflicts || []).map((conflict, index) => ({
      id: `conflict-${conflict.id || index}`,
      timestamp:
        conflict.created_at || conflict.updated_at || conflict.resolved_at || "",
      title: `Sync conflict review for ${String(conflict.entity_type || "record").replace(
        /[_-]/g,
        " ",
      )}`,
      detail: conflict.conflict_type || "Conflict detected during sync.",
      moduleLabel: "Sync",
      tone: conflict.status === "RESOLVED" ? "success" : "warning",
    })),
  ];

  const distributionEntries = distributionRows.slice(0, 12).map((row) => ({
    id: `distribution-${row.id}`,
    timestamp: row.distribution_date || "",
    title: `Recorded distribution for ${row.disaster_event_title || row.event_code || "response"}`,
    detail:
      row.relief_pack_template_name || row.released_items_summary || "Relief goods released",
    moduleLabel: "Distribution",
    tone: "info",
  }));

  return [...localActivityEntries, ...syncHistoryEntries, ...distributionEntries]
    .filter((entry) => entry.timestamp || entry.title)
    .sort((left, right) => {
      const leftTime = left.timestamp ? new Date(left.timestamp).getTime() : 0;
      const rightTime = right.timestamp ? new Date(right.timestamp).getTime() : 0;
      return rightTime - leftTime;
    });
};

export const buildLocalSyncLogRows = (syncEntries) =>
  syncEntries
    .map((entry) => ({
      id: entry.id,
      timestamp:
        entry.updatedAt || entry.createdAt || entry.clientTimestamp || entry.syncedAt || "",
      label: formatQueueEntryTitle(entry),
      status: entry.status || LOCAL_SYNC_STATUS.PENDING,
      detail: entry.moduleName
        ? String(entry.moduleName).replace(/[_-]/g, " ")
        : entry.actionKey || "--",
    }))
    .sort((left, right) => {
      const leftTime = left.timestamp ? new Date(left.timestamp).getTime() : 0;
      const rightTime = right.timestamp ? new Date(right.timestamp).getTime() : 0;
      return rightTime - leftTime;
    });

export const ensureArray = (value) => (Array.isArray(value) ? value : []);

export const ensureObject = (value, fallback = {}) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : fallback;

export { LOCAL_SYNC_STATUS };
