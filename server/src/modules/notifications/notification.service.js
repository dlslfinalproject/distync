const notificationRepository = require("./notification.repository");
const disasterEventRepository = require("../../repositories/disasterEvent.repository");
const {
  NOTIFICATION_TYPES,
  assertValidNotificationType,
} = require("./notification.constants");
const { ROLE_CODES } = require("../auth/auth.middleware");
const emailService = require("../email/email.service");
const { insertAuditLog } = require("../../repositories/systemLog.repository");
const {
  DELIVERY_MODE,
  NOTIFICATION_POLICY_ROWS,
  NOTIFICATION_RULE_TARGETS,
  getCanonicalRuleCode,
  getCanonicalRuleDefinition,
  getSettingsVisibleRuleCodesForRole,
  getPolicyRolesForRule,
  isVisibleInSettings,
} = require("./notificationPolicy");
const {
  buildPreferenceCategories,
  mergeCanonicalPolicyRows,
  resolveEffectiveNotificationPreferences,
  sanitizeNotificationRulePreferences,
} = require("./notificationPreferenceUtils");
const {
  isManualInventoryStockDriftReviewable,
} = require("../../utils/syncConflictReviewPolicy");
const {
  isInventoryBatchExpired,
  isInventoryBatchNearExpiry,
  isInventoryBatchLowStock,
} = require("../../utils/inventoryBatchStatus");

const CRITICAL_STOCK_THRESHOLD = 5;
const NEAR_EXPIRY_DAYS = 30;
const DEDUPE_LOOKBACK_HOURS = 24;
const MANILA_TIME_ZONE = "Asia/Manila";
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const MAX_EVACUATION_SUMMARY_BARANGAYS = 3;
const MAX_NOTIFICATION_METADATA_KEYS = 20;
const MAX_NOTIFICATION_METADATA_STRING_LENGTH = 256;
const MAX_SUMMARY_BREAKDOWN_ROWS = 20;
const MAINTENANCE_SCAN_INTERVAL_MS = Number.parseInt(
  process.env.NOTIFICATION_SCAN_INTERVAL_MS || `${15 * 60 * 1000}`,
  10,
);
const EMAIL_NOTIFICATION_MAX_ATTEMPTS = Math.max(1, Number.parseInt(process.env.EMAIL_NOTIFICATION_MAX_ATTEMPTS || "3", 10) || 3);
const EMAIL_NOTIFICATION_RETRY_BASE_SECONDS = Math.max(60, Number.parseInt(process.env.EMAIL_NOTIFICATION_RETRY_BASE_SECONDS || "900", 10) || 900);
const EMAIL_DELIVERY_STALE_AFTER_SECONDS = 15 * 60;
const NOTIFICATION_OUTBOX_BATCH_SIZE = Math.max(
  1,
  Number.parseInt(process.env.NOTIFICATION_OUTBOX_BATCH_SIZE || "25", 10) || 25,
);

const DEFAULT_NOTIFICATION_RULES = NOTIFICATION_RULE_TARGETS.map((rule) => ({
  code: rule.code,
  name: rule.name,
  trigger_type: rule.triggerType,
  target_role_code: rule.targetRoleCode,
  is_active: rule.isActive,
}));

const NOTIFICATION_SEVERITY_BY_POLICY_PRIORITY = Object.freeze({
  CRITICAL: "CRITICAL",
  WARNING: "WARNING",
  INFORMATIONAL: "INFO",
  INFO: "INFO",
});

const resolveNotificationSeverity = (priority) => {
  const normalizedPriority = String(priority || "").trim().toUpperCase();
  const severity = NOTIFICATION_SEVERITY_BY_POLICY_PRIORITY[normalizedPriority];

  if (!severity) {
    const error = new Error(
      `Notification policy priority is invalid: ${normalizedPriority || "missing"}.`,
    );
    error.code = "INVALID_NOTIFICATION_PRIORITY";
    error.statusCode = 500;
    throw error;
  }

  return severity;
};

let notificationMaintenanceInterval = null;

const createNotificationPolicyConfigurationError = (roleCode) => {
  const error = new Error(
    `Notification preferences are temporarily unavailable for role ${roleCode}.`,
  );
  error.statusCode = 503;
  error.code = "NOTIFICATION_POLICY_UNAVAILABLE";
  return error;
};

const MAYOR_RELEVANT_SYNC_ENTITY_TYPES = new Set([
  "INVENTORY_ITEM",
  "INVENTORY_BATCH",
  "INVENTORY_TRANSACTION",
  "DONATION",
  "DONATION_ITEM",
  "SUPPLIER",
]);

const FALLBACK_SYNC_NOTIFICATION_ROLE_CODES = [
  ROLE_CODES.BARANGAY,
  ROLE_CODES.MSWDO,
];

const toDisplayQuantity = (value) => Number(value || 0).toLocaleString();

const toSafeInteger = (value) => Number.parseInt(value || 0, 10) || 0;

const METADATA_FIELDS_BY_RULE = {
  DISASTER_EVENT_CREATED: ["disasterEventId", "action"],
  DISASTER_EVENT_UPDATED: ["disasterEventId", "action", "barangayIds"],
  HOUSEHOLD_REGISTERED: ["householdId", "barangayId", "action"],
  HOUSEHOLD_VERIFICATION_UPDATED: ["householdId", "barangayId"],
  EVACUEE_ATTENDANCE_UPDATED: ["householdId", "barangayId", "attendanceAction"],
  DISTRIBUTION_COMPLETED: ["distributionTransactionId", "barangayId", "stubNo"],
  CRITICAL_INVENTORY_SHORTAGE: ["batchId", "itemId", "remainingQuantity"],
  LOW_STOCK: ["batchId", "itemId", "remainingQuantity"],
  NEAR_EXPIRY_STOCK: ["batchId", "itemId", "expiresAt", "remainingQuantity"],
  EXPIRED_STOCK: ["batchId", "itemId", "expiresAt", "remainingQuantity"],
  INVENTORY_INCIDENT: ["inventoryTransactionId", "batchId", "itemId", "quantity", "transactionType"],
  DONATION_RECEIVED: ["donationId", "donationItemId", "itemCount", "quantity"],
  DONATION_STOCK_ANOMALY: ["donationId", "donationItemId", "quantity"],
  SYNC_FAILURE: ["syncTransactionId", "operationType", "entityType"],
  SYNC_CONFLICT: ["conflictId", "entityType"],
};

const sanitizeMetadataScalar = (value) => {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") return value.slice(0, MAX_NOTIFICATION_METADATA_STRING_LENGTH);
  if (Array.isArray(value)) {
    return value.slice(0, MAX_SUMMARY_BREAKDOWN_ROWS).map(sanitizeMetadataScalar).filter((item) => item !== undefined);
  }
  return undefined;
};

const sanitizeNotificationMetadata = (ruleCode, metadata = {}) => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const allowedFields = new Set(METADATA_FIELDS_BY_RULE[ruleCode] || []);
  const result = {};
  for (const key of allowedFields) {
    const value = sanitizeMetadataScalar(metadata[key]);
    if (value !== undefined) result[key] = value;
  }

  if (metadata.summary && typeof metadata.summary === "object" && !Array.isArray(metadata.summary)) {
    const summary = {};
    ["windowStart", "windowEnd", "eventCount", "newHouseholds", "newEvacuees", "presentCount", "departedCount", "itemCount"].forEach((key) => {
      const value = sanitizeMetadataScalar(metadata.summary[key]);
      if (value !== undefined) summary[key] = value;
    });
    if (Array.isArray(metadata.summary.breakdown)) {
      summary.breakdown = metadata.summary.breakdown.slice(0, MAX_SUMMARY_BREAKDOWN_ROWS).map((row) => {
        if (!row || typeof row !== "object" || Array.isArray(row)) return null;
        const clean = {};
        ["barangayId", "action", "count", "householdCount", "evacueeCount"].forEach((key) => {
          const value = sanitizeMetadataScalar(row[key]);
          if (value !== undefined) clean[key] = value;
        });
        return Object.keys(clean).length ? clean : null;
      }).filter(Boolean);
    }
    if (Object.keys(summary).length) result.summary = summary;
  }

  return Object.fromEntries(Object.entries(result).slice(0, MAX_NOTIFICATION_METADATA_KEYS));
};

const shiftDateByMilliseconds = (value, milliseconds) =>
  new Date(value.getTime() + milliseconds);

const getPreviousCompletedManilaHourWindow = (now = new Date()) => {
  const manilaNow = shiftDateByMilliseconds(now, MANILA_OFFSET_MS);
  const windowEndsAtInManila = new Date(
    Date.UTC(
      manilaNow.getUTCFullYear(),
      manilaNow.getUTCMonth(),
      manilaNow.getUTCDate(),
      manilaNow.getUTCHours(),
      0,
      0,
      0,
    ),
  );
  const windowStartedAtInManila = new Date(
    windowEndsAtInManila.getTime() - 60 * 60 * 1000,
  );

  return {
    timezone: MANILA_TIME_ZONE,
    windowStartedAt: shiftDateByMilliseconds(
      windowStartedAtInManila,
      -MANILA_OFFSET_MS,
    ),
    windowEndsAt: shiftDateByMilliseconds(
      windowEndsAtInManila,
      -MANILA_OFFSET_MS,
    ),
  };
};

const formatManilaHourLabel = (value) =>
  new Intl.DateTimeFormat("en-PH", {
    timeZone: MANILA_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));

const formatCountLabel = (count, singular, plural = `${singular}s`) =>
  `${toDisplayQuantity(count)} ${count === 1 ? singular : plural}`;

const getEvacuationSummaryPayload = (summaryGroup) =>
  summaryGroup.events.reduce((payload, eventRow) => {
    if (payload) {
      return payload;
    }

    if (
      eventRow?.payload_json &&
      typeof eventRow.payload_json === "object" &&
      !Array.isArray(eventRow.payload_json)
    ) {
      return eventRow.payload_json;
    }

    return null;
  }, null);

const hasMeaningfulEvacuationSummaryActivity = (summary = {}) => {
  const totals = summary.totals || {};
  const attendanceActivity = summary.attendanceActivity || {};

  return (
    toSafeInteger(totals.newHouseholds) > 0 ||
    toSafeInteger(totals.newEvacuees) > 0 ||
    toSafeInteger(attendanceActivity.arrivals) > 0 ||
    toSafeInteger(attendanceActivity.departures) > 0
  );
};

const buildEvacuationSummaryContent = (summaryPayload = {}) => {
  const disasterEvent = summaryPayload.disasterEvent || {};
  const window = summaryPayload.window || {};
  const totals = summaryPayload.totals || {};
  const barangays = Array.isArray(summaryPayload.barangays)
    ? summaryPayload.barangays
    : [];
  const windowStartLabel = formatManilaHourLabel(window.start || new Date());
  const windowEndLabel = formatManilaHourLabel(window.end || new Date());
  const eventLabel =
    disasterEvent.title ||
    disasterEvent.eventCode ||
    "Active disaster event";
  const currentTotalsSentence = `Current event totals: ${formatCountLabel(
    toSafeInteger(totals.cumulativeHouseholds),
    "household",
  )} and ${formatCountLabel(
    toSafeInteger(totals.cumulativeEvacuees),
    "evacuee",
  )}.`;
  const attendanceSentence =
    totals.presentEvacuees == null || totals.departedEvacuees == null
      ? ""
      : ` Current attendance: ${formatCountLabel(
          toSafeInteger(totals.presentEvacuees),
          "present evacuee",
        )} and ${formatCountLabel(
          toSafeInteger(totals.departedEvacuees),
          "departed evacuee",
        )}.`;
  const rankedBarangays = [...barangays]
    .sort((left, right) => {
      const leftActivity =
        toSafeInteger(left.newHouseholds) + toSafeInteger(left.newEvacuees);
      const rightActivity =
        toSafeInteger(right.newHouseholds) + toSafeInteger(right.newEvacuees);

      if (leftActivity !== rightActivity) {
        return rightActivity - leftActivity;
      }

      return String(left.barangayName || "").localeCompare(
        String(right.barangayName || ""),
      );
    })
    .filter(
      (row) =>
        toSafeInteger(row.newHouseholds) > 0 || toSafeInteger(row.newEvacuees) > 0,
    );
  const visibleBarangays = rankedBarangays.slice(0, MAX_EVACUATION_SUMMARY_BARANGAYS);
  const remainingBarangayCount = Math.max(
    rankedBarangays.length - visibleBarangays.length,
    0,
  );
  const barangaySentence =
    visibleBarangays.length === 0
      ? ""
      : ` Barangay breakdown: ${visibleBarangays
          .map(
            (row) =>
              `${row.barangayName}: ${formatCountLabel(
                toSafeInteger(row.newHouseholds),
                "household",
              )}, ${formatCountLabel(
                toSafeInteger(row.newEvacuees),
                "evacuee",
              )}`,
          )
          .join("; ")}${
          remainingBarangayCount > 0
            ? `; and ${toDisplayQuantity(remainingBarangayCount)} more barangay${
                remainingBarangayCount === 1 ? "" : "s"
              }`
            : ""
        }.`;

  return {
    title: `Evacuation Summary - ${windowStartLabel} to ${windowEndLabel}`,
    message: `${eventLabel} recorded ${formatCountLabel(
      toSafeInteger(totals.newHouseholds),
      "newly registered household",
    )} and ${formatCountLabel(
      toSafeInteger(totals.newEvacuees),
      "new evacuee",
    )} from ${windowStartLabel} to ${windowEndLabel}.${barangaySentence} ${currentTotalsSentence}${attendanceSentence}`.replace(
      /\s+/g,
      " ",
    ).trim(),
  };
};

const isExpiredDate = (value) => {
  return isInventoryBatchExpired(value);
};

const getWindowBounds = (deliveryMode, now = new Date()) => {
  const manilaNow = shiftDateByMilliseconds(now, MANILA_OFFSET_MS);
  const windowStartedAtInManila = new Date(
    Date.UTC(
      manilaNow.getUTCFullYear(),
      manilaNow.getUTCMonth(),
      manilaNow.getUTCDate(),
      deliveryMode === DELIVERY_MODE.DAILY_SUMMARY ? 0 : manilaNow.getUTCHours(),
      0,
      0,
      0,
    ),
  );
  const windowEndsAtInManila = new Date(windowStartedAtInManila);

  if (deliveryMode === DELIVERY_MODE.DAILY_SUMMARY) {
    windowEndsAtInManila.setUTCDate(windowEndsAtInManila.getUTCDate() + 1);
  } else {
    windowEndsAtInManila.setUTCHours(windowEndsAtInManila.getUTCHours() + 1);
  }

  const windowStartedAt = shiftDateByMilliseconds(
    windowStartedAtInManila,
    -MANILA_OFFSET_MS,
  );
  const windowEndsAt = shiftDateByMilliseconds(
    windowEndsAtInManila,
    -MANILA_OFFSET_MS,
  );

  return {
    windowStartedAt,
    windowEndsAt,
    readyAt: windowEndsAt,
  };
};

const buildSummaryKey = ({
  roleCode,
  ruleCode,
  disasterEventId = "",
  barangayId = "",
  windowStartedAt,
}) =>
  [
    roleCode,
    ruleCode,
    disasterEventId || "global",
    barangayId || "all",
    windowStartedAt.toISOString(),
  ].join(":");

const getSummaryEvents = (eventRow) => {
  const payload = eventRow?.payload_json;
  if (Array.isArray(payload?.events)) {
    return payload.events;
  }

  // Pending rows created before Block 1 stored one event as an object.
  return payload && typeof payload === "object" ? [payload] : [];
};

const getSummaryEventCount = (summaryGroup) =>
  summaryGroup.events.reduce(
    (count, eventRow) => count + getSummaryEvents(eventRow).length,
    0,
  );

const resolveStoredPreferenceState = ({
  roleCode,
  policyRows,
  preferenceRow,
}) =>
  resolveEffectiveNotificationPreferences({
    roleCode,
    policyRows,
    modernPreferences: sanitizeNotificationRulePreferences(
      preferenceRow?.notification_rule_preferences_json,
    ),
  });

const buildRecipientDeliveryPlan = async ({
  userIds,
  roleCode,
  ruleCode,
}) => {
  const canonicalRuleCode = getCanonicalRuleCode(ruleCode);
  const resolvedUserIds = [...new Set((userIds || []).filter(Boolean))];

  if (resolvedUserIds.length === 0 || !roleCode || !canonicalRuleCode) {
    return [];
  }

  const [policyRow, preferenceRows] = await Promise.all([
    notificationRepository.getNotificationPolicyRow(canonicalRuleCode, roleCode),
    notificationRepository.getUserNotificationPreferencesByRole(
      resolvedUserIds,
      roleCode,
    ),
  ]);

  if (!policyRow || policyRow.policy_is_active === false || policyRow.is_active === false) {
    return [];
  }

  const policyRowsForRole =
    await notificationRepository.getNotificationPolicyRowsByRoleCode(roleCode);

  return preferenceRows.map((row) => {
    const resolvedPreferenceState = resolveStoredPreferenceState({
      roleCode,
      policyRows: policyRowsForRole,
      preferenceRow: row,
    });
    const effectiveChannels =
      resolvedPreferenceState.effectiveChannels?.[policyRow.code] || {
        inApp: false,
        email: false,
      };

    return {
      userId: row.user_id,
      roleCode,
      email: typeof row.email === "string" ? row.email.trim() : "",
      inAppEnabled: effectiveChannels.inApp,
      emailEnabled: effectiveChannels.email,
    };
  });
};

const resolveNotificationRecipientRoles = (ruleCode, targetRoleCode = null) => {
  const policyRoles = getPolicyRolesForRule(getCanonicalRuleCode(ruleCode));
  if (policyRoles.length > 0) {
    return policyRoles;
  }

  return targetRoleCode ? [targetRoleCode] : [];
};

const resolveNotificationRecipientGroups = async ({
  ruleCode,
  targetRoleCode = null,
  recipientResolversByRole = {},
  includeRoleCodes = null,
}) => {
  const resolvedRoleCodes = (
    Array.isArray(includeRoleCodes) && includeRoleCodes.length > 0
      ? includeRoleCodes
      : resolveNotificationRecipientRoles(ruleCode, targetRoleCode)
  ).filter(Boolean);

  const recipientGroups = await Promise.all(
    resolvedRoleCodes.map(async (roleCode) => {
      const resolver = recipientResolversByRole[roleCode];

      if (typeof resolver !== "function") {
        return null;
      }

      return {
        roleCode,
        userIds: await resolver(),
      };
    }),
  );

  return recipientGroups.filter(Boolean);
};

const normalizeSyncContextValue = (value) =>
  typeof value === "string" ? value.trim().toUpperCase() : "";

const isMayorRelevantSyncEvent = (syncContext = {}) =>
  MAYOR_RELEVANT_SYNC_ENTITY_TYPES.has(
    normalizeSyncContextValue(syncContext.entity_type),
  );

const resolveSyncFailureRecipientRoleCodes = async (syncTransaction = {}) => {
  const actorRoleCodes = await notificationRepository.getRoleCodesByUserId(
    syncTransaction.user_id,
  );

  if (
    actorRoleCodes.includes(ROLE_CODES.MAYOR) &&
    isMayorRelevantSyncEvent(syncTransaction)
  ) {
    return [ROLE_CODES.MAYOR];
  }

  if (actorRoleCodes.includes(ROLE_CODES.BARANGAY)) {
    return [ROLE_CODES.BARANGAY];
  }

  if (actorRoleCodes.includes(ROLE_CODES.MSWDO)) {
    return [ROLE_CODES.MSWDO];
  }

  return FALLBACK_SYNC_NOTIFICATION_ROLE_CODES.filter((roleCode) =>
    resolveNotificationRecipientRoles("SYNC_FAILURE", ROLE_CODES.BARANGAY).includes(
      roleCode,
    ),
  );
};

const resolveSyncConflictRecipientRoleCode = async (syncConflict = {}) => {
  const actorRoleCodes = await notificationRepository.getRoleCodesByUserId(
    syncConflict.user_id,
  );

  if (
    actorRoleCodes.includes(ROLE_CODES.MAYOR) &&
    isMayorRelevantSyncEvent(syncConflict)
  ) {
    return ROLE_CODES.MAYOR;
  }

  return (
    actorRoleCodes.find((roleCode) =>
      FALLBACK_SYNC_NOTIFICATION_ROLE_CODES.includes(roleCode),
    ) || null
  );
};

const createPersistentNotification = async ({
  ruleCode,
  recipientGroups,
  disaster_event_id = null,
  type,
  title,
  message,
  severity: _producerSeverity = "INFO",
  reference_type = null,
  reference_id = null,
  source_event_key = null,
  metadata = {},
  dedupeHours = DEDUPE_LOOKBACK_HOURS,
}) => {
  const canonicalRuleCode = getCanonicalRuleCode(ruleCode);
  assertValidNotificationType(type);
  if (!canonicalRuleCode || !getCanonicalRuleDefinition(canonicalRuleCode)) {
    const error = new Error("Notification rule is invalid.");
    error.code = "INVALID_NOTIFICATION_RULE";
    error.statusCode = 500;
    throw error;
  }
  const safeMetadata = sanitizeNotificationMetadata(canonicalRuleCode, metadata);

  const policyRows = await Promise.all(
    (recipientGroups || []).map((group) =>
      notificationRepository.getNotificationPolicyRow(canonicalRuleCode, group.roleCode),
    ),
  );
  const activePolicyRows = policyRows.filter(Boolean);

  if (activePolicyRows.length === 0) {
    return null;
  }

  const priorities = [...new Set(activePolicyRows.map((row) => row.priority))];
  if (priorities.length !== 1) {
    const error = new Error(
      `Notification rule ${canonicalRuleCode} has inconsistent recipient priorities.`,
    );
    error.code = "INCONSISTENT_NOTIFICATION_POLICY";
    error.statusCode = 500;
    throw error;
  }
  // Priority is static for every active rule. Producers supply context only.
  const severity = resolveNotificationSeverity(priorities[0]);

  const deliveryPlanBuckets = await Promise.all(
    (recipientGroups || []).map((group) =>
      buildRecipientDeliveryPlan({
        userIds: group.userIds,
        roleCode: group.roleCode,
        ruleCode: canonicalRuleCode,
      }),
    ),
  );

  const recipientPlans = Array.from(
    deliveryPlanBuckets
      .flat()
      .reduce((current, plan) => {
        if (!plan?.userId) {
          return current;
        }

        if (!current.has(plan.userId)) {
          current.set(plan.userId, plan);
          return current;
        }

        const existingPlan = current.get(plan.userId);
        current.set(plan.userId, {
          ...existingPlan,
          inAppEnabled: existingPlan.inAppEnabled || plan.inAppEnabled,
          emailEnabled: existingPlan.emailEnabled || plan.emailEnabled,
          email: existingPlan.email || plan.email,
        });
        return current;
      }, new Map())
      .values(),
  );

  const inAppRecipientIds = recipientPlans
    .filter((plan) => plan.inAppEnabled)
    .map((plan) => plan.userId);
  const emailRecipients = recipientPlans.filter(
    (plan) => plan.emailEnabled && plan.email,
  );

  if (inAppRecipientIds.length === 0 && emailRecipients.length === 0) {
    return null;
  }

  const dedupeRecipientIds =
    inAppRecipientIds.length > 0
      ? inAppRecipientIds
      : emailRecipients.map((plan) => plan.userId);
  const existingNotification =
    source_event_key
      ? await notificationRepository.findNotificationBySourceEventKey(
          source_event_key,
        )
      : dedupeRecipientIds.length > 0
      ? await notificationRepository.findRecentNotificationMatchForUsers(
          {
            type,
            title,
            message,
            severity,
            reference_type,
            reference_id,
          },
          dedupeRecipientIds,
          dedupeHours,
        )
      : null;

  if (existingNotification) {
    return existingNotification;
  }

  const createdNotification = await notificationRepository.insertNotification({
    disaster_event_id,
    rule_code: canonicalRuleCode,
    type,
    title,
    message,
    severity,
    reference_type,
    reference_id,
    source_event_key,
    metadata_json: safeMetadata,
  });

  if (!createdNotification) {
    return notificationRepository.findNotificationBySourceEventKey(
      source_event_key,
    );
  }

  if (inAppRecipientIds.length > 0) {
    await notificationRepository.insertNotificationRecipients(
      createdNotification.id,
      inAppRecipientIds,
    );
  }

  if (emailRecipients.length > 0) {
    await Promise.allSettled(
      emailRecipients.map((recipient) =>
        deliverTrackedNotificationEmail({
          notificationId: createdNotification.id,
          recipient,
          ruleCode: canonicalRuleCode,
          type,
          title,
          message,
          severity,
        }),
      ),
    );
  }

  return createdNotification;
};

const enqueueSummaryNotification = async ({
  ruleCode,
  recipientGroups = [],
  disaster_event_id = null,
  reference_type = null,
  reference_id = null,
  summaryMetadata = {},
}) => {
  const canonicalRuleCode = getCanonicalRuleCode(ruleCode);
  const now = new Date();

  await Promise.all(
    recipientGroups.map(async (group) => {
      const [policyRow] = await Promise.all([
        notificationRepository.getNotificationPolicyRow(
          canonicalRuleCode,
          group.roleCode,
        ),
      ]);

      if (!policyRow) {
        return;
      }

      const window = getWindowBounds(policyRow.delivery_mode, now);
      const summaryKey = buildSummaryKey({
        roleCode: group.roleCode,
        ruleCode,
        disasterEventId: disaster_event_id,
        barangayId: summaryMetadata.barangayId || "",
        windowStartedAt: window.windowStartedAt,
      });

      await notificationRepository.insertSummaryEvent({
        summaryKey,
        ruleCode: canonicalRuleCode,
        roleCode: group.roleCode,
        barangayId: summaryMetadata.barangayId || null,
        disasterEventId: disaster_event_id,
        referenceScope: {
          referenceType: reference_type,
          referenceId: reference_id,
          ...summaryMetadata,
        },
        aggregateEvents: true,
        payload: {
          eventId: [reference_type || "EVENT", reference_id || "unknown", summaryMetadata.action || ""].join(":"),
          referenceType: reference_type,
          referenceId: reference_id,
          ...summaryMetadata,
        },
        windowStartedAt: window.windowStartedAt.toISOString(),
        windowEndsAt: window.windowEndsAt.toISOString(),
        readyAt: window.readyAt.toISOString(),
      });
    }),
  );

  return null;
};

const createNotificationForRecipientGroups = async ({
  ruleCode = null,
  recipientGroups = [],
  disaster_event_id = null,
  type,
  title,
  message,
  severity = "INFO",
  reference_type = null,
  reference_id = null,
  source_event_key = null,
  dedupeHours = DEDUPE_LOOKBACK_HOURS,
  summaryMetadata = {},
  metadata = {},
  bypassSummaryQueue = false,
}) => {
  const canonicalRuleCode = getCanonicalRuleCode(ruleCode);
  if (!canonicalRuleCode || !getCanonicalRuleDefinition(canonicalRuleCode)) {
    const error = new Error("Notification rule is invalid.");
    error.code = "INVALID_NOTIFICATION_RULE";
    error.statusCode = 500;
    throw error;
  }
  const matchingRule = canonicalRuleCode
    ? await notificationRepository.getNotificationRuleByCode(canonicalRuleCode)
    : null;

  if (matchingRule && matchingRule.is_active === false) {
    return null;
  }

  const policyModes = await Promise.all(
    recipientGroups.map(async (group) => {
      const policyRow = await notificationRepository.getNotificationPolicyRow(
        canonicalRuleCode,
        group.roleCode,
      );
      return policyRow?.delivery_mode || DELIVERY_MODE.IMMEDIATE;
    }),
  );

  const hasSummaryMode = policyModes.some((mode) =>
    [DELIVERY_MODE.HOURLY_SUMMARY, DELIVERY_MODE.DAILY_SUMMARY].includes(mode),
  );

  if (hasSummaryMode && !bypassSummaryQueue) {
    return enqueueSummaryNotification({
      ruleCode: canonicalRuleCode,
      recipientGroups,
      disaster_event_id,
      reference_type,
      reference_id,
      summaryMetadata,
    });
  }

  return createPersistentNotification({
    ruleCode: canonicalRuleCode,
    recipientGroups,
    disaster_event_id,
    type,
    title,
    message,
    severity,
    reference_type,
    reference_id,
    source_event_key,
    dedupeHours,
    metadata: { ...summaryMetadata, ...metadata },
  });
};

const getEmailRetryAt = (attemptCount) => new Date(Date.now() + EMAIL_NOTIFICATION_RETRY_BASE_SECONDS * 1000 * Math.max(1, 2 ** Math.max(0, attemptCount - 1)));

const deliverTrackedNotificationEmail = async ({ notificationId, recipient, ruleCode, type, title, message, severity }) => {
  if (typeof emailService.isValidNotificationEmailAddress === "function" && !emailService.isValidNotificationEmailAddress(recipient.email)) {
    await notificationRepository.markNotificationEmailDeliveryFailedWithoutAttempt({ notificationId, recipientUserId: recipient.userId, roleCode: recipient.roleCode, reason: "EMAIL_RECIPIENT_INVALID" });
    return { skipped: true, reason: "invalid-recipient-email" };
  }
  if (typeof emailService.isNotificationEmailConfigured === "function" && !emailService.isNotificationEmailConfigured()) {
    await notificationRepository.markNotificationEmailDeliverySkipped({ notificationId, recipientUserId: recipient.userId, roleCode: recipient.roleCode, reason: "EMAIL_SERVICE_NOT_CONFIGURED" });
    return { skipped: true, reason: "email-service-not-configured" };
  }

  const delivery = await notificationRepository.claimNotificationEmailDelivery({
    notificationId, recipientUserId: recipient.userId, roleCode: recipient.roleCode,
    maxAttempts: EMAIL_NOTIFICATION_MAX_ATTEMPTS, staleAfterSeconds: EMAIL_DELIVERY_STALE_AFTER_SECONDS,
  });
  if (!delivery) return { skipped: true, reason: "delivery-already-claimed-or-terminal" };

  const result = await emailService.sendNotificationEmail({
    actor: { userId: recipient.userId, roleCode: recipient.roleCode }, recipientEmail: recipient.email,
    notificationType: ruleCode || type, notificationTitle: title, notificationMessage: message,
    severity, timestamp: new Date().toISOString(), idempotencyKey: `notification-email/${delivery.id}`,
  });
  if (result.success) {
    await notificationRepository.markNotificationEmailDeliveryResult({ deliveryId: delivery.id, status: "SENT", providerMessageId: result.messageId });
    return result;
  }

  const canRetry = result.failureClass === "TRANSIENT" && delivery.attempt_count < EMAIL_NOTIFICATION_MAX_ATTEMPTS;
  await notificationRepository.markNotificationEmailDeliveryResult({
    deliveryId: delivery.id, status: canRetry ? "RETRY_PENDING" : result.skipped ? "SKIPPED" : "FAILED",
    errorCode: String(result.reason || result.failureClass || "EMAIL_SEND_FAILED").slice(0, 100),
    errorMessage: typeof emailService.sanitizeProviderError === "function"
      ? emailService.sanitizeProviderError(result.error)
      : String(result.error || "Email provider request failed.").slice(0, 500),
    nextRetryAt: canRetry ? getEmailRetryAt(delivery.attempt_count) : null,
  });
  return result;
};

const retryNotificationEmailDeliveries = async () => {
  const candidates = await notificationRepository.getRetryableNotificationEmailDeliveries();
  await Promise.allSettled(candidates.map(async (candidate) => {
    const plans = await buildRecipientDeliveryPlan({ userIds: [candidate.recipient_user_id], roleCode: candidate.role_code, ruleCode: candidate.rule_code });
    const recipient = plans.find((plan) => plan.userId === candidate.recipient_user_id);
    if (!recipient?.emailEnabled || !recipient.email) {
      return notificationRepository.markNotificationEmailDeliverySkipped({ notificationId: candidate.notification_id, recipientUserId: candidate.recipient_user_id, roleCode: candidate.role_code, reason: "EMAIL_NO_LONGER_ELIGIBLE" });
    }
    return deliverTrackedNotificationEmail({ notificationId: candidate.notification_id, recipient, ruleCode: candidate.rule_code, type: candidate.type, title: candidate.title, message: candidate.message, severity: candidate.severity });
  }));
};

const createNotificationForUsers = async ({
  ruleCode,
  userIds,
  roleCode = null,
  disaster_event_id = null,
  type,
  title,
  message,
  severity = "INFO",
  reference_type = null,
  reference_id = null,
  source_event_key = null,
  dedupeHours = DEDUPE_LOOKBACK_HOURS,
  metadata = {},
}) =>
  createNotificationForRecipientGroups({
    ruleCode: getCanonicalRuleCode(ruleCode),
    recipientGroups: [{ userIds, roleCode }],
    disaster_event_id,
    type,
    title,
    message,
    severity,
    reference_type,
    reference_id,
    source_event_key,
    dedupeHours,
    metadata,
  });

const createNotificationForRole = async ({
  ruleCode,
  roleCode = ROLE_CODES.MAYOR,
  disaster_event_id = null,
  type,
  title,
  message,
  severity = "INFO",
  reference_type = null,
  reference_id = null,
  source_event_key = null,
  dedupeHours = DEDUPE_LOOKBACK_HOURS,
  summaryMetadata = {},
  metadata = {},
}) => {
  const canonicalRuleCode = getCanonicalRuleCode(ruleCode);
  const matchingRule = canonicalRuleCode
    ? await notificationRepository.getNotificationRuleByCode(canonicalRuleCode)
    : null;

  if (matchingRule && matchingRule.is_active === false) {
    return null;
  }

  const targetRoleCode = matchingRule?.target_role_code || roleCode;
  const resolvedRoleCodes = resolveNotificationRecipientRoles(
    canonicalRuleCode,
    targetRoleCode,
  );
  const recipientGroups = await resolveNotificationRecipientGroups({
    ruleCode: canonicalRuleCode,
    targetRoleCode,
    includeRoleCodes: resolvedRoleCodes,
    recipientResolversByRole: Object.fromEntries(
      resolvedRoleCodes.map((resolvedRoleCode) => [
        resolvedRoleCode,
        () =>
          notificationRepository.getRecipientUserIdsByRoleCode(resolvedRoleCode),
      ]),
    ),
  });

  return createNotificationForRecipientGroups({
    ruleCode,
    recipientGroups,
    disaster_event_id,
    type,
    title,
    message,
    severity,
    reference_type,
    reference_id,
    source_event_key,
    dedupeHours,
    summaryMetadata,
    metadata,
  });
};

const createNotificationForRoles = async ({
  ruleCode,
  roleCodes = [],
  disaster_event_id = null,
  type,
  title,
  message,
  severity = "INFO",
  reference_type = null,
  reference_id = null,
  dedupeHours = DEDUPE_LOOKBACK_HOURS,
  metadata = {},
}) => {
  const resolvedRoleCodes = [
    ...new Set([
      ...resolveNotificationRecipientRoles(getCanonicalRuleCode(ruleCode), null),
      ...(roleCodes || []).filter(Boolean),
    ]),
  ];

  const recipientGroups = await resolveNotificationRecipientGroups({
    ruleCode: getCanonicalRuleCode(ruleCode),
    includeRoleCodes: resolvedRoleCodes,
    recipientResolversByRole: Object.fromEntries(
      resolvedRoleCodes.map((roleCode) => [
        roleCode,
        () => notificationRepository.getRecipientUserIdsByRoleCode(roleCode),
      ]),
    ),
  });

  return createNotificationForRecipientGroups({
    ruleCode,
    recipientGroups,
    disaster_event_id,
    type,
    title,
    message,
    severity,
    reference_type,
    reference_id,
    dedupeHours,
    metadata,
  });
};

const emitSafely = async (handler) => {
  try {
    await handler();
  } catch (error) {
    console.error("Failed to emit notification:", error.message);
  }
};

const maybeNotifyThresholdState = async ({
  stateKey,
  ruleCode,
  roleCode,
  stateValue,
  shouldNotify,
  notificationPayload,
}) => {
  const existingState =
    await notificationRepository.getNotificationDeliveryState(stateKey);

  if (!shouldNotify) {
    await notificationRepository.upsertNotificationDeliveryState({
      stateKey,
      ruleCode,
      roleCode,
      stateValue,
      lastNotifiedAt: existingState?.last_notified_at || null,
    });
    return null;
  }

  if (existingState?.state_value === stateValue) {
    return null;
  }

  const createdNotification = await createNotificationForRole(notificationPayload);

  await notificationRepository.upsertNotificationDeliveryState({
    stateKey,
    ruleCode,
    roleCode,
    stateValue,
    lastNotifiedAt: createdNotification ? new Date().toISOString() : null,
  });

  await insertAuditLog({
    user_id: null,
    role_code: roleCode,
    device_id: null,
    action: "NOTIFICATION_THRESHOLD_GENERATED",
    entity_type: "NOTIFICATION_RULE",
    entity_id: notificationPayload.reference_id || null,
    old_values_json: {
      previousState: existingState?.state_value || null,
      ruleCode,
    },
    new_values_json: {
      nextState: stateValue,
      ruleCode,
    },
    ip_address: null,
  });

  return createdNotification;
};

const emitBatchAlerts = async ({
  batch,
  previousQuantityAvailable = null,
  previousStatus = null,
  disasterEventId = null,
}) => {
  if (!batch) {
    return;
  }

  const itemName =
    batch.inventory_item?.item_name ||
    batch.item_name ||
    batch.inventory_item_name ||
    "Inventory item";
  const batchNumber = batch.batch_no || "Unknown batch";
  const quantityAvailable = Number(batch.quantity_available || 0);
  const priorQuantity =
    previousQuantityAvailable === null || previousQuantityAvailable === undefined
      ? null
      : Number(previousQuantityAvailable);

  const lowStockStateKey = `INVENTORY_LOW_STOCK:${batch.id}`;
  const criticalStockStateKey = `INVENTORY_CRITICAL_STOCK:${batch.id}`;
  const expiryStateKey = `INVENTORY_EXPIRY:${batch.id}`;
  const reorderLevel =
    batch.inventory_item?.reorder_level ?? batch.reorder_level ?? 0;
  const isLowStock = isInventoryBatchLowStock({
    quantityAvailable,
    totalQuantityAvailable: batch.item_total_stock ?? quantityAvailable,
    reorderLevel,
  });
  const isCriticalStock =
    isLowStock && quantityAvailable > 0 && quantityAvailable <= CRITICAL_STOCK_THRESHOLD;
  const stockState =
    isCriticalStock
      ? "CRITICAL_STOCK"
      : isLowStock
        ? "LOW_STOCK"
        : "NORMAL";
  const expiryState =
    quantityAvailable > 0 &&
    (batch.status === "EXPIRED" || isExpiredDate(batch.expiration_date))
      ? "EXPIRED_STOCK"
      : quantityAvailable > 0 &&
          batch.expiration_date &&
          isInventoryBatchNearExpiry(
            batch.expiration_date,
            NEAR_EXPIRY_DAYS,
          )
        ? "NEAR_EXPIRY_STOCK"
        : "NORMAL";

  await maybeNotifyThresholdState({
    stateKey: expiryStateKey,
    ruleCode:
      expiryState === "EXPIRED_STOCK" ? "EXPIRED_STOCK" : "NEAR_EXPIRY_STOCK",
    roleCode: ROLE_CODES.MAYOR,
    stateValue: expiryState,
    shouldNotify: expiryState !== "NORMAL",
    notificationPayload:
      expiryState === "EXPIRED_STOCK"
        ? {
            ruleCode: "EXPIRED_STOCK",
            disaster_event_id: disasterEventId,
            type: NOTIFICATION_TYPES.EXPIRY,
            title: "Expired stock alert",
            message: `${itemName} (${batchNumber}) is now expired and needs immediate review.`,
            severity: "CRITICAL",
            reference_type: "INVENTORY_BATCH",
            reference_id: batch.id,
            metadata: { batchId: batch.id, itemId: batch.inventory_item_id, expiresAt: batch.expiration_date, remainingQuantity: quantityAvailable },
          }
        : {
            ruleCode: "NEAR_EXPIRY_STOCK",
            disaster_event_id: disasterEventId,
            type: NOTIFICATION_TYPES.EXPIRY,
            title: "Near-expiry stock alert",
            message: `${itemName} (${batchNumber}) is nearing expiry and should be reviewed soon.`,
            severity: "WARNING",
            reference_type: "INVENTORY_BATCH",
            reference_id: batch.id,
            metadata: { batchId: batch.id, itemId: batch.inventory_item_id, expiresAt: batch.expiration_date, remainingQuantity: quantityAvailable },
          },
  });

  await maybeNotifyThresholdState({
    stateKey: lowStockStateKey,
    ruleCode: "LOW_STOCK",
    roleCode: ROLE_CODES.MAYOR,
    // A critical shortage is still below the low-stock boundary. Keep this
    // state latched until restock so a critical-to-low recovery is not noisy.
    stateValue: stockState === "NORMAL" ? "NORMAL" : "BELOW_LOW",
    shouldNotify: stockState === "LOW_STOCK",
    notificationPayload: {
      ruleCode: "LOW_STOCK",
      disaster_event_id: disasterEventId,
      type: NOTIFICATION_TYPES.INVENTORY,
      title: "Low stock alert",
      message: `${itemName} (${batchNumber}) is down to ${toDisplayQuantity(quantityAvailable)} available units.`,
      reference_type: "INVENTORY_BATCH",
      reference_id: batch.id,
      metadata: { batchId: batch.id, itemId: batch.inventory_item_id, remainingQuantity: quantityAvailable },
    },
  });

  await maybeNotifyThresholdState({
    stateKey: criticalStockStateKey,
    ruleCode: "CRITICAL_INVENTORY_SHORTAGE",
    roleCode: ROLE_CODES.MAYOR,
    stateValue: stockState === "CRITICAL_STOCK" ? "CRITICAL_STOCK" : "NORMAL",
    shouldNotify: stockState === "CRITICAL_STOCK",
    notificationPayload: {
      ruleCode: "CRITICAL_INVENTORY_SHORTAGE",
      disaster_event_id: disasterEventId,
      type: NOTIFICATION_TYPES.INVENTORY,
      title: "Critical inventory shortage",
      message: `${itemName} (${batchNumber}) is down to ${toDisplayQuantity(quantityAvailable)} available units.`,
      severity: "CRITICAL",
      reference_type: "INVENTORY_BATCH",
      reference_id: batch.id,
      metadata: { batchId: batch.id, itemId: batch.inventory_item_id, remainingQuantity: quantityAvailable },
    },
  });

  if (
    priorQuantity !== null &&
    previousStatus === batch.status &&
    quantityAvailable === priorQuantity
  ) {
    return;
  }
};

const emitInventoryTransactionAlerts = async ({
  transaction,
  batch,
  previousQuantityAvailable,
  previousStatus,
  disasterEventId = null,
}) => {
  if (!transaction || !batch) {
    return;
  }

  const itemName =
    batch.inventory_item?.item_name ||
    batch.item_name ||
    batch.inventory_item_name ||
    "Inventory item";
  const batchNumber = batch.batch_no || "Unknown batch";

  if (
    ["DAMAGED", "MISSING", "SPOILED", "STOLEN", "OTHER"].includes(
      transaction.transaction_type,
    )
  ) {
    const alertLabel =
      transaction.transaction_type === "OTHER" &&
      String(transaction.other_status || "").trim()
        ? `other (${String(transaction.other_status).trim()})`
        : transaction.transaction_type.toLowerCase();
    const severity =
      transaction.transaction_type === "MISSING" ||
      transaction.transaction_type === "STOLEN"
        ? "CRITICAL"
        : "WARNING";

    await createNotificationForRole({
      ruleCode: "INVENTORY_INCIDENT",
      disaster_event_id: disasterEventId,
      type: NOTIFICATION_TYPES.ANOMALY,
      title: "Inventory incident alert",
      message: `${toDisplayQuantity(transaction.quantity)} units of ${itemName} (${batchNumber}) were marked as ${alertLabel}.${transaction.remarks ? ` ${transaction.remarks}` : ""}`,
      severity,
      reference_type: "INVENTORY_TRANSACTION",
      reference_id: transaction.id,
      source_event_key: `INVENTORY_INCIDENT:${transaction.id}`,
      metadata: {
        inventoryTransactionId: transaction.id,
        batchId: batch.id,
        itemId: batch.inventory_item_id,
        quantity: Number(transaction.quantity || 0),
        transactionType: transaction.transaction_type,
        otherStatus: transaction.other_status || null,
      },
    });
  }

  await emitBatchAlerts({
    batch,
    previousQuantityAvailable,
    previousStatus,
    disasterEventId,
  });
};

const emitDonationStockUpdate = async ({
  donorName,
  itemName,
  quantity,
  disasterEventId = null,
  referenceId = null,
  actionLabel = "updated",
  severity = "INFO",
  anomaly = false,
}) =>
  createNotificationForRole({
    ruleCode: anomaly ? "DONATION_STOCK_ANOMALY" : "DONATION_RECEIVED",
    disaster_event_id: disasterEventId,
    type: anomaly ? NOTIFICATION_TYPES.ANOMALY : NOTIFICATION_TYPES.INVENTORY,
    title: anomaly ? "Donation anomaly detected" : "Donation received",
    message: `${donorName} donation stock for ${itemName} was ${actionLabel} by ${toDisplayQuantity(quantity)} units.`,
    severity,
    reference_type: "DONATION_ITEM",
    reference_id: referenceId,
    metadata: { donationItemId: referenceId, quantity: Number(quantity || 0) },
  });

const emitDonationSummaryUpdate = async ({
  donorName,
  itemCount,
  disasterEventId = null,
  referenceId = null,
}) =>
  createNotificationForRole({
    ruleCode: "DONATION_RECEIVED",
    disaster_event_id: disasterEventId,
    type: NOTIFICATION_TYPES.INVENTORY,
    title: "Donation received",
    message: `A donation from ${donorName} was received with ${toDisplayQuantity(itemCount)} item entries.`,
    severity: "INFO",
    reference_type: "DONATION",
    reference_id: referenceId,
    metadata: { donationId: referenceId, itemCount: Number(itemCount || 0) },
  });

const emitDisasterEventCreated = async ({ disasterEvent }) => {
  if (!disasterEvent) {
    return;
  }

  await createNotificationForRole({
    ruleCode: "DISASTER_EVENT_CREATED",
    roleCode: ROLE_CODES.MSWDO,
    disaster_event_id: disasterEvent.id,
    type: NOTIFICATION_TYPES.EVENT,
    title: "New disaster event created",
    message: `${`${disasterEvent.event_code || ""} ${disasterEvent.title || "Disaster event"}`.trim()} was created and is ready for MSWDO coordination.`,
    severity: "WARNING",
    reference_type: "DISASTER_EVENT",
    reference_id: disasterEvent.id,
    metadata: { disasterEventId: disasterEvent.id, action: "created" },
  });
};

const emitDisasterEventUpdate = async ({
  disasterEvent,
  action,
  affectedBarangays = [],
}) => {
  if (!disasterEvent) {
    return;
  }

  const normalizedAction = String(action || "updated").toLowerCase();
  const actionLabel =
    normalizedAction === "created"
      ? "created"
      : normalizedAction === "extended"
        ? "extended"
        : normalizedAction === "ended"
          ? "ended"
          : "updated";
  const eventLabel = `${disasterEvent.event_code || ""} ${disasterEvent.title || "Disaster event"}`.trim();
  const barangayLabel =
    Array.isArray(affectedBarangays) && affectedBarangays.length > 0
      ? affectedBarangays.map((barangay) => barangay.name).join(", ")
      : "All affected barangays";
  const affectedBarangayIds = Array.isArray(affectedBarangays)
    ? affectedBarangays.map((barangay) => barangay.id).filter(Boolean)
    : [];
  const recipientGroups = await resolveNotificationRecipientGroups({
    ruleCode: "DISASTER_EVENT_UPDATED",
    targetRoleCode: ROLE_CODES.MSWDO,
    includeRoleCodes: resolveNotificationRecipientRoles(
      "DISASTER_EVENT_UPDATED",
      ROLE_CODES.MSWDO,
    ),
    recipientResolversByRole: {
      [ROLE_CODES.MSWDO]: () =>
        notificationRepository.getRecipientUserIdsByRoleCode(ROLE_CODES.MSWDO),
      [ROLE_CODES.BARANGAY]: () =>
        notificationRepository.getRecipientUserIdsByRoleCodeAndBarangayIds(
          ROLE_CODES.BARANGAY,
          affectedBarangayIds,
        ),
      [ROLE_CODES.MAYOR]: () =>
        notificationRepository.getRecipientUserIdsByRoleCode(ROLE_CODES.MAYOR),
    },
  });

  await createNotificationForRecipientGroups({
    ruleCode: "DISASTER_EVENT_UPDATED",
    recipientGroups,
    disaster_event_id: disasterEvent.id,
    type: NOTIFICATION_TYPES.EVENT,
    title: "Disaster event update",
    message: `${eventLabel} was ${actionLabel}. Affected coverage: ${barangayLabel}.`,
    severity: normalizedAction === "ended" ? "INFO" : "WARNING",
    reference_type: "DISASTER_EVENT",
    reference_id: disasterEvent.id,
    metadata: { disasterEventId: disasterEvent.id, action: actionLabel, barangayIds: affectedBarangayIds },
  });
};

const emitDistributionUpdate = async ({
  disasterEventId = null,
  barangayId = null,
  stubNo,
  familyHeadName,
  distributionTransactionId,
}) => {
  const recipientGroups = await resolveNotificationRecipientGroups({
    ruleCode: "DISTRIBUTION_COMPLETED",
    targetRoleCode: ROLE_CODES.MSWDO,
    includeRoleCodes: resolveNotificationRecipientRoles(
      "DISTRIBUTION_COMPLETED",
      ROLE_CODES.MSWDO,
    ),
    recipientResolversByRole: {
      [ROLE_CODES.MSWDO]: () =>
        notificationRepository.getRecipientUserIdsByRoleCode(ROLE_CODES.MSWDO),
      [ROLE_CODES.MAYOR]: () =>
        notificationRepository.getRecipientUserIdsByRoleCode(ROLE_CODES.MAYOR),
    },
  });

  await createNotificationForRecipientGroups({
    ruleCode: "DISTRIBUTION_COMPLETED",
    recipientGroups,
    disaster_event_id: disasterEventId,
    type: NOTIFICATION_TYPES.EVENT,
    title: "Distribution completed",
    message: `Stub ${stubNo || "--"} for ${familyHeadName || "a household"} was successfully validated for relief distribution.`,
    severity: "INFO",
    reference_type: "DISTRIBUTION_TRANSACTION",
    reference_id: distributionTransactionId,
    summaryMetadata: {
      barangayId,
      stubNo,
    },
    metadata: { distributionTransactionId, barangayId, stubNo },
  });
};

const emitHouseholdRegistrationUpdate = async ({
  householdId,
  barangayId,
  familyHeadName,
  action = "registered",
  requiresVerification = false,
}) => {
  const recipientGroups = await resolveNotificationRecipientGroups({
    ruleCode: "HOUSEHOLD_REGISTERED",
    targetRoleCode: ROLE_CODES.BARANGAY,
    includeRoleCodes: resolveNotificationRecipientRoles(
      "HOUSEHOLD_REGISTERED",
      ROLE_CODES.BARANGAY,
    ),
    recipientResolversByRole: {
      [ROLE_CODES.BARANGAY]: () =>
        notificationRepository.getRecipientUserIdsByRoleCodeAndBarangayIds(
          ROLE_CODES.BARANGAY,
          barangayId ? [barangayId] : [],
        ),
      [ROLE_CODES.MSWDO]: () =>
        notificationRepository.getRecipientUserIdsByRoleCode(ROLE_CODES.MSWDO),
    },
  });

  const normalizedAction = String(action || "registered").toLowerCase();
  const actionLabel =
    normalizedAction === "updated" ? "updated" : "registered";

  await createNotificationForRecipientGroups({
    ruleCode: "HOUSEHOLD_REGISTERED",
    recipientGroups,
    type: NOTIFICATION_TYPES.SYSTEM,
    title: "Household registration update",
    message: `${familyHeadName || "A household"} was ${actionLabel} in the barangay masterlist.`,
    severity: "INFO",
    reference_type: "HOUSEHOLD",
    reference_id: householdId,
    summaryMetadata: {
      barangayId,
      action: actionLabel,
    },
    metadata: { householdId, barangayId, action: actionLabel },
  });

  if (requiresVerification) {
    const verificationRecipientGroups = await resolveNotificationRecipientGroups({
      ruleCode: "HOUSEHOLD_VERIFICATION_UPDATED",
      targetRoleCode: ROLE_CODES.BARANGAY,
      includeRoleCodes: resolveNotificationRecipientRoles(
        "HOUSEHOLD_VERIFICATION_UPDATED",
        ROLE_CODES.BARANGAY,
      ),
      recipientResolversByRole: {
        [ROLE_CODES.BARANGAY]: () =>
          notificationRepository.getRecipientUserIdsByRoleCodeAndBarangayIds(
            ROLE_CODES.BARANGAY,
            barangayId ? [barangayId] : [],
          ),
        [ROLE_CODES.MSWDO]: () =>
          notificationRepository.getRecipientUserIdsByRoleCode(ROLE_CODES.MSWDO),
      },
    });

    await createNotificationForRecipientGroups({
      ruleCode: "HOUSEHOLD_VERIFICATION_UPDATED",
      recipientGroups: verificationRecipientGroups,
      type: NOTIFICATION_TYPES.SYSTEM,
      title: "Household pending verification",
      message: `${familyHeadName || "A household"} is pending household verification follow-up.`,
      severity: "WARNING",
      reference_type: "HOUSEHOLD",
      reference_id: householdId,
      metadata: { householdId, barangayId },
    });
  }

  return true;
};

const emitEvacueeAttendanceUpdate = async ({
  householdId,
  barangayId,
  familyHeadName,
  action = "updated",
}) => {
  const recipientGroups = await resolveNotificationRecipientGroups({
    ruleCode: "EVACUEE_ATTENDANCE_UPDATED",
    targetRoleCode: ROLE_CODES.BARANGAY,
    includeRoleCodes: resolveNotificationRecipientRoles(
      "EVACUEE_ATTENDANCE_UPDATED",
      ROLE_CODES.BARANGAY,
    ),
    recipientResolversByRole: {
      [ROLE_CODES.BARANGAY]: () =>
        notificationRepository.getRecipientUserIdsByRoleCodeAndBarangayIds(
          ROLE_CODES.BARANGAY,
          barangayId ? [barangayId] : [],
        ),
      [ROLE_CODES.MSWDO]: () =>
        notificationRepository.getRecipientUserIdsByRoleCode(ROLE_CODES.MSWDO),
    },
  });

  const normalizedAction = String(action || "updated").toLowerCase();
  let actionLabel = "updated";

  if (normalizedAction === "arrival-recorded") {
    actionLabel = "arrival was recorded";
  } else if (normalizedAction === "departure-recorded") {
    actionLabel = "departure was recorded";
  } else if (normalizedAction === "status-updated") {
    actionLabel = "attendance status was updated";
  }

  return createNotificationForRecipientGroups({
    ruleCode: "EVACUEE_ATTENDANCE_UPDATED",
    recipientGroups,
    type: NOTIFICATION_TYPES.EVENT,
    title: "Evacuee attendance update",
    message: `${familyHeadName || "A household"} ${actionLabel}.`,
    severity: "INFO",
    reference_type: "HOUSEHOLD",
    reference_id: householdId,
    summaryMetadata: {
      barangayId,
      action: normalizedAction,
    },
    metadata: { householdId, barangayId, attendanceAction: normalizedAction },
  });
};

const emitSyncTransactionFailureAlert = async (syncTransaction) => {
  if (!syncTransaction?.id) {
    return null;
  }

  if (syncTransaction.sync_status && syncTransaction.sync_status !== "FAILED") {
    return null;
  }

  const recipientRoleCodes =
    await resolveSyncFailureRecipientRoleCodes(syncTransaction);

  const recipientGroups = await resolveNotificationRecipientGroups({
    ruleCode: "SYNC_FAILURE",
    targetRoleCode: ROLE_CODES.BARANGAY,
    includeRoleCodes: recipientRoleCodes,
    recipientResolversByRole: Object.fromEntries(
      recipientRoleCodes.map((roleCode) => [
        roleCode,
        () => notificationRepository.getRecipientUserIdsByRoleCode(roleCode),
      ]),
    ),
  });

  return createNotificationForRecipientGroups({
    ruleCode: "SYNC_FAILURE",
    recipientGroups,
    type: NOTIFICATION_TYPES.SYNC,
    title: "Sync failure detected",
    message: `${syncTransaction.operation_type} for ${syncTransaction.entity_type} could not be synchronized. Review the Sync Center for details and retry when ready.`,
    severity: "WARNING",
    reference_type: "SYNC_TRANSACTION",
    reference_id: syncTransaction.id,
    source_event_key: `SYNC_FAILURE:${syncTransaction.id}`,
    metadata: { syncTransactionId: syncTransaction.id, operationType: syncTransaction.operation_type, entityType: syncTransaction.entity_type },
  });
};

const emitSyncConflictAlert = async (syncConflict) => {
  if (!syncConflict?.user_id) {
    return null;
  }

  const recipientRoleCode =
    await resolveSyncConflictRecipientRoleCode(syncConflict);

  if (!recipientRoleCode) {
    return null;
  }

  const recipientUserIds =
    recipientRoleCode === ROLE_CODES.MAYOR &&
    isManualInventoryStockDriftReviewable(syncConflict)
      ? await notificationRepository.getRecipientUserIdsByRoleCode(
          ROLE_CODES.MAYOR,
        )
      : [syncConflict.user_id];

  return createNotificationForUsers({
    ruleCode: "SYNC_CONFLICT",
    userIds: recipientUserIds,
    roleCode: recipientRoleCode,
    type: NOTIFICATION_TYPES.SYNC,
    title: "Synchronization conflict detected",
    message: `${syncConflict.entity_type} still needs sync conflict review. Open the Sync Center to resolve it safely.`,
    severity: "CRITICAL",
    reference_type: "SYNC_CONFLICT",
    reference_id: syncConflict.id,
    source_event_key: `SYNC_CONFLICT:${syncConflict.id}`,
    metadata: { conflictId: syncConflict.id, entityType: syncConflict.entity_type },
  });
};

const emitSyncConflictResolutionAlert = async (syncConflict) => {
  if (!syncConflict?.user_id || syncConflict.status !== "RESOLVED") {
    return null;
  }

  const recipientRoleCode =
    await resolveSyncConflictRecipientRoleCode(syncConflict);

  if (!recipientRoleCode) {
    return null;
  }

  const actionLabel =
    syncConflict.resolution_action === "APPLY_LOCAL"
      ? "Local change applied"
      : syncConflict.resolution_action === "KEEP_SERVER"
        ? "Server record kept"
        : "Conflict reviewed";

  return createNotificationForUsers({
    ruleCode: "SYNC_CONFLICT",
    userIds: [syncConflict.user_id],
    roleCode: recipientRoleCode,
    type: NOTIFICATION_TYPES.SYNC,
    title: "Synchronization conflict resolved",
    message: `${actionLabel} for ${syncConflict.entity_type}. Open the Sync Center to review the resolution record.`,
    severity: "INFO",
    reference_type: "SYNC_CONFLICT",
    reference_id: syncConflict.id,
    source_event_key: `SYNC_CONFLICT_RESOLVED:${syncConflict.id}`,
    metadata: { conflictId: syncConflict.id, entityType: syncConflict.entity_type },
  });
};

const ensureSyncNotificationIntent = async (
  { eventType, sourceType, sourceId },
  dbClient = undefined,
) => {
  if (!eventType || !sourceType || !sourceId) {
    return null;
  }

  return notificationRepository.ensureNotificationOutboxEvent(
    { eventType, sourceType, sourceId },
    dbClient,
  );
};

const materializeNotificationOutboxEvent = async (event) => {
  if (!event?.id) {
    return null;
  }

  if (
    event.event_type === "SYNC_FAILURE" &&
    event.source_type === "SYNC_TRANSACTION"
  ) {
    const syncTransaction =
      await notificationRepository.getSyncTransactionNotificationSourceById(
        event.source_id,
      );
    return emitSyncTransactionFailureAlert(syncTransaction);
  }

  if (
    event.event_type === "SYNC_CONFLICT" &&
    event.source_type === "SYNC_CONFLICT"
  ) {
    const syncConflict =
      await notificationRepository.getSyncConflictNotificationSourceById(
        event.source_id,
      );
    return emitSyncConflictAlert(syncConflict);
  }

  if (
    event.event_type === "SYNC_CONFLICT_RESOLVED" &&
    event.source_type === "SYNC_CONFLICT"
  ) {
    const syncConflict =
      await notificationRepository.getSyncConflictNotificationSourceById(
        event.source_id,
      );
    return emitSyncConflictResolutionAlert(syncConflict);
  }

  return null;
};

const processNotificationOutboxEventById = async (id) => {
  const claimedEvent =
    await notificationRepository.claimNotificationOutboxEventById(id);

  if (!claimedEvent) {
    return null;
  }

  try {
    const notification = await materializeNotificationOutboxEvent(claimedEvent);
    await notificationRepository.markNotificationOutboxEventProcessed(
      claimedEvent.id,
    );
    return notification;
  } catch (error) {
    await notificationRepository.markNotificationOutboxEventFailed({
      id: claimedEvent.id,
      errorMessage: error.message,
    });
    throw error;
  }
};

const processPendingNotificationOutboxEvents = async (
  limit = NOTIFICATION_OUTBOX_BATCH_SIZE,
) => {
  const claimedEvents =
    await notificationRepository.claimPendingNotificationOutboxEvents(limit);
  const results = [];

  for (const event of claimedEvents) {
    try {
      const notification = await materializeNotificationOutboxEvent(event);
      await notificationRepository.markNotificationOutboxEventProcessed(event.id);
      results.push({ eventId: event.id, status: "PROCESSED", notification });
    } catch (error) {
      await notificationRepository.markNotificationOutboxEventFailed({
        id: event.id,
        errorMessage: error.message,
      });
      results.push({ eventId: event.id, status: "FAILED", error });
    }
  }

  return results;
};

const seedNotificationRules = async () => {
  let insertedRuleCount = 0;
  let updatedRuleCount = 0;
  let insertedPolicyCount = 0;
  let updatedPolicyCount = 0;

  for (const rule of NOTIFICATION_RULE_TARGETS) {
    const result = await notificationRepository.upsertNotificationRule({
      code: rule.code,
      name: rule.name,
      trigger_type: rule.triggerType,
      target_role_code: rule.targetRoleCode,
      is_active: rule.isActive,
    });

    if (result?.inserted) {
      insertedRuleCount += 1;
    } else if (result) {
      updatedRuleCount += 1;
    }
  }

  for (const policyRow of NOTIFICATION_POLICY_ROWS) {
    const result =
      await notificationRepository.upsertNotificationRuleRolePolicy(policyRow);

    if (result?.inserted) {
      insertedPolicyCount += 1;
    } else if (result) {
      updatedPolicyCount += 1;
    }
  }

  return {
    insertedRuleCount,
    updatedRuleCount,
    insertedPolicyCount,
    updatedPolicyCount,
    expectedRuleCount: NOTIFICATION_RULE_TARGETS.length,
    expectedPolicyCount: NOTIFICATION_POLICY_ROWS.length,
  };
};

const buildSummaryNotificationContent = (summaryGroup) => {
  const count = getSummaryEventCount(summaryGroup);
  const roleLabel = summaryGroup.roleCode;

  switch (summaryGroup.ruleCode) {
    case "HOUSEHOLD_REGISTERED":
      return {
        title: "New evacuee registration summary",
        message: `${count} new evacuee registration updates were recorded for ${roleLabel} during the last hour.`,
      };
    case "EVACUEE_ATTENDANCE_UPDATED":
      return {
        title: "Evacuee attendance summary",
        message: `${count} evacuee attendance updates were recorded for ${roleLabel} during the last hour.`,
      };
    case "DISTRIBUTION_COMPLETED":
      return {
        title: "Distribution completed summary",
        message: `${count} completed relief distribution transactions were recorded for ${roleLabel} during the last hour.`,
      };
    case "DONATION_RECEIVED":
      return {
        title: "Donation received summary",
        message: `${count} donation receipts were recorded for ${roleLabel} during the last day.`,
      };
    case "EVACUATION_SUMMARY_REPORT":
      return buildEvacuationSummaryContent(
        getEvacuationSummaryPayload(summaryGroup) || {
          disasterEvent: {
            title: roleLabel,
          },
          totals: {
            newHouseholds: count,
            newEvacuees: count,
            cumulativeHouseholds: count,
            cumulativeEvacuees: count,
            presentEvacuees: 0,
            departedEvacuees: 0,
          },
          barangays: [],
          window: {
            start: new Date().toISOString(),
            end: new Date().toISOString(),
            timezone: MANILA_TIME_ZONE,
          },
        },
      );
    default:
      return {
        title: `${summaryGroup.ruleCode} summary`,
        message: `${count} ${summaryGroup.ruleCode} events were grouped into this summary.`,
      };
  }
};

const getSummaryPayloadEvents = (summaryGroup) =>
  (summaryGroup.events || []).flatMap((eventRow) => {
    const payload = eventRow?.payload_json;
    if (Array.isArray(payload?.events)) return payload.events;
    return payload && typeof payload === "object" ? [payload] : [];
  });

const buildSummaryNotificationMetadata = (summaryGroup) => {
  const firstEvent = summaryGroup.events?.[0] || {};
  const summary = {
    windowStart: firstEvent.window_started_at || null,
    windowEnd: firstEvent.window_ends_at || null,
    eventCount: getSummaryEventCount(summaryGroup),
  };

  if (summaryGroup.ruleCode === "EVACUATION_SUMMARY_REPORT") {
    const payload = getEvacuationSummaryPayload(summaryGroup) || {};
    const totals = payload.totals || {};
    summary.newHouseholds = toSafeInteger(totals.newHouseholds);
    summary.newEvacuees = toSafeInteger(totals.newEvacuees);
    summary.presentCount = toSafeInteger(totals.presentEvacuees);
    summary.departedCount = toSafeInteger(totals.departedEvacuees);
    summary.breakdown = (Array.isArray(payload.barangays) ? payload.barangays : [])
      .slice(0, MAX_SUMMARY_BREAKDOWN_ROWS)
      .map((row) => ({
        barangayId: row.barangayId || row.barangay_id,
        householdCount: toSafeInteger(row.newHouseholds),
        evacueeCount: toSafeInteger(row.newEvacuees),
      }))
      .filter((row) => row.barangayId);
  } else {
    const counts = new Map();
    getSummaryPayloadEvents(summaryGroup).forEach((payload) => {
      const key = `${payload.barangayId || ""}:${payload.action || ""}`;
      const current = counts.get(key) || {
        barangayId: payload.barangayId || undefined,
        action: payload.action || undefined,
        count: 0,
      };
      current.count += 1;
      counts.set(key, current);
    });
    const breakdown = [...counts.values()].slice(0, MAX_SUMMARY_BREAKDOWN_ROWS);
    if (breakdown.length) summary.breakdown = breakdown;
  }

  return { summary };
};

const generateDueEvacuationSummaryReports = async (now = new Date()) => {
  const { windowStartedAt, windowEndsAt, timezone } =
    getPreviousCompletedManilaHourWindow(now);
  const activeDisasterEvents =
    await disasterEventRepository.listActiveDisasterEventsForEvacuationSummary();
  const generatedSummaryKeys = [];

  for (const disasterEvent of activeDisasterEvents) {
    const summary = await disasterEventRepository.getEvacuationSummaryForWindow({
      disasterEventId: disasterEvent.id,
      windowStart: windowStartedAt.toISOString(),
      windowEnd: windowEndsAt.toISOString(),
    });

    if (!summary || !hasMeaningfulEvacuationSummaryActivity(summary)) {
      continue;
    }

    const summaryKey = buildSummaryKey({
      roleCode: ROLE_CODES.MAYOR,
      ruleCode: "EVACUATION_SUMMARY_REPORT",
      disasterEventId: disasterEvent.id,
      windowStartedAt,
    });
    const insertedSummaryEvent = await notificationRepository.insertSummaryEvent({
      summaryKey,
      ruleCode: "EVACUATION_SUMMARY_REPORT",
      roleCode: ROLE_CODES.MAYOR,
      barangayId: null,
      disasterEventId: disasterEvent.id,
      referenceScope: {
        timezone,
      },
      payload: {
        ruleCode: "EVACUATION_SUMMARY_REPORT",
        disasterEvent: summary.disasterEvent,
        window: {
          ...summary.window,
          timezone,
        },
        totals: summary.totals,
        attendanceActivity: summary.attendanceActivity,
        barangays: summary.barangays,
      },
      windowStartedAt: windowStartedAt.toISOString(),
      windowEndsAt: windowEndsAt.toISOString(),
      readyAt: windowEndsAt.toISOString(),
    });

    if (insertedSummaryEvent) {
      generatedSummaryKeys.push(summaryKey);
    }
  }

  return generatedSummaryKeys;
};

const flushSummaryNotifications = async () => {
  const dueEvents = await notificationRepository.getDueSummaryEvents();

  if (dueEvents.length === 0) {
    return;
  }

  const groups = dueEvents.reduce((current, eventRow) => {
    if (!current.has(eventRow.summary_key)) {
      current.set(eventRow.summary_key, {
        summaryKey: eventRow.summary_key,
        ruleCode: eventRow.rule_code,
        roleCode: eventRow.role_code,
        disasterEventId: eventRow.disaster_event_id,
        barangayId: eventRow.barangay_id,
        events: [],
      });
    }

    current.get(eventRow.summary_key).events.push(eventRow);
    return current;
  }, new Map());

  for (const group of groups.values()) {
    const content = buildSummaryNotificationContent(group);
    const recipientGroups = await resolveNotificationRecipientGroups({
      ruleCode: group.ruleCode,
      includeRoleCodes: [group.roleCode],
      recipientResolversByRole: {
        [ROLE_CODES.BARANGAY]: () =>
          notificationRepository.getRecipientUserIdsByRoleCodeAndBarangayIds(
            ROLE_CODES.BARANGAY,
            group.barangayId ? [group.barangayId] : [],
          ),
        [ROLE_CODES.MSWDO]: () =>
          notificationRepository.getRecipientUserIdsByRoleCode(ROLE_CODES.MSWDO),
        [ROLE_CODES.MAYOR]: () =>
          notificationRepository.getRecipientUserIdsByRoleCode(ROLE_CODES.MAYOR),
      },
    });

    await createNotificationForRecipientGroups({
      ruleCode: group.ruleCode,
      recipientGroups,
      disaster_event_id: group.disasterEventId,
      type: NOTIFICATION_TYPES.SUMMARY,
      title: content.title,
      message: content.message,
      severity: "INFO",
      reference_type: "NOTIFICATION_SUMMARY",
      reference_id: null,
      metadata: buildSummaryNotificationMetadata(group),
      bypassSummaryQueue: true,
    });

    await notificationRepository.markSummaryEventsProcessed(
      group.events.map((eventRow) => eventRow.id),
    );

    await insertAuditLog({
      user_id: null,
      role_code: group.roleCode,
      device_id: null,
      action: "NOTIFICATION_SUMMARY_GENERATED",
      entity_type: "NOTIFICATION_RULE",
      entity_id: null,
      old_values_json: {},
      new_values_json: {
        ruleCode: group.ruleCode,
        eventCount: getSummaryEventCount(group),
        summaryKey: group.summaryKey,
      },
      ip_address: null,
    });
  }
};

const scanExpiryNotifications = async () => {
  const candidateBatches =
    await notificationRepository.getBatchesForExpiryNotificationScan(
      NEAR_EXPIRY_DAYS,
    );

  for (const batch of candidateBatches) {
    await emitBatchAlerts({
      batch: {
        ...batch,
        status: isExpiredDate(batch.expiration_date) ? "EXPIRED" : batch.status,
      },
      previousStatus: null,
      previousQuantityAvailable: batch.quantity_available,
      disasterEventId: null,
    });
  }
};

const scanSyncNotifications = async () => {
  const [failedSyncTransactions, openSyncConflicts] = await Promise.all([
    notificationRepository.getFailedSyncTransactionsForNotificationScan(),
    notificationRepository.getOpenSyncConflictsForNotificationScan(),
  ]);

  for (const syncTransaction of failedSyncTransactions) {
    const event = await ensureSyncNotificationIntent({
      eventType: "SYNC_FAILURE",
      sourceType: "SYNC_TRANSACTION",
      sourceId: syncTransaction.id,
    });
    if (event?.id) {
      await processNotificationOutboxEventById(event.id);
    }
  }

  for (const syncConflict of openSyncConflicts) {
    const event = await ensureSyncNotificationIntent({
      eventType: "SYNC_CONFLICT",
      sourceType: "SYNC_CONFLICT",
      sourceId: syncConflict.id,
    });
    if (event?.id) {
      await processNotificationOutboxEventById(event.id);
    }
  }
};

const runNotificationMaintenanceScans = async () => {
  await seedNotificationRules();
  await generateDueEvacuationSummaryReports();
  await scanExpiryNotifications();
  await processPendingNotificationOutboxEvents();
  await scanSyncNotifications();
  await flushSummaryNotifications();
  await retryNotificationEmailDeliveries();
};

const startNotificationMaintenance = () => {
  if (notificationMaintenanceInterval) {
    return;
  }

  notificationMaintenanceInterval = setInterval(() => {
    emitSafely(runNotificationMaintenanceScans);
  }, MAINTENANCE_SCAN_INTERVAL_MS);
};

const initializeNotificationInfrastructure = async () => {
  const seedResult = await seedNotificationRules();

  console.log(
    `Notification policy verification complete: rules inserted=${seedResult.insertedRuleCount}, rules updated=${seedResult.updatedRuleCount}, policies inserted=${seedResult.insertedPolicyCount}, policies updated=${seedResult.updatedPolicyCount}, expected rules=${seedResult.expectedRuleCount}, expected policies=${seedResult.expectedPolicyCount}.`,
  );

  await generateDueEvacuationSummaryReports();
  await scanExpiryNotifications();
  await processPendingNotificationOutboxEvents();
  await scanSyncNotifications();
  await flushSummaryNotifications();
  await retryNotificationEmailDeliveries();
  startNotificationMaintenance();
};

const encodeNotificationCursor = (notification) =>
  Buffer.from(
    JSON.stringify({ generatedAt: notification.generated_at, id: notification.id }),
  ).toString("base64url");

const getNotificationsForUser = async (userId, filters) => {
  const policyRows = await notificationRepository.getNotificationPolicyRowsByRoleCode(
    filters.roleCode,
  );
  const availableCategories = new Set(
    policyRows.map((row) => row.category_code).filter(Boolean),
  );

  if (filters.category !== "ALL" && !availableCategories.has(filters.category)) {
    const error = new Error("Invalid notification category");
    error.statusCode = 400;
    throw error;
  }

  const notifications = await notificationRepository.getNotificationsForUser(userId, filters);
  const hasMore = notifications.length > filters.limit;
  const pageItems = hasMore ? notifications.slice(0, filters.limit) : notifications;

  return {
    items: pageItems.map((notification) => {
    const metadata =
      notification.metadata_json &&
      typeof notification.metadata_json === "object" &&
      !Array.isArray(notification.metadata_json)
        ? notification.metadata_json
        : {};
    return {
      ...notification,
      severity: notification.policy_priority || notification.severity,
      ruleCode: notification.rule_code || null,
      metadata,
    };
    }),
    nextCursor: hasMore
      ? encodeNotificationCursor(pageItems[pageItems.length - 1])
      : null,
    filterOptions: {
      categories: [...availableCategories],
    },
  };
};

const getUnreadCountForUser = async (userId) =>
  notificationRepository.countUnreadNotificationsForUser(userId);

const getNotificationPreferenceCatalogForRole = async ({
  roleCode,
  preferenceRow = null,
  storedPreferences = null,
  dbClient = undefined,
  enforceAvailability = true,
}) => {
  const policyRows =
    await notificationRepository.getNotificationPolicyRowsByRoleCode(
      roleCode,
      dbClient,
    );
  const canonicalPolicyRows = mergeCanonicalPolicyRows({
    roleCode,
    policyRows,
  });

  if (
    enforceAvailability &&
    getSettingsVisibleRuleCodesForRole(roleCode).length > 0 &&
    canonicalPolicyRows.length === 0
  ) {
    throw createNotificationPolicyConfigurationError(roleCode);
  }

  const resolvedPreferenceState = resolveEffectiveNotificationPreferences({
    roleCode,
    policyRows,
    modernPreferences:
      storedPreferences ??
      sanitizeNotificationRulePreferences(
        preferenceRow?.notification_rule_preferences_json,
      ),
  });

  return {
    notificationRulePreferences: resolvedPreferenceState.normalizedPreferences,
    effectiveNotificationChannels: resolvedPreferenceState.effectiveChannels,
    categories: buildPreferenceCategories({
      roleCode,
      policyRows,
      storedPreferences: resolvedPreferenceState.normalizedPreferences,
    }),
    rules: canonicalPolicyRows
      .map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    trigger_type: row.trigger_type,
    target_role_code: row.target_role_code,
    is_active: row.is_active !== false && row.policy_is_active !== false,
    categoryCode: row.category_code,
    categoryLabel: row.category_label,
    priority: row.priority,
    inAppPolicy: row.in_app_policy,
    emailPolicy: row.email_policy,
    deliveryMode: row.delivery_mode,
    userConfigurability: row.user_configurability,
    created_at: row.created_at,
      }))
      .filter((row) => isVisibleInSettings(row.code, roleCode)),
    source: resolvedPreferenceState.source,
  };
};

const getNotificationRulesForRole = async (roleCode) => {
  const catalog = await getNotificationPreferenceCatalogForRole({ roleCode });
  return catalog.rules;
};

const getNotificationCategoriesForRole = async ({
  roleCode,
  preferenceRow = null,
  storedPreferences = null,
  dbClient = undefined,
  enforceAvailability = true,
}) => {
  const catalog = await getNotificationPreferenceCatalogForRole({
    roleCode,
    preferenceRow,
    storedPreferences,
    dbClient,
    enforceAvailability,
  });

  return {
    categories: catalog.categories,
    storedPreferences: catalog.notificationRulePreferences,
    source: catalog.source,
  };
};

const markNotificationAsRead = async (notificationId, userId) => {
  const updatedRecipient = await notificationRepository.markNotificationAsRead(
    notificationId,
    userId,
  );

  if (!updatedRecipient) {
    const error = new Error("Notification not found");
    error.statusCode = 404;
    throw error;
  }

  return updatedRecipient;
};

const markAllNotificationsAsRead = async (userId) => {
  const updatedRecipients =
    await notificationRepository.markAllNotificationsAsRead(userId);

  return {
    updated_count: updatedRecipients.length,
  };
};

module.exports = {
  CRITICAL_STOCK_THRESHOLD,
  NEAR_EXPIRY_DAYS,
  DEFAULT_NOTIFICATION_RULES,
  EMAIL_NOTIFICATION_MAX_ATTEMPTS,
  resolveNotificationRecipientRoles,
  emitSafely,
  emitBatchAlerts,
  emitInventoryTransactionAlerts,
  emitDonationStockUpdate,
  emitDonationSummaryUpdate,
  emitDisasterEventCreated,
  emitDisasterEventUpdate,
  emitDistributionUpdate,
  emitHouseholdRegistrationUpdate,
  emitEvacueeAttendanceUpdate,
  emitSyncTransactionFailureAlert,
  emitSyncConflictAlert,
  ensureSyncNotificationIntent,
  processNotificationOutboxEventById,
  processPendingNotificationOutboxEvents,
  seedNotificationRules,
  scanExpiryNotifications,
  scanSyncNotifications,
  getPreviousCompletedManilaHourWindow,
  getWindowBounds,
  getSummaryEvents,
  getSummaryEventCount,
  generateDueEvacuationSummaryReports,
  flushSummaryNotifications,
  retryNotificationEmailDeliveries,
  deliverTrackedNotificationEmail,
  initializeNotificationInfrastructure,
  getNotificationsForUser,
  sanitizeNotificationMetadata,
  getUnreadCountForUser,
  getNotificationPreferenceCatalogForRole,
  getNotificationRulesForRole,
  getNotificationCategoriesForRole,
  buildRecipientDeliveryPlan,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};
