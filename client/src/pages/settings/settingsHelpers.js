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

export const FRONTEND_NOTIFICATION_RULE_ALIAS_MAP = {
  DISASTER_EVENT_UPDATE: "DISASTER_EVENT_UPDATED",
  EVACUEE_ATTENDANCE_UPDATE: "EVACUEE_ATTENDANCE_UPDATED",
  HOUSEHOLD_VERIFICATION: "HOUSEHOLD_VERIFICATION_UPDATED",
  HOUSEHOLD_VERIFICATION_UPDATE: "HOUSEHOLD_VERIFICATION_UPDATED",
  CRITICAL_STOCK: "CRITICAL_INVENTORY_SHORTAGE",
  SYNCHRONIZATION_CONFLICT_ALERT: "SYNC_CONFLICT",
};

const CANONICAL_NOTIFICATION_RULE_METADATA = {
  DISASTER_EVENT_CREATED: {
    name: "Newly Created Disaster Event",
  },
  DISASTER_EVENT_UPDATED: {
    name: "Disaster Event Updates",
  },
  HOUSEHOLD_REGISTERED: {
    name: "New Evacuee Registration",
  },
  EVACUEE_ATTENDANCE_UPDATED: {
    name: "Evacuee Attendance Updates",
  },
  HOUSEHOLD_VERIFICATION_UPDATED: {
    name: "Household Verification Updates",
  },
  DISTRIBUTION_COMPLETED: {
    name: "Distribution Completed",
  },
  LOW_STOCK: {
    name: "Low Stock Alert",
  },
  CRITICAL_INVENTORY_SHORTAGE: {
    name: "Critical Inventory Shortage",
  },
  NEAR_EXPIRY_STOCK: {
    name: "Near Expiry Stock Alert",
  },
  EXPIRED_STOCK: {
    name: "Expired Stock Alert",
  },
  INVENTORY_INCIDENT: {
    name: "Inventory Incident Alert",
  },
  DONATION_RECEIVED: {
    name: "Donation Received",
  },
  DONATION_STOCK_ANOMALY: {
    name: "Donation Anomaly",
  },
  SYNC_FAILURE: {
    name: "Sync Failure",
  },
  SYNC_CONFLICT: {
    name: "Synchronization Conflict Alert",
  },
  EVACUATION_SUMMARY_REPORT: {
    name: "Evacuation Summary Reports",
  },
  SYSTEM_ALERT: {
    name: "System Alerts",
  },
  OPERATIONAL_ANOMALY: {
    name: "Operational Anomaly Alerts",
  },
};

const CATEGORY_SORT_ORDER_BY_ROLE = {
  [ROLE_CODES.BARANGAY]: {
    DISASTER_COORDINATION: 0,
    EVACUEE_MANAGEMENT: 1,
    SYSTEM_OPERATIONS: 2,
  },
  [ROLE_CODES.MSWDO]: {
    DISASTER_MANAGEMENT: 0,
    EVACUEE_MANAGEMENT: 1,
    RELIEF_OPERATIONS: 2,
    SYSTEM_OPERATIONS: 3,
  },
  [ROLE_CODES.MAYOR]: {
    DISASTER_MONITORING: 0,
    RELIEF_OPERATIONS: 1,
    INVENTORY_MONITORING: 2,
    SYSTEM_MONITORING: 3,
  },
};

const RULE_SORT_ORDER = {
  DISASTER_EVENT_CREATED: 0,
  DISASTER_EVENT_UPDATED: 1,
  HOUSEHOLD_REGISTERED: 2,
  EVACUEE_ATTENDANCE_UPDATED: 3,
  HOUSEHOLD_VERIFICATION_UPDATED: 4,
  DISTRIBUTION_COMPLETED: 5,
  LOW_STOCK: 6,
  CRITICAL_INVENTORY_SHORTAGE: 7,
  NEAR_EXPIRY_STOCK: 8,
  EXPIRED_STOCK: 9,
  INVENTORY_INCIDENT: 10,
  DONATION_RECEIVED: 11,
  SYNC_FAILURE: 12,
  SYNC_CONFLICT: 13,
  DONATION_STOCK_ANOMALY: 14,
  EVACUATION_SUMMARY_REPORT: 15,
  SYSTEM_ALERT: 16,
  OPERATIONAL_ANOMALY: 17,
};

const HIDDEN_NOTIFICATION_RULE_CODES = new Set(["SYSTEM_ANOMALY"]);

const SYNC_NOTIFICATION_DESCRIPTIONS = {
  [ROLE_CODES.BARANGAY]: {
    SYNC_FAILURE:
      "Alerts you when an offline evacuee, attendance, stub, or relief distribution transaction from your barangay fails to synchronize and requires review.",
    SYNC_CONFLICT:
      "Alerts you when an offline transaction from your barangay conflicts with an existing central record and requires review or confirmation.",
  },
  [ROLE_CODES.MSWDO]: {
    SYNC_FAILURE:
      "Alerts you when an evacuee, attendance, household verification, or relief distribution record fails to synchronize and requires review.",
    SYNC_CONFLICT:
      "Alerts you when synchronized evacuee or relief-operation data conflicts with an existing central record and may require authorized review.",
  },
  [ROLE_CODES.MAYOR]: {
    SYNC_FAILURE:
      "Alerts you when an inventory, donation, or other Mayor-related transaction fails to synchronize and requires review.",
    SYNC_CONFLICT:
      "Alerts you when an offline inventory or donation transaction conflicts with an existing central record and may require review.",
  },
};

const RULE_DESCRIPTION_BY_NAME = {
  "Disaster Event Updates":
    "Important changes to active disaster events, affected barangays, and operation schedules.",
  "Newly Created Disaster Event":
    "Alerts your office when a new disaster event is created for official response.",
  "New Evacuee Registration":
    "Shows grouped updates for newly registered household records in active evacuation operations.",
  "Household Verification Updates":
    "Highlights household records that need follow-up or closer review.",
  "Evacuee Attendance Updates":
    "Shows grouped attendance activity for evacuees during ongoing operations.",
  "Distribution Completed":
    "Tracks completed relief distribution activity without sending one alert for every transaction.",
  "Low Stock Alert":
    "Warns you when relief stock falls below the warning threshold before it becomes critical.",
  "Critical Inventory Shortage":
    "Alerts you when relief stock reaches a critical shortage level.",
  "Inventory Incident Alert":
    "Warns you when relief goods are marked damaged, missing, spoiled, or stolen.",
  "Donation Received":
    "Lets your office monitor newly received donations after they are successfully recorded.",
  "Donation Anomaly":
    "Warns you when donation stock activity is inconsistent and needs review.",
  "Near Expiry Stock Alert":
    "Warns you when relief goods are close to their expiry date.",
  "Expired Stock Alert":
    "Alerts you when relief goods are already expired and need action.",
  "Evacuation Summary Reports":
    "Provides a grouped daily view of evacuation monitoring updates.",
  "System Alerts":
    "Alerts your office when a system service or subsystem needs immediate attention.",
  "Operational Anomaly Alerts":
    "Warns the Mayor about operational discrepancies that require review.",
};

export const getSafePolicyLabel = (value, labels, fallback) =>
  labels[value] || fallback;

export const canonicalizeNotificationRuleCode = (ruleCode = "") =>
  FRONTEND_NOTIFICATION_RULE_ALIAS_MAP[ruleCode] || ruleCode;

const getCanonicalRuleMetadata = (ruleCode = "") =>
  CANONICAL_NOTIFICATION_RULE_METADATA[canonicalizeNotificationRuleCode(ruleCode)] ||
  null;

const mergeBooleanPreference = (leftValue, rightValue) => {
  if (leftValue === true || rightValue === true) {
    return true;
  }

  if (typeof leftValue === "boolean") {
    return leftValue;
  }

  if (typeof rightValue === "boolean") {
    return rightValue;
  }

  return undefined;
};

const sortNotificationCategories = (categories = [], roleCode = "") =>
  [...categories].sort((left, right) => {
    const leftOrder =
      CATEGORY_SORT_ORDER_BY_ROLE[roleCode]?.[left.code] ?? Number.MAX_SAFE_INTEGER;
    const rightOrder =
      CATEGORY_SORT_ORDER_BY_ROLE[roleCode]?.[right.code] ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return String(left.label || "").localeCompare(String(right.label || ""));
  });

const sortCategoryRules = (rules = []) =>
  [...rules].sort(
    (left, right) =>
      (RULE_SORT_ORDER[left.code] ?? Number.MAX_SAFE_INTEGER) -
      (RULE_SORT_ORDER[right.code] ?? Number.MAX_SAFE_INTEGER),
  );

export const dedupeNotificationSettings = ({
  roleCode = "",
  notificationRulePreferences = {},
  effectiveNotificationChannels = {},
  categories = [],
}) => {
  const canonicalPreferences = {};
  const canonicalEffectiveChannels = {};
  const groupedRules = new Map();

  Object.entries(notificationRulePreferences || {}).forEach(([ruleCode, value]) => {
    const canonicalRuleCode = canonicalizeNotificationRuleCode(ruleCode);

    if (!canonicalRuleCode || HIDDEN_NOTIFICATION_RULE_CODES.has(canonicalRuleCode)) {
      return;
    }

    canonicalPreferences[canonicalRuleCode] = {
      ...(canonicalPreferences[canonicalRuleCode] || {}),
      ...(typeof value === "object" && value ? value : {}),
    };
  });

  Object.entries(effectiveNotificationChannels || {}).forEach(([ruleCode, value]) => {
    const canonicalRuleCode = canonicalizeNotificationRuleCode(ruleCode);

    if (!canonicalRuleCode || HIDDEN_NOTIFICATION_RULE_CODES.has(canonicalRuleCode)) {
      return;
    }

    const existingValue = canonicalEffectiveChannels[canonicalRuleCode] || {};
    canonicalEffectiveChannels[canonicalRuleCode] = {
      inApp: mergeBooleanPreference(existingValue.inApp, value?.inApp),
      email: mergeBooleanPreference(existingValue.email, value?.email),
    };
  });

  (categories || []).forEach((category) => {
    const nextRules = Array.isArray(category?.rules) ? category.rules : [];

    nextRules.forEach((rule) => {
      const canonicalRuleCode = canonicalizeNotificationRuleCode(rule?.code);

      if (!canonicalRuleCode || HIDDEN_NOTIFICATION_RULE_CODES.has(canonicalRuleCode)) {
        return;
      }

      const metadata = getCanonicalRuleMetadata(canonicalRuleCode);
      const groupKey = `${category?.code || ""}:${canonicalRuleCode}`;
      const existingRule = groupedRules.get(groupKey);

      groupedRules.set(groupKey, {
        ...(existingRule || {}),
        ...rule,
        code: canonicalRuleCode,
        roleCode: rule?.roleCode || rule?.role_code || category?.roleCode || roleCode,
        categoryCode:
          rule?.categoryCode || rule?.category_code || category?.code || "",
        categoryLabel:
          rule?.categoryLabel || rule?.category_label || category?.label || "",
        name: metadata?.name || existingRule?.name || rule?.name || canonicalRuleCode,
        effectiveChannels: {
          inApp: mergeBooleanPreference(
            existingRule?.effectiveChannels?.inApp,
            rule?.effectiveChannels?.inApp,
          ),
          email: mergeBooleanPreference(
            existingRule?.effectiveChannels?.email,
            rule?.effectiveChannels?.email,
          ),
        },
      });
    });
  });

  const categoriesByCode = new Map();

  Array.from(groupedRules.values()).forEach((rule) => {
    const categoryCode = rule.categoryCode || rule.category_code || "";
    const categoryLabel = rule.categoryLabel || rule.category_label || "";

    if (!categoriesByCode.has(categoryCode)) {
      categoriesByCode.set(categoryCode, {
        code: categoryCode,
        label: categoryLabel,
        roleCode,
        rules: [],
      });
    }

    categoriesByCode.get(categoryCode).rules.push(rule);
  });

  const normalizedCategories = sortNotificationCategories(
    Array.from(categoriesByCode.values()).map((category) => ({
      ...category,
      rules: sortCategoryRules(category.rules),
    })),
    roleCode,
  );

  return {
    notificationRulePreferences: canonicalPreferences,
    effectiveNotificationChannels: canonicalEffectiveChannels,
    categories: normalizedCategories,
  };
};

export const getRuleDescription = (rule = {}) =>
  SYNC_NOTIFICATION_DESCRIPTIONS[rule.roleCode]?.[rule.code] ||
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
  const dedupedNotificationSettings = dedupeNotificationSettings({
    roleCode: value?.roleCode || "",
    notificationRulePreferences: value?.notificationRulePreferences,
    effectiveNotificationChannels: value?.effectiveNotificationChannels,
    categories: Array.isArray(value?.categories) ? value.categories : [],
  });

  return {
    ...defaults,
    ...value,
    profile: {
      ...defaults.profile,
      ...(value?.profile || {}),
    },
    notificationRulePreferences:
      dedupedNotificationSettings.notificationRulePreferences,
    effectiveNotificationChannels:
      dedupedNotificationSettings.effectiveNotificationChannels,
    categories: dedupedNotificationSettings.categories,
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
