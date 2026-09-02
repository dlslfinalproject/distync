import { LOCAL_SYNC_STATUS } from "../../offline/db.js";
import {
  getUnsupportedOfflineActionMessage,
  isUnsupportedOfflineActionKey,
  isMalformedSyncEntry,
  isNonRetryableSyncEntry,
} from "../../offline/syncQueue.js";
import {
  getSafeSyncErrorMessage,
  isSyncIdempotencyMismatch,
  SYNC_PRESENTATION_MESSAGES,
} from "../../offline/syncStatus.js";

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
  DISASTER_EVENT: "Disaster Event Management",
  DISASTER_EVENTS: "Disaster Event Management",
  INVENTORY: "Inventory",
  INVENTORY_ITEM: "Inventory",
  INVENTORY_ITEMS: "Inventory",
  INVENTORY_TRANSACTION: "Inventory",
  INVENTORY_TRANSACTIONS: "Inventory",
  INVENTORY_BATCH: "Inventory",
  INVENTORY_BATCHES: "Inventory",
};

const ACTION_LABELS = {
  HOUSEHOLD_REGISTER: "Register Family",
  HOUSEHOLD_RE_ADMISSION: "Re-admit Household",
  HOUSEHOLD_UPDATE: "Edit Household",
  HOUSEHOLD_DEPART: "Record Departure",
  STUB_CLAIM: "Confirm Relief Claim",
  DISTRIBUTION_QR_CLAIM: "Confirm QR Relief Claim",
  DISTRIBUTION_CREATE: "Relief Distribution Record",
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
  INVENTORY_BATCH_CREATE: "Add Inventory Batch",
  INVENTORY_TRANSACTION_CREATE: "Inventory Movement",
};

const OPERATION_LABELS = {
  HOUSEHOLD_REGISTER: "Create",
  HOUSEHOLD_RE_ADMISSION: "Create",
  HOUSEHOLD_UPDATE: "Update",
  HOUSEHOLD_DEPART: "Time Out",
  STUB_CLAIM: "Claim",
  DISTRIBUTION_QR_CLAIM: "Claim",
  DISTRIBUTION_CREATE: "Create",
  INVENTORY_ITEM_CREATE: "Create",
  INVENTORY_ITEM_UPDATE: "Update",
  INVENTORY_BATCH_CREATE: "Create",
  INVENTORY_TRANSACTION_CREATE: "Create",
};

const ACTION_SUBJECT_FALLBACKS = {
  HOUSEHOLD_REGISTER: "Household registration",
  HOUSEHOLD_RE_ADMISSION: "New household occurrence",
  HOUSEHOLD_UPDATE: "Household update",
  HOUSEHOLD_DEPART: "Evacuee departure record",
  STUB_CLAIM: "Relief distribution claim",
  DISTRIBUTION_QR_CLAIM: "QR relief claim",
  DISTRIBUTION_CREATE: "Relief distribution record",
  DONATION_CREATE: "Donation record",
  DONATION_UPDATE: "Donation update",
  DONATION_ITEM_CREATE: "Donation item record",
  DONATION_ITEM_UPDATE: "Donation item update",
  DISASTER_EVENT_CREATE: "Disaster event record",
  DISASTER_EVENT_UPDATE: "Disaster event update",
  DISASTER_EVENT_EXTEND: "Disaster event extension",
  DISASTER_EVENT_END: "Disaster event closure",
  INVENTORY_ITEM_CREATE: "Inventory item record",
  INVENTORY_ITEM_UPDATE: "Inventory item update",
  INVENTORY_BATCH_CREATE: "Inventory batch record",
  INVENTORY_TRANSACTION_CREATE: "Inventory movement record",
};

const MAYOR_SYNC_ENTITY_TYPES = new Set([
  "INVENTORY_ITEM",
  "INVENTORY_BATCH",
  "INVENTORY_TRANSACTION",
]);

const MAYOR_SYNC_ACTION_KEYS = new Set([
  "INVENTORY_ITEM_CREATE",
  "INVENTORY_ITEM_UPDATE",
  "INVENTORY_BATCH_CREATE",
  "INVENTORY_TRANSACTION_CREATE",
]);

const MAYOR_SYNC_MODULE_NAMES = new Set(["MAYOR-INVENTORY"]);

const getStoredActionKey = (record = {}) =>
  normalizeKey(
    record.actionKey ||
      record.action_key ||
      record.payload_json?.action_key ||
      record.payload_json?.payload?.action_key ||
      record.payload?.action_key ||
      record.local_payload_json?.action_key,
  );

const getOperationType = (record = {}) =>
  normalizeKey(record.operation_type || record.operationType);

const getActionSubjectFallback = ({ record = {}, actionKey, entityType, recordType }) => {
  const storedActionKey = getStoredActionKey(record);
  const operationType = getOperationType(record);

  if (ACTION_SUBJECT_FALLBACKS[storedActionKey]) {
    return ACTION_SUBJECT_FALLBACKS[storedActionKey];
  }

  if (ACTION_SUBJECT_FALLBACKS[actionKey]) {
    return ACTION_SUBJECT_FALLBACKS[actionKey];
  }

  if (entityType === "HOUSEHOLD" && operationType === "TIME_OUT") {
    return "Evacuee departure record";
  }

  if (["STUB", "DISTRIBUTION_TRANSACTION"].includes(entityType) && operationType === "CLAIM") {
    return "Relief distribution claim";
  }

  if (entityType === "HOUSEHOLD" && operationType === "CREATE") {
    return "Household registration";
  }

  return `${recordType} sync record`;
};

const getOperationLabel = (record = {}, actionKey = "") => {
  const operationType = getOperationType(record);

  if (OPERATION_LABELS[actionKey]) {
    return OPERATION_LABELS[actionKey];
  }

  if (operationType === "TIME_OUT") {
    return "Time Out";
  }

  if (operationType === "QR_SCAN" || operationType === "CLAIM") {
    return "Claim";
  }

  if (operationType === "CREATE" || operationType === "UPDATE") {
    return toTitleCase(operationType);
  }

  return toTitleCase(operationType || "Sync");
};

export const SYNC_MISSING_VALUE = "Not available";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

export const formatSyncHistoryDateTime = (value) => {
  const formattedValue = formatSyncDateTime(value);
  return formattedValue === "--" ? SYNC_MISSING_VALUE : formattedValue;
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
  !isNonRetryableSyncEntry(entry);

const normalizeDisplayText = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const isUuidLikeValue = (value) => uuidPattern.test(String(value || "").trim());

const isMeaningfulDisplayValue = (value) => {
  const normalized = normalizeDisplayText(value);

  return (
    Boolean(normalized) &&
    normalized !== "--" &&
    normalized !== "not available" &&
    normalized !== "n/a" &&
    !isUuidLikeValue(normalized)
  );
};

const asDisplayValue = (value) => {
  if (!isMeaningfulDisplayValue(value)) {
    return SYNC_MISSING_VALUE;
  }

  return String(value).trim();
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
      record.payload_json?.payload?.action_key ||
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
      record.payload_json?.payload?.entity_type ||
      record.payload?.entity_type,
  );

export const isMayorOwnedSyncRecord = (record = {}) => {
  const actionKey = getActionKey(record);
  const entityType = getEntityType(record);
  const moduleName = normalizeKey(
    record.moduleName ||
      record.module_name ||
      record.payload_json?.module_name ||
      record.payload?.module_name,
  );

  return (
    MAYOR_SYNC_ENTITY_TYPES.has(entityType) &&
    (MAYOR_SYNC_ACTION_KEYS.has(actionKey) || MAYOR_SYNC_MODULE_NAMES.has(moduleName))
  );
};

const getFirstValue = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

export const getSyncRecordBarangayId = (record = {}) => {
  const payload = getPayloadContainer(record);
  const value = getFirstValue(
    record.barangay_id,
    record.barangayId,
    record.queueDisplayContext?.barangay_id,
    record.queueDisplayContext?.barangayId,
    payload.barangay_id,
    payload.override_barangay_id,
    payload.barangay?.id,
    payload.household?.barangay_id,
    payload.distribution?.barangay_id,
  );

  return String(value || "").trim() || null;
};

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

const getAffectedPersonName = (payload = {}) =>
  getFirstValue(
    getFamilyHeadName(payload),
    payload.claimed_by_name,
    payload.claimedByName,
    payload.recipient_name,
    payload.recipientName,
    payload.household?.family_head_name,
    payload.household?.familyHeadName,
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
  const payloadJson = record.payload_json || record.local_payload_json || {};
  const actionKey = getActionKey(record);
  const entityType = getEntityType(record);
  const recordType = getRecordTypeLabel(record, payload);
  const familyHeadName = getFamilyHeadName(payload);
  const affectedPersonName = getAffectedPersonName(payload);
  const inventoryItemName = getFirstValue(
    payload.item_name,
    payload.inventory_item_name,
    payload.inventory_item?.item_name,
    payload.item?.item_name,
    payload.item?.name,
    payload.inventory_batch?.inventory_item?.item_name,
    payload.batch?.inventory_item?.item_name,
  );
  const inventoryBatchNo = getFirstValue(
    payload.batch_no,
    payload.inventory_batch_no,
    payload.inventory_batch?.batch_no,
    payload.batch?.batch_no,
  );
  const inventoryTransactionReferenceNo = getFirstValue(
    payload.inventory_transaction_reference_no,
    payload.inventoryTransactionReferenceNo,
    payload.transaction_reference_no,
  );
  const barcode = getFirstValue(
    payload.barcode,
    payload.item_barcode,
    payload.inventory_item?.barcode,
    payload.stock_form?.barcode,
  );
  const stubNumber = getFirstValue(
    payload.display_stub_no,
    payload.display_stub_number,
    payload.stub_no,
    payload.stub_number,
    payload.receipt_no,
    payload.receipt_number,
    payload.stub?.display_stub_number,
    payload.stub?.stub_number,
    payload.distribution?.display_stub_number,
    payload.distribution?.stub_number,
  );
  const barangay = getFirstValue(
    record.barangay_name,
    record.barangayName,
    record.barangay?.name,
    record.queueDisplayContext?.barangay_name,
    record.queueDisplayContext?.barangayName,
    payload.barangay_name,
    payload.barangay,
    payload.barangay?.name,
    payload.assigned_barangay_name,
    payload.assigned_barangay,
    payload.household?.barangay_name,
    payload.household?.barangay?.name,
    payload.household?.assigned_barangay_name,
    payload.distribution?.barangay_name,
    payload.distribution?.barangay?.name,
  );
  const disasterEvent = getFirstValue(
    record.queueDisplayContext?.disaster_event_title,
    record.queueDisplayContext?.disasterEventTitle,
    record.sync_history_disaster_event_title,
    record.disaster_event_title,
    record.disasterEventTitle,
    record.event_title,
    record.eventTitle,
    payloadJson.disaster_event_title,
    payloadJson.disasterEventTitle,
    payloadJson.event_title,
    payloadJson.eventTitle,
    payload.disaster_event_title,
    payload.disaster_event_name,
    payload.event_title,
    payload.event_name,
    payload.disaster_event?.title,
    payload.disaster_event?.name,
    payload.disasterEvent?.title,
    payload.disasterEvent?.name,
    payload.household?.disaster_event_title,
    payload.household?.disaster_event?.title,
    payload.distribution?.disaster_event_title,
    payload.distribution?.disaster_event?.title,
  );
  const subject = getFirstValue(
    affectedPersonName,
    stubNumber,
    inventoryItemName,
    inventoryBatchNo,
    inventoryTransactionReferenceNo,
    payload.title,
    payload.name,
    uuidPattern.test(String(record.entity_server_id || record.entityServerId || ""))
      ? ""
      : record.entity_server_id || record.entityServerId,
    uuidPattern.test(String(record.entity_local_id || record.entityLocalId || ""))
      ? ""
      : record.entity_local_id || record.entityLocalId,
  );
  const fallbackSubject = getActionSubjectFallback({
    record,
    actionKey,
    entityType,
    recordType,
  });
  const primarySubject = asDisplayValue(subject || fallbackSubject);
  const secondaryCandidates = [
    stubNumber ? `Stub No. ${stubNumber}` : "",
    inventoryBatchNo ? `Batch No. ${inventoryBatchNo}` : "",
    inventoryTransactionReferenceNo ? `ITR No. ${inventoryTransactionReferenceNo}` : "",
    barcode ? `Barcode ${barcode}` : "",
    familyHeadName && normalizeDisplayText(familyHeadName) !== normalizeDisplayText(primarySubject)
      ? familyHeadName
      : "",
  ];
  const secondaryLabel =
    secondaryCandidates.find(
      (candidate) =>
        isMeaningfulDisplayValue(candidate) &&
        normalizeDisplayText(candidate) !== normalizeDisplayText(primarySubject),
    ) || "";

  return {
    actionLabel: ACTION_LABELS[actionKey] || toTitleCase(actionKey || "Sync Action"),
    barangay: asDisplayValue(barangay),
    disasterEvent: asDisplayValue(disasterEvent),
    entityType,
    familyHeadName: asDisplayValue(familyHeadName),
    notes: asDisplayValue(
      getUnsupportedOfflineActionMessage(actionKey) ||
        getSafeSyncErrorMessage(record, "") ||
        payload.remarks ||
        "",
    ),
    operation: getOperationLabel(record, actionKey),
    recordType,
    secondaryLabel,
    status: record.status || record.sync_status || record.resolution_status || SYNC_MISSING_VALUE,
    stubNumber: asDisplayValue(stubNumber),
    subject: primarySubject,
  };
};

export const getSyncQueueNotes = (record = {}) => {
  const actionKey = getActionKey(record);
  const status = String(record.status || record.sync_status || "").toUpperCase();

  if (isSyncIdempotencyMismatch(record)) {
    return SYNC_PRESENTATION_MESSAGES.IDEMPOTENCY_MISMATCH;
  }

  if (isMalformedSyncEntry(record)) {
    return SYNC_PRESENTATION_MESSAGES.MALFORMED_ENTRY;
  }

  if (isNonRetryableSyncEntry(record) || isUnsupportedOfflineActionKey(actionKey)) {
    return (
      getUnsupportedOfflineActionMessage(actionKey) ||
      SYNC_PRESENTATION_MESSAGES.UNSUPPORTED
    );
  }

  if (status === LOCAL_SYNC_STATUS.PENDING) {
    return "Waiting for a connection to DISTYNC.";
  }

  if (status === LOCAL_SYNC_STATUS.CONFLICT) {
    return SYNC_PRESENTATION_MESSAGES.CONFLICT;
  }

  if (status === LOCAL_SYNC_STATUS.FAILED) {
    return (
      getSafeSyncErrorMessage(record, SYNC_PRESENTATION_MESSAGES.SERVER) ||
      SYNC_PRESENTATION_MESSAGES.SERVER
    );
  }

  return getSafeSyncErrorMessage(record, "") || "Waiting for synchronization.";
};

const collectUniqueDisplayValues = (values = []) => {
  const seen = new Set();
  const output = [];

  values.forEach((value) => {
    if (!isMeaningfulDisplayValue(value)) {
      return;
    }

    const text = String(value).trim();
    const key = normalizeDisplayText(text);

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    output.push(text);
  });

  return output;
};

export const getSyncHistoryNotes = (record = {}) => {
  const payload = getPayloadContainer(record);
  const details = getSyncRecordDetails(record);
  const excludedValues = [
    details.subject,
    details.secondaryLabel,
    details.familyHeadName,
    details.stubNumber,
    details.barangay,
    details.disasterEvent,
    details.recordType,
    details.actionLabel,
  ].map(normalizeDisplayText);

  const candidateNotes = [
    getUnsupportedOfflineActionMessage(getActionKey(record)),
    getSafeSyncErrorMessage(record, ""),
    payload.remarks,
    payload.status &&
    normalizeDisplayText(payload.status) !== normalizeDisplayText(record.sync_status)
      ? `Record status: ${payload.status}`
      : "",
    payload.quantity_needed || payload.quantity_received
      ? `Quantity: ${payload.quantity_needed || payload.quantity_received}`
      : "",
    payload.quantity ? `Quantity: ${payload.quantity}` : "",
    payload.item_name ? `Item: ${payload.item_name}` : "",
    payload.condition ? `Condition: ${payload.condition}` : "",
    payload.barcode ? `Barcode: ${payload.barcode}` : "",
    payload.source_type ? `Source: ${payload.source_type}` : "",
    Array.isArray(payload.items) && payload.items.length > 0
      ? `${payload.items.length} item(s)`
      : "",
  ];

  const notes = collectUniqueDisplayValues(candidateNotes).filter(
    (note) => !excludedValues.includes(normalizeDisplayText(note.replace(/^Family Head:\s*/i, ""))),
  );

  return notes.length > 0 ? notes : [SYNC_MISSING_VALUE];
};

export const buildSyncSearchText = (
  record = {},
  { includeBarangay = false } = {},
) => {
  const details = getSyncRecordDetails(record);
  const payload = getPayloadContainer(record);
  const { barangay } = details;

  return [
    details.recordType,
    details.actionLabel,
    details.subject,
    details.familyHeadName,
    details.stubNumber,
    details.disasterEvent,
    details.status,
    details.notes,
    details.secondaryLabel,
    includeBarangay ? barangay : "",
    payload.item_name,
    payload.inventory_item_name,
    payload.batch_no,
    payload.inventory_batch_no,
    payload.inventory_transaction_reference_no,
    payload.barcode,
    payload.condition,
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
  const entityType = getEntityType(record);
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
    return recordType === "Inventory" || entityType.startsWith("INVENTORY");
  }

  if (normalizedFilter === "INVENTORY_ITEM") {
    return entityType === "INVENTORY_ITEM";
  }

  if (normalizedFilter === "INVENTORY_BATCH") {
    return entityType === "INVENTORY_BATCH";
  }

  if (normalizedFilter === "INVENTORY_TRANSACTION") {
    return entityType === "INVENTORY_TRANSACTION";
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

export const getConflictReasonLabel = (conflict) => {
  if (conflict?.conflict_type === "POSSIBLE_CROSS_BARANGAY_HOUSEHOLD_DUPLICATE") {
    return "Possible Cross-Barangay Duplicate";
  }

  if (conflict?.conflict_type === "UPDATED_AT_MISMATCH") {
    return "Record Changed in Two Places";
  }

  if (conflict?.conflict_type === "DUPLICATE_CLAIM") {
    return "Duplicate Relief Claim";
  }

  if (conflict?.conflict_type === "DUPLICATE_HOUSEHOLD_REGISTRATION") {
    return "Duplicate Household Registration";
  }

  return toTitleCase(conflict?.conflict_type || "--");
};

export const getConflictExplanation = (conflict) => {
  if (
    conflict?.conflict_type === "POSSIBLE_CROSS_BARANGAY_HOUSEHOLD_DUPLICATE" &&
    conflict?.resolved_payload_json?.automatic
  ) {
    return "The same household was registered under different Barangays for the same disaster event.";
  }

  if (conflict?.error_message && !isUuidLikeValue(conflict.error_message)) {
    return conflict.error_message;
  }

  if (conflict?.conflict_type === "DUPLICATE_HOUSEHOLD_REGISTRATION") {
    return "A household with matching information was already recorded for this disaster event.";
  }

  if (conflict?.conflict_type === "POSSIBLE_CROSS_BARANGAY_HOUSEHOLD_DUPLICATE") {
    return "The same household was registered under different Barangays for the same disaster event.";
  }

  if (conflict?.conflict_type === "DUPLICATE_CLAIM") {
    return "A relief claim for the same stub was already recorded in DISTYNC.";
  }

  if (conflict?.conflict_type === "UPDATED_AT_MISMATCH") {
    return "This device and DISTYNC both had changes for the same record before synchronization completed.";
  }

  if (conflict?.conflict_type === "INVENTORY_STOCK_STATE_DRIFT") {
    return "The available stock in DISTYNC changed before this offline inventory action could be synchronized.";
  }

  return "DISTYNC found a conflict while synchronizing this record.";
};

export const getResolutionStatusLabel = (conflict) => {
  if (
    conflict?.status === "RESOLVED" &&
    conflict?.resolved_payload_json?.automatic
  ) {
    return "Resolved";
  }

  if (conflict?.status === "RESOLVED") {
    return "Resolved";
  }

  if (conflict?.status === "OPEN") {
    return "Open";
  }

  return toTitleCase(conflict?.status || "--");
};

const getConflictWinner = (conflict = {}) =>
  normalizeKey(conflict.resolved_payload_json?.winner);

export const getConflictResolutionSummary = (conflict = {}) => {
  const isResolved = conflict.status === "RESOLVED";
  const winner = getConflictWinner(conflict);
  const strategy = normalizeKey(conflict.resolution_strategy);
  const action = normalizeKey(conflict.resolution_action);
  const canResolve = Array.isArray(conflict.availableResolutionActions) &&
    conflict.availableResolutionActions.length > 0;

  if (isResolved && conflict.resolved_payload_json?.automatic) {
    const retained = conflict.resolved_payload_json.result ===
      "EARLIER_REGISTRATION_RETAINED";
    return {
      result: retained ? "Earlier Registration Retained" : "Resolved as Duplicate",
      whatHappened:
        "DISTYNC retained the registration with the earlier valid registration time and automatically resolved the later registration as a duplicate.",
    };
  }

  if (!isResolved) {
    return {
      result: canResolve ? "Review still needed" : "Waiting for authorized review",
      whatHappened: canResolve
        ? "Review the record comparison, then choose an available action when you are ready."
        : "This conflict is open. Only an authorized reviewer can close it.",
    };
  }

  if (winner === "SERVER" || strategy === "FIRST_ACCEPTED" || action === "KEEP_SERVER") {
    return {
      result: "Saved DISTYNC record kept",
      whatHappened:
        "DISTYNC kept the first valid saved record to prevent duplicate or conflicting data.",
    };
  }

  if (winner === "LOCAL" || action === "APPLY_LOCAL") {
    return {
      result: "This device record applied",
      whatHappened:
        "The synchronized record from this device was accepted after review.",
    };
  }

  if (action === "MARK_REVIEWED") {
    return {
      result: "Conflict reviewed",
      whatHappened:
        "An authorized reviewer checked the conflict and closed it without changing the saved DISTYNC record.",
    };
  }

  if (strategy === "LATEST_TIMESTAMP") {
    return {
      result: "Latest valid record kept",
      whatHappened:
        "DISTYNC compared the record times and kept the latest valid information.",
    };
  }

  return {
    result: "Conflict resolved",
    whatHappened:
      "DISTYNC completed the conflict review and kept the authorized saved result.",
  };
};

const getComparisonPayload = (payload = {}) => {
  if (payload?.payload && typeof payload.payload === "object") {
    return {
      action_key: payload.action_key,
      ...payload.payload,
    };
  }

  return payload && typeof payload === "object" ? payload : {};
};

const pickComparisonValue = (payload = {}, keys = []) => {
  for (const key of keys) {
    const value = key.split(".").reduce((current, segment) => current?.[segment], payload);

    if (isMeaningfulDisplayValue(value)) {
      return String(value).trim();
    }
  }

  return "";
};

const getPayloadComparisonDetails = (payload = {}) => {
  const normalizedPayload = getComparisonPayload(payload);
  const details = getSyncRecordDetails({ payload: normalizedPayload });

  return {
    familyHead: details.familyHeadName,
    stubNumber: details.stubNumber,
    barangay: asDisplayValue(normalizedPayload.barangay_name) !== SYNC_MISSING_VALUE
      ? asDisplayValue(normalizedPayload.barangay_name)
      : details.barangay,
    disasterEvent: asDisplayValue(normalizedPayload.disaster_event_title) !== SYNC_MISSING_VALUE
      ? asDisplayValue(normalizedPayload.disaster_event_title)
      : details.disasterEvent,
    status: asDisplayValue(normalizedPayload.status),
    remarks: asDisplayValue(normalizedPayload.remarks),
    item: asDisplayValue(normalizedPayload.item_name),
    quantity: asDisplayValue(
      normalizedPayload.quantity ||
        normalizedPayload.quantity_needed ||
        normalizedPayload.quantity_received,
    ),
    batchNo: asDisplayValue(normalizedPayload.batch_no),
    donorName: asDisplayValue(normalizedPayload.donor_name),
    updatedAt: formatSyncHistoryDateTime(normalizedPayload.updated_at),
    registeredAt: formatSyncHistoryDateTime(normalizedPayload.registered_at),
    householdSize: asDisplayValue(normalizedPayload.household_size),
    address: asDisplayValue(normalizedPayload.current_address_details),
    result: asDisplayValue(normalizedPayload.result),
    receiptNo: asDisplayValue(
      pickComparisonValue(normalizedPayload, [
        "receipt_no",
        "receipt_number",
        "distribution.receipt_no",
        "distribution.receipt_number",
      ]),
    ),
  };
};

export const getConflictComparisonRows = (conflict = {}) => {
  if (
    conflict?.conflict_type === "POSSIBLE_CROSS_BARANGAY_HOUSEHOLD_DUPLICATE" &&
    conflict?.resolved_payload_json?.automatic
  ) {
    const earlier = getPayloadComparisonDetails(
      conflict.resolved_payload_json.earlier_registration,
    );
    const later = getPayloadComparisonDetails(
      conflict.resolved_payload_json.later_registration,
    );
    const fields = [
      ["Family Head", "familyHead"],
      ["Barangay", "barangay"],
      ["Disaster Event", "disasterEvent"],
      ["Registered At", "registeredAt"],
      ["Household Size", "householdSize"],
      ["Address", "address"],
      ["Result", "result"],
    ];

    return fields.map(([label, key]) => ({
      label,
      localValue: key === "result"
        ? "Retained"
        : earlier[key],
      serverValue: key === "result"
        ? "Resolved as Duplicate"
        : later[key],
    }));
  }

  const localDetails = getPayloadComparisonDetails(conflict.local_payload_json);
  const serverDetails = getPayloadComparisonDetails(conflict.server_payload_json);
  const fields = [
    ["Family Head", "familyHead"],
    ["Stub No.", "stubNumber"],
    ["Receipt No.", "receiptNo"],
    ["Barangay", "barangay"],
    ["Disaster Event", "disasterEvent"],
    ["Status", "status"],
    ["Remarks", "remarks"],
    ["Item", "item"],
    ["Quantity", "quantity"],
    ["Batch No.", "batchNo"],
    ["Donor", "donorName"],
    ["Last Updated", "updatedAt"],
  ];

  return fields
    .map(([label, key]) => ({
      label,
      localValue: localDetails[key],
      serverValue: serverDetails[key],
    }))
    .filter(
      (row) =>
        row.localValue !== SYNC_MISSING_VALUE ||
        row.serverValue !== SYNC_MISSING_VALUE,
    );
};
