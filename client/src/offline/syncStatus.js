import { LOCAL_SYNC_STATUS } from "./db.js";

export const SYNC_PRESENTATION_MESSAGES = Object.freeze({
  NETWORK: "Could not connect to DISTYNC. Reconnect and try again.",
  SERVER: "Synchronization could not be completed. Try again.",
  IDEMPOTENCY_MISMATCH:
    "This action cannot be retried because its synchronization information no longer matches the original request. Review the related record while online.",
  VALIDATION:
    "Some information could not be synchronized. Review the related record while online.",
  CONFLICT:
    "A synchronization conflict was detected. Review it in Conflict Review.",
  UNSUPPORTED:
    "This offline action cannot be retried here. Complete it from the related module while online.",
  OFFLINE: "You are currently offline. Reconnect before retrying.",
});

export const SYNC_ERROR_CODES = Object.freeze({
  IDEMPOTENCY_MISMATCH: "IDEMPOTENCY_KEY_REUSE_MISMATCH",
});

const NETWORK_ERROR_PATTERNS = [
  "failed to fetch",
  "networkerror",
  "network error",
  "load failed",
  "econnrefused",
  "enotfound",
  "timeout",
  "timed out",
];

const TECHNICAL_ERROR_PATTERNS = [
  "current transaction is aborted",
  "sqlstate",
  "postgres",
  "database",
  "relation ",
  "column ",
  "constraint",
  "syntax error",
  "stack trace",
  "axios",
];

const getRawSyncErrorText = (source = {}) =>
  String(
    source?.message ||
      source?.lastError ||
      source?.serverMessage ||
      source?.error_message ||
      "",
  ).trim();

export const isSyncIdempotencyMismatch = (source = {}) => {
  const code = String(
    source?.code ||
      source?.errorCode ||
      source?.error_code ||
      source?.lastErrorCode ||
      "",
  ).toUpperCase();

  if (code === SYNC_ERROR_CODES.IDEMPOTENCY_MISMATCH) {
    return true;
  }

  // Older responses did not include a code. Keep this narrow fallback only so
  // an already-persisted legacy queue row is not offered an endless retry.
  const rawMessage = getRawSyncErrorText(source).toLowerCase();
  return (
    rawMessage.includes("client_sync_id") &&
    rawMessage.includes("different sync request")
  );
};

export const getSafeSyncErrorMessage = (source = {}, fallback = "") => {
  const rawMessage = getRawSyncErrorText(source);
  const normalizedMessage = rawMessage.toLowerCase();
  const code = String(
    source?.code ||
      source?.errorCode ||
      source?.error_code ||
      source?.lastErrorCode ||
      "",
  ).toUpperCase();
  const statusCode = Number(
    source?.statusCode ||
      source?.httpStatus ||
      source?.status_code ||
      source?.lastErrorStatusCode ||
      0,
  );
  const syncStatus = String(source?.sync_status || source?.status || "").toUpperCase();

  if (isSyncIdempotencyMismatch(source)) {
    return SYNC_PRESENTATION_MESSAGES.IDEMPOTENCY_MISMATCH;
  }

  if (syncStatus === LOCAL_SYNC_STATUS.CONFLICT || code.includes("CONFLICT")) {
    return SYNC_PRESENTATION_MESSAGES.CONFLICT;
  }

  if (
    code.includes("NOT_SUPPORTED") ||
    code.includes("LEGACY") ||
    source?.isRetryable === false
  ) {
    return SYNC_PRESENTATION_MESSAGES.UNSUPPORTED;
  }

  if (NETWORK_ERROR_PATTERNS.some((pattern) => normalizedMessage.includes(pattern))) {
    return SYNC_PRESENTATION_MESSAGES.NETWORK;
  }

  if (
    TECHNICAL_ERROR_PATTERNS.some((pattern) => normalizedMessage.includes(pattern)) ||
    statusCode >= 500
  ) {
    return SYNC_PRESENTATION_MESSAGES.SERVER;
  }

  if (
    statusCode === 400 ||
    code.includes("VALIDATION")
  ) {
    return SYNC_PRESENTATION_MESSAGES.VALIDATION;
  }

  return rawMessage || fallback;
};

const STATUS_PRIORITY = {
  [LOCAL_SYNC_STATUS.CONFLICT]: 4,
  [LOCAL_SYNC_STATUS.FAILED]: 3,
  [LOCAL_SYNC_STATUS.PENDING]: 2,
  [LOCAL_SYNC_STATUS.SYNCED]: 1,
};

export const SYNC_STATUS_LABELS = {
  [LOCAL_SYNC_STATUS.SYNCED]: "Synced",
  [LOCAL_SYNC_STATUS.PENDING]: "Pending Sync",
  [LOCAL_SYNC_STATUS.FAILED]: "Failed Sync",
  [LOCAL_SYNC_STATUS.CONFLICT]: "Conflict",
};

export const getNormalizedSyncStatus = (status) => {
  if (status === "OPEN") {
    return "OPEN";
  }

  if (status === "RESOLVED") {
    return "RESOLVED";
  }

  if (Object.values(LOCAL_SYNC_STATUS).includes(status)) {
    return status;
  }

  return LOCAL_SYNC_STATUS.SYNCED;
};

export const getSyncLabel = (status) => {
  if (status === "OPEN") {
    return "Open";
  }

  if (status === "RESOLVED") {
    return "Resolved";
  }

  return SYNC_STATUS_LABELS[getNormalizedSyncStatus(status)];
};

export const formatSyncStatusCount = (count, type) => {
  if (type === "pending") {
    if (count === 0) {
      return "All changes synced";
    }

    if (count === 1) {
      return "1 pending entry";
    }

    return `${count} pending entries`;
  }

  if (type === "failed") {
    if (count === 0) {
      return "No failed sync";
    }

    if (count === 1) {
      return "1 failed entry";
    }

    return `${count} failed entries`;
  }

  if (type === "conflict") {
    if (count === 0) {
      return "No conflicts";
    }

    if (count === 1) {
      return "1 conflict";
    }

    return `${count} conflicts`;
  }

  return "";
};

export const getSyncStatusSummaryMessage = ({
  pending = 0,
  failed = 0,
  conflicts = 0,
} = {}) => {
  return getSyncHealthPresentation({ pending, failed, conflicts }).message;
};

export const SYNC_HEALTH_STATES = Object.freeze({
  HEALTHY: "HEALTHY",
  PENDING: "PENDING",
  FAILED: "FAILED",
  CONFLICT: "CONFLICT",
  ATTENTION: "ATTENTION",
  LOADING: "LOADING",
  UNAVAILABLE: "UNAVAILABLE",
});

const normalizeSyncHealthCount = (count) => {
  const normalizedCount = Number(count);
  return Number.isFinite(normalizedCount) && normalizedCount > 0
    ? Math.floor(normalizedCount)
    : 0;
};

const buildSyncHealthBadges = ({ pending, failed, conflicts, isHealthy }) => {
  if (isHealthy) {
    return [{ type: "healthy", label: "All changes synced" }];
  }

  const badges = [];

  if (failed > 0) {
    badges.push({
      type: "failed",
      label: `${failed} ${failed === 1 ? "failed" : "failed"}`,
    });
  }

  if (conflicts > 0) {
    badges.push({
      type: "conflict",
      label: `${conflicts} ${conflicts === 1 ? "conflict" : "conflicts"}`,
    });
  }

  if (pending > 0) {
    badges.push({
      type: "pending",
      label: `${pending} pending`,
    });
  }

  return badges;
};

export const getSyncHealthPresentation = ({
  pending = 0,
  failed = 0,
  conflicts = 0,
  isLoading = false,
  hasError = false,
  lastSuccessfulSyncAt = null,
} = {}) => {
  const pendingCount = normalizeSyncHealthCount(pending);
  const failedCount = normalizeSyncHealthCount(failed);
  const conflictCount = normalizeSyncHealthCount(conflicts);
  const outstandingStateCount = [pendingCount, failedCount, conflictCount].filter(
    (count) => count > 0,
  ).length;
  const isHealthy =
    !isLoading &&
    !hasError &&
    pendingCount === 0 &&
    failedCount === 0 &&
    conflictCount === 0;

  let state = SYNC_HEALTH_STATES.HEALTHY;
  let message = "All changes are synchronized.";

  if (isLoading) {
    state = SYNC_HEALTH_STATES.LOADING;
    message = "Checking synchronization status.";
  } else if (hasError) {
    state = SYNC_HEALTH_STATES.UNAVAILABLE;
    message = "Synchronization status is currently unavailable.";
  } else if (outstandingStateCount > 1) {
    state = SYNC_HEALTH_STATES.ATTENTION;
    message = "Some changes are waiting or need attention.";
  } else if (failedCount > 0) {
    state = SYNC_HEALTH_STATES.FAILED;
    message = "Synchronization needs attention.";
  } else if (conflictCount > 0) {
    state = SYNC_HEALTH_STATES.CONFLICT;
    message = "A synchronization conflict needs review.";
  } else if (pendingCount > 0) {
    state = SYNC_HEALTH_STATES.PENDING;
    message = "Synchronization is still processing.";
  }

  return {
    state,
    message,
    badges: buildSyncHealthBadges({
      pending: pendingCount,
      failed: failedCount,
      conflicts: conflictCount,
      isHealthy,
    }),
    needsAttention: !isLoading && !isHealthy,
    isHealthy,
    pendingCount,
    failedCount,
    conflictCount,
    lastSuccessfulSyncAt,
  };
};

export const formatCompactSyncChipLabel = (count, type) => {
  if (type === "synced") {
    return "🟢 All changes synced";
  }

  if (type === "pending") {
    return `🟡 ${count} pending`;
  }

  if (type === "failed") {
    return `🔴 ${count} failed`;
  }

  if (type === "conflict") {
    return `🟠 ${count} ${count === 1 ? "conflict" : "conflicts"}`;
  }

  return "";
};

export const getSyncBadgePalette = (status) => {
  if (status === "OPEN") {
    return {
      backgroundColor: "#fef3c7",
      color: "#92400e",
      borderColor: "#fde68a",
    };
  }

  if (status === "RESOLVED") {
    return {
      backgroundColor: "#eef6ff",
      color: "#1d4f91",
      borderColor: "#cfe0fb",
    };
  }

  const normalizedStatus = getNormalizedSyncStatus(status);

  if (normalizedStatus === LOCAL_SYNC_STATUS.PENDING) {
    return {
      backgroundColor: "#e0f2fe",
      color: "#075985",
      borderColor: "#bae6fd",
    };
  }

  if (normalizedStatus === LOCAL_SYNC_STATUS.FAILED) {
    return {
      backgroundColor: "#fff3f1",
      color: "#a14538",
      borderColor: "#f4c9c2",
    };
  }

  if (normalizedStatus === LOCAL_SYNC_STATUS.CONFLICT) {
    return {
      backgroundColor: "#fef3c7",
      color: "#92400e",
      borderColor: "#fde68a",
    };
  }

  return {
    backgroundColor: "#e6f5ec",
    color: "#2d7a4f",
    borderColor: "#ccebd9",
  };
};

const getComparableTimestamp = (entry) => {
  const rawValue =
    entry?.updatedAt ||
    entry?.syncedAt ||
    entry?.clientTimestamp ||
    entry?.createdAt ||
    null;

  if (!rawValue) {
    return 0;
  }

  const parsedDate = new Date(rawValue);
  return Number.isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime();
};

export const pickMostRelevantSyncEntry = (entries = []) => {
  if (!Array.isArray(entries) || entries.length === 0) {
    return null;
  }

  return [...entries].sort((left, right) => {
    const leftPriority =
      STATUS_PRIORITY[getNormalizedSyncStatus(left?.status)] || 0;
    const rightPriority =
      STATUS_PRIORITY[getNormalizedSyncStatus(right?.status)] || 0;

    if (leftPriority !== rightPriority) {
      return rightPriority - leftPriority;
    }

    return getComparableTimestamp(right) - getComparableTimestamp(left);
  })[0];
};

export const findSyncEntry = (syncEntries = [], predicate = () => false) => {
  return pickMostRelevantSyncEntry(syncEntries.filter(predicate));
};

export const buildSyncDescriptor = (entry) => {
  const normalizedStatus = getNormalizedSyncStatus(entry?.status);

  return {
    status: normalizedStatus,
    label: getSyncLabel(normalizedStatus),
    entry: entry || null,
    isPending: normalizedStatus === LOCAL_SYNC_STATUS.PENDING,
    isFailed: normalizedStatus === LOCAL_SYNC_STATUS.FAILED,
    isConflict: normalizedStatus === LOCAL_SYNC_STATUS.CONFLICT,
    isSynced: normalizedStatus === LOCAL_SYNC_STATUS.SYNCED,
  };
};
