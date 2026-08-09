import { LOCAL_SYNC_STATUS } from "../../offline/db.js";
import {
  getUnsupportedOfflineActionMessage,
  isUnsupportedOfflineActionKey,
} from "../../offline/syncQueue.js";

export const SYNC_FILTERS = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "SYNCED", label: "Synced" },
  { key: "FAILED", label: "Failed" },
  { key: "CONFLICT", label: "Conflict" },
  { key: "RESOLVED", label: "Resolved" },
];

const RECORD_TYPE_LABELS = {
  HOUSEHOLD: "Evacuee Masterlist",
  HOUSEHOLDS: "Evacuee Masterlist",
  HOUSEHOLD_REGISTRATION: "Evacuee Masterlist",
  EVACUEE_MASTERLIST: "Evacuee Masterlist",
  RELIEF_DISTRIBUTION: "Relief Goods Distribution",
  RELIEF_GOODS_DISTRIBUTION: "Relief Goods Distribution",
  DISTRIBUTION: "Relief Goods Distribution",
  STUB: "Relief Goods Distribution",
  STUBS: "Relief Goods Distribution",
  DONATION: "Donation Management",
  DONATION_ITEM: "Donation Management",
  DONATION_NEED: "Donation Management",
  DISASTER_EVENT: "Disaster Event Management",
  DISASTER_EVENTS: "Disaster Event Management",
  INVENTORY: "Inventory",
  INVENTORY_ITEM: "Inventory",
  INVENTORY_ITEMS: "Inventory",
  INVENTORY_TRANSACTION: "Inventory",
  INVENTORY_TRANSACTIONS: "Inventory",
};

const ACTION_LABELS = {
  HOUSEHOLD_REGISTER: "Register Family",
  HOUSEHOLD_UPDATE: "Edit Household",
  HOUSEHOLD_DEPART: "Record Departure",
  STUB_CLAIM: "Confirm Relief Claim",
  DISTRIBUTION_QR_CLAIM: "Confirm QR Relief Claim",
  DISTRIBUTION_CREATE: "Relief Distribution Record",
  DONATION_NEED_CREATE: "Create Donation Need",
  DONATION_NEED_UPDATE: "Edit Donation Need",
  DONATION_CREATE: "Record Donation",
  DONATION_UPDATE: "Edit Donation",
  DONATION_ITEM_CREATE: "Add Donation Item",
  DONATION_ITEM_UPDATE: "Edit Donation Item",
  DISASTER_EVENT_CREATE: "Create Disaster Event",
  DISASTER_EVENT_UPDATE: "Edit Disaster Event",
  DISASTER_EVENT_EXTEND: "Extend Disaster Event",
  DISASTER_EVENT_END: "End Disaster Event",
  INVENTORY_ITEM_CREATE: "Add Inventory Item",
  INVENTORY_ITEM_UPDATE: "Edit Inventory Item",
  INVENTORY_TRANSACTION_CREATE: "Inventory Movement",
};

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

  if (filterKey === "CONFLICT") {
    return status === "CONFLICT" || status === LOCAL_SYNC_STATUS.CONFLICT;
  }

  if (filterKey === "RESOLVED") {
    return status === "RESOLVED";
  }

  return status === filterKey;
};

export const isSafeRetryableStatus = (status) =>
  status === LOCAL_SYNC_STATUS.FAILED;

export const isSafeRetryableQueueEntry = (entry = {}) =>
  isSafeRetryableStatus(entry.status) &&
  !isUnsupportedOfflineActionKey(entry.actionKey);

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

const asDisplayValue = (value) => {
  if (value === undefined || value === null || value === "") {
    return "--";
  }

  return String(value);
};

const normalizeKey = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

const toTitleCase = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const getPayloadContainer = (record = {}) => {
  const payload = record.payload_json || record.payload || record.local_payload_json || record;

  if (payload?.payload && typeof payload.payload === "object") {
    return payload.payload;
  }

  return payload && typeof payload === "object" ? payload : {};
};

const getActionKey = (record = {}) =>
  normalizeKey(
    record.actionKey ||
      record.action_key ||
      record.operation_type ||
      record.payload_json?.action_key ||
      record.payload?.action_key ||
      record.local_payload_json?.action_key,
  );

const getEntityType = (record = {}) =>
  normalizeKey(
    record.entityType ||
      record.entity_type ||
      record.moduleName ||
      record.module_name ||
      record.payload_json?.entity_type ||
      record.payload?.entity_type,
  );

const getFirstValue = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

const getPersonName = (person = {}) =>
  [
    person.first_name || person.firstName,
    person.middle_name || person.middleName,
    person.last_name || person.lastName,
    person.suffix,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

const getFamilyHeadName = (payload = {}) =>
  getFirstValue(
    payload.family_head_name,
    payload.familyHeadName,
    payload.household?.family_head_name,
    payload.household?.familyHeadName,
    payload.family_head?.full_name,
    payload.family_head?.name,
    payload.familyHead?.fullName,
    payload.familyHead?.name,
    getPersonName(payload.family_head),
    getPersonName(payload.familyHead),
  );

const getRecordTypeLabel = (record = {}, payload = {}) => {
  const actionKey = getActionKey(record);
  const entityType = getEntityType(record);

  if (ACTION_LABELS[actionKey]?.includes("Relief") || actionKey.includes("STUB")) {
    return "Relief Goods Distribution";
  }

  if (actionKey.includes("HOUSEHOLD")) {
    return "Evacuee Masterlist";
  }

  if (actionKey.includes("DISASTER_EVENT")) {
    return "Disaster Event Management";
  }

  if (actionKey.includes("DONATION")) {
    return "Donation Management";
  }

  if (actionKey.includes("INVENTORY")) {
    return "Inventory";
  }

  return (
    RECORD_TYPE_LABELS[entityType] ||
    RECORD_TYPE_LABELS[normalizeKey(payload.module_name)] ||
    toTitleCase(entityType || payload.entity_type || payload.module_name || "Sync Record")
  );
};

export const getSyncRecordDetails = (record = {}) => {
  const payload = getPayloadContainer(record);
  const actionKey = getActionKey(record);
  const entityType = getEntityType(record);
  const recordType = getRecordTypeLabel(record, payload);
  const familyHeadName = getFamilyHeadName(payload);
  const stubNumber = getFirstValue(
    payload.display_stub_number,
    payload.stub_number,
    payload.stub?.display_stub_number,
    payload.stub?.stub_number,
    payload.distribution?.display_stub_number,
    payload.distribution?.stub_number,
  );
  const barangay = getFirstValue(
    payload.barangay_name,
    payload.barangay,
    payload.assigned_barangay_name,
    payload.assigned_barangay,
    payload.household?.barangay_name,
    payload.household?.assigned_barangay_name,
    payload.distribution?.barangay_name,
  );
  const disasterEvent = getFirstValue(
    payload.disaster_event_title,
    payload.disaster_event_name,
    payload.event_title,
    payload.event_name,
    payload.disaster_event?.title,
    payload.disaster_event?.name,
    payload.household?.disaster_event_title,
  );
  const subject = getFirstValue(
    familyHeadName,
    stubNumber,
    payload.item_name,
    payload.title,
    payload.name,
    record.entity_server_id,
    record.entityServerId,
    record.entity_local_id,
    record.entityLocalId,
  );

  return {
    actionLabel: ACTION_LABELS[actionKey] || toTitleCase(actionKey || "Sync Action"),
    barangay: asDisplayValue(barangay),
    disasterEvent: asDisplayValue(disasterEvent),
    entityType,
    familyHeadName: asDisplayValue(familyHeadName),
    notes: asDisplayValue(
      getUnsupportedOfflineActionMessage(actionKey) ||
        record.lastError ||
        record.serverMessage ||
        record.error_message ||
        payload.remarks ||
        payload.status ||
        record.entity_server_id ||
        record.entityServerId ||
        record.entity_local_id ||
        record.entityLocalId,
    ),
    recordType,
    status: record.status || record.sync_status || record.resolution_status || "--",
    stubNumber: asDisplayValue(stubNumber),
    subject: asDisplayValue(subject),
  };
};

export const buildSyncSearchText = (record = {}) => {
  const details = getSyncRecordDetails(record);
  const payload = getPayloadContainer(record);

  return [
    details.recordType,
    details.actionLabel,
    details.subject,
    details.familyHeadName,
    details.stubNumber,
    details.barangay,
    details.disasterEvent,
    details.status,
    details.notes,
    payload.sectors_text,
    payload.sectors,
    payload.relief_pack,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
};

export const matchesRecordTypeFilter = (record = {}, filterValue = "ALL") => {
  if (filterValue === "ALL") {
    return true;
  }

  const recordType = getSyncRecordDetails(record).recordType;
  const normalizedFilter = normalizeKey(filterValue);

  if (normalizedFilter === "EVACUEE_MASTERLIST") {
    return recordType === "Evacuee Masterlist";
  }

  if (normalizedFilter === "RELIEF_GOODS_DISTRIBUTION") {
    return recordType === "Relief Goods Distribution";
  }

  if (normalizedFilter === "DISASTER_EVENT") {
    return recordType === "Disaster Event Management";
  }

  if (normalizedFilter === "INVENTORY") {
    return recordType === "Inventory";
  }

  return true;
};

const pickSummaryFields = (payload = {}) => {
  const details = getSyncRecordDetails({ payload });
  const summary = {};

  [
    ["family_head", details.familyHeadName],
    ["stub_number", details.stubNumber],
    ["barangay", details.barangay],
    ["disaster_event", details.disasterEvent],
    ["status", payload.status],
    ["quantity", payload.quantity_needed || payload.quantity_received],
    ["item", payload.item_name],
  ].forEach(([key, value]) => {
    if (value && value !== "--") {
      summary[key] = value;
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
    .map(([key, value]) => `${toTitleCase(key)}: ${String(value)}`)
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

export const getConflictReasonLabel = (conflict) => {
  if (conflict?.conflict_type === "UPDATED_AT_MISMATCH") {
    return "Latest timestamp conflict between offline and saved records.";
  }

  if (conflict?.conflict_type === "DUPLICATE_CLAIM") {
    return "Possible duplicate relief claim for the same stub.";
  }

  return toTitleCase(conflict?.conflict_type || "--");
};

export const getResolutionStatusLabel = (conflict) => {
  if (conflict?.status === "RESOLVED") {
    return "Resolved";
  }

  if (conflict?.status === "OPEN") {
    return "For Review";
  }

  return toTitleCase(conflict?.status || "--");
};
