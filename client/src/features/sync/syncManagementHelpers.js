import { LOCAL_SYNC_STATUS } from "../../offline/db";

export const SYNC_FILTERS = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "SYNCED", label: "Synced" },
  { key: "FAILED", label: "Failed" },
  { key: "CONFLICT", label: "Conflict" },
];

export const formatSyncDateTime = (value) => {
  if (!value) {
    return "--";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "--";
  }

  return parsedDate.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const matchesSyncFilter = (status, filterKey) => {
  if (filterKey === "ALL") {
    return true;
  }

  return status === filterKey;
};

export const isSafeRetryableStatus = (status) =>
  status === LOCAL_SYNC_STATUS.PENDING || status === LOCAL_SYNC_STATUS.FAILED;

export const getWinningSide = (conflict) => {
  const winner = conflict?.resolved_payload_json?.winner;

  if (winner === "LOCAL") {
    return "Local";
  }

  if (winner === "SERVER") {
    return "Server";
  }

  return "--";
};

const pickSummaryFields = (payload = {}) => {
  const summary = {};

  [
    "action_key",
    "inventory_item_id",
    "disaster_event_id",
    "donor_name",
    "donor_type",
    "status",
    "quantity_needed",
    "quantity_received",
    "batch_no",
    "item_name",
    "remarks",
    "contact_information",
  ].forEach((key) => {
    if (payload?.[key] !== undefined && payload?.[key] !== null && payload?.[key] !== "") {
      summary[key] = payload[key];
    }
  });

  if (Array.isArray(payload?.items)) {
    summary.items = `${payload.items.length} item(s)`;
  }

  return summary;
};

export const buildPayloadSummary = (payload) => {
  const summary = pickSummaryFields(payload);
  const entries = Object.entries(summary);

  if (entries.length === 0) {
    return "--";
  }

  return entries
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" | ");
};

export const buildConflictPayloadSummary = (payload) => {
  if (!payload || typeof payload !== "object") {
    return "--";
  }

  if (payload.payload && typeof payload.payload === "object") {
    return buildPayloadSummary({
      action_key: payload.action_key,
      ...payload.payload,
    });
  }

  return buildPayloadSummary(payload);
};
