const notificationRepository = require("./notification.repository");
const { ROLE_CODES } = require("../auth/auth.middleware");

const LOW_STOCK_THRESHOLD = 10;
const CRITICAL_STOCK_THRESHOLD = 5;
const NEAR_EXPIRY_DAYS = 14;

const toDisplayQuantity = (value) => Number(value || 0).toLocaleString();

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

  if (recipientIds.length === 0) {
    return null;
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
    recipientIds,
  );

  return createdNotification;
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

  if (
    batch.status === "EXPIRED" &&
    previousStatus !== "EXPIRED"
  ) {
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

  if (["DAMAGED", "MISSING", "SPOILED", "STOLEN"].includes(transaction.transaction_type)) {
    const alertLabel = transaction.transaction_type.toLowerCase();
    const severity =
      transaction.transaction_type === "MISSING" || transaction.transaction_type === "STOLEN"
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

const getNotificationsForMayor = async (userId, filters) => {
  return notificationRepository.getNotificationsForUser(userId, filters);
};

const getUnreadCountForMayor = async (userId) => {
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
  emitSafely,
  emitBatchAlerts,
  emitInventoryTransactionAlerts,
  emitDonationStockUpdate,
  emitDonationSummaryUpdate,
  getNotificationsForMayor,
  getUnreadCountForMayor,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};
