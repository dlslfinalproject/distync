import { LOCAL_SYNC_STATUS } from "./db";

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
  if (status === "RESOLVED") {
    return "RESOLVED";
  }

  if (Object.values(LOCAL_SYNC_STATUS).includes(status)) {
    return status;
  }

  return LOCAL_SYNC_STATUS.SYNCED;
};

export const getSyncLabel = (status) => {
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
