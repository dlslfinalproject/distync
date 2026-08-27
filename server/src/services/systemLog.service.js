const systemLogRepository = require("../repositories/systemLog.repository");

const buildPerformedByLabel = (row) => {
  if (row.first_name || row.last_name) {
    return [row.first_name, row.last_name].filter(Boolean).join(" ");
  }

  return row.email || "System";
};

const buildDistributionPerformedByLabel = (row) => {
  if (row.distribution_verified_by_first_name || row.distribution_verified_by_last_name) {
    return [
      row.distribution_verified_by_first_name,
      row.distribution_verified_by_last_name,
    ]
      .filter(Boolean)
      .join(" ");
  }

  return row.distribution_verified_by_email || buildPerformedByLabel(row);
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
  "OTHER",
]);

const AUDIT_DETAIL_FIELD_LABELS = {
  item_code: "Item Code",
  item_name: "Item Name",
  category: "Category",
  unit_of_measure: "Unit",
  unit_of_measure_value: "Unit Value",
  packaging: "Packaging",
  packaging_count: "Packaging Count",
  quantity: "Quantity",
  reorder_level: "Reorder Level",
  expiration_date: "Expiration Date",
  barcode: "Barcode",
  is_perishable: "Perishable",
  is_active: "Status",
  batch_no: "Batch Number",
  source_type: "Source",
  quantity_received: "Quantity Received",
  quantity_available: "Quantity Available",
  received_at: "Received Date",
  storage_location: "Storage Location",
  transaction_type: "Stock Action",
  other_status: "Other Status",
  performed_at: "Performed At",
  remarks: "Remarks",
  name: "Name",
  description: "Description",
  based_on_family_size: "Family Size Rule",
  based_on_sector: "Sector Rule",
  is_additional_pack: "Pack Type",
  applies_to_all_disasters: "Disaster Coverage",
  disaster_types: "Disaster Types",
  donor_name: "Donor Name",
  donor_type: "Donor Type",
  donor_type_other: "Other Donor Type",
  contact_information: "Contact Information",
  status: "Status",
  item_count: "Number of Items",
  total_quantity_received: "Total Quantity Received",
  distribution_status: "Distribution Status",
  claimed_by_name: "Claimed By",
  qr_reference_value: "QR Reference",
  receipt_no: "Receipt Number",
  receipt_status: "Receipt Status",
  received_at: "Received At",
};

const AUDIT_DETAIL_ALLOWED_FIELDS = {
  INVENTORY_ITEM: [
    "item_code",
    "item_name",
    "category",
    "unit_of_measure",
    "unit_of_measure_value",
    "packaging",
    "packaging_count",
    "quantity",
    "reorder_level",
    "expiration_date",
    "barcode",
    "is_perishable",
    "is_active",
  ],
  INVENTORY_BATCH: [
    "batch_no",
    "source_type",
    "quantity_received",
    "quantity_available",
    "expiration_date",
    "received_at",
    "storage_location",
    "status",
  ],
  INVENTORY_TRANSACTION: [
    "transaction_type",
    "other_status",
    "quantity",
    "performed_at",
    "remarks",
  ],
  RELIEF_PACK_TEMPLATE: [
    "name",
    "description",
    "based_on_family_size",
    "based_on_sector",
    "is_additional_pack",
    "applies_to_all_disasters",
    "disaster_types",
    "is_active",
  ],
  DONATION: [
    "donor_name",
    "donor_type",
    "donor_type_other",
    "contact_information",
    "received_at",
    "status",
    "remarks",
    "item_count",
    "total_quantity_received",
  ],
  DONATION_ITEM: [
    "donor_name",
    "item_name",
    "category",
    "quantity_received",
    "batch_no",
    "expiration_date",
    "quantity_available",
    "remarks",
  ],
  DISTRIBUTION_TRANSACTION: [
    "distribution_status",
    "claimed_by_name",
    "qr_reference_value",
    "receipt_no",
    "receipt_status",
    "received_at",
    "remarks",
  ],
};

const DATE_DETAIL_FIELDS = new Set([
  "expiration_date",
  "received_at",
  "performed_at",
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

const formatAuditDateTime = (value) => {
  if (!value) {
    return "--";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsedDate);
};

const formatAuditDate = (value) => {
  if (!value) {
    return "--";
  }

  const parsedDate = new Date(`${String(value).slice(0, 10)}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsedDate);
};

const formatAuditStatus = (value) => {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    return "--";
  }

  if (normalizedValue.toUpperCase() === "TRUE") {
    return "Active";
  }

  if (normalizedValue.toUpperCase() === "FALSE") {
    return "Inactive";
  }

  return normalizedValue
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
};

const formatAuditValue = (fieldName, value) => {
  if (value === undefined || value === null || value === "") {
    return "--";
  }

  if (fieldName === "is_active") {
    return value ? "Active" : "Inactive";
  }

  if (fieldName === "is_perishable") {
    return value ? "Yes" : "No";
  }

  if (fieldName === "is_additional_pack") {
    return value ? "Additional pack" : "Standard pack";
  }

  if (
    [
      "based_on_family_size",
      "based_on_sector",
      "applies_to_all_disasters",
    ].includes(fieldName)
  ) {
    return value ? "Yes" : "No";
  }

  if (DATE_DETAIL_FIELDS.has(fieldName)) {
    return fieldName === "expiration_date"
      ? formatAuditDate(value)
      : formatAuditDateTime(value);
  }

  if (Array.isArray(value)) {
    if (!value.length) {
      return "--";
    }

    return value
      .map((entry) => {
        if (entry && typeof entry === "object") {
          return entry.item_name || entry.name || null;
        }

        return entry;
      })
      .filter(Boolean)
      .join(", ");
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (["status", "source_type", "transaction_type", "distribution_status"].includes(fieldName)) {
    return formatAuditStatus(value);
  }

  return String(value);
};

const buildAuditDetailChanges = (row) => {
  const oldValues = row.old_values_json || {};
  const newValues = row.new_values_json || {};
  const allowedFields = AUDIT_DETAIL_ALLOWED_FIELDS[row.entity_type] || [];

  return allowedFields
    .filter((fieldName) => {
      const previousValue = normalizeComparableAuditValue(oldValues[fieldName]);
      const nextValue = normalizeComparableAuditValue(newValues[fieldName]);

      return previousValue !== nextValue;
    })
    .map((fieldName) => ({
      field: fieldName,
      label: AUDIT_DETAIL_FIELD_LABELS[fieldName] || fieldName,
      previous_value: formatAuditValue(fieldName, oldValues[fieldName]),
      new_value: formatAuditValue(fieldName, newValues[fieldName]),
    }));
};

const buildItemChangeKey = (item = {}) =>
  String(item.inventory_item_id || item.item_name || item.id || "").trim();

const buildAuditDetailItemChanges = (row) => {
  const oldItems = Array.isArray(row.old_values_json?.items)
    ? row.old_values_json.items
    : [];
  const newItems = Array.isArray(row.new_values_json?.items)
    ? row.new_values_json.items
    : [];
  const itemKeys = Array.from(
    new Set([
      ...oldItems.map(buildItemChangeKey),
      ...newItems.map(buildItemChangeKey),
    ]),
  ).filter(Boolean);

  return itemKeys
    .map((itemKey) => {
      const previousItem =
        oldItems.find((item) => buildItemChangeKey(item) === itemKey) || null;
      const nextItem =
        newItems.find((item) => buildItemChangeKey(item) === itemKey) || null;
      const item = nextItem || previousItem || {};
      const previousQuantity =
        previousItem?.quantity_required ?? previousItem?.quantity_received;
      const nextQuantity =
        nextItem?.quantity_required ?? nextItem?.quantity_received;

      if (
        normalizeComparableAuditValue(previousItem) ===
        normalizeComparableAuditValue(nextItem)
      ) {
        return null;
      }

      return {
        item_name: item.item_name || "Item",
        previous_quantity:
          previousQuantity !== undefined && previousQuantity !== null
            ? String(previousQuantity)
            : "--",
        new_quantity:
          nextQuantity !== undefined && nextQuantity !== null
            ? String(nextQuantity)
            : "--",
        unit_of_measure: item.unit_of_measure || "",
        remarks: item.remarks || "",
        change_type: previousItem ? (nextItem ? "Updated" : "Removed") : "Added",
      };
    })
    .filter(Boolean);
};

const buildDistributionItemDetails = (row) =>
  getDistributionItems(row).map((item) => ({
    item_name: item.item_name || "Item",
    batch_no: item.batch_no || "--",
    quantity: formatAuditValue("quantity", item.quantity_released),
    unit_of_measure: item.unit_of_measure || "",
    source:
      parseReliefPackRemark(item.donation_remarks) ||
      item.donor_name ||
      formatAuditStatus(item.source_type) ||
      "--",
  }));

const buildAuditDetail = (row) => {
  return {
    changes: buildAuditDetailChanges(row),
    item_changes: buildAuditDetailItemChanges(row),
    distributed_items: isDistributionAuditRow(row)
      ? buildDistributionItemDetails(row)
      : [],
  };
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

const isDistributionAuditRow = (row) => {
  return (
    row.entity_type === "DISTRIBUTION_TRANSACTION" &&
    ["DISTRIBUTION_RECORD", "DISTRIBUTION_QR_CLAIM"].includes(row.action)
  );
};

const buildDistributionAuditActionLabel = (row) => {
  return isDistributionAuditRow(row) ? "Distributed Items" : null;
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

const getDistributionItems = (row) => {
  const items = row.distribution_items_json || [];

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

const buildDistributionRecordLines = (row) => {
  const lines = [];
  const templateName =
    row.distribution_relief_pack_template_name ||
    row.new_values_json?.relief_pack_template_name ||
    null;

  if (templateName) {
    lines.push(templateName);
  }

  const donatedReliefPackNames = new Set();
  const donatedLooseItemDonorNames = new Set();

  getDistributionItems(row).forEach((item) => {
    const reliefPackName = parseReliefPackRemark(item?.donation_remarks);

    if (reliefPackName) {
      donatedReliefPackNames.add(reliefPackName);
      return;
    }

    if (String(item?.source_type || "").toUpperCase() !== "DONATED") {
      return;
    }

    const donorName = String(item?.donor_name || "").trim();
    donatedLooseItemDonorNames.add(donorName || "Donor");
  });

  donatedReliefPackNames.forEach((reliefPackName) => {
    lines.push(reliefPackName);
  });

  donatedLooseItemDonorNames.forEach((donorName) => {
    lines.push(`${donorName} Donation`);
  });

  return lines.length ? lines : ["Distributed relief goods"];
};

const buildDistributionRecordLabel = (row) => {
  return buildDistributionRecordLines(row).join(" - ");
};

const buildAuditActionLabel = (row) => {
  return (
    buildDistributionAuditActionLabel(row) ||
    buildDonationAuditActionLabel(row) ||
    buildInventoryAuditActionLabel(row) ||
    buildReliefPackAuditActionLabel(row) ||
    "System Activity"
  );
};

const buildRecordLabel = (row) => {
  if (isDistributionAuditRow(row)) {
    return buildDistributionRecordLabel(row);
  }

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
  if (isDistributionAuditRow(row)) {
    return (
      row.distribution_status ||
      row.new_values_json?.distribution_status ||
      ""
    ) === "CLAIMED";
  }

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
  const isDistribution = isDistributionAuditRow(row);
  const recordLines = isDonation
    ? buildDonationRecordLines(row)
    : isDistribution
      ? buildDistributionRecordLines(row)
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
      : isDistribution
        ? "Distribution"
        : isReliefPackTemplate
          ? "Relief Pack"
          : "Inventory",
    performed_by: isDistribution
      ? buildDistributionPerformedByLabel(row)
      : buildPerformedByLabel(row),
    role_code: row.role_code || null,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    record_label: recordLines.length ? recordLines.join(" - ") : null,
    record_lines: recordLines,
    timestamp: isDistribution ? row.distribution_date || row.created_at : row.created_at,
    status: "SUCCESS",
    details: {
      changed_fields: buildValueSummary(row.new_values_json),
      previous_fields: buildValueSummary(row.old_values_json),
    },
    audit_detail: buildAuditDetail(row),
  };
};

const getLogPagination = ({ rows, limit, page }) => {
  const totalRecords = rows.length
    ? Number(rows[0].total_count ?? rows.length)
    : 0;
  const totalPages =
    Number.isInteger(limit) && limit > 0
      ? Math.max(1, Math.ceil(totalRecords / limit))
      : 1;

  return {
    page,
    limit,
    total_records: totalRecords,
    total_pages: totalPages,
    has_previous_page: page > 1,
    has_next_page: page < totalPages,
    retention_years: 5,
  };
};

const getAuditLogSummary = (rows = []) => {
  if (!rows.length) {
    return {
      total_matching_records: 0,
      inventory_records: 0,
      relief_pack_records: 0,
      donation_records: 0,
      distribution_records: 0,
    };
  }

  const [firstRow] = rows;

  return {
    total_matching_records: Number(firstRow.total_count || 0),
    inventory_records: Number(firstRow.inventory_count || 0),
    relief_pack_records: Number(firstRow.relief_pack_count || 0),
    donation_records: Number(firstRow.donation_count || 0),
    distribution_records: Number(firstRow.distribution_count || 0),
  };
};

const getSystemLogReview = async ({
  auditAction = "all",
  dateFrom = "",
  dateTo = "",
  limit = 50,
  module = "all",
  page = 1,
  search = "",
  type = "all",
} = {}) => {
  const shouldLoadAuditLogs = type === "all" || type === "audit";
  const shouldLoadErrorLogs = type === "all" || type === "error";

  const [auditLogs, errorLogs] = await Promise.all([
    shouldLoadAuditLogs
      ? systemLogRepository.getAuditLogs({
          auditAction,
          dateFrom,
          dateTo,
          limit,
          module,
          page,
          search,
        })
      : [],
    shouldLoadErrorLogs ? systemLogRepository.getErrorLogs({ limit }) : [],
  ]);

  const auditLogRows = auditLogs.filter(isCurrentAuditRow);

  return {
    filters: {
      auditAction,
      dateFrom,
      dateTo,
      limit,
      module,
      page,
      search,
      type,
    },
    pagination: {
      audit_logs: getLogPagination({ rows: auditLogs, limit, page }),
    },
    summary: {
      audit_logs: getAuditLogSummary(auditLogs),
    },
    audit_logs: auditLogRows.map(mapAuditLog),
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
