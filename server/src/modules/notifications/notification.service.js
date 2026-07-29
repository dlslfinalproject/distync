const notificationRepository = require("./notification.repository");
const { ROLE_CODES } = require("../auth/auth.middleware");
const emailService = require("../email/email.service");

const LOW_STOCK_THRESHOLD = 10;
const CRITICAL_STOCK_THRESHOLD = 5;
const NEAR_EXPIRY_DAYS = 14;
const DEDUPE_LOOKBACK_HOURS = 24;
const MAINTENANCE_SCAN_INTERVAL_MS = Number.parseInt(
  process.env.NOTIFICATION_SCAN_INTERVAL_MS || `${15 * 60 * 1000}`,
  10,
);

const DEFAULT_NOTIFICATION_RULES = [
  {
    code: "LOW_STOCK",
    name: "Low Stock Alert",
    trigger_type: "INVENTORY_STOCK_THRESHOLD",
    target_role_code: ROLE_CODES.MAYOR,
  },
  {
    code: "CRITICAL_STOCK",
    name: "Critical Stock Alert",
    trigger_type: "INVENTORY_STOCK_THRESHOLD",
    target_role_code: ROLE_CODES.MAYOR,
  },
  {
    code: "NEAR_EXPIRY_STOCK",
    name: "Near Expiry Stock Alert",
    trigger_type: "INVENTORY_EXPIRY",
    target_role_code: ROLE_CODES.MAYOR,
  },
  {
    code: "EXPIRED_STOCK",
    name: "Expired Stock Alert",
    trigger_type: "INVENTORY_EXPIRY",
    target_role_code: ROLE_CODES.MAYOR,
  },
  {
    code: "INVENTORY_INCIDENT",
    name: "Inventory Incident Alert",
    trigger_type: "INVENTORY_INCIDENT",
    target_role_code: ROLE_CODES.MAYOR,
  },
  {
    code: "DONATION_STOCK_UPDATE",
    name: "Donation Stock Update",
    trigger_type: "DONATION_UPDATE",
    target_role_code: ROLE_CODES.MAYOR,
  },
  {
    code: "DONATION_STOCK_ANOMALY",
    name: "Donation Stock Anomaly",
    trigger_type: "DONATION_ANOMALY",
    target_role_code: ROLE_CODES.MAYOR,
  },
  {
    code: "DISASTER_EVENT_CREATED",
    name: "Newly Created Disaster Event",
    trigger_type: "DISASTER_EVENT_CREATED",
    target_role_code: ROLE_CODES.MSWDO,
  },
  {
    code: "DISASTER_EVENT_UPDATE",
    name: "Disaster Event Update",
    trigger_type: "DISASTER_EVENT",
    target_role_code: ROLE_CODES.MSWDO,
  },
  {
    code: "DISTRIBUTION_UPDATE",
    name: "Distribution Update",
    trigger_type: "DISTRIBUTION_UPDATE",
    target_role_code: ROLE_CODES.MSWDO,
  },
  {
    code: "HOUSEHOLD_REGISTERED",
    name: "Household Registration Update",
    trigger_type: "HOUSEHOLD_REGISTRATION",
    target_role_code: ROLE_CODES.BARANGAY,
  },
  {
    code: "HOUSEHOLD_VERIFICATION",
    name: "Household Verification Update",
    trigger_type: "HOUSEHOLD_VERIFICATION",
    target_role_code: ROLE_CODES.BARANGAY,
  },
  {
    code: "EVACUEE_ATTENDANCE_UPDATE",
    name: "Evacuee Attendance Update",
    trigger_type: "EVACUEE_ATTENDANCE_UPDATE",
    target_role_code: ROLE_CODES.BARANGAY,
  },
  {
    code: "SYNC_CONFLICT",
    name: "Sync Conflict Alert",
    trigger_type: "SYNC_CONFLICT",
    target_role_code: ROLE_CODES.BARANGAY,
  },
  {
    code: "SYSTEM_ANOMALY",
    name: "System Anomaly Alert",
    trigger_type: "SYSTEM_ANOMALY",
    target_role_code: ROLE_CODES.BARANGAY,
  },
  {
    code: "EVACUATION_SUMMARY_REPORT",
    name: "Evacuation Monitoring Summary",
    trigger_type: "EVACUATION_SUMMARY",
    target_role_code: ROLE_CODES.MAYOR,
  },
];

const NOTIFICATION_PREFERENCE_KEYS = {
  DISASTER_ALERTS: "disasterAlerts",
  DISTRIBUTION_SCHEDULES: "distributionSchedules",
  RELIEF_ARRIVAL_NOTIFICATIONS: "reliefArrivalNotifications",
  ATTENDANCE_REMINDERS: "attendanceReminders",
  SYSTEM_ANNOUNCEMENTS: "systemAnnouncements",
};

const RULE_NOTIFICATION_PREFERENCE_MAP = {
  DISASTER_EVENT_CREATED: NOTIFICATION_PREFERENCE_KEYS.DISASTER_ALERTS,
  LOW_STOCK: NOTIFICATION_PREFERENCE_KEYS.RELIEF_ARRIVAL_NOTIFICATIONS,
  CRITICAL_STOCK: NOTIFICATION_PREFERENCE_KEYS.RELIEF_ARRIVAL_NOTIFICATIONS,
  NEAR_EXPIRY_STOCK: NOTIFICATION_PREFERENCE_KEYS.RELIEF_ARRIVAL_NOTIFICATIONS,
  EXPIRED_STOCK: NOTIFICATION_PREFERENCE_KEYS.RELIEF_ARRIVAL_NOTIFICATIONS,
  INVENTORY_INCIDENT: NOTIFICATION_PREFERENCE_KEYS.RELIEF_ARRIVAL_NOTIFICATIONS,
  DONATION_STOCK_UPDATE:
    NOTIFICATION_PREFERENCE_KEYS.RELIEF_ARRIVAL_NOTIFICATIONS,
  DONATION_STOCK_ANOMALY:
    NOTIFICATION_PREFERENCE_KEYS.RELIEF_ARRIVAL_NOTIFICATIONS,
  DISASTER_EVENT_UPDATE: NOTIFICATION_PREFERENCE_KEYS.DISASTER_ALERTS,
  DISTRIBUTION_UPDATE: NOTIFICATION_PREFERENCE_KEYS.DISTRIBUTION_SCHEDULES,
  HOUSEHOLD_REGISTERED: NOTIFICATION_PREFERENCE_KEYS.ATTENDANCE_REMINDERS,
  HOUSEHOLD_VERIFICATION: NOTIFICATION_PREFERENCE_KEYS.ATTENDANCE_REMINDERS,
  EVACUEE_ATTENDANCE_UPDATE: NOTIFICATION_PREFERENCE_KEYS.ATTENDANCE_REMINDERS,
  SYNC_CONFLICT: NOTIFICATION_PREFERENCE_KEYS.SYSTEM_ANNOUNCEMENTS,
  SYSTEM_ANOMALY: NOTIFICATION_PREFERENCE_KEYS.SYSTEM_ANNOUNCEMENTS,
  EVACUATION_SUMMARY_REPORT: NOTIFICATION_PREFERENCE_KEYS.DISASTER_ALERTS,
};

const RULE_ADDITIONAL_RECIPIENT_ROLES = {
  DISASTER_EVENT_UPDATE: [ROLE_CODES.BARANGAY, ROLE_CODES.MAYOR],
  HOUSEHOLD_REGISTERED: [ROLE_CODES.MSWDO],
  HOUSEHOLD_VERIFICATION: [ROLE_CODES.MSWDO],
  EVACUEE_ATTENDANCE_UPDATE: [ROLE_CODES.MSWDO],
  DISTRIBUTION_UPDATE: [ROLE_CODES.MAYOR],
  SYNC_CONFLICT: [ROLE_CODES.MSWDO],
  SYSTEM_ANOMALY: [ROLE_CODES.MSWDO, ROLE_CODES.MAYOR],
};

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
  const parsedDate = new Date(value);

  return parsedDate < todayDateOnly;
};

const isNearExpiryDate = (value, thresholdDays = NEAR_EXPIRY_DAYS) => {
  if (!value) {
    return false;
  }

  const today = new Date();
  const startDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const thresholdDate = new Date(startDate);
  thresholdDate.setDate(thresholdDate.getDate() + thresholdDays);

  const parsedDate = new Date(value);
  return parsedDate >= startDate && parsedDate <= thresholdDate;
};

const sanitizeEnabledRuleCodes = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry) => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const isChannelEnabledForInApp = (channels, preferenceKey) => {
  if (!preferenceKey) {
    return true;
  }

  if (typeof channels?.[preferenceKey]?.inApp === "boolean") {
    return channels[preferenceKey].inApp;
  }

  return true;
};

const isChannelEnabledForEmail = (channels, preferenceKey) => {
  if (!preferenceKey) {
    return false;
  }

  if (typeof channels?.[preferenceKey]?.email === "boolean") {
    return channels[preferenceKey].email;
  }

  return false;
};

const isRuleEnabledForUser = (enabledRuleCodes, ruleCode) => {
  if (!ruleCode) {
    return true;
  }

  if (!Array.isArray(enabledRuleCodes) || enabledRuleCodes.length === 0) {
    return true;
  }

  return enabledRuleCodes.includes(ruleCode);
};

const resolveNotificationRecipientRoles = (
  ruleCode,
  targetRoleCode = null,
) => {
  const additionalRoleCodes =
    RULE_ADDITIONAL_RECIPIENT_ROLES[ruleCode] || [];

  return [...new Set([targetRoleCode, ...additionalRoleCodes].filter(Boolean))];
};

const resolveNotificationRecipientGroups = async ({
  ruleCode,
  targetRoleCode = null,
  preferenceKey = null,
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
        preferenceKey,
      };
    }),
  );

  return recipientGroups.filter(Boolean);
};

const isRuleVisibleToRole = (rule, roleCode) => {
  if (!rule?.code || !roleCode) {
    return false;
  }

  return resolveNotificationRecipientRoles(
    rule.code,
    rule.target_role_code,
  ).includes(roleCode);
};

const filterRecipientUserIdsByPreference = async ({
  userIds,
  roleCode,
  ruleCode = null,
  preferenceKey = null,
}) => {
  const resolvedUserIds = [...new Set((userIds || []).filter(Boolean))];

  if (resolvedUserIds.length === 0 || !roleCode) {
    return resolvedUserIds;
  }

  const preferenceRows =
    await notificationRepository.getUserNotificationPreferencesByRole(
      resolvedUserIds,
      roleCode,
    );
  const preferenceMap = new Map(
    preferenceRows.map((row) => [
      row.user_id,
      {
        enabledRuleCodes: sanitizeEnabledRuleCodes(
          row.enabled_notification_rule_codes_json,
        ),
        channels: row.notification_channels_json || {},
      },
    ]),
  );

  return resolvedUserIds.filter((userId) => {
    const preferences = preferenceMap.get(userId);

    if (!preferences) {
      return true;
    }

    return (
      isChannelEnabledForInApp(preferences.channels, preferenceKey) &&
      isRuleEnabledForUser(preferences.enabledRuleCodes, ruleCode)
    );
  });
};

const buildRecipientDeliveryPlan = async ({
  userIds,
  roleCode,
  ruleCode = null,
  preferenceKey = null,
}) => {
  const resolvedUserIds = [...new Set((userIds || []).filter(Boolean))];

  if (resolvedUserIds.length === 0 || !roleCode) {
    return [];
  }

  const preferenceRows =
    await notificationRepository.getUserNotificationPreferencesByRole(
      resolvedUserIds,
      roleCode,
    );

  return preferenceRows.map((row) => {
    const enabledRuleCodes = sanitizeEnabledRuleCodes(
      row.enabled_notification_rule_codes_json,
    );
    const channels = row.notification_channels_json || {};

    return {
      userId: row.user_id,
      email: typeof row.email === "string" ? row.email.trim() : "",
      roleCode,
      inAppEnabled:
        isChannelEnabledForInApp(channels, preferenceKey) &&
        isRuleEnabledForUser(enabledRuleCodes, ruleCode),
      emailEnabled:
        isChannelEnabledForEmail(channels, preferenceKey) &&
        isRuleEnabledForUser(enabledRuleCodes, ruleCode),
    };
  });
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
}) => {
  const matchingRule = ruleCode
    ? await notificationRepository.getNotificationRuleByCode(ruleCode)
    : null;

  if (matchingRule && matchingRule.is_active === false) {
    return null;
  }

  const deliveryPlanBuckets = await Promise.all(
    (recipientGroups || []).map(async (group) => {
      const resolvedRuleCode = group.ruleCode ?? ruleCode;
      const resolvedPreferenceKey =
        group.preferenceKey ||
        RULE_NOTIFICATION_PREFERENCE_MAP[resolvedRuleCode] ||
        null;

      return buildRecipientDeliveryPlan({
        userIds: group.userIds,
        roleCode: group.roleCode,
        ruleCode: resolvedRuleCode,
        preferenceKey: resolvedPreferenceKey,
      });
    }),
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

const createNotificationForUsers = async ({
  ruleCode,
  userIds,
  roleCode = null,
  preferenceKey = null,
  disaster_event_id = null,
  type,
  title,
  message,
  severity = "INFO",
  reference_type = null,
  reference_id = null,
  dedupeHours = DEDUPE_LOOKBACK_HOURS,
}) => {
  return createNotificationForRecipientGroups({
    ruleCode,
    recipientGroups: [
      {
        userIds,
        roleCode,
        preferenceKey,
      },
    ],
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

const createNotificationForRole = async ({
  ruleCode,
  roleCode = ROLE_CODES.MAYOR,
  preferenceKey = null,
  disaster_event_id = null,
  type,
  title,
  message,
  severity = "INFO",
  reference_type = null,
  reference_id = null,
  dedupeHours = DEDUPE_LOOKBACK_HOURS,
}) => {
  const matchingRule = ruleCode
    ? await notificationRepository.getNotificationRuleByCode(ruleCode)
    : null;

  if (matchingRule && matchingRule.is_active === false) {
    return null;
  }

  const targetRoleCode = matchingRule?.target_role_code || roleCode;
  const recipientGroups = await resolveNotificationRecipientGroups({
    ruleCode,
    preferenceKey,
    targetRoleCode,
    recipientResolversByRole: Object.fromEntries(
      resolveNotificationRecipientRoles(ruleCode, targetRoleCode).map(
        (resolvedRoleCode) => [
          resolvedRoleCode,
          () =>
            notificationRepository.getRecipientUserIdsByRoleCode(
              resolvedRoleCode,
            ),
        ],
      ),
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
  const matchingRule = ruleCode
    ? await notificationRepository.getNotificationRuleByCode(ruleCode)
    : null;

  if (matchingRule && matchingRule.is_active === false) {
    return null;
  }

  const resolvedRoleCodes = [
    ...new Set([
      ...resolveNotificationRecipientRoles(
        ruleCode,
        matchingRule?.target_role_code || null,
      ),
      ...(roleCodes || []).filter(Boolean),
    ]),
  ];
  const recipientGroups = await resolveNotificationRecipientGroups({
    ruleCode,
    targetRoleCode: matchingRule?.target_role_code || null,
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

  if (batch.status === "EXPIRED" && previousStatus !== "EXPIRED") {
    await createNotificationForRole({
      ruleCode: "EXPIRED_STOCK",
      disaster_event_id: disasterEventId,
      type: "EXPIRY",
      title: "Expired stock alert",
      message: `${itemName} (${batchNumber}) is now expired and needs immediate review.`,
      severity: "CRITICAL",
      reference_type: "INVENTORY_BATCH",
      reference_id: batch.id,
    });
  } else if (
    batch.expiration_date &&
    isNearExpiryDate(batch.expiration_date) &&
    batch.status !== "EXPIRED"
  ) {
    await createNotificationForRole({
      ruleCode: "NEAR_EXPIRY_STOCK",
      disaster_event_id: disasterEventId,
      type: "EXPIRY",
      title: "Near-expiry stock alert",
      message: `${itemName} (${batchNumber}) is nearing expiry and should be reviewed soon.`,
      severity: "WARNING",
      reference_type: "INVENTORY_BATCH",
      reference_id: batch.id,
    });
  }

  if (
    quantityAvailable <= CRITICAL_STOCK_THRESHOLD &&
    (priorQuantity === null || priorQuantity > CRITICAL_STOCK_THRESHOLD)
  ) {
    await createNotificationForRole({
      ruleCode: "CRITICAL_STOCK",
      disaster_event_id: disasterEventId,
      type: "INVENTORY",
      title: "Critical stock alert",
      message: `${itemName} (${batchNumber}) is down to ${toDisplayQuantity(quantityAvailable)} available units.`,
      severity: "CRITICAL",
      reference_type: "INVENTORY_BATCH",
      reference_id: batch.id,
    });
    return;
  }

  if (
    quantityAvailable <= LOW_STOCK_THRESHOLD &&
    quantityAvailable > CRITICAL_STOCK_THRESHOLD &&
    (priorQuantity === null || priorQuantity > LOW_STOCK_THRESHOLD)
  ) {
    await createNotificationForRole({
      ruleCode: "LOW_STOCK",
      disaster_event_id: disasterEventId,
      type: "INVENTORY",
      title: "Low stock alert",
      message: `${itemName} (${batchNumber}) is down to ${toDisplayQuantity(quantityAvailable)} available units.`,
      severity: "WARNING",
      reference_type: "INVENTORY_BATCH",
      reference_id: batch.id,
    });
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
}) => {
  await createNotificationForRole({
    ruleCode: anomaly ? "DONATION_STOCK_ANOMALY" : "DONATION_STOCK_UPDATE",
    disaster_event_id: disasterEventId,
    type: anomaly ? "ANOMALY" : "INVENTORY",
    title: anomaly ? "Donation stock anomaly" : "Donation stock update",
    message: `${donorName} donation stock for ${itemName} was ${actionLabel} by ${toDisplayQuantity(quantity)} units.`,
    severity,
    reference_type: "DONATION_ITEM",
    reference_id: referenceId,
  });
};

const emitDonationSummaryUpdate = async ({
  donorName,
  itemCount,
  disasterEventId = null,
  referenceId = null,
}) => {
  await createNotificationForRole({
    ruleCode: "DONATION_STOCK_UPDATE",
    disaster_event_id: disasterEventId,
    type: "INVENTORY",
    title: "Donation received",
    message: `A donation from ${donorName} was received with ${toDisplayQuantity(itemCount)} item entries.`,
    severity: "INFO",
    reference_type: "DONATION",
    reference_id: referenceId,
  });
};

const emitDisasterEventCreated = async ({
  disasterEvent,
}) => {
  if (!disasterEvent) {
    return;
  }

  await createNotificationForRole({
    ruleCode: "DISASTER_EVENT_CREATED",
    roleCode: ROLE_CODES.MSWDO,
    preferenceKey: NOTIFICATION_PREFERENCE_KEYS.DISASTER_ALERTS,
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
    preferenceKey: NOTIFICATION_PREFERENCE_KEYS.DISASTER_ALERTS,
    includeRoleCodes:
      normalizedAction === "created"
        ? resolveNotificationRecipientRoles(
            "DISASTER_EVENT_UPDATE",
            ROLE_CODES.MSWDO,
          ).filter((roleCode) => roleCode !== ROLE_CODES.MSWDO)
        : null,
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
  stubNo,
  familyHeadName,
  distributionTransactionId,
}) => {
  const recipientGroups = await resolveNotificationRecipientGroups({
    ruleCode: "DISTRIBUTION_UPDATE",
    targetRoleCode: ROLE_CODES.MSWDO,
    preferenceKey: NOTIFICATION_PREFERENCE_KEYS.DISTRIBUTION_SCHEDULES,
    recipientResolversByRole: {
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
    preferenceKey: NOTIFICATION_PREFERENCE_KEYS.ATTENDANCE_REMINDERS,
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

  if (recipientGroups.every((group) => group.userIds.length === 0)) {
    return null;
  }

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
  });

  if (requiresVerification) {
    const verificationRecipientGroups = await resolveNotificationRecipientGroups(
      {
        ruleCode: "HOUSEHOLD_VERIFICATION",
        targetRoleCode: ROLE_CODES.BARANGAY,
        preferenceKey: NOTIFICATION_PREFERENCE_KEYS.ATTENDANCE_REMINDERS,
        recipientResolversByRole: {
          [ROLE_CODES.BARANGAY]: () =>
            notificationRepository.getRecipientUserIdsByRoleCodeAndBarangayIds(
              ROLE_CODES.BARANGAY,
              barangayId ? [barangayId] : [],
            ),
          [ROLE_CODES.MSWDO]: () =>
            notificationRepository.getRecipientUserIdsByRoleCode(
              ROLE_CODES.MSWDO,
            ),
        },
      },
    );

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
    preferenceKey: NOTIFICATION_PREFERENCE_KEYS.ATTENDANCE_REMINDERS,
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

  if (recipientGroups.every((group) => group.userIds.length === 0)) {
    return null;
  }

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
  });
};

const emitSyncTransactionFailureAlert = async (syncTransaction) => {
  if (!syncTransaction?.id) {
    return null;
  }

  const recipientGroups = await resolveNotificationRecipientGroups({
    ruleCode: "SYSTEM_ANOMALY",
    targetRoleCode: ROLE_CODES.BARANGAY,
    preferenceKey: NOTIFICATION_PREFERENCE_KEYS.SYSTEM_ANNOUNCEMENTS,
    recipientResolversByRole: {
      [ROLE_CODES.BARANGAY]: () =>
        notificationRepository.getRecipientUserIdsByRoleCode(
          ROLE_CODES.BARANGAY,
        ),
      [ROLE_CODES.MSWDO]: () =>
        notificationRepository.getRecipientUserIdsByRoleCode(ROLE_CODES.MSWDO),
      [ROLE_CODES.MAYOR]: () =>
        notificationRepository.getRecipientUserIdsByRoleCode(ROLE_CODES.MAYOR),
    },
  });

  if (recipientGroups.every((group) => group.userIds.length === 0)) {
    return null;
  }

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
    resolveNotificationRecipientRoles(
      "SYNC_CONFLICT",
      ROLE_CODES.BARANGAY,
    ).includes(roleCode),
  );

  if (!recipientRoleCode) {
    return null;
  }

  return createNotificationForUsers({
    ruleCode: "SYNC_CONFLICT",
    userIds: [syncConflict.user_id],
    roleCode: recipientRoleCode,
    preferenceKey: NOTIFICATION_PREFERENCE_KEYS.SYSTEM_ANNOUNCEMENTS,
    type: "SYNC",
    title: "Sync conflict detected",
    message: `${syncConflict.conflict_type} conflict is still unresolved for ${syncConflict.entity_type}.`,
    severity: "CRITICAL",
    reference_type: "SYNC_CONFLICT",
    reference_id: syncConflict.id,
  });
};

const seedNotificationRules = async () => {
  for (const rule of DEFAULT_NOTIFICATION_RULES) {
    await notificationRepository.upsertNotificationRule(rule);
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
  // Full sync management UI is a future enhancement.
  // For now, unresolved sync issues surface through notifications only.
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

const getNotificationsForUser = async (userId, filters) => {
  return notificationRepository.getNotificationsForUser(userId, filters);
};

const getUnreadCountForUser = async (userId) => {
  return notificationRepository.countUnreadNotificationsForUser(userId);
};

const getNotificationRulesForRole = async (roleCode, dbClient = undefined) => {
  const rules = await notificationRepository.getAllNotificationRules(dbClient);

  return rules
    .filter((row) => isRuleVisibleToRole(row, roleCode))
    .map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    trigger_type: row.trigger_type,
    target_role_code: row.target_role_code,
    is_active: row.is_active !== false,
    created_at: row.created_at,
  }));
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
  const updatedRecipients = await notificationRepository.markAllNotificationsAsRead(
    userId,
  );

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
  initializeNotificationInfrastructure,
  getNotificationsForUser,
  getUnreadCountForUser,
  getNotificationRulesForRole,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};
