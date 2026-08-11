const systemLogRepository = require("../repositories/systemLog.repository");

const buildPerformedByLabel = (row) => {
  if (row.first_name || row.last_name) {
    return [row.first_name, row.last_name].filter(Boolean).join(" ");
  }

  return row.email || "System";
};

const buildValueSummary = (payload = {}) => {
  const keys = Object.keys(payload || {});

  if (!keys.length) {
    return "-";
  }

  return keys.slice(0, 4).join(", ");
};

const INVENTORY_FIELD_LABELS = {
  item_name: "Item Name",
  reorder_level: "Reorder Level",
};

const INVENTORY_ITEM_EDIT_AUDIT_FIELDS = Object.keys(INVENTORY_FIELD_LABELS);

const RELIEF_PACK_FIELD_LABELS = {
  name: "Pack Name",
  description: "Description",
  based_on_family_size: "Family Size Covered",
  based_on_sector: "Sector Match",
  is_additional_pack: "Pack Type",
  sector_id: "Sector Match",
  sector_ids: "Sector Match",
  applies_to_all_disasters: "Disaster Applicability",
  disaster_types: "Disaster Types",
  is_active: "Template Status",
  items: "Template Items",
};

const RELIEF_PACK_EDIT_AUDIT_FIELDS = Object.keys(RELIEF_PACK_FIELD_LABELS);

const DONATION_FIELD_LABELS = {
  donor_name: "Donor Name",
  received_at: "Received Date",
  item_count: "Donation Items",
  total_quantity_received: "Donation Items",
  items: "Donation Items",
};

const DONATION_ITEM_FIELD_LABELS = {
  quantity_received: "Quantity",
  remarks: "Per Family Allocation",
};

const DONATION_EDIT_AUDIT_FIELDS = Object.keys(DONATION_FIELD_LABELS);
const DONATION_ITEM_EDIT_AUDIT_FIELDS = Object.keys(DONATION_ITEM_FIELD_LABELS);

const INVENTORY_WRITE_OFF_TYPES = new Set([
  "DAMAGED",
  "EXPIRED",
  "MISSING",
  "SPOILED",
  "STOLEN",
]);

const formatInventoryStatusType = (value) => {
  const normalizedValue = String(value || "").trim().toUpperCase();

  if (!normalizedValue) {
    return null;
  }

  return normalizedValue
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
};

const normalizeAuditValue = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return value;
};

const normalizeComparableAuditValue = (value) => {
  const normalizedValue = normalizeAuditValue(value);

  if (Array.isArray(normalizedValue)) {
    return JSON.stringify(normalizedValue);
  }

  if (normalizedValue && typeof normalizedValue === "object") {
    return JSON.stringify(normalizedValue);
  }

  return normalizedValue;
};

const formatInventoryDate = (value) => {
  if (!value) {
    return "No expiry date";
  }

  const dateValue = new Date(`${String(value).slice(0, 10)}T00:00:00`);

  if (Number.isNaN(dateValue.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(dateValue);
};

const buildInventoryItemEditDetail = (row) => {
  const oldValues = row.old_values_json || {};
  const newValues = row.new_values_json || {};
  const changedFields = INVENTORY_ITEM_EDIT_AUDIT_FIELDS.filter((key) => {
    return (
      normalizeAuditValue(oldValues[key]) !==
      normalizeAuditValue(newValues[key])
    );
  });

  if (!changedFields.length) {
    return null;
  }

  return `Edited: ${changedFields
    .map((key) => INVENTORY_FIELD_LABELS[key] || formatInventoryStatusType(key))
    .join(", ")}`;
};

const buildChangedFieldLabels = (row, auditFields, fieldLabels) => {
  const oldValues = row.old_values_json || {};
  const newValues = row.new_values_json || {};

  return auditFields
    .filter((key) => {
      return (
        normalizeComparableAuditValue(oldValues[key]) !==
        normalizeComparableAuditValue(newValues[key])
      );
    })
    .map((key) => fieldLabels[key] || formatInventoryStatusType(key));
};

const buildInventoryAuditActionDetail = (row) => {
  const transactionType = String(
    row.new_values_json?.transaction_type || "",
  ).toUpperCase();
  const quantity = row.new_values_json?.quantity;
  const quantityReceived = row.new_values_json?.quantity_received;

  if (
    row.entity_type === "INVENTORY_ITEM" &&
    row.action === "INVENTORY_ITEM_UPDATE"
  ) {
    return buildInventoryItemEditDetail(row);
  }

  if (
    row.entity_type === "INVENTORY_BATCH" &&
    row.action === "INVENTORY_BATCH_UPDATE"
  ) {
    const previousExpiry = row.old_values_json?.expiration_date || null;
    const nextExpiry = row.new_values_json?.expiration_date || null;

    if (previousExpiry !== nextExpiry) {
      return `Expiry: ${formatInventoryDate(nextExpiry)}`;
    }
  }

  if (
    row.entity_type === "INVENTORY_TRANSACTION" &&
    INVENTORY_WRITE_OFF_TYPES.has(transactionType)
  ) {
    return formatInventoryStatusType(transactionType);
  }

  if (
    row.entity_type === "INVENTORY_TRANSACTION" &&
    ["INFLOW", "RETURN", "ADJUSTMENT"].includes(transactionType) &&
    quantity !== undefined &&
    quantity !== null
  ) {
    return `Quantity: ${quantity}`;
  }

  if (
    row.entity_type === "INVENTORY_BATCH" &&
    row.action === "INVENTORY_BATCH_CREATE" &&
    quantityReceived !== undefined &&
    quantityReceived !== null
  ) {
    return `Quantity: ${quantityReceived}`;
  }

  return null;
};

const buildInventoryAuditActionLabel = (row) => {
  const transactionType = String(
    row.new_values_json?.transaction_type || "",
  ).toUpperCase();

  if (row.entity_type === "INVENTORY_ITEM") {
    if (row.action === "INVENTORY_ITEM_CREATE") {
      return "Item Created";
    }

    if (row.action === "INVENTORY_ITEM_UPDATE") {
      return "Item Details Edited";
    }
  }

  if (
    row.entity_type === "INVENTORY_BATCH" &&
    row.action === "INVENTORY_BATCH_CREATE"
  ) {
    return "Stock Added";
  }

  if (
    row.entity_type === "INVENTORY_BATCH" &&
    row.action === "INVENTORY_BATCH_UPDATE"
  ) {
    const previousExpiry = row.old_values_json?.expiration_date || null;
    const nextExpiry = row.new_values_json?.expiration_date || null;

    if (previousExpiry !== nextExpiry) {
      return "Batch Expiry Updated";
    }
  }

  if (row.entity_type === "INVENTORY_TRANSACTION") {
    if (INVENTORY_WRITE_OFF_TYPES.has(transactionType)) {
      return "Written Off";
    }

    if (transactionType === "ADJUSTMENT") {
      return "Stock Adjusted";
    }

    if (transactionType === "INFLOW" || transactionType === "RETURN") {
      return "Stock Added";
    }
  }

  return null;
};

const buildReliefPackAuditActionLabel = (row) => {
  if (row.entity_type !== "RELIEF_PACK_TEMPLATE") {
    return null;
  }

  if (row.action === "RELIEF_PACK_TEMPLATE_CREATE") {
    return "Relief Pack Template Created";
  }

  if (
    [
      "RELIEF_PACK_TEMPLATE_UPDATE",
      "RELIEF_PACK_TEMPLATE_UPDATED",
      "RELIEF_PACK_TEMPLATE_ITEMS_UPDATED",
    ].includes(row.action)
  ) {
    return "Relief Pack Details Edited";
  }

  return null;
};

const getDonationItems = (row) => {
  const items = row.donation_items_json || row.new_values_json?.items || [];

  if (typeof items === "string") {
    try {
      const parsedItems = JSON.parse(items);
      return Array.isArray(parsedItems) ? parsedItems : [];
    } catch (_error) {
      return [];
    }
  }

  return Array.isArray(items) ? items : [];
};

const parseReliefPackRemark = (remarks) => {
  const matchedRemark = String(remarks || "")
    .trim()
    .match(/^Relief Pack:\s*(.+?)(?:\s+x\s+\d+)?(?:\.|$)/i);

  return matchedRemark?.[1]?.trim() || null;
};

const buildDonationItemSummaryLine = (row) => {
  const donationItems = getDonationItems(row);

  if (!donationItems.length) {
    const itemName =
      row.new_values_json?.item_name ||
      row.old_values_json?.item_name ||
      "Donation items";
    return itemName;
  }

  const reliefPackValues = donationItems.map((item) =>
    parseReliefPackRemark(item?.remarks),
  );
  const reliefPackNames = Array.from(new Set(reliefPackValues.filter(Boolean)));

  if (
    reliefPackNames.length > 0 &&
    reliefPackValues.every((reliefPackName) => Boolean(reliefPackName))
  ) {
    return reliefPackNames.join("; ");
  }

  return donationItems
    .map((item) => {
      const itemName = item?.item_name || "Donation item";
      const quantity = Number(item?.quantity_received || 0);
      const unit = item?.unit_of_measure || "unit(s)";

      if (quantity > 0) {
        return `${itemName} (${quantity} ${unit})`;
      }

      return itemName;
    })
    .join("; ");
};

const isDonationAuditRow = (row) => {
  if (["DONATION", "DONATION_ITEM"].includes(row.entity_type)) {
    return true;
  }

  const transactionType = String(
    row.new_values_json?.transaction_type || "",
  ).toUpperCase();

  return (
    row.entity_type === "INVENTORY_TRANSACTION" &&
    row.inventory_transaction_reference_type === "DONATION" &&
    INVENTORY_WRITE_OFF_TYPES.has(transactionType)
  );
};

const buildDonationAuditActionLabel = (row) => {
  if (!isDonationAuditRow(row)) {
    return null;
  }

  if (row.entity_type === "DONATION" && row.action === "DONATION_CREATE") {
    return "Donation Entry";
  }

  if (
    (row.entity_type === "DONATION" && row.action === "DONATION_UPDATE") ||
    (row.entity_type === "DONATION_ITEM" && row.action === "DONATION_ITEM_UPDATE")
  ) {
    return "Donation Details Edited";
  }

  const transactionType = String(
    row.new_values_json?.transaction_type || "",
  ).toUpperCase();

  if (
    row.entity_type === "INVENTORY_TRANSACTION" &&
    INVENTORY_WRITE_OFF_TYPES.has(transactionType)
  ) {
    return "Written Off";
  }

  return null;
};

const buildInventoryRecordLines = (row) => {
  const itemName =
    row.inventory_item_name ||
    row.new_values_json?.item_name ||
    row.old_values_json?.item_name ||
    "Inventory record";
  const batchNo =
    row.inventory_batch_no ||
    row.new_values_json?.batch_no ||
    row.old_values_json?.batch_no ||
    null;
  const barcode =
    row.inventory_barcode ||
    row.new_values_json?.barcode ||
    row.old_values_json?.barcode ||
    null;
  const lines = [];

  if (barcode) {
    lines.push(`${itemName} (${barcode})`);
  } else {
    lines.push(itemName);
  }

  if (batchNo) {
    lines.push(batchNo);
  }

  return lines;
};

const buildInventoryRecordLabel = (row) => {
  return buildInventoryRecordLines(row).join(" - ");
};

const buildReliefPackEditDetail = (row) => {
  const changedFieldLabels = buildChangedFieldLabels(
    row,
    RELIEF_PACK_EDIT_AUDIT_FIELDS,
    RELIEF_PACK_FIELD_LABELS,
  );
  const uniqueChangedFieldLabels = [];

  changedFieldLabels.filter(Boolean).forEach((fieldLabel) => {
    const normalizedFieldLabel =
      fieldLabel === "Disaster Types" ? "Disaster Applicability" : fieldLabel;

    if (!uniqueChangedFieldLabels.includes(normalizedFieldLabel)) {
      uniqueChangedFieldLabels.push(normalizedFieldLabel);
    }
  });

  if (!uniqueChangedFieldLabels.length) {
    return null;
  }

  return `Edited: ${uniqueChangedFieldLabels.join(", ")}`;
};

const buildReliefPackRecordLines = (row) => {
  const templateName =
    row.relief_pack_template_name ||
    row.new_values_json?.name ||
    row.old_values_json?.name ||
    "Relief pack template";
  return [templateName];
};

const buildReliefPackRecordLabel = (row) => {
  return buildReliefPackRecordLines(row).join(" - ");
};

const buildDonationEditDetail = (row) => {
  if (row.entity_type === "DONATION") {
    const changedFieldLabels = buildChangedFieldLabels(
      row,
      DONATION_EDIT_AUDIT_FIELDS,
      DONATION_FIELD_LABELS,
    );
    const uniqueChangedFieldLabels = Array.from(new Set(changedFieldLabels));

    return uniqueChangedFieldLabels.length
      ? `Edited: ${uniqueChangedFieldLabels.join(", ")}`
      : null;
  }

  if (row.entity_type === "DONATION_ITEM") {
    const changedFieldLabels = buildChangedFieldLabels(
      row,
      DONATION_ITEM_EDIT_AUDIT_FIELDS,
      DONATION_ITEM_FIELD_LABELS,
    );
    const uniqueChangedFieldLabels = Array.from(new Set(changedFieldLabels));

    return uniqueChangedFieldLabels.length
      ? `Edited: ${uniqueChangedFieldLabels.join(", ")}`
      : null;
  }

  return null;
};

const buildDonationRecordLines = (row) => {
  const donorName =
    row.donation_donor_name ||
    row.new_values_json?.donor_name ||
    row.old_values_json?.donor_name ||
    "Donation record";
  const itemSummaryLine = buildDonationItemSummaryLine(row);

  return [donorName, itemSummaryLine].filter(Boolean);
};

const buildDonationRecordLabel = (row) => {
  return buildDonationRecordLines(row).join(" - ");
};

const buildAuditActionLabel = (row) => {
  return (
    buildDonationAuditActionLabel(row) ||
    buildInventoryAuditActionLabel(row) ||
    buildReliefPackAuditActionLabel(row) ||
    "System Activity"
  );
};

const buildRecordLabel = (row) => {
  if (
    [
      "INVENTORY_ITEM",
      "INVENTORY_BATCH",
      "INVENTORY_TRANSACTION",
    ].includes(row.entity_type)
  ) {
    return buildInventoryRecordLabel(row);
  }

  if (row.entity_type === "RELIEF_PACK_TEMPLATE") {
    return buildReliefPackRecordLabel(row);
  }

  if (isDonationAuditRow(row)) {
    return buildDonationRecordLabel(row);
  }

  return null;
};

const isCurrentAuditRow = (row) => {
  if (
    [
      "INVENTORY_ITEM",
      "INVENTORY_BATCH",
      "INVENTORY_TRANSACTION",
    ].includes(row.entity_type)
  ) {
    return row.inventory_item_is_active === true;
  }

  if (row.entity_type === "RELIEF_PACK_TEMPLATE") {
    return row.relief_pack_template_is_active !== false;
  }

  if (isDonationAuditRow(row)) {
    return row.donation_status !== "CANCELLED";
  }

  return true;
};

const mapAuditLog = (row) => {
  const isReliefPackTemplate = row.entity_type === "RELIEF_PACK_TEMPLATE";
  const isDonation = isDonationAuditRow(row);
  const recordLines = isDonation
    ? buildDonationRecordLines(row)
    : isReliefPackTemplate
      ? buildReliefPackRecordLines(row)
      : buildRecordLabel(row)
        ? buildInventoryRecordLines(row)
        : [];

  return {
    id: row.id,
    action: row.action,
    action_label: buildAuditActionLabel(row),
    action_detail: isDonation
      ? row.action === "DONATION_CREATE"
        ? null
        : buildDonationEditDetail(row) || buildInventoryAuditActionDetail(row)
      : isReliefPackTemplate
        ? row.action === "RELIEF_PACK_TEMPLATE_CREATE"
          ? null
          : buildReliefPackEditDetail(row)
        : buildInventoryAuditActionDetail(row),
    module: isDonation
      ? "Donation"
      : isReliefPackTemplate
        ? "Relief Pack"
        : "Inventory",
    performed_by: buildPerformedByLabel(row),
    role_code: row.role_code || null,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    record_label: recordLines.length ? recordLines.join(" - ") : null,
    record_lines: recordLines,
    timestamp: row.created_at,
    status: "SUCCESS",
    details: {
      changed_fields: buildValueSummary(row.new_values_json),
      previous_fields: buildValueSummary(row.old_values_json),
    },
  };
};

const getSystemLogReview = async ({ limit = 50, type = "all" } = {}) => {
  const shouldLoadAuditLogs = type === "all" || type === "audit";
  const shouldLoadErrorLogs = type === "all" || type === "error";

  const [auditLogs, errorLogs] = await Promise.all([
    shouldLoadAuditLogs ? systemLogRepository.getAuditLogs({ limit }) : [],
    shouldLoadErrorLogs ? systemLogRepository.getErrorLogs({ limit }) : [],
  ]);

  return {
    filters: {
      limit,
      type,
    },
    audit_logs: auditLogs.filter(isCurrentAuditRow).map(mapAuditLog),
    error_logs: errorLogs.map((row) => ({
      id: row.id,
      action: row.error_code || "SYSTEM_ERROR",
      module: row.module_name,
      performed_by: buildPerformedByLabel(row),
      timestamp: row.created_at,
      status: row.severity || "ERROR",
      error_message: row.error_message,
      stack_trace: row.stack_trace || null,
    })),
  };
};

module.exports = {
  getSystemLogReview,
};
