import { buildPayloadSummary } from "../../features/sync/syncManagementHelpers";
import { LOCAL_SYNC_STATUS } from "../../offline/db";
import { ROLE_CODES } from "../../utils/roleSession";
import {
  BARANGAY_NOTIFICATION_OPTIONS,
  BARANGAY_POSITION_LABEL,
  getNotificationOptionsForRole,
  ROLE_DISPLAY_NAMES,
} from "./settingsConfig";

export const createDefaultNotificationChannels = () =>
  BARANGAY_NOTIFICATION_OPTIONS.reduce((current, option) => {
    current[option.key] = {
      inApp: true,
      email: false,
    };
    return current;
  }, {});

export const createDefaultRolePreferences = () => ({
  enabledNotificationRuleCodes: [],
  profile: {
    fullName: "",
    position: BARANGAY_POSITION_LABEL,
    contactNumber: "",
    emailAddress: "",
    profilePictureDataUrl: "",
    profilePictureFileName: "",
  },
  notificationChannels: createDefaultNotificationChannels(),
  metadata: {
    lastProfileUpdateAt: "",
    lastPreferenceSaveAt: "",
  },
});

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

export const getBarangayProfileValidationErrors = (profile = {}) => {
  const errors = {};
  const fullName = String(profile.fullName || "").trim();
  const contactNumber = normalizePhilippineContactNumber(
    String(profile.contactNumber || "").trim(),
  );
  const emailAddress = String(profile.emailAddress || "").trim();

  if (!fullName) {
    errors.fullName = "Full name is required.";
  }

  if (!contactNumber) {
    errors.contactNumber = "Contact number is required.";
  } else if (!isValidPhilippineContactNumber(contactNumber)) {
    errors.contactNumber = "Please enter a valid contact number.";
  }

  if (!emailAddress) {
    errors.emailAddress = "Please enter a valid email address.";
  } else if (!isValidEmailAddress(emailAddress)) {
    errors.emailAddress = "Please enter a valid email address.";
  }

  return errors;
};

export const getNotificationPreferenceValidationErrors = ({
  notificationChannels = {},
  roleCode = ROLE_CODES.BARANGAY,
  emailAddress = "",
  enabledNotificationRuleCodes = [],
  notificationRules = [],
}) => {
  const errors = {};
  const optionStates = getNotificationOptionsForRole(roleCode).map((option) => ({
    label: option.label,
    inApp: Boolean(notificationChannels[option.key]?.inApp),
    email: Boolean(notificationChannels[option.key]?.email),
  }));
  const hasAnyEmailChannel = optionStates.some((option) => option.email);
  const trimmedEmailAddress = String(emailAddress || "").trim();
  const disabledTypes = optionStates.filter((option) => !option.inApp && !option.email);
  const allowedRuleCodes = new Set(
    (notificationRules || [])
      .map((rule) => (typeof rule?.code === "string" ? rule.code.trim() : ""))
      .filter(Boolean),
  );
  const invalidRuleCodes = Array.from(
    new Set(
      (enabledNotificationRuleCodes || [])
        .map((code) => (typeof code === "string" ? code.trim() : ""))
        .filter((code) => code && !allowedRuleCodes.has(code)),
    ),
  );

  if (disabledTypes.length > 0) {
    errors.notificationTypes =
      disabledTypes.length === 1
        ? `${disabledTypes[0].label} must keep at least one enabled channel.`
        : "Each notification type must keep at least one enabled channel.";
  }

  if (hasAnyEmailChannel && !EMAIL_ADDRESS_PATTERN.test(trimmedEmailAddress)) {
    errors.emailAddress =
      "A valid email address is required to receive email notifications.";
  }

  if (invalidRuleCodes.length > 0) {
    errors.notificationRules =
      "Some notification preferences are no longer available for your account role. Reset your notification settings and save again.";
  }

  return errors;
};

export const normalizeRolePreferences = (value = {}) => {
  const defaults = createDefaultRolePreferences();
  const { preferredExportFormat: _removedPreferredExportFormat, ...remainingValue } =
    value || {};
  const notificationChannels = {
    ...defaults.notificationChannels,
  };

  Object.entries(value?.notificationChannels || {}).forEach(([key, channels]) => {
    notificationChannels[key] = {
      ...(defaults.notificationChannels[key] || { inApp: true, email: false }),
      ...(channels || {}),
    };
  });

  return {
    ...defaults,
    ...remainingValue,
    enabledNotificationRuleCodes: Array.isArray(value?.enabledNotificationRuleCodes)
      ? value.enabledNotificationRuleCodes
      : [],
    profile: {
      ...defaults.profile,
      ...(value?.profile || {}),
    },
    notificationChannels,
    metadata: {
      ...defaults.metadata,
      ...(value?.metadata || {}),
    },
  };
};

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
      return {
        title: "BARANGAY SETTINGS",
      };
    case ROLE_CODES.MSWDO:
      return {
        title: "MSWDO SETTINGS",
      };
    case ROLE_CODES.MAYOR:
      return {
        title: "MAYOR SETTINGS",
      };
    default:
      return {
        title: "SETTINGS",
      };
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
      displayLabel: "⏳ Pending Synchronization",
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
      displayLabel: "⚠ Requires Attention",
      description: "Some records require review before synchronization can be completed.",
    };
  }

  if (syncSummary[LOCAL_SYNC_STATUS.PENDING] > 0) {
    return {
      tone: "warning",
      label: "Pending Synchronization",
      displayLabel: "⏳ Pending Synchronization",
      description: "There are records waiting to be synchronized.",
    };
  }

  return {
    tone: "success",
    label: "Synced",
    displayLabel: "✓ Synced",
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

  return [
    ...localActivityEntries,
    ...syncHistoryEntries,
    ...distributionEntries,
  ]
    .filter((entry) => entry.timestamp || entry.title)
    .sort((left, right) => {
      const leftTime = left.timestamp ? new Date(left.timestamp).getTime() : 0;
      const rightTime = right.timestamp ? new Date(right.timestamp).getTime() : 0;
      return rightTime - leftTime;
    });
};

export const buildLocalSyncLogRows = (syncEntries) => {
  return syncEntries
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
};

export const ensureArray = (value) => (Array.isArray(value) ? value : []);

export const ensureObject = (value, fallback = {}) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : fallback;

export { LOCAL_SYNC_STATUS };
