const notificationRepository = require("./notification.repository");
const { ROLE_CODES } = require("../auth/auth.middleware");

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
    code: "DISASTER_EVENT_UPDATE",
    name: "Disaster Event Update",
    trigger_type: "DISASTER_EVENT",
    target_role_code: ROLE_CODES.MSWDO,
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
];

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

const createNotificationForUsers = async ({
  ruleCode,
  userIds,
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

  const resolvedUserIds = [...new Set((userIds || []).filter(Boolean))];

  if (resolvedUserIds.length === 0) {
    return null;
  }

  const existingNotification =
    await notificationRepository.findRecentNotificationMatchForUsers(
      {
        type,
        title,
        message,
        severity,
        reference_type,
        reference_id,
      },
      resolvedUserIds,
      dedupeHours,
    );

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

  await notificationRepository.insertNotificationRecipients(
    createdNotification.id,
    resolvedUserIds,
  );

  return createdNotification;
};

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
}) => {
  const matchingRule = ruleCode
    ? await notificationRepository.getNotificationRuleByCode(ruleCode)
    : null;

  if (matchingRule && matchingRule.is_active === false) {
    return null;
  }

  const targetRoleCode = matchingRule?.target_role_code || roleCode;
  const recipientIds = await notificationRepository.getRecipientUserIdsByRoleCode(
    targetRoleCode,
  );

  return createNotificationForUsers({
    ruleCode,
    userIds: recipientIds,
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

  const resolvedRoleCodes = [...new Set((roleCodes || []).filter(Boolean))];
  const recipientBuckets = await Promise.all(
    resolvedRoleCodes.map((roleCode) =>
      notificationRepository.getRecipientUserIdsByRoleCode(roleCode),
    ),
  );
  const recipientIds = [...new Set(recipientBuckets.flat())];

  return createNotificationForUsers({
    ruleCode,
    userIds: recipientIds,
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
  const [mswdoRecipientIds, barangayRecipientIds] = await Promise.all([
    notificationRepository.getRecipientUserIdsByRoleCode(ROLE_CODES.MSWDO),
    notificationRepository.getRecipientUserIdsByRoleCodeAndBarangayIds(
      ROLE_CODES.BARANGAY,
      affectedBarangayIds,
    ),
  ]);

  await createNotificationForUsers({
    ruleCode: "DISASTER_EVENT_UPDATE",
    userIds: [...new Set([...mswdoRecipientIds, ...barangayRecipientIds])],
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
  await createNotificationForRole({
    roleCode: ROLE_CODES.MSWDO,
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
  const barangayRecipientIds =
    await notificationRepository.getRecipientUserIdsByRoleCodeAndBarangayIds(
      ROLE_CODES.BARANGAY,
      barangayId ? [barangayId] : [],
    );

  if (barangayRecipientIds.length === 0) {
    return null;
  }

  const normalizedAction = String(action || "registered").toLowerCase();
  const actionLabel =
    normalizedAction === "updated" ? "updated" : "registered";

  await createNotificationForUsers({
    userIds: barangayRecipientIds,
    type: "SYSTEM",
    title: "Household registration update",
    message: `${familyHeadName || "A household"} was ${actionLabel} in the barangay masterlist.`,
    severity: "INFO",
    reference_type: "HOUSEHOLD",
    reference_id: householdId,
  });

  if (requiresVerification) {
    await createNotificationForUsers({
      userIds: barangayRecipientIds,
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

const emitSyncTransactionFailureAlert = async (syncTransaction) => {
  if (!syncTransaction?.user_id) {
    return null;
  }

  return createNotificationForUsers({
    ruleCode: "SYSTEM_ANOMALY",
    userIds: [syncTransaction.user_id],
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

  return createNotificationForUsers({
    ruleCode: "SYNC_CONFLICT",
    userIds: [syncConflict.user_id],
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
  emitSafely,
  emitBatchAlerts,
  emitInventoryTransactionAlerts,
  emitDonationStockUpdate,
  emitDonationSummaryUpdate,
  emitDisasterEventUpdate,
  emitDistributionUpdate,
  emitHouseholdRegistrationUpdate,
  emitSyncTransactionFailureAlert,
  emitSyncConflictAlert,
  seedNotificationRules,
  scanExpiryNotifications,
  scanSyncNotifications,
  initializeNotificationInfrastructure,
  getNotificationsForUser,
  getUnreadCountForUser,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};
