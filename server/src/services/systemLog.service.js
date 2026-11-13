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
  donor_name_public: "Donor Name Visibility",
  disaster_event_title: "Disaster Event",
  donor_type: "Donor Type",
  donor_type_other: "Other Donor Type",
  contact_information: "Contact Information",
  received_at: "Received Date",
  status: "Status",
  remarks: "Remarks",
  item_count: "Number of Items",
  total_quantity_received: "Total Quantity Received",
  items: "Donation Items",
};

const DONATION_ITEM_FIELD_LABELS = {
  donor_name: "Donor Name",
  item_code: "Item Code",
  item_name: "Item Name",
  category: "Category",
  quantity_received: "Quantity",
  unit_of_measure: "Unit",
  unit_of_measure_value: "Unit Value",
  packaging: "Packaging",
  units_per_packaging: "Units per Packaging",
  batch_no: "Batch Number",
  expiration_date: "Expiration Date",
  quantity_available: "Quantity Available",
  remarks: "Item Remarks",
};

const DONATION_EDIT_AUDIT_FIELDS = Object.keys(DONATION_FIELD_LABELS).filter(
  (fieldName) => fieldName !== "items",
);
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
  is_active: "Status",
  batch_no: "Batch Number",
  source_type: "Source",
  quantity_received: "Quantity Received",
  quantity_available: "Quantity Available",
  received_at: "Received Date",
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
  donor_name_public: "Donor Name Visibility",
  donation_type: "Donation Type",
  disaster_event_title: "Disaster Event",
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
  units_per_packaging: "Units per Packaging",
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
    "is_active",
  ],
  INVENTORY_ITEM_STOCK_FORM: [
    "inventory_item_id",
    "barcode",
    "packaging",
    "units_per_packaging",
    "unit_of_measure",
    "unit_of_measure_value",
    "is_active",
  ],
  INVENTORY_BATCH: [
    "batch_no",
    "source_type",
    "quantity_received",
    "quantity_available",
    "expiration_date",
    "received_at",
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
    "donation_type",
    "donor_name",
    "donor_name_public",
    "disaster_event_title",
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
    "item_code",
    "item_name",
    "category",
    "quantity_received",
    "unit_of_measure",
    "unit_of_measure_value",
    "packaging",
    "units_per_packaging",
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

const ITEM_CREATED_ITEM_FIELDS = new Set([
  "item_code",
  "item_name",
  "category",
  "unit_of_measure",
  "unit_of_measure_value",
  "packaging",
  "barcode",
  "reorder_level",
]);

const OPENING_STOCK_REMARK =
  "Opening stock recorded during inventory item creation";
const STOCK_ADDED_REMARK = "Stock received during inventory batch creation";

const DATE_DETAIL_FIELDS = new Set([
  "expiration_date",
  "received_at",
  "performed_at",
]);
const AUDIT_DISPLAY_TIME_ZONE = "Asia/Manila";
const NOT_APPLICABLE_EXPIRATION_DATE = "N/A";

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

const getComparableAuditFields = (row, allowedFields) => {
  if (row.entity_type !== "DONATION" || row.action !== "DONATION_UPDATE") {
    return allowedFields;
  }

  const oldValues = row.old_values_json || {};
  const newValues = row.new_values_json || {};
  const fieldsPresentInBoth = allowedFields.filter(
    (fieldName) =>
      Object.prototype.hasOwnProperty.call(oldValues, fieldName) &&
      Object.prototype.hasOwnProperty.call(newValues, fieldName),
  );
  const changedFieldsPresentInBoth = fieldsPresentInBoth.filter(
    (fieldName) =>
      normalizeComparableAuditValue(oldValues[fieldName]) !==
      normalizeComparableAuditValue(newValues[fieldName]),
  );

  if (changedFieldsPresentInBoth.length) {
    return fieldsPresentInBoth;
  }

  const fieldsPresentInOnlyOneSnapshot = allowedFields.filter(
    (fieldName) =>
      Object.prototype.hasOwnProperty.call(oldValues, fieldName) !==
      Object.prototype.hasOwnProperty.call(newValues, fieldName),
  );

  return fieldsPresentInOnlyOneSnapshot.length
    ? fieldsPresentInOnlyOneSnapshot
    : fieldsPresentInBoth;
};

const formatInventoryDate = (value) => {
  if (!value) {
    return NOT_APPLICABLE_EXPIRATION_DATE;
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
    timeZone: AUDIT_DISPLAY_TIME_ZONE,
  }).format(parsedDate);
};

const formatAuditDate = (value) => {
  if (!value) {
    return NOT_APPLICABLE_EXPIRATION_DATE;
  }

  const parsedDate = new Date(`${String(value).slice(0, 10)}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: AUDIT_DISPLAY_TIME_ZONE,
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

const AUDIT_DONOR_TYPE_LABELS = {
  INDIVIDUAL: "Individual",
  NGO: "NGO",
  PRIVATE_ORGANIZATION: "Private Organization",
  GOVERNMENT_PARTNER: "Government Partner",
  OTHER: "Other",
};

const formatAuditDonorType = (value) => {
  const normalizedValue = String(value || "").trim().toUpperCase();

  return (
    AUDIT_DONOR_TYPE_LABELS[normalizedValue] ||
    formatAuditStatus(value)
  );
};

const RELIEF_PACK_DISASTER_TYPE_LABELS = [
  "Typhoon",
  "Flood",
  "Earthquake",
  "Landslide",
  "Volcanic Eruption",
  "Storm Surge",
  "Drought / El Niño",
  "Tsunami",
  "Fire",
  "Other",
];

const formatReliefPackDisasterType = (value) => {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    return null;
  }

  return (
    RELIEF_PACK_DISASTER_TYPE_LABELS.find(
      (label) => label.toLowerCase() === normalizedValue.toLowerCase(),
    ) || formatAuditStatus(normalizedValue)
  );
};

const isAuditBooleanTrue = (value) =>
  value === true || String(value || "").trim().toLowerCase() === "true";

const hasReliefPackDisasterTypes = (value) => {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return value !== undefined && value !== null && String(value).trim() !== "";
};

const isReliefPackAllDisasters = (values = {}) => {
  const appliesToAllDisasters = values.applies_to_all_disasters;

  if (
    appliesToAllDisasters === undefined ||
    appliesToAllDisasters === null ||
    appliesToAllDisasters === ""
  ) {
    return !hasReliefPackDisasterTypes(values.disaster_types);
  }

  return isAuditBooleanTrue(appliesToAllDisasters);
};

const formatReliefPackDisasterTypes = (
  value,
  { appliesToAllDisasters = false } = {},
) => {
  const disasterTypes = Array.isArray(value)
    ? value
    : value === undefined || value === null || value === ""
      ? []
      : [value];
  const includesGenericAllDisasterLabel = disasterTypes.some((entry) => {
    const disasterType =
      entry && typeof entry === "object"
        ? entry.disaster_type || entry.name || entry.label
        : entry;

    return (
      String(disasterType || "").trim().toLowerCase() === "all disaster types"
    );
  });

  if (appliesToAllDisasters || includesGenericAllDisasterLabel) {
    return RELIEF_PACK_DISASTER_TYPE_LABELS.join(", ");
  }

  const formattedDisasterTypes = disasterTypes
    .map((entry) => {
      if (entry && typeof entry === "object") {
        return formatReliefPackDisasterType(
          entry.disaster_type || entry.name || entry.label,
        );
      }

      return formatReliefPackDisasterType(entry);
    })
    .filter(Boolean);

  return formattedDisasterTypes.length
    ? Array.from(new Set(formattedDisasterTypes)).join(", ")
    : "--";
};

const formatAuditValue = (fieldName, value) => {
  if (
    fieldName === "expiration_date" &&
    (value === undefined || value === null || value === "")
  ) {
    return NOT_APPLICABLE_EXPIRATION_DATE;
  }

  if (value === undefined || value === null || value === "") {
    return "--";
  }

  if (fieldName === "is_active") {
    return value ? "Active" : "Inactive";
  }

  if (fieldName === "is_perishable") {
    return value ? "Yes" : "No";
  }

  if (fieldName === "donor_name_public") {
    return value === true || String(value).trim().toLowerCase() === "true"
      ? "Visible"
      : "Hidden";
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

  if (fieldName === "unit_of_measure_value") {
    const numericValue = Number(value);

    return Number.isFinite(numericValue) ? String(numericValue) : String(value);
  }

  if (fieldName === "donor_type") {
    return formatAuditDonorType(value);
  }

  if (["status", "source_type", "transaction_type", "distribution_status"].includes(fieldName)) {
    return formatAuditStatus(value);
  }

  return String(value);
};

const RELIEF_PACK_SECTOR_IDS_PREFIX = "__relief_pack_sector_ids__:";

const getReliefPackSectorIds = (values = {}) => {
  const explicitSectorIds = [
    ...(Array.isArray(values.sector_ids) ? values.sector_ids : []),
    values.sector_id,
  ]
    .map((sectorId) => String(sectorId || "").trim())
    .filter(Boolean);

  if (explicitSectorIds.length > 0) {
    return Array.from(new Set(explicitSectorIds));
  }

  const description = String(values.description || "");

  if (!description.startsWith(RELIEF_PACK_SECTOR_IDS_PREFIX)) {
    return [];
  }

  try {
    const parsedSectorIds = JSON.parse(
      description.slice(RELIEF_PACK_SECTOR_IDS_PREFIX.length),
    );

    return Array.isArray(parsedSectorIds)
      ? Array.from(
          new Set(
            parsedSectorIds
              .map((sectorId) => String(sectorId || "").trim())
              .filter(Boolean),
          ),
        )
      : [];
  } catch (_error) {
    return [];
  }
};

const getReliefPackSectorNameMap = (row = {}) => {
  const rawSectorNameMap = row.relief_pack_sector_name_map;
  let parsedSectorNameMap = rawSectorNameMap;

  if (typeof rawSectorNameMap === "string") {
    try {
      parsedSectorNameMap = JSON.parse(rawSectorNameMap);
    } catch (_error) {
      parsedSectorNameMap = {};
    }
  }

  if (!parsedSectorNameMap || typeof parsedSectorNameMap !== "object") {
    return new Map();
  }

  return new Map(
    Object.entries(parsedSectorNameMap)
      .map(([sectorId, sectorName]) => [
        String(sectorId),
        String(sectorName || "").trim(),
      ])
      .filter(([, sectorName]) => Boolean(sectorName)),
  );
};

const getReliefPackSectorNames = (values = {}) => {
  const directSectorNames = [
    ...(Array.isArray(values.sector_names) ? values.sector_names : []),
    ...(Array.isArray(values.sector_labels) ? values.sector_labels : []),
    ...(Array.isArray(values.sectors) ? values.sectors : []),
  ]
    .map((sector) => {
      if (sector && typeof sector === "object") {
        return sector.name || sector.label;
      }

      return sector;
    })
    .map((sectorName) => String(sectorName || "").trim())
    .filter(Boolean);

  return Array.from(new Set(directSectorNames));
};

const formatReliefPackFamilySize = (values = {}) => {
  if (
    isAuditBooleanTrue(values.is_additional_pack) ||
    !isAuditBooleanTrue(values.based_on_family_size)
  ) {
    return null;
  }

  return formatAuditValue("family_size_covered", values.description);
};

const formatReliefPackSectorMatch = (
  values = {},
  sectorNameMap = new Map(),
) => {
  if (!isAuditBooleanTrue(values.is_additional_pack)) {
    return null;
  }

  const directSectorNames = getReliefPackSectorNames(values);

  if (directSectorNames.length > 0) {
    return directSectorNames.join(", ");
  }

  const sectorIds = getReliefPackSectorIds(values);

  if (sectorIds.length === 0) {
    return "--";
  }

  return sectorIds
    .map((sectorId) => sectorNameMap.get(sectorId) || "Unknown sector")
    .join(", ");
};

const buildReliefPackTemplateCreatedChanges = (row) => {
  const values = row.new_values_json || {};
  const sectorNameMap = getReliefPackSectorNameMap(row);
  const changes = [];
  const addChange = (field, label, newValue) => {
    changes.push({
      field,
      label,
      previous_value: "--",
      new_value:
        newValue === undefined || newValue === null || newValue === ""
          ? "--"
          : String(newValue),
    });
  };

  addChange("name", "Pack Name", values.name);

  if (isAuditBooleanTrue(values.is_additional_pack)) {
    addChange(
      "sector_match",
      "Sector Match",
      formatReliefPackSectorMatch(values, sectorNameMap),
    );
  } else if (isAuditBooleanTrue(values.based_on_family_size)) {
    addChange(
      "family_size_covered",
      "Family Size Covered",
      values.description,
    );
  }

  addChange(
    "is_additional_pack",
    "Pack Type",
    formatAuditValue("is_additional_pack", values.is_additional_pack),
  );
  addChange(
    "disaster_types",
    "Disaster Types",
    formatReliefPackDisasterTypes(values.disaster_types, {
      appliesToAllDisasters: isReliefPackAllDisasters(values),
    }),
  );
  addChange(
    "is_active",
    "Template Status",
    formatAuditValue("is_active", values.is_active),
  );

  return changes;
};

const buildReliefPackTemplateEditChanges = (row) => {
  const oldValues = row.old_values_json || {};
  const newValues = row.new_values_json || {};
  const sectorNameMap = getReliefPackSectorNameMap(row);
  const changes = [];
  const addChangedChange = (field, label, previousValue, newValue) => {
    if (previousValue === newValue) {
      return;
    }

    if (previousValue === null && newValue === null) {
      return;
    }

    changes.push({
      field,
      label,
      previous_value: previousValue === null ? "Not applicable" : previousValue,
      new_value: newValue === null ? "Not applicable" : newValue,
    });
  };

  addChangedChange(
    "name",
    "Pack Name",
    formatAuditValue("name", oldValues.name),
    formatAuditValue("name", newValues.name),
  );
  addChangedChange(
    "family_size_covered",
    "Family Size Covered",
    formatReliefPackFamilySize(oldValues),
    formatReliefPackFamilySize(newValues),
  );
  addChangedChange(
    "sector_match",
    "Sector Match",
    formatReliefPackSectorMatch(oldValues, sectorNameMap),
    formatReliefPackSectorMatch(newValues, sectorNameMap),
  );
  addChangedChange(
    "is_additional_pack",
    "Pack Type",
    formatAuditValue("is_additional_pack", oldValues.is_additional_pack),
    formatAuditValue("is_additional_pack", newValues.is_additional_pack),
  );
  addChangedChange(
    "disaster_types",
    "Disaster Types",
    formatReliefPackDisasterTypes(oldValues.disaster_types, {
      appliesToAllDisasters: isReliefPackAllDisasters(oldValues),
    }),
    formatReliefPackDisasterTypes(newValues.disaster_types, {
      appliesToAllDisasters: isReliefPackAllDisasters(newValues),
    }),
  );
  addChangedChange(
    "is_active",
    "Template Status",
    formatAuditValue("is_active", oldValues.is_active),
    formatAuditValue("is_active", newValues.is_active),
  );

  return changes;
};

const buildAuditDetailChanges = (row) => {
  const oldValues = row.old_values_json || {};
  const newValues = row.new_values_json || {};
  const allowedFields = AUDIT_DETAIL_ALLOWED_FIELDS[row.entity_type] || [];

  return getComparableAuditFields(row, allowedFields)
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
        change_type: previousItem ? (nextItem ? "Updated" : "Removed") : "Added",
      };
    })
    .filter(Boolean);
};

const parseReliefPackRemarkDetails = (remarks) => {
  const matchedRemark = String(remarks || "")
    .trim()
    .match(/^Relief Pack:\s*(.+?)(?:\s+x\s+(\d+))?$/i);

  if (!matchedRemark?.[1]) {
    return null;
  }

  return {
    packName: matchedRemark[1].trim(),
    packQuantity: matchedRemark[2] ? Number(matchedRemark[2]) : null,
  };
};

const formatDonationType = (value) => {
  const normalizedValue = String(value || "").trim().toUpperCase();

  if (normalizedValue === "RELIEF_PACK") {
    return "Relief Pack";
  }

  if (normalizedValue === "LOOSE_ITEM") {
    return "Loose Item";
  }

  return formatAuditStatus(value);
};

const getDonationEntryType = (row, donationItems = []) => {
  const explicitType = String(row.new_values_json?.donation_type || "")
    .trim()
    .toUpperCase();

  if (["LOOSE_ITEM", "RELIEF_PACK"].includes(explicitType)) {
    return explicitType;
  }

  const itemTypes = donationItems.map((item) =>
    parseReliefPackRemarkDetails(item?.remarks) ? "RELIEF_PACK" : "LOOSE_ITEM",
  );

  return itemTypes.length > 0 && itemTypes.every((type) => type === "RELIEF_PACK")
    ? "RELIEF_PACK"
    : "LOOSE_ITEM";
};

const buildDonationItemDetails = (row) => {
  const donationItems = getDonationItems(row);
  const detailRows = [];
  const reliefPackRows = new Map();

  donationItems.forEach((item) => {
    const reliefPack = parseReliefPackRemarkDetails(item?.remarks);
    const itemDetails = {
      itemName: item?.item_name || "Donation item",
      quantityReceived: formatAuditValue(
        "quantity_received",
        item?.quantity_received,
      ),
      unitOfMeasure: item?.unit_of_measure || "--",
      packaging: item?.packaging || "--",
      batchNo: item?.batch_no || "--",
      expirationDate: item?.expiration_date
        ? formatAuditValue("expiration_date", item.expiration_date)
        : NOT_APPLICABLE_EXPIRATION_DATE,
      remarks:
        item?.inventory_transaction_remarks || item?.remarks || "--",
    };

    if (!reliefPack) {
      detailRows.push({
        donation_type: "Loose Item",
        item_name: itemDetails.itemName,
        relief_pack_name: null,
        relief_pack_quantity: null,
        quantity_received: itemDetails.quantityReceived,
        unit_of_measure: itemDetails.unitOfMeasure,
        packaging: itemDetails.packaging,
        batch_no: itemDetails.batchNo,
        expiration_date: itemDetails.expirationDate,
        remarks: itemDetails.remarks,
      });
      return;
    }

    const reliefPackKey = `${reliefPack.packName}|${reliefPack.packQuantity || ""}`;
    let reliefPackRow = reliefPackRows.get(reliefPackKey);

    if (!reliefPackRow) {
      reliefPackRow = {
        donation_type: "Relief Pack",
        item_name: null,
        relief_pack_name: reliefPack.packName,
        relief_pack_quantity:
          reliefPack.packQuantity === null
            ? "--"
            : String(reliefPack.packQuantity),
        relief_pack_contents: [],
        quantity_received: "--",
        unit_of_measure: "pack(s)",
        packaging: "--",
        batch_no: "--",
        expiration_date: NOT_APPLICABLE_EXPIRATION_DATE,
        remarks: "--",
      };
      reliefPackRows.set(reliefPackKey, reliefPackRow);
      detailRows.push(reliefPackRow);
    }

    reliefPackRow.relief_pack_contents.push({
      itemName: itemDetails.itemName,
      quantityReceived: itemDetails.quantityReceived,
      unitOfMeasure: itemDetails.unitOfMeasure,
      packaging: itemDetails.packaging,
      batchNo: itemDetails.batchNo,
      expirationDate: itemDetails.expirationDate,
    });
  });

  return detailRows;
};

const buildDonationEntryDetails = (row, changes, donationItems) => {
  const detailChanges = changes.filter((change) => change.field !== "status");
  const donationType = getDonationEntryType(row, donationItems);
  const eventTitle =
    row.donation_disaster_event_title ||
    row.new_values_json?.disaster_event_title ||
    null;

  if (!detailChanges.some((change) => change.field === "donation_type")) {
    detailChanges.unshift(
      createAuditDetailChange(
        "donation_type",
        "Donation Type",
        donationType,
        formatDonationType,
      ),
    );
  }

  if (
    eventTitle &&
    !detailChanges.some((change) => change.field === "disaster_event_title")
  ) {
    const donationTypeIndex = detailChanges.findIndex(
      (change) => change.field === "donation_type",
    );
    detailChanges.splice(
      donationTypeIndex + 1,
      0,
      createAuditDetailChange(
        "disaster_event_title",
        "Disaster Event",
        eventTitle,
      ),
    );
  }

  if (
    donationType === "RELIEF_PACK" &&
    !detailChanges.some((change) => change.field === "relief_pack_name")
  ) {
    const reliefPackRows = donationItems
      .map((item) => parseReliefPackRemarkDetails(item?.remarks))
      .filter(Boolean);
    const reliefPackNames = Array.from(
      new Set(
        reliefPackRows
          .map((item) => item.packName)
          .filter(Boolean),
      ),
    );
    const reliefPackQuantities = Array.from(
      new Set(
        reliefPackRows
          .map((item) => item.packQuantity)
          .filter((quantity) => quantity !== null && quantity !== undefined)
          .map(String),
      ),
    );
    const eventIndex = detailChanges.findIndex(
      (change) => change.field === "disaster_event_title",
    );
    const donationTypeIndex = detailChanges.findIndex(
      (change) => change.field === "donation_type",
    );
    const insertIndex =
      (eventIndex >= 0 ? eventIndex : donationTypeIndex) + 1;

    detailChanges.splice(
      insertIndex,
      0,
      createAuditDetailChange(
        "relief_pack_name",
        "Relief Pack Name",
        reliefPackNames.join(", ") || "--",
      ),
      createAuditDetailChange(
        "relief_pack_quantity",
        "Number of Relief Packs Received",
        reliefPackQuantities.join(", ") || "--",
      ),
    );
  }

  detailChanges.forEach((change) => {
    if (change.field === "donation_type") {
      change.new_value = formatDonationType(donationType);
    }
  });

  return detailChanges;
};

const isInventoryItemCreatedAudit = (row) =>
  row?.entity_type === "INVENTORY_ITEM" &&
  row?.action === "INVENTORY_ITEM_CREATE";

const isInventoryPackagingAddedAudit = (row) =>
  row?.entity_type === "INVENTORY_ITEM_STOCK_FORM" &&
  row?.action === "INVENTORY_ITEM_STOCK_FORM_CREATE" &&
  String(row?.new_values_json?.is_additional_packaging || "").toLowerCase() ===
    "true";

const isInventoryStockAddedAudit = (row) => {
  if (
    row?.entity_type === "INVENTORY_BATCH" &&
    row?.action === "INVENTORY_BATCH_CREATE"
  ) {
    return true;
  }

  return (
    row?.entity_type === "INVENTORY_TRANSACTION" &&
    row?.action === "INVENTORY_TRANSACTION_CREATE" &&
    String(row?.new_values_json?.transaction_type || "").toUpperCase() ===
      "INFLOW" &&
    String(
      row?.inventory_transaction_reference_type ||
        row?.new_values_json?.reference_type ||
        "",
    ).toUpperCase() !== "DONATION"
  );
};

const getRelatedInventoryItemId = (row) =>
  String(
    row?.related_inventory_item_id ||
      row?.new_values_json?.inventory_item_id ||
      "",
  ).trim();

const getRelatedInventoryStockFormId = (row) =>
  String(
    row?.related_inventory_item_stock_form_id ||
      row?.new_values_json?.inventory_item_stock_form_id ||
      "",
  ).trim();

const getAuditTimestamp = (row) => {
  const timestamp = new Date(row?.created_at || "").getTime();

  return Number.isFinite(timestamp) ? timestamp : null;
};

const getOpeningRelatedAuditRows = (itemRow, relatedRows = []) => {
  const itemId = String(itemRow?.entity_id || "").trim();
  const itemTimestamp = getAuditTimestamp(itemRow);

  return relatedRows
    .filter((row) => {
      if (getRelatedInventoryItemId(row) !== itemId) {
        return false;
      }

      const relatedTimestamp = getAuditTimestamp(row);

      return (
        itemTimestamp === null ||
        relatedTimestamp === null ||
        relatedTimestamp >= itemTimestamp
      );
    })
    .sort((left, right) => {
      const leftTimestamp = getAuditTimestamp(left) ?? Number.POSITIVE_INFINITY;
      const rightTimestamp = getAuditTimestamp(right) ?? Number.POSITIVE_INFINITY;

      return leftTimestamp - rightTimestamp || String(left.id).localeCompare(String(right.id));
    });
};

const getOpeningPackagingRelatedAuditRows = (stockFormRow, relatedRows = []) => {
  const stockFormId = String(stockFormRow?.entity_id || "").trim();

  return relatedRows
    .filter((row) => getRelatedInventoryStockFormId(row) === stockFormId)
    .sort((left, right) => {
      const leftTimestamp = getAuditTimestamp(left) ?? Number.POSITIVE_INFINITY;
      const rightTimestamp = getAuditTimestamp(right) ?? Number.POSITIVE_INFINITY;

      return leftTimestamp - rightTimestamp || String(left.id).localeCompare(String(right.id));
    });
};

const findOpeningBatchAudit = (relatedRows) =>
  relatedRows.find(
    (row) =>
      row.entity_type === "INVENTORY_BATCH" &&
      row.action === "INVENTORY_BATCH_CREATE",
  ) || null;

const findOpeningTransactionAudit = (itemRow, relatedRows, batchRow) => {
  const transactionRows = relatedRows.filter(
    (row) =>
      row.entity_type === "INVENTORY_TRANSACTION" &&
      row.action === "INVENTORY_TRANSACTION_CREATE" &&
      String(row.new_values_json?.transaction_type || "").toUpperCase() ===
        "INFLOW",
  );

  if (!transactionRows.length) {
    return null;
  }

  const batchId = String(batchRow?.entity_id || "").trim();
  const transactionForBatch = transactionRows.find(
    (row) => String(row.new_values_json?.inventory_batch_id || "").trim() === batchId,
  );

  if (transactionForBatch) {
    return transactionForBatch;
  }

  const transactionForItem = transactionRows.find(
    (row) => String(row.new_values_json?.reference_id || "").trim() === String(itemRow?.entity_id || "").trim(),
  );

  return transactionForItem || transactionRows[0];
};

const formatAuditSource = (value) => {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    return "--";
  }

  return normalizedValue.toUpperCase() === "LGU"
    ? "LGU"
    : formatAuditStatus(normalizedValue);
};

const createAuditDetailChange = (field, label, value, formatter = null) => ({
  field,
  label,
  previous_value: "--",
  new_value: formatter ? formatter(value) : formatAuditValue(field, value),
});

const getDonationAdjustmentAudit = (row) => {
  const rawAdjustment = row.donation_adjustment_json;

  if (!rawAdjustment) {
    return null;
  }

  if (typeof rawAdjustment === "string") {
    try {
      return JSON.parse(rawAdjustment);
    } catch (_error) {
      return null;
    }
  }

  return rawAdjustment;
};

const buildDonationAdjustmentDetails = (row) => {
  const adjustment = getDonationAdjustmentAudit(row);
  const values = adjustment?.new_values_json || {};

  if (!Object.keys(values).length) {
    return [];
  }

  return [
    createAuditDetailChange(
      "transaction_type",
      "Stock Action",
      values.transaction_type,
    ),
    createAuditDetailChange(
      "quantity",
      "Quantity Adjusted",
      values.quantity,
    ),
    createAuditDetailChange(
      "performed_at",
      "Adjusted At",
      values.performed_at,
    ),
    createAuditDetailChange("remarks", "Remarks", values.remarks),
  ];
};

const buildItemCreatedOpeningStockDetails = (itemRow, batchRow) => {
  const itemValues = itemRow.new_values_json || {};
  const batchValues = batchRow?.new_values_json || {};
  const changes = [];

  if (itemValues.packaging_count !== undefined && itemValues.packaging_count !== null) {
    changes.push(
      createAuditDetailChange(
        "packaging_count",
        "Quantity on Hand",
        itemValues.packaging_count,
      ),
    );
  }

  if (itemValues.quantity !== undefined && itemValues.quantity !== null) {
    changes.push(
      createAuditDetailChange(
        "quantity",
        "Units per Packaging",
        itemValues.quantity,
      ),
    );
  }

  if (batchValues.batch_no !== undefined && batchValues.batch_no !== null) {
    changes.push(
      createAuditDetailChange("batch_no", "Batch Number", batchValues.batch_no),
    );
  }

  if (
    batchValues.quantity_received !== undefined &&
    batchValues.quantity_received !== null
  ) {
    const formattedQuantity = formatAuditValue(
      "quantity_received",
      batchValues.quantity_received,
    );
    const unit = itemValues.unit_of_measure || "";

    changes.push({
      field: "quantity_received",
      label: "Total Opening Stock",
      previous_value: "--",
      new_value: unit ? `${formattedQuantity} ${unit}` : formattedQuantity,
    });
  }

  if (batchValues.source_type !== undefined && batchValues.source_type !== null) {
    changes.push(
      createAuditDetailChange(
        "source_type",
        "Source",
        batchValues.source_type,
        formatAuditSource,
      ),
    );
  }

  if (
    batchValues.expiration_date !== undefined &&
    batchValues.expiration_date !== null
  ) {
    changes.push(
      createAuditDetailChange(
        "expiration_date",
        "Expiration Date",
        batchValues.expiration_date,
      ),
    );
  }

  return changes;
};

const buildOpeningTransactionDetails = (
  transactionRow,
  fallbackRemark = STOCK_ADDED_REMARK,
) => {
  if (!transactionRow) {
    return [];
  }

  const values = transactionRow.new_values_json || {};
  const changes = [];

  if (values.transaction_type !== undefined && values.transaction_type !== null) {
    changes.push(
      createAuditDetailChange(
        "transaction_type",
        "Transaction Type",
        values.transaction_type,
      ),
    );
  }

  if (values.performed_at !== undefined && values.performed_at !== null) {
    changes.push(
      createAuditDetailChange(
        "performed_at",
        "Received/Performed At",
        values.performed_at,
      ),
    );
  }

  const remarks = values.remarks || fallbackRemark;

  changes.push(createAuditDetailChange("remarks", "Remarks", remarks));

  return changes;
};

const buildItemCreatedOpeningTransactionDetails = (transactionRow) =>
  buildOpeningTransactionDetails(transactionRow, OPENING_STOCK_REMARK);

const addAuditDetailChangeIfPresent = (
  changes,
  field,
  label,
  value,
  formatter = null,
) => {
  if (value === undefined || value === null || value === "") {
    return;
  }

  changes.push(createAuditDetailChange(field, label, value, formatter));
};

const buildPackagingAddedItemDetails = (row) => {
  const values = row.new_values_json || {};
  const changes = [];

  addAuditDetailChangeIfPresent(
    changes,
    "item_code",
    "Item Code",
    row.inventory_item_code,
  );
  addAuditDetailChangeIfPresent(
    changes,
    "item_name",
    "Item Name",
    row.inventory_item_name,
  );
  addAuditDetailChangeIfPresent(
    changes,
    "category",
    "Category",
    row.inventory_item_category,
  );
  addAuditDetailChangeIfPresent(
    changes,
    "unit_of_measure",
    "Unit",
    values.unit_of_measure ||
      row.inventory_packaging_unit_of_measure ||
      row.inventory_item_unit_of_measure,
  );
  addAuditDetailChangeIfPresent(
    changes,
    "unit_of_measure_value",
    "Unit Value",
    values.unit_of_measure_value ?? row.inventory_item_unit_of_measure_value,
  );
  addAuditDetailChangeIfPresent(
    changes,
    "packaging",
    "Packaging",
    values.packaging || row.inventory_packaging,
  );
  addAuditDetailChangeIfPresent(
    changes,
    "barcode",
    "Barcode",
    values.barcode || row.inventory_barcode,
  );
  addAuditDetailChangeIfPresent(
    changes,
    "reorder_level",
    "Reorder Level",
    row.inventory_item_reorder_level,
  );

  return changes;
};

const buildPackagingAddedOpeningStockDetails = (row, batchRow) => {
  const stockFormValues = row.new_values_json || {};
  const batchValues = batchRow?.new_values_json || {};
  const changes = [];
  const unit =
    stockFormValues.unit_of_measure ||
    row.inventory_packaging_unit_of_measure ||
    row.inventory_item_unit_of_measure ||
    "";

  addAuditDetailChangeIfPresent(
    changes,
    "units_per_packaging",
    "Units per Packaging",
    stockFormValues.units_per_packaging ?? row.inventory_units_per_packaging,
  );
  addAuditDetailChangeIfPresent(
    changes,
    "batch_no",
    "Batch Number",
    batchValues.batch_no || row.inventory_batch_no,
  );

  const totalOpeningStock =
    batchValues.quantity_received ??
    (batchRow ? null : row.new_values_json?.quantity_received);

  if (totalOpeningStock !== undefined && totalOpeningStock !== null) {
    const formattedQuantity = formatAuditValue(
      "quantity_received",
      totalOpeningStock,
    );

    changes.push({
      field: "quantity_received",
      label: "Total Opening Stock",
      previous_value: "--",
      new_value: unit ? `${formattedQuantity} ${unit}` : formattedQuantity,
    });
  }

  addAuditDetailChangeIfPresent(
    changes,
    "source_type",
    "Source",
    batchValues.source_type || row.inventory_source_type,
    formatAuditSource,
  );
  addAuditDetailChangeIfPresent(
    changes,
    "expiration_date",
    "Expiration Date",
    batchValues.expiration_date ?? row.inventory_expiration_date,
  );

  return changes;
};

const buildStockAdditionDetails = (row) => {
  const values = row.new_values_json || {};
  const isBatch = row.entity_type === "INVENTORY_BATCH";
  const changes = [];

  addAuditDetailChangeIfPresent(
    changes,
    "item_name",
    "Item",
    row.inventory_item_name || values.item_name,
  );
  addAuditDetailChangeIfPresent(
    changes,
    "packaging",
    "Packaging",
    row.inventory_packaging || values.packaging,
  );
  addAuditDetailChangeIfPresent(
    changes,
    "batch_no",
    "Batch Number",
    (isBatch ? values.batch_no : row.inventory_batch_no) ||
      row.inventory_batch_no,
  );
  addAuditDetailChangeIfPresent(
    changes,
    "quantity_received",
    "Quantity Added",
    isBatch ? values.quantity_received : values.quantity,
  );
  addAuditDetailChangeIfPresent(
    changes,
    "unit_of_measure",
    "Unit",
    row.inventory_item_unit_of_measure ||
      row.inventory_packaging_unit_of_measure ||
      values.unit_of_measure,
  );
  addAuditDetailChangeIfPresent(
    changes,
    "source_type",
    "Source",
    (isBatch ? values.source_type : row.inventory_source_type) ||
      row.inventory_source_type,
    formatAuditSource,
  );
  addAuditDetailChangeIfPresent(
    changes,
    "expiration_date",
    "Expiration Date",
    (isBatch ? values.expiration_date : row.inventory_expiration_date) ??
      row.inventory_expiration_date,
  );

  return changes;
};

const buildStockTransactionDetails = (row) => {
  const values = row.new_values_json || {};
  const isTransaction = row.entity_type === "INVENTORY_TRANSACTION";
  const changes = [];

  addAuditDetailChangeIfPresent(
    changes,
    "transaction_type",
    "Stock Action",
    isTransaction ? values.transaction_type : "INFLOW",
  );
  addAuditDetailChangeIfPresent(
    changes,
    "performed_at",
    "Received/Performed At",
    isTransaction
      ? values.performed_at
      : values.received_at || row.inventory_received_at || row.created_at,
  );
  addAuditDetailChangeIfPresent(
    changes,
    "remarks",
    "Remarks",
    isTransaction ? values.remarks : STOCK_ADDED_REMARK,
  );

  return changes;
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

const buildAuditDetail = (row, relatedRows = []) => {
  const isReliefPackTemplate = row.entity_type === "RELIEF_PACK_TEMPLATE";
  const isReliefPackTemplateCreated =
    isReliefPackTemplate && row.action === "RELIEF_PACK_TEMPLATE_CREATE";
  const changes = isReliefPackTemplateCreated
    ? buildReliefPackTemplateCreatedChanges(row)
    : isReliefPackTemplate
      ? buildReliefPackTemplateEditChanges(row)
    : buildAuditDetailChanges(row);
  const detailChanges =
    row.entity_type === "DONATION_ITEM" &&
    row.action === "DONATION_ITEM_UPDATE"
      ? changes.map((change) => ({
          ...change,
          label: DONATION_ITEM_FIELD_LABELS[change.field] || change.label,
        }))
      : changes;
  const rawDonationItems =
    row.entity_type === "DONATION" && row.action === "DONATION_CREATE"
      ? getDonationItems(row)
      : [];
  const donationItems = rawDonationItems.length
    ? buildDonationItemDetails(row)
    : [];
  const detail = {
    changes: detailChanges,
    item_changes: buildAuditDetailItemChanges(row),
    distributed_items: isDistributionAuditRow(row)
      ? buildDistributionItemDetails(row)
      : [],
    sync_resolution: buildSyncResolutionDetail(row),
  };

  if (row.entity_type === "DONATION" && row.action === "DONATION_CREATE") {
    detail.donation_details = buildDonationEntryDetails(
      row,
      changes,
      rawDonationItems,
    );
    detail.donation_items = donationItems;
  }

  if (
    row.entity_type === "DONATION_ITEM" &&
    row.action === "DONATION_ITEM_UPDATE"
  ) {
    detail.donation_stock_adjustment = buildDonationAdjustmentDetails(row);
  }

  if (isInventoryItemCreatedAudit(row)) {
    const openingRelatedRows = getOpeningRelatedAuditRows(row, relatedRows);
    const openingBatchRow = findOpeningBatchAudit(openingRelatedRows);
    const openingTransactionRow = findOpeningTransactionAudit(
      row,
      openingRelatedRows,
      openingBatchRow,
    );

    detail.item_details = changes.filter((change) =>
      ITEM_CREATED_ITEM_FIELDS.has(change.field),
    );
    detail.opening_stock = buildItemCreatedOpeningStockDetails(
      row,
      openingBatchRow,
    );
    detail.opening_transaction = buildItemCreatedOpeningTransactionDetails(
      openingTransactionRow,
    );
  }

  if (isInventoryPackagingAddedAudit(row)) {
    const openingRelatedRows = getOpeningPackagingRelatedAuditRows(
      row,
      relatedRows,
    );
    const openingBatchRow = findOpeningBatchAudit(openingRelatedRows);
    const openingTransactionRow = findOpeningTransactionAudit(
      row,
      openingRelatedRows,
      openingBatchRow,
    );

    detail.item_details = buildPackagingAddedItemDetails(row);
    detail.opening_stock = buildPackagingAddedOpeningStockDetails(
      row,
      openingBatchRow,
    );
    detail.opening_transaction = buildOpeningTransactionDetails(
      openingTransactionRow,
    );
  }

  if (isInventoryStockAddedAudit(row)) {
    detail.stock_addition = buildStockAdditionDetails(row);
    detail.stock_transaction = buildStockTransactionDetails(row);
  }

  return detail;
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
  const comparableFields = new Set(getComparableAuditFields(row, auditFields));

  return auditFields
    .filter((key) => comparableFields.has(key))
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
    row.entity_type === "INVENTORY_ITEM" &&
    row.action === "INVENTORY_ITEM_REORDER_LEVEL_UPDATE"
  ) {
    return `Reorder level: ${row.new_values_json?.reorder_level ?? "--"}`;
  }

  if (
    row.entity_type === "INVENTORY_TRANSACTION" &&
    INVENTORY_WRITE_OFF_TYPES.has(transactionType)
  ) {
    return formatInventoryStatusType(transactionType);
  }

  if (
    row.entity_type === "INVENTORY_TRANSACTION" &&
    ["INFLOW", "ADJUSTMENT", "OUTFLOW"].includes(transactionType) &&
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

    if (row.action === "INVENTORY_ITEM_REORDER_LEVEL_UPDATE") {
      return "Reorder Level Updated";
    }
  }

  if (row.entity_type === "INVENTORY_ITEM_STOCK_FORM") {
    if (isInventoryPackagingAddedAudit(row)) {
      return "Packaging Added";
    }

    if (row.action === "INVENTORY_ITEM_STOCK_FORM_UPDATE") {
      return "Packaging Updated";
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

    if (transactionType === "INFLOW") {
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

  return (
    row.entity_type === "INVENTORY_TRANSACTION" &&
    row.inventory_transaction_reference_type === "DONATION"
  );
};

const isDonationAdjustmentAuditRow = (row) => {
  if (
    row.entity_type !== "INVENTORY_TRANSACTION" ||
    row.inventory_transaction_reference_type !== "DONATION"
  ) {
    return false;
  }

  const transactionType = String(
    row.new_values_json?.transaction_type || "",
  ).toUpperCase();
  const remarks = String(row.new_values_json?.remarks || "")
    .trim()
    .toLowerCase();

  return (
    transactionType === "ADJUSTMENT" ||
    remarks.startsWith("adjusted up donation stock") ||
    remarks.startsWith("adjusted down donation stock") ||
    remarks.includes("donation adjustment")
  );
};

const buildDonationAuditActionLabel = (row) => {
  if (!isDonationAuditRow(row)) {
    return null;
  }

  if (isDonationAdjustmentAuditRow(row)) {
    return "Donation Adjustment";
  }

  if (row.entity_type === "DONATION" && row.action === "DONATION_CREATE") {
    return "Donation Entry";
  }

  if (
    row.entity_type === "DONATION" &&
    row.action === "DONATION_PUBLIC_NAME_UPDATE"
  ) {
    return "Donor Name Visibility Updated";
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

  if (
    row.entity_type === "INVENTORY_TRANSACTION" &&
    transactionType === "INFLOW"
  ) {
    return "Donated Stock Added";
  }

  if (
    row.entity_type === "INVENTORY_TRANSACTION" &&
    transactionType === "OUTFLOW"
  ) {
    return "Donated Stock Removed";
  }

  return null;
};

const isDistributionAuditRow = (row) => {
  return (
    row.entity_type === "DISTRIBUTION_TRANSACTION" &&
    ["DISTRIBUTION_RECORD", "DISTRIBUTION_QR_CLAIM"].includes(row.action)
  );
};

const isSyncAuditRow = (row) =>
  ["SYNC_CONFLICT", "SYNC_TRANSACTION"].includes(row.entity_type);

const buildSyncAuditActionLabel = (row) => {
  if (!isSyncAuditRow(row)) {
    return null;
  }

  if (row.action === "SYNC_CONFLICT_RESOLUTION") {
    return "Sync Conflict Resolved";
  }

  if (row.action === "SYNC_RETRY_REQUEST") {
    return "Sync Retry Requested";
  }

  return "Sync Activity";
};

const SYNC_CONFLICT_TYPE_LABELS = {
  INVENTORY_STOCK_STATE_DRIFT: "Inventory Stock Difference",
  DUPLICATE_INVENTORY_ITEM: "Possible Duplicate Inventory Item",
  DUPLICATE_INVENTORY_BARCODE: "Barcode Used for Another Packaging",
  DUPLICATE_INVENTORY_BATCH: "Possible Duplicate Inventory Batch",
  POSSIBLE_CROSS_BARANGAY_HOUSEHOLD_DUPLICATE:
    "Possible Cross-Barangay Household Duplicate",
};

const SYNC_RESOLUTION_PRESENTATIONS = {
  MARK_REVIEWED: {
    decision: "Conflict reviewed",
    summary: "Conflict reviewed; saved record kept",
    result:
      "The conflict was closed without changing the saved DISTYNC record.",
  },
  KEEP_SERVER: {
    decision: "Kept first accepted record",
    summary: "Kept saved record; offline record discarded",
    result:
      "The first record accepted by DISTYNC was kept. The offline entry was treated as a duplicate.",
  },
  APPLY_LOCAL: {
    decision: "Applied offline record",
    summary: "Applied offline record",
    result: "The offline record was accepted after review.",
  },
  ACCEPT_BOTH: {
    decision: "Accepted both records",
    summary: "Accepted both records; separate batch created",
    result: "Both records were kept as separate inventory batches.",
  },
};

const formatSyncConflictType = (value) => {
  const normalizedValue = String(value || "").trim().toUpperCase();

  if (!normalizedValue) {
    return "Sync conflict";
  }

  return (
    SYNC_CONFLICT_TYPE_LABELS[normalizedValue] ||
    formatAuditStatus(normalizedValue)
  );
};

const getSyncPayload = (payload) => {
  if (
    payload?.payload &&
    typeof payload.payload === "object" &&
    !Array.isArray(payload.payload)
  ) {
    return payload.payload;
  }

  return payload && typeof payload === "object" ? payload : {};
};

const getSyncPayloadValue = (payload, keys = []) => {
  const normalizedPayload = getSyncPayload(payload);

  for (const key of keys) {
    const value = key
      .split(".")
      .reduce((current, segment) => current?.[segment], normalizedPayload);

    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return null;
};

const getSyncConflictType = (row) =>
  String(
    row.sync_conflict_type ||
      row.new_values_json?.conflict_type ||
      row.old_values_json?.conflict_type ||
      row.new_values_json?.entity_type ||
      row.entity_type ||
      "",
  )
    .trim()
    .toUpperCase();

const getSyncConflictEntityType = (row) =>
  String(row.sync_conflict_entity_type || row.entity_type || "")
    .trim()
    .toUpperCase();

const getSyncResolutionAcceptedPayload = (row) => {
  const resolvedPayload = getSyncPayload(
    row.sync_conflict_resolved_payload_json,
  );
  const explicitAcceptedPayload =
    resolvedPayload.acceptedPayload ||
    resolvedPayload.accepted_payload ||
    resolvedPayload.correctedPayload ||
    resolvedPayload.corrected_payload;

  if (
    explicitAcceptedPayload &&
    typeof explicitAcceptedPayload === "object" &&
    !Array.isArray(explicitAcceptedPayload)
  ) {
    return getSyncPayload(explicitAcceptedPayload);
  }

  if (getSyncResolutionAction(row) !== "APPLY_LOCAL") {
    return {};
  }

  // Older resolutions did not persist the final corrected snapshot.  Rebuild
  // the small part needed for the audit from the original device payload and
  // the persisted resolution result so existing records remain understandable.
  const fallbackPayload = {
    ...getSyncPayload(row.sync_conflict_local_payload_json),
  };
  const replacementBarcode = getSyncPayloadValue(resolvedPayload, [
    "replacementBarcode",
    "replacement_barcode",
  ]);

  if (isAuditBooleanTrue(resolvedPayload.savedWithoutBarcode)) {
    if (getSyncConflictEntityType(row) === "INVENTORY_BATCH") {
      fallbackPayload.stock_form_barcode = null;
    } else {
      fallbackPayload.barcode = null;
    }
  } else if (replacementBarcode) {
    if (getSyncConflictEntityType(row) === "INVENTORY_BATCH") {
      fallbackPayload.stock_form_barcode = replacementBarcode;
    } else {
      fallbackPayload.barcode = replacementBarcode;
    }
  }

  const resolvedBatchNumber = getSyncPayloadValue(resolvedPayload, [
    "batchNumber",
    "batch_number",
    "batch_no",
  ]);

  if (resolvedBatchNumber) {
    fallbackPayload.batch_no = resolvedBatchNumber;
  }

  return fallbackPayload;
};

const SYNC_CORRECTION_FIELD_DEFINITIONS = [
  { key: "item_code", label: "Item Code", keys: ["item_code", "itemCode"] },
  { key: "item_name", label: "Item Name", keys: ["item_name", "itemName"] },
  { key: "category", label: "Category", keys: ["category"] },
  {
    key: "unit_of_measure",
    label: "Unit",
    keys: ["unit_of_measure", "unitOfMeasure", "stock_form_unit_of_measure"],
    batchKeys: [
      "stock_form_unit_of_measure",
      "unit_of_measure",
      "unitOfMeasure",
    ],
  },
  {
    key: "unit_of_measure_value",
    label: "Unit Value",
    keys: [
      "unit_of_measure_value",
      "unitOfMeasureValue",
      "stock_form_unit_of_measure_value",
    ],
    batchKeys: [
      "stock_form_unit_of_measure_value",
      "unit_of_measure_value",
      "unitOfMeasureValue",
    ],
  },
  {
    key: "packaging",
    label: "Packaging",
    keys: ["packaging", "stock_form_packaging"],
    batchKeys: ["stock_form_packaging", "packaging"],
  },
  {
    key: "packaging_count",
    label: "Packaging Count",
    keys: ["packaging_count", "stock_form_units_per_packaging"],
    batchKeys: ["stock_form_units_per_packaging", "packaging_count"],
  },
  {
    key: "quantity",
    label: "Quantity",
    keys: ["quantity", "quantity_received"],
    batchKeys: ["quantity_received", "quantity"],
  },
  { key: "reorder_level", label: "Reorder Level", keys: ["reorder_level"] },
  {
    key: "expiration_date",
    label: "Expiration Date",
    keys: ["expiration_date"],
  },
  {
    key: "barcode",
    label: "Barcode",
    keys: [
      "barcode",
      "item_barcode",
      "stock_form_barcode",
      "stockFormBarcode",
    ],
    batchKeys: [
      "stock_form_barcode",
      "barcode",
      "item_barcode",
      "stockFormBarcode",
    ],
  },
  { key: "batch_no", label: "Batch Number", keys: ["batch_no", "batch_number"] },
  { key: "source_type", label: "Source", keys: ["source_type"] },
  {
    key: "storage_location",
    label: "Storage Location",
    keys: ["storage_location"],
  },
];

const getSyncPayloadField = (payload, keys = []) => {
  const normalizedPayload = getSyncPayload(payload);

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(normalizedPayload, key)) {
      return {
        present: true,
        value: normalizedPayload[key],
      };
    }
  }

  return {
    present: false,
    value: undefined,
  };
};

const normalizeSyncCorrectionValue = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (Array.isArray(value) || (value && typeof value === "object")) {
    return JSON.stringify(value);
  }

  return String(value).trim();
};

const formatSyncCorrectionValue = (field, value) => {
  if (field.key === "barcode" && (value === undefined || value === null || value === "")) {
    return "No barcode";
  }

  if (field.key === "expiration_date") {
    return formatAuditValue("expiration_date", value);
  }

  if (field.key === "unit_of_measure_value") {
    return formatAuditValue("unit_of_measure_value", value);
  }

  if (field.key === "source_type") {
    return formatAuditStatus(value);
  }

  if (value === undefined || value === null || value === "") {
    return "--";
  }

  return String(value);
};

const buildSyncResolutionCorrectionChanges = (row) => {
  if (getSyncResolutionAction(row) !== "APPLY_LOCAL") {
    return [];
  }

  const localPayload = getSyncPayload(row.sync_conflict_local_payload_json);
  const acceptedPayload = getSyncResolutionAcceptedPayload(row);
  const useBatchFields =
    getSyncConflictEntityType(row) === "INVENTORY_BATCH" ||
    getSyncConflictType(row) === "DUPLICATE_INVENTORY_ITEM";

  return SYNC_CORRECTION_FIELD_DEFINITIONS.flatMap((field) => {
    const fieldKeys = useBatchFields && field.batchKeys ? field.batchKeys : field.keys;
    const previous = getSyncPayloadField(localPayload, fieldKeys);
    const next = getSyncPayloadField(acceptedPayload, fieldKeys);

    // Only show fields that were present in both snapshots.  This omits
    // defaults added while saving and keeps the table focused on the reviewer's
    // actual correction.
    if (
      !previous.present ||
      !next.present ||
      normalizeSyncCorrectionValue(previous.value) ===
        normalizeSyncCorrectionValue(next.value)
    ) {
      return [];
    }

    return [
      {
        field: field.key,
        label: field.label,
        previous_value: formatSyncCorrectionValue(field, previous.value),
        new_value: formatSyncCorrectionValue(field, next.value),
      },
    ];
  });
};

const buildSyncInventoryRecordLabel = (payload) => {
  const itemName = getSyncPayloadValue(payload, [
    "item_name",
    "itemName",
    "inventory_item_name",
    "inventory_item.item_name",
  ]);
  const itemCode = getSyncPayloadValue(payload, [
    "item_code",
    "itemCode",
    "inventory_item.item_code",
  ]);
  const barcode = getSyncPayloadValue(payload, [
    "barcode",
    "item_barcode",
    "stock_form_barcode",
    "inventory_item.barcode",
    "inventory_item_stock_form.barcode",
    "stock_form.barcode",
  ]);
  const batchNumber = getSyncPayloadValue(payload, [
    "batch_no",
    "batch_number",
    "inventory_batch_no",
  ]);
  const baseLabel = itemName || itemCode || batchNumber || "Inventory record";
  const labelWithBarcode = barcode
    ? `${baseLabel} (${barcode})`
    : baseLabel;

  return batchNumber && batchNumber !== baseLabel
    ? `${labelWithBarcode} - ${batchNumber}`
    : labelWithBarcode;
};

const buildSyncAuditRecordLabel = (payload) => {
  const itemName = getSyncPayloadValue(payload, [
    "item_name",
    "itemName",
    "inventory_item_name",
    "inventory_item.item_name",
    "item.name",
  ]);
  const itemCode = getSyncPayloadValue(payload, [
    "item_code",
    "itemCode",
    "inventory_item.item_code",
  ]);
  const barcode = getSyncPayloadValue(payload, [
    "barcode",
    "item_barcode",
    "stock_form_barcode",
    "stockFormBarcode",
    "inventory_item.barcode",
    "inventory_item_stock_form.barcode",
    "stock_form.barcode",
  ]);
  const batchNumber = getSyncPayloadValue(payload, [
    "batch_no",
    "batch_number",
    "inventory_batch_no",
  ]);
  const details = [
    itemName
      ? `Item: ${itemName}`
      : itemCode
        ? `Item Code: ${itemCode}`
        : null,
    `Barcode: ${barcode || "No barcode"}`,
    batchNumber ? `Batch Number: ${batchNumber}` : null,
  ].filter(Boolean);

  return details.length ? details.join(" | ") : "Inventory record details unavailable";
};

const hasSyncPayload = (payload) =>
  Object.keys(getSyncPayload(payload)).length > 0;

const getSyncResolutionAction = (row) =>
  String(
    row.sync_conflict_resolution_action ||
      row.new_values_json?.resolution_action ||
      "",
  )
    .trim()
    .toUpperCase();

const buildSyncResolutionSummary = (row) => {
  const resolutionAction = getSyncResolutionAction(row);

  const presentation = SYNC_RESOLUTION_PRESENTATIONS[
    resolutionAction
  ];

  return presentation?.summary || null;
};

const getSyncResolutionRecordPayloads = (row, resolutionAction) => {
  const serverPayload = row.sync_conflict_server_payload_json;
  const localPayload = getSyncPayload(row.sync_conflict_local_payload_json);

  if (resolutionAction === "ACCEPT_BOTH") {
    const acceptedBatchNumber = getSyncPayloadValue(
      row.sync_conflict_resolved_payload_json,
      ["batchNumber", "batch_number", "batch_no"],
    );

    return [
      serverPayload,
      acceptedBatchNumber
        ? { ...localPayload, batch_no: acceptedBatchNumber }
        : localPayload,
    ];
  }

  if (resolutionAction === "APPLY_LOCAL") {
    return [serverPayload, localPayload];
  }

  return [serverPayload, localPayload];
};

const buildSyncResolutionResult = (row, resolutionAction) => {
  if (resolutionAction === "APPLY_LOCAL") {
    const conflictType = getSyncConflictType(row);
    const resolvedPayload = getSyncPayload(
      row.sync_conflict_resolved_payload_json,
    );

    if (
      conflictType === "DUPLICATE_INVENTORY_BARCODE" &&
      isAuditBooleanTrue(resolvedPayload.savedWithoutBarcode)
    ) {
      return "The saved record remained first. The duplicate device record was saved as a manual item without a barcode.";
    }

    if (conflictType === "DUPLICATE_INVENTORY_ITEM") {
      return "The saved item remained first. The duplicate packaging was corrected and added under that item.";
    }

    if (conflictType === "DUPLICATE_INVENTORY_BARCODE") {
      return "The saved record remained first. The duplicate device record was corrected and applied.";
    }

    return "The accepted first record remained unchanged, and the duplicate record was corrected and applied.";
  }

  if (resolutionAction !== "ACCEPT_BOTH") {
    return SYNC_RESOLUTION_PRESENTATIONS[resolutionAction]?.result || null;
  }

  const resolvedPayload = getSyncPayload(
    row.sync_conflict_resolved_payload_json,
  );
  const localEntryOrder = String(
    resolvedPayload.batchNumberOrdering?.localEntryOrder || "",
  ).toUpperCase();

  if (localEntryOrder === "EARLIER") {
    return "Both records were kept as separate inventory batches. The offline record was recorded first, so it kept the earlier batch position.";
  }

  return "Both records were kept as separate inventory batches. The saved record remained first, and the offline record received the next available batch number.";
};

const getSyncResolutionRecordLabels = (resolutionAction) => {
  if (resolutionAction === "KEEP_SERVER") {
    return ["Kept Record", "Duplicate Record"];
  }

  if (resolutionAction === "APPLY_LOCAL") {
    return ["Accepted First", "Duplicate Record"];
  }

  return ["Saved Record", "Offline Record"];
};

const SYNC_RECORD_COMPARISON_FIELD_DEFINITIONS = [
  {
    key: "family_head",
    label: "Family Head",
    keys: [
      "family_head_name",
      "familyHeadName",
      "family_head.full_name",
      "family_head.name",
      "familyHead.fullName",
      "familyHead.name",
    ],
  },
  {
    key: "stub_number",
    label: "Stub No.",
    keys: [
      "display_stub_no",
      "display_stub_number",
      "stub_no",
      "stub_number",
    ],
  },
  {
    key: "receipt_number",
    label: "Receipt No.",
    keys: ["receipt_no", "receipt_number"],
  },
  {
    key: "barangay",
    label: "Barangay",
    keys: [
      "barangay_name",
      "barangayName",
      "barangay.name",
      "assigned_barangay_name",
      "assigned_barangay",
    ],
  },
  {
    key: "disaster_event",
    label: "Disaster Event",
    keys: [
      "disaster_event_title",
      "disasterEventTitle",
      "disaster_event.name",
      "disasterEvent.name",
    ],
  },
  {
    key: "remarks",
    label: "Remarks",
    keys: ["remarks"],
  },
  {
    key: "item",
    label: "Item",
    keys: [
      "item_name",
      "itemName",
      "inventory_item_name",
      "inventory_item.item_name",
      "item.name",
    ],
  },
  {
    key: "barcode",
    label: "Barcode",
    keys: [
      "barcode",
      "item_barcode",
      "stock_form_barcode",
      "stockFormBarcode",
      "inventory_item.barcode",
      "inventory_item_stock_form.barcode",
      "stock_form.barcode",
    ],
  },
  {
    key: "packaging",
    label: "Packaging",
    keys: [
      "packaging",
      "stock_form_packaging",
      "inventory_item.packaging",
      "inventory_item_stock_form.packaging",
      "stock_form.packaging",
    ],
  },
  {
    key: "units_per_packaging",
    label: "Units per Packaging",
    keys: [
      "units_per_packaging",
      "stock_form_units_per_packaging",
      "inventory_item_stock_form.units_per_packaging",
      "stock_form.units_per_packaging",
    ],
  },
  {
    key: "quantity",
    label: "Quantity",
    keys: ["quantity", "quantity_needed", "quantity_received"],
  },
  {
    key: "batch_number",
    label: "Batch No.",
    keys: ["batch_no", "batch_number", "inventory_batch_no"],
  },
  {
    key: "donor",
    label: "Donor",
    keys: ["donor_name", "donorName"],
  },
];

const SYNC_RECORD_DATE_TIME_LABEL = "Date & Time";
const SYNC_RECORD_DATE_TIME_NOTE =
  "Date & Time shows when each record was captured or last updated in its source system.";
const SYNC_RECORD_COMPARISON_MISSING_VALUE = "Not available";

const getSyncComparisonValue = (payload, keys = []) => {
  const normalizedPayload = getSyncPayload(payload);

  for (const key of keys) {
    const value = key
      .split(".")
      .reduce((current, segment) => current?.[segment], normalizedPayload);

    if (
      value !== undefined &&
      value !== null &&
      typeof value !== "object" &&
      String(value).trim() !== ""
    ) {
      return String(value).trim();
    }
  }

  return null;
};

const getSyncRecordDateTime = (payload, fallbackValue = null) =>
  fallbackValue ||
  getSyncComparisonValue(payload, [
    "client_timestamp",
    "clientTimestamp",
    "registered_at",
    "registeredAt",
    "updated_at",
    "updatedAt",
    "created_at",
    "createdAt",
  ]);

const getSyncRecordComparisonValue = (payload, field) =>
  getSyncComparisonValue(payload, field.keys);

const formatSyncRecordComparisonValue = (value) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return SYNC_RECORD_COMPARISON_MISSING_VALUE;
  }

  return String(value).trim();
};

const buildSyncRecordComparison = (row, recordPayloads, recordLabels) => {
  const [savedPayload, offlinePayload] = recordPayloads;
  const localDateTime = getSyncRecordDateTime(
    offlinePayload,
    row.sync_conflict_client_timestamp ||
      row.sync_conflict_transaction_created_at,
  );
  const savedDateTime = getSyncRecordDateTime(savedPayload);
  const fieldValues = SYNC_RECORD_COMPARISON_FIELD_DEFINITIONS.map((field) => ({
    ...field,
    savedValue: getSyncRecordComparisonValue(savedPayload, field),
    offlineValue: getSyncRecordComparisonValue(offlinePayload, field),
  })).filter(
    (field) => field.savedValue !== null || field.offlineValue !== null,
  );

  if (savedDateTime || localDateTime) {
    fieldValues.push({
      key: "record_date_time",
      label: SYNC_RECORD_DATE_TIME_LABEL,
      savedValue: savedDateTime,
      offlineValue: localDateTime,
      isDateTime: true,
    });
  }

  return {
    note: SYNC_RECORD_DATE_TIME_NOTE,
    records: recordPayloads.map((payload, index) => {
      const isSavedRecord = index === 0;

      return {
        label: recordLabels[index],
        fields: fieldValues.map((field) => {
          const rawValue = isSavedRecord
            ? field.savedValue
            : field.offlineValue;

          return {
            field: field.key,
            label: field.label,
            value: field.isDateTime && rawValue
              ? formatAuditDateTime(rawValue)
              : formatSyncRecordComparisonValue(rawValue),
          };
        }),
      };
    }),
  };
};

const buildSyncResolutionDetail = (row) => {
  if (row.action !== "SYNC_CONFLICT_RESOLUTION") {
    return null;
  }

  const resolutionAction = getSyncResolutionAction(row);
  const presentation = SYNC_RESOLUTION_PRESENTATIONS[resolutionAction];

  if (!presentation) {
    return null;
  }

  const conflictType = formatSyncConflictType(
    row.sync_conflict_type || row.new_values_json?.conflict_type,
  );
  const recordPayloads = getSyncResolutionRecordPayloads(
    row,
    resolutionAction,
  );
  const recordLabels = getSyncResolutionRecordLabels(resolutionAction);
  const reviewNote =
    row.sync_conflict_resolution_reason ||
    row.new_values_json?.reason ||
    "No review note provided";
  const correctionChanges = buildSyncResolutionCorrectionChanges(row);

  return {
    resolution_action: resolutionAction,
    changes: [
      {
        field: "conflict_type",
        label: "Conflict",
        new_value: conflictType,
      },
      {
        field: "decision",
        label: "Decision",
        new_value: presentation.decision,
      },
      {
        field: "result",
        label: "Result",
        new_value: buildSyncResolutionResult(row, resolutionAction),
      },
      {
        field: "reason",
        label: "Reason",
        new_value: reviewNote,
      },
    ],
    record_comparison: buildSyncRecordComparison(
      row,
      recordPayloads,
      recordLabels,
    ),
    correction_changes: correctionChanges,
  };
};

const buildSyncRecordLines = (row) => {
  const conflictType = getSyncConflictType(row);
  const resolutionAction = getSyncResolutionAction(row);

  if (
    row.action === "SYNC_CONFLICT_RESOLUTION" &&
    SYNC_RESOLUTION_PRESENTATIONS[resolutionAction]
  ) {
    const recordPayloads = getSyncResolutionRecordPayloads(
      row,
      resolutionAction,
    );

    const recordLabels = getSyncResolutionRecordLabels(resolutionAction);
    const recordLines = recordPayloads
      .map((payload, index) => {
        if (!hasSyncPayload(payload)) {
          return null;
        }

        return `${recordLabels[index] || "Record"}: ${buildSyncAuditRecordLabel(payload)}`;
      })
      .filter(Boolean);

    if (recordLines.length) {
      return recordLines;
    }
  }

  return [
    formatSyncConflictType(conflictType),
    resolutionAction
      ? `Resolution: ${
          SYNC_RESOLUTION_PRESENTATIONS[resolutionAction]?.decision ||
          formatAuditStatus(resolutionAction)
        }`
      : null,
  ].filter(Boolean);
};

const buildDistributionAuditActionLabel = (row) => {
  return isDistributionAuditRow(row) ? "Distributed Items" : null;
};

const buildInventoryRecordLines = (row) => {
  const isInventoryItemEdit =
    row.entity_type === "INVENTORY_ITEM" &&
    row.action === "INVENTORY_ITEM_UPDATE";
  const recordValues = isInventoryItemEdit
    ? row.old_values_json || {}
    : row.new_values_json || {};
  const itemName =
    recordValues.item_name ||
    (isInventoryItemEdit ? row.old_values_json?.item_name : null) ||
    row.inventory_item_name ||
    row.new_values_json?.item_name ||
    row.old_values_json?.item_name ||
    "Inventory record";
  const batchNo =
    recordValues.batch_no ||
    row.inventory_batch_no ||
    row.new_values_json?.batch_no ||
    row.old_values_json?.batch_no ||
    null;
  const barcode =
    recordValues.barcode ||
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
  const uniqueChangedFieldLabels = buildReliefPackTemplateEditChanges(row).map(
    ({ label }) => label,
  );

  if (buildAuditDetailItemChanges(row).length > 0) {
    uniqueChangedFieldLabels.push("Template Items");
  }

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
    buildSyncAuditActionLabel(row) ||
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
      "INVENTORY_ITEM_STOCK_FORM",
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

  if (isSyncAuditRow(row)) {
    return buildSyncRecordLines(row).join(" - ");
  }

  return null;
};

const mapAuditLog = (row, relatedRows = []) => {
  const isReliefPackTemplate = row.entity_type === "RELIEF_PACK_TEMPLATE";
  const isDonation = isDonationAuditRow(row);
  const isDistribution = isDistributionAuditRow(row);
  const isSync = isSyncAuditRow(row);
  const recordLines = isDonation
    ? buildDonationRecordLines(row)
    : isDistribution
      ? buildDistributionRecordLines(row)
      : isSync
        ? buildSyncRecordLines(row)
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
        : isSync
          ? buildSyncResolutionSummary(row)
          : buildInventoryAuditActionDetail(row),
    module: isDonation
      ? "Donation"
      : isDistribution
        ? "Distribution"
        : isSync
          ? "Sync Center"
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
    timestamp: isDistribution
      ? row.distribution_date || row.created_at
      : row.action === "SYNC_CONFLICT_RESOLUTION"
        ? row.sync_conflict_resolved_at || row.created_at
        : row.created_at,
    status: "SUCCESS",
    details: {
      changed_fields: buildValueSummary(row.new_values_json),
      previous_fields: buildValueSummary(row.old_values_json),
    },
    audit_detail: buildAuditDetail(row, relatedRows),
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

  const auditLogRows = auditLogs;
  const itemCreationRows = auditLogRows.filter(isInventoryItemCreatedAudit);
  const packagingAddedRows = auditLogRows.filter(isInventoryPackagingAddedAudit);
  const relatedItemCreationAuditRows =
    itemCreationRows.length &&
    typeof systemLogRepository.getInventoryItemCreationRelatedAuditLogs === "function"
      ? await systemLogRepository.getInventoryItemCreationRelatedAuditLogs({
          itemIds: itemCreationRows.map((row) => row.entity_id),
        })
      : [];
  const relatedPackagingAddedAuditRows =
    packagingAddedRows.length &&
    typeof systemLogRepository.getInventoryPackagingAddedRelatedAuditLogs ===
      "function"
      ? await systemLogRepository.getInventoryPackagingAddedRelatedAuditLogs({
          stockFormIds: packagingAddedRows.map((row) => row.entity_id),
        })
      : [];
  const relatedRowsByItemId = new Map();
  const relatedRowsByStockFormId = new Map();

  relatedItemCreationAuditRows.forEach((row) => {
    const itemId = getRelatedInventoryItemId(row);

    if (!itemId) {
      return;
    }

    const rows = relatedRowsByItemId.get(itemId) || [];
    rows.push(row);
    relatedRowsByItemId.set(itemId, rows);
  });

  relatedPackagingAddedAuditRows.forEach((row) => {
    const stockFormId = getRelatedInventoryStockFormId(row);

    if (!stockFormId) {
      return;
    }

    const rows = relatedRowsByStockFormId.get(stockFormId) || [];
    rows.push(row);
    relatedRowsByStockFormId.set(stockFormId, rows);
  });

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
    audit_logs: auditLogRows.map((row) =>
      mapAuditLog(
        row,
        relatedRowsByItemId.get(String(row.entity_id || "").trim()) ||
          relatedRowsByStockFormId.get(String(row.entity_id || "").trim()) ||
          [],
      ),
    ),
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
