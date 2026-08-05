const notificationRepository = require("./notification.repository");
const { ROLE_CODES } = require("../auth/auth.middleware");
const emailService = require("../email/email.service");
const { insertAuditLog } = require("../../repositories/systemLog.repository");
const {
  DELIVERY_MODE,
  NOTIFICATION_POLICY_ROWS,
  NOTIFICATION_RULE_TARGETS,
  getPolicyRolesForRule,
} = require("./notificationPolicy");
const {
  buildPreferenceCategories,
  deriveLegacyPreferenceMap,
  resolveEffectiveChannels,
  sanitizeNotificationRulePreferences,
} = require("./notificationPreferenceUtils");

const LOW_STOCK_THRESHOLD = 10;
const CRITICAL_STOCK_THRESHOLD = 5;
const NEAR_EXPIRY_DAYS = 30;
const DEDUPE_LOOKBACK_HOURS = 24;
const MAINTENANCE_SCAN_INTERVAL_MS = Number.parseInt(
  process.env.NOTIFICATION_SCAN_INTERVAL_MS || `${15 * 60 * 1000}`,
  10,
);

const DEFAULT_NOTIFICATION_RULES = NOTIFICATION_RULE_TARGETS.map((rule) => ({
  code: rule.code,
  name: rule.name,
  trigger_type: rule.triggerType,
  target_role_code: rule.targetRoleCode,
}));

let notificationMaintenanceInterval = null;

const toDisplayQuantity = (value) => Number(value || 0).toLocaleString();

const isExpiredDate = (value) => {
  if (!value) {
    return false;
  }

  const today = new Date();
  const todayDateOnly = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  return new Date(value) < todayDateOnly;
};

const isNearExpiryDate = (value, thresholdDays = NEAR_EXPIRY_DAYS) => {
  if (!value) {
    return false;
  }

  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  const thresholdDate = new Date(startDate);
  thresholdDate.setDate(thresholdDate.getDate() + thresholdDays);
  const parsedDate = new Date(value);

  return parsedDate >= startDate && parsedDate <= thresholdDate;
};

const getWindowBounds = (deliveryMode, now = new Date()) => {
  const windowStartedAt = new Date(now);
  const windowEndsAt = new Date(now);

  if (deliveryMode === DELIVERY_MODE.DAILY_SUMMARY) {
    windowStartedAt.setHours(0, 0, 0, 0);
    windowEndsAt.setHours(24, 0, 0, 0);
    return {
      windowStartedAt,
      windowEndsAt,
      readyAt: windowEndsAt,
    };
  }

  windowStartedAt.setMinutes(0, 0, 0);
  windowEndsAt.setMinutes(0, 0, 0);
  windowEndsAt.setHours(windowEndsAt.getHours() + 1);

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

const buildStoredPreferenceMap = ({
  policyRows,
  preferenceRow,
}) => {
  const explicitPreferences = sanitizeNotificationRulePreferences(
    preferenceRow?.notification_rule_preferences_json,
  );

  if (Object.keys(explicitPreferences).length > 0) {
    return explicitPreferences;
  }

  return deriveLegacyPreferenceMap({
    policyRows,
    enabledNotificationRuleCodes:
      preferenceRow?.enabled_notification_rule_codes_json || [],
    notificationChannels: preferenceRow?.notification_channels_json || {},
  });
};

const buildRecipientDeliveryPlan = async ({
  userIds,
  roleCode,
  ruleCode,
}) => {
  const resolvedUserIds = [...new Set((userIds || []).filter(Boolean))];

  if (resolvedUserIds.length === 0 || !roleCode || !ruleCode) {
    return [];
  }

  const [policyRow, preferenceRows] = await Promise.all([
    notificationRepository.getNotificationPolicyRow(ruleCode, roleCode),
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
    const storedPreferences = buildStoredPreferenceMap({
      policyRows: policyRowsForRole,
      preferenceRow: row,
    });
    const effectiveChannels = resolveEffectiveChannels({
      policyRow,
      storedPreferences,
    });

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
  const policyRoles = getPolicyRolesForRule(ruleCode);
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

const createPersistentNotification = async ({
  ruleCode,
  recipientGroups,
  disaster_event_id = null,
  type,
  title,
  message,
  severity = "INFO",
  reference_type = null,
  reference_id = null,
  dedupeHours = DEDUPE_LOOKBACK_HOURS,
}) => {
  const deliveryPlanBuckets = await Promise.all(
    (recipientGroups || []).map((group) =>
      buildRecipientDeliveryPlan({
        userIds: group.userIds,
        roleCode: group.roleCode,
        ruleCode,
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
    dedupeRecipientIds.length > 0
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
    type,
    title,
    message,
    severity,
    reference_type,
    reference_id,
  });

  if (inAppRecipientIds.length > 0) {
    await notificationRepository.insertNotificationRecipients(
      createdNotification.id,
      inAppRecipientIds,
    );
  }

  if (emailRecipients.length > 0) {
    await Promise.allSettled(
      emailRecipients.map((recipient) =>
        emailService.sendNotificationEmail({
          actor: {
            userId: recipient.userId,
            roleCode: recipient.roleCode,
          },
          recipientEmail: recipient.email,
          notificationType: ruleCode || type,
          notificationTitle: title,
          notificationMessage: message,
          severity,
          timestamp: new Date().toISOString(),
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
  const now = new Date();

  await Promise.all(
    recipientGroups.map(async (group) => {
      const [policyRow] = await Promise.all([
        notificationRepository.getNotificationPolicyRow(ruleCode, group.roleCode),
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
        ruleCode,
        roleCode: group.roleCode,
        barangayId: summaryMetadata.barangayId || null,
        disasterEventId: disaster_event_id,
        referenceScope: {
          referenceType: reference_type,
          referenceId: reference_id,
          ...summaryMetadata,
        },
        payload: {
          count: 1,
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
  dedupeHours = DEDUPE_LOOKBACK_HOURS,
  summaryMetadata = {},
  bypassSummaryQueue = false,
}) => {
  const matchingRule = ruleCode
    ? await notificationRepository.getNotificationRuleByCode(ruleCode)
    : null;

  if (matchingRule && matchingRule.is_active === false) {
    return null;
  }

  const policyModes = await Promise.all(
    recipientGroups.map(async (group) => {
      const policyRow = await notificationRepository.getNotificationPolicyRow(
        ruleCode,
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
      ruleCode,
      recipientGroups,
      disaster_event_id,
      reference_type,
      reference_id,
      summaryMetadata,
    });
  }

  return createPersistentNotification({
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
  });
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
  dedupeHours = DEDUPE_LOOKBACK_HOURS,
}) =>
  createNotificationForRecipientGroups({
    ruleCode,
    recipientGroups: [{ userIds, roleCode }],
    disaster_event_id,
    type,
    title,
    message,
    severity,
    reference_type,
    reference_id,
    dedupeHours,
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
  dedupeHours = DEDUPE_LOOKBACK_HOURS,
  summaryMetadata = {},
}) => {
  const matchingRule = ruleCode
    ? await notificationRepository.getNotificationRuleByCode(ruleCode)
    : null;

  if (matchingRule && matchingRule.is_active === false) {
    return null;
  }

  const targetRoleCode = matchingRule?.target_role_code || roleCode;
  const resolvedRoleCodes = resolveNotificationRecipientRoles(ruleCode, targetRoleCode);
  const recipientGroups = await resolveNotificationRecipientGroups({
    ruleCode,
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
    dedupeHours,
    summaryMetadata,
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
}) => {
  const resolvedRoleCodes = [
    ...new Set([
      ...resolveNotificationRecipientRoles(ruleCode, null),
      ...(roleCodes || []).filter(Boolean),
    ]),
  ];

  const recipientGroups = await resolveNotificationRecipientGroups({
    ruleCode,
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

  const stockStateKey = `INVENTORY_STOCK:${batch.id}`;
  const expiryStateKey = `INVENTORY_EXPIRY:${batch.id}`;
  const stockState =
    quantityAvailable <= CRITICAL_STOCK_THRESHOLD
      ? "CRITICAL_STOCK"
      : quantityAvailable <= LOW_STOCK_THRESHOLD
        ? "LOW_STOCK"
        : "NORMAL";
  const expiryState =
    batch.status === "EXPIRED" || isExpiredDate(batch.expiration_date)
      ? "EXPIRED_STOCK"
      : batch.expiration_date && isNearExpiryDate(batch.expiration_date)
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
            type: "EXPIRY",
            title: "Expired stock alert",
            message: `${itemName} (${batchNumber}) is now expired and needs immediate review.`,
            severity: "CRITICAL",
            reference_type: "INVENTORY_BATCH",
            reference_id: batch.id,
          }
        : {
            ruleCode: "NEAR_EXPIRY_STOCK",
            disaster_event_id: disasterEventId,
            type: "EXPIRY",
            title: "Near-expiry stock alert",
            message: `${itemName} (${batchNumber}) is nearing expiry and should be reviewed soon.`,
            severity: "WARNING",
            reference_type: "INVENTORY_BATCH",
            reference_id: batch.id,
          },
  });

  await maybeNotifyThresholdState({
    stateKey: stockStateKey,
    ruleCode:
      stockState === "CRITICAL_STOCK" ? "CRITICAL_STOCK" : "LOW_STOCK",
    roleCode: ROLE_CODES.MAYOR,
    stateValue: stockState,
    shouldNotify: stockState !== "NORMAL",
    notificationPayload:
      stockState === "CRITICAL_STOCK"
        ? {
            ruleCode: "CRITICAL_STOCK",
            disaster_event_id: disasterEventId,
            type: "INVENTORY",
            title: "Critical stock alert",
            message: `${itemName} (${batchNumber}) is down to ${toDisplayQuantity(quantityAvailable)} available units.`,
            severity: "CRITICAL",
            reference_type: "INVENTORY_BATCH",
            reference_id: batch.id,
          }
        : {
            ruleCode: "LOW_STOCK",
            disaster_event_id: disasterEventId,
            type: "INVENTORY",
            title: "Low stock alert",
            message: `${itemName} (${batchNumber}) is down to ${toDisplayQuantity(quantityAvailable)} available units.`,
            severity: "WARNING",
            reference_type: "INVENTORY_BATCH",
            reference_id: batch.id,
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
    ["DAMAGED", "MISSING", "SPOILED", "STOLEN"].includes(
      transaction.transaction_type,
    )
  ) {
    const alertLabel = transaction.transaction_type.toLowerCase();
    const severity =
      transaction.transaction_type === "MISSING" ||
      transaction.transaction_type === "STOLEN"
        ? "CRITICAL"
        : "WARNING";

    await createNotificationForRole({
      ruleCode: "INVENTORY_INCIDENT",
      disaster_event_id: disasterEventId,
      type: "ANOMALY",
      title: `${transaction.transaction_type} stock recorded`,
      message: `${toDisplayQuantity(transaction.quantity)} units of ${itemName} (${batchNumber}) were marked as ${alertLabel}.${transaction.remarks ? ` ${transaction.remarks}` : ""}`,
      severity,
      reference_type: "INVENTORY_TRANSACTION",
      reference_id: transaction.id,
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
    ruleCode: anomaly ? "DONATION_STOCK_ANOMALY" : "DONATION_STOCK_UPDATE",
    disaster_event_id: disasterEventId,
    type: anomaly ? "ANOMALY" : "INVENTORY",
    title: anomaly ? "Donation stock anomaly" : "Donation stock update",
    message: `${donorName} donation stock for ${itemName} was ${actionLabel} by ${toDisplayQuantity(quantity)} units.`,
    severity,
    reference_type: "DONATION_ITEM",
    reference_id: referenceId,
    summaryMetadata: {
      donorName,
      itemName,
      quantity: Number(quantity || 0),
    },
  });

const emitDonationSummaryUpdate = async ({
  donorName,
  itemCount,
  disasterEventId = null,
  referenceId = null,
}) =>
  createNotificationForRole({
    ruleCode: "DONATION_STOCK_UPDATE",
    disaster_event_id: disasterEventId,
    type: "INVENTORY",
    title: "Donation received",
    message: `A donation from ${donorName} was received with ${toDisplayQuantity(itemCount)} item entries.`,
    severity: "INFO",
    reference_type: "DONATION",
    reference_id: referenceId,
    summaryMetadata: {
      donorName,
      itemCount: Number(itemCount || 0),
    },
  });

const emitDisasterEventCreated = async ({ disasterEvent }) => {
  if (!disasterEvent) {
    return;
  }

  await createNotificationForRole({
    ruleCode: "DISASTER_EVENT_CREATED",
    roleCode: ROLE_CODES.MSWDO,
    disaster_event_id: disasterEvent.id,
    type: "EVENT",
    title: "New disaster event created",
    message: `${`${disasterEvent.event_code || ""} ${disasterEvent.title || "Disaster event"}`.trim()} was created and is ready for MSWDO coordination.`,
    severity: "WARNING",
    reference_type: "DISASTER_EVENT",
    reference_id: disasterEvent.id,
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
    ruleCode: "DISASTER_EVENT_UPDATE",
    targetRoleCode: ROLE_CODES.MSWDO,
    includeRoleCodes: resolveNotificationRecipientRoles(
      "DISASTER_EVENT_UPDATE",
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
    ruleCode: "DISASTER_EVENT_UPDATE",
    recipientGroups,
    disaster_event_id: disasterEvent.id,
    type: "EVENT",
    title: "Disaster event update",
    message: `${eventLabel} was ${actionLabel}. Affected coverage: ${barangayLabel}.`,
    severity: normalizedAction === "ended" ? "INFO" : "WARNING",
    reference_type: "DISASTER_EVENT",
    reference_id: disasterEvent.id,
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
    ruleCode: "DISTRIBUTION_UPDATE",
    targetRoleCode: ROLE_CODES.MSWDO,
    includeRoleCodes: resolveNotificationRecipientRoles(
      "DISTRIBUTION_UPDATE",
      ROLE_CODES.MSWDO,
    ),
    recipientResolversByRole: {
      [ROLE_CODES.BARANGAY]: () =>
        notificationRepository.getRecipientUserIdsByRoleCodeAndBarangayIds(
          ROLE_CODES.BARANGAY,
          barangayId ? [barangayId] : [],
        ),
      [ROLE_CODES.MSWDO]: () =>
        notificationRepository.getRecipientUserIdsByRoleCode(ROLE_CODES.MSWDO),
      [ROLE_CODES.MAYOR]: () =>
        notificationRepository.getRecipientUserIdsByRoleCode(ROLE_CODES.MAYOR),
    },
  });

  await createNotificationForRecipientGroups({
    ruleCode: "DISTRIBUTION_UPDATE",
    recipientGroups,
    disaster_event_id: disasterEventId,
    type: "EVENT",
    title: "Relief distribution recorded",
    message: `Stub ${stubNo || "--"} for ${familyHeadName || "a household"} was successfully validated for relief distribution.`,
    severity: "INFO",
    reference_type: "DISTRIBUTION_TRANSACTION",
    reference_id: distributionTransactionId,
    summaryMetadata: {
      barangayId,
      stubNo,
    },
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
    type: "SYSTEM",
    title: "Household registration update",
    message: `${familyHeadName || "A household"} was ${actionLabel} in the barangay masterlist.`,
    severity: "INFO",
    reference_type: "HOUSEHOLD",
    reference_id: householdId,
    summaryMetadata: {
      barangayId,
      action: actionLabel,
    },
  });

  if (requiresVerification) {
    const verificationRecipientGroups = await resolveNotificationRecipientGroups({
      ruleCode: "HOUSEHOLD_VERIFICATION",
      targetRoleCode: ROLE_CODES.BARANGAY,
      includeRoleCodes: resolveNotificationRecipientRoles(
        "HOUSEHOLD_VERIFICATION",
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
      ruleCode: "HOUSEHOLD_VERIFICATION",
      recipientGroups: verificationRecipientGroups,
      type: "SYSTEM",
      title: "Household pending verification",
      message: `${familyHeadName || "A household"} is pending household verification follow-up.`,
      severity: "WARNING",
      reference_type: "HOUSEHOLD",
      reference_id: householdId,
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
    ruleCode: "EVACUEE_ATTENDANCE_UPDATE",
    targetRoleCode: ROLE_CODES.BARANGAY,
    includeRoleCodes: resolveNotificationRecipientRoles(
      "EVACUEE_ATTENDANCE_UPDATE",
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
    ruleCode: "EVACUEE_ATTENDANCE_UPDATE",
    recipientGroups,
    type: "EVENT",
    title: "Evacuee attendance update",
    message: `${familyHeadName || "A household"} ${actionLabel}.`,
    severity: "INFO",
    reference_type: "HOUSEHOLD",
    reference_id: householdId,
    summaryMetadata: {
      barangayId,
      action: normalizedAction,
    },
  });
};

const emitSyncTransactionFailureAlert = async (syncTransaction) => {
  if (!syncTransaction?.id) {
    return null;
  }

  const recipientGroups = await resolveNotificationRecipientGroups({
    ruleCode: "SYSTEM_ANOMALY",
    targetRoleCode: ROLE_CODES.BARANGAY,
    includeRoleCodes: resolveNotificationRecipientRoles(
      "SYSTEM_ANOMALY",
      ROLE_CODES.BARANGAY,
    ),
    recipientResolversByRole: {
      [ROLE_CODES.BARANGAY]: () =>
        notificationRepository.getRecipientUserIdsByRoleCode(ROLE_CODES.BARANGAY),
      [ROLE_CODES.MSWDO]: () =>
        notificationRepository.getRecipientUserIdsByRoleCode(ROLE_CODES.MSWDO),
      [ROLE_CODES.MAYOR]: () =>
        notificationRepository.getRecipientUserIdsByRoleCode(ROLE_CODES.MAYOR),
    },
  });

  return createNotificationForRecipientGroups({
    ruleCode: "SYSTEM_ANOMALY",
    recipientGroups,
    type: "SYNC",
    title: "Sync transaction failed",
    message: `${syncTransaction.operation_type} for ${syncTransaction.entity_type} failed to sync.${syncTransaction.error_message ? ` ${syncTransaction.error_message}` : ""}`,
    severity: "WARNING",
    reference_type: "SYNC_TRANSACTION",
    reference_id: syncTransaction.id,
  });
};

const emitSyncConflictAlert = async (syncConflict) => {
  if (!syncConflict?.user_id) {
    return null;
  }

  const roleCodes = await notificationRepository.getRoleCodesByUserId(
    syncConflict.user_id,
  );
  const recipientRoleCode = roleCodes.find((roleCode) =>
    resolveNotificationRecipientRoles("SYNC_CONFLICT", ROLE_CODES.BARANGAY).includes(
      roleCode,
    ),
  );

  if (!recipientRoleCode) {
    return null;
  }

  return createNotificationForUsers({
    ruleCode: "SYNC_CONFLICT",
    userIds: [syncConflict.user_id],
    roleCode: recipientRoleCode,
    type: "SYNC",
    title: "Sync conflict detected",
    message: `${syncConflict.conflict_type} conflict is still unresolved for ${syncConflict.entity_type}.`,
    severity: "CRITICAL",
    reference_type: "SYNC_CONFLICT",
    reference_id: syncConflict.id,
  });
};

const seedNotificationRules = async () => {
  for (const rule of NOTIFICATION_RULE_TARGETS) {
    await notificationRepository.upsertNotificationRule({
      code: rule.code,
      name: rule.name,
      trigger_type: rule.triggerType,
      target_role_code: rule.targetRoleCode,
    });
  }

  for (const policyRow of NOTIFICATION_POLICY_ROWS) {
    await notificationRepository.upsertNotificationRuleRolePolicy(policyRow);
  }
};

const buildSummaryNotificationContent = (summaryGroup) => {
  const count = summaryGroup.events.length;
  const roleLabel = summaryGroup.roleCode;

  switch (summaryGroup.ruleCode) {
    case "HOUSEHOLD_REGISTERED":
      return {
        title: "Household registration summary",
        message: `${count} household registration updates were recorded for ${roleLabel} during the last hour.`,
      };
    case "EVACUEE_ATTENDANCE_UPDATE":
      return {
        title: "Evacuee attendance summary",
        message: `${count} evacuee attendance updates were recorded for ${roleLabel} during the last hour.`,
      };
    case "DISTRIBUTION_UPDATE":
      return {
        title: "Distribution activity summary",
        message: `${count} relief distribution transactions were recorded for ${roleLabel} during the last hour.`,
      };
    case "DONATION_STOCK_UPDATE":
      return {
        title: "Donation stock summary",
        message: `${count} donation stock updates were recorded for ${roleLabel} during the last day.`,
      };
    case "EVACUATION_SUMMARY_REPORT":
      return {
        title: "Evacuation monitoring summary",
        message: `${count} evacuation monitoring updates were prepared for ${roleLabel} during the last day.`,
      };
    default:
      return {
        title: `${summaryGroup.ruleCode} summary`,
        message: `${count} ${summaryGroup.ruleCode} events were grouped into this summary.`,
      };
  }
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
      type: "SUMMARY",
      title: content.title,
      message: content.message,
      severity: "INFO",
      reference_type: "NOTIFICATION_SUMMARY",
      reference_id: null,
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
        eventCount: group.events.length,
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
    await emitSyncTransactionFailureAlert(syncTransaction);
  }

  for (const syncConflict of openSyncConflicts) {
    await emitSyncConflictAlert(syncConflict);
  }
};

const runNotificationMaintenanceScans = async () => {
  await seedNotificationRules();
  await scanExpiryNotifications();
  await scanSyncNotifications();
  await flushSummaryNotifications();
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
  await runNotificationMaintenanceScans();
  startNotificationMaintenance();
};

const getNotificationsForUser = async (userId, filters) =>
  notificationRepository.getNotificationsForUser(userId, filters);

const getUnreadCountForUser = async (userId) =>
  notificationRepository.countUnreadNotificationsForUser(userId);

const getNotificationRulesForRole = async (roleCode) => {
  const policyRows =
    await notificationRepository.getNotificationPolicyRowsByRoleCode(roleCode);

  return policyRows.map((row) => ({
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
  }));
};

const getNotificationCategoriesForRole = async ({
  roleCode,
  preferenceRow = null,
}) => {
  const policyRows =
    await notificationRepository.getNotificationPolicyRowsByRoleCode(roleCode);
  const storedPreferences = buildStoredPreferenceMap({
    policyRows,
    preferenceRow,
  });

  return {
    categories: buildPreferenceCategories({
      roleCode,
      policyRows,
      storedPreferences,
    }),
    storedPreferences,
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
  LOW_STOCK_THRESHOLD,
  CRITICAL_STOCK_THRESHOLD,
  NEAR_EXPIRY_DAYS,
  DEFAULT_NOTIFICATION_RULES,
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
  seedNotificationRules,
  scanExpiryNotifications,
  scanSyncNotifications,
  flushSummaryNotifications,
  initializeNotificationInfrastructure,
  getNotificationsForUser,
  getUnreadCountForUser,
  getNotificationRulesForRole,
  getNotificationCategoriesForRole,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};
