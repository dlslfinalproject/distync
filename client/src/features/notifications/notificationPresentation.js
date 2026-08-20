const CATEGORY_BY_REFERENCE_TYPE = {
  DISASTER_EVENT: "Disaster",
  HOUSEHOLD: "Evacuee Management",
  DISTRIBUTION: "Relief Distribution",
  DISTRIBUTION_TRANSACTION: "Relief Distribution",
  STUB: "Relief Distribution",
  INVENTORY_ITEM: "Inventory",
  INVENTORY_BATCH: "Inventory",
  INVENTORY_TRANSACTION: "Inventory",
  DONATION: "Inventory",
  DONATION_ITEM: "Inventory",
  SYNC_TRANSACTION: "System",
  SYNC_CONFLICT: "System",
};

const CATEGORY_LABELS = {
  DISASTER_COORDINATION: "Disaster Coordination",
  DISASTER_EVENT: "Disaster",
  DISASTER_MANAGEMENT: "Disaster Management",
  DISASTER_MONITORING: "Disaster Monitoring",
  EVACUEE_MASTERLIST: "Evacuee Management",
  EVACUEE_MANAGEMENT: "Evacuee Management",
  INVENTORY: "Inventory",
  INVENTORY_MONITORING: "Inventory Monitoring",
  RELIEF_OPERATIONS: "Relief Operations",
  RELIEF_DISTRIBUTION: "Relief Distribution",
  SETTINGS: "Settings",
  SYNC: "System",
  SYSTEM: "System",
  SYSTEM_MONITORING: "System Monitoring",
  SYSTEM_OPERATIONS: "System Operations",
};

const humanizeCode = (value, fallback = "System") => {
  const text = String(value || "").trim();
  if (!text) return fallback;
  return text
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

export const getNotificationCategoryLabel = (notification) => {
  const categoryLabel = String(notification?.category_label || "").trim();
  if (categoryLabel) return categoryLabel;

  const categoryCode = String(notification?.category_code || "").toUpperCase();
  if (CATEGORY_LABELS[categoryCode]) return CATEGORY_LABELS[categoryCode];

  return getNotificationCategory(notification);
};

export const getNotificationCategory = (notification) =>
  CATEGORY_BY_REFERENCE_TYPE[String(notification?.reference_type || "").toUpperCase()] ||
  "System";

export const getNotificationPriority = (notification) => {
  const priority = String(notification?.severity || "INFO").toUpperCase();
  return priority === "CRITICAL" || priority === "WARNING" ? priority : "INFO";
};

export const getNotificationTypeLabel = (notification) =>
  String(notification?.type || "EVENT").toUpperCase() === "SUMMARY"
    ? "Summary"
    : "Event";

export const getNotificationTitle = (notification) => {
  const title = String(notification?.title || "").trim();
  return title || "Notification";
};

export const getNotificationMessage = (notification) =>
  String(notification?.message || "")
    .replace(/\s+(for|in)\s+(BARANGAY|MSWDO|MAYOR)\b/gi, "")
    .replace(/\b1\s+([a-z ]+?)\s+updates\b/gi, "1 $1 update")
    .replace(/\s{2,}/g, " ")
    .trim();

export const getNotificationCardMessage = (notification) => {
  const message = getNotificationMessage(notification);
  if (String(notification?.type || "").toUpperCase() !== "SUMMARY") return message;
  return message.match(/^.+?[.!?](?:\s|$)/)?.[0]?.trim() || message;
};

export const getRelativeNotificationTime = (value) => {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} hr ago`;
  if (minutes < 2880) return "Yesterday";
  return new Date(value).toLocaleDateString();
};

export const getNotificationPreview = (notification, maxLength = 115) => {
  const message = getNotificationMessage(notification);
  return message.length > maxLength ? `${message.slice(0, maxLength - 1).trim()}…` : message;
};

export const formatNotificationTimestamp = (value) => {
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime())) return "Date unavailable";
  return timestamp.toLocaleString();
};

export const getNotificationMetadata = (notification) => {
  const rows = [];
  const metadata =
    notification?.metadata && typeof notification.metadata === "object"
      ? notification.metadata
      : {};
  const summary = metadata.summary;
  if (summary?.eventCount != null) {
    rows.push({ label: "Events", value: String(summary.eventCount) });
  }
  if (summary?.windowStart && summary?.windowEnd) {
    rows.push({ label: "Summary window", value: `${new Date(summary.windowStart).toLocaleString()} - ${new Date(summary.windowEnd).toLocaleString()}` });
  }
  if (notification?.disaster_event_title) {
    rows.push({ label: "Disaster event", value: notification.disaster_event_title });
  }
  if (notification?.reference_type) {
    rows.push({ label: "Context", value: humanizeCode(notification.reference_type, "Related record") });
  }
  return rows;
};

export const toNotificationViewModel = (notification = {}) => {
  const priority = getNotificationPriority(notification);
  const title = getNotificationTitle(notification);
  const message = getNotificationMessage(notification);

  return {
    id: notification.id,
    unread: !notification.read_at,
    title,
    message,
    cardMessage: getNotificationCardMessage(notification),
    preview: getNotificationPreview(notification),
    priority,
    priorityLabel: priority === "INFO" ? "Info" : humanizeCode(priority),
    typeLabel: getNotificationTypeLabel(notification),
    categoryLabel: getNotificationCategoryLabel(notification),
    timestampLabel: formatNotificationTimestamp(notification.generated_at),
    relativeTimeLabel: getRelativeNotificationTime(notification.generated_at),
    generatedAt: notification.generated_at,
    metadataRows: getNotificationMetadata(notification),
  };
};
