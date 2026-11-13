const NOTIFICATION_TYPES = Object.freeze({
  EVENT: "EVENT",
  INVENTORY: "INVENTORY",
  EXPIRY: "EXPIRY",
  SYNC: "SYNC",
  ANOMALY: "ANOMALY",
  SYSTEM: "SYSTEM",
  SUMMARY: "SUMMARY",
});

const VALID_NOTIFICATION_TYPES = new Set(Object.values(NOTIFICATION_TYPES));

const isValidNotificationType = (value) => VALID_NOTIFICATION_TYPES.has(value);

const assertValidNotificationType = (value) => {
  if (!isValidNotificationType(value)) {
    const error = new Error(`Unsupported notification type: ${value}`);
    error.statusCode = 400;
    throw error;
  }
};

module.exports = {
  NOTIFICATION_TYPES,
  VALID_NOTIFICATION_TYPES,
  isValidNotificationType,
  assertValidNotificationType,
};
