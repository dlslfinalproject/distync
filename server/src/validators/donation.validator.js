const donationStatuses = [
  "RECEIVED",
  "PARTIALLY_DISTRIBUTED",
  "DISTRIBUTED",
  "CANCELLED",
];

const donorTypes = [
  "INDIVIDUAL",
  "NGO",
  "PRIVATE_ORGANIZATION",
  "GOVERNMENT_PARTNER",
  "OTHER",
];
const donationExportTypes = ["LOOSE_ITEM", "RELIEF_PACK"];
const donationExportSortOrders = ["newest", "oldest", "az", "za"];
const invalidDonorTypeMessage = "Please select a valid donor type.";
const invalidDonorTypeOtherMessage =
  "Please specify the donor type when Other is selected.";

const priorityLevels = ["LOW", "MEDIUM", "HIGH", "URGENT"];

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isValidUuid = (value) => {
  return typeof value === "string" && uuidPattern.test(value);
};

const isValidDateTimeString = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  const parsedDate = new Date(value);
  return !Number.isNaN(parsedDate.getTime());
};

const parseOptionalBoolean = (value) => {
  if (value === undefined) {
    return { isProvided: false, value: null };
  }

  if (value === "true" || value === true) {
    return { isProvided: true, value: true };
  }

  if (value === "false" || value === false) {
    return { isProvided: true, value: false };
  }

  return { isProvided: true, value: "invalid" };
};

const normalizeNullableString = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return "invalid";
  }

  const trimmedValue = value.trim();
  return trimmedValue || null;
};

const isReliefPackRemark = (remarks) =>
  String(remarks || "").trim().toLowerCase().startsWith("relief pack:");

const isPerFamilyAllocationRemark = (remarks) =>
  /^Per Family Allocation:\s*[1-9]\d*$/i.test(String(remarks || "").trim());

const parsePerFamilyAllocationRemark = (remarks) => {
  const matchedRemark = String(remarks || "")
    .trim()
    .match(/^Per Family Allocation:\s*(\d+)$/i);

  return Number(matchedRemark?.[1] || 0);
};

const parsePositiveInteger = (value) => {
  const parsedValue = Number(value);

  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
};

const parsePositiveNumber = (value) => {
  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
};

const normalizeDonationInventoryItemDefinition = (definition, index) => {
  const fieldPrefix = `items[${index}].new_inventory_item`;

  if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
    throw new Error(`${fieldPrefix} must be an object`);
  }

  if (
    typeof definition.item_name !== "string" ||
    !definition.item_name.trim()
  ) {
    throw new Error(`${fieldPrefix}.item_name must be a non-empty string`);
  }

  if (
    typeof definition.category !== "string" ||
    !definition.category.trim()
  ) {
    throw new Error(`${fieldPrefix}.category must be a non-empty string`);
  }

  if (
    typeof definition.unit_of_measure !== "string" ||
    !definition.unit_of_measure.trim()
  ) {
    throw new Error(`${fieldPrefix}.unit_of_measure must be a non-empty string`);
  }

  if (
    definition.packaging === undefined ||
    definition.packaging === null ||
    typeof definition.packaging !== "string" ||
    !definition.packaging.trim()
  ) {
    throw new Error(`${fieldPrefix}.packaging must be a non-empty string`);
  }

  const unitOfMeasureValue =
    definition.unit_of_measure_value === undefined ||
    definition.unit_of_measure_value === null ||
    definition.unit_of_measure_value === ""
      ? 1
      : parsePositiveNumber(definition.unit_of_measure_value);
  const quantity = parsePositiveInteger(definition.quantity);
  const packagingCount = parsePositiveInteger(definition.packaging_count);

  if (!unitOfMeasureValue) {
    throw new Error(
      `${fieldPrefix}.unit_of_measure_value must be a positive number`,
    );
  }

  if (!quantity) {
    throw new Error(`${fieldPrefix}.quantity must be a positive integer`);
  }

  if (!packagingCount) {
    throw new Error(
      `${fieldPrefix}.packaging_count must be a positive integer`,
    );
  }

  if (
    definition.expiration_date !== undefined &&
    definition.expiration_date !== null &&
    !isValidDateTimeString(definition.expiration_date)
  ) {
    throw new Error(`${fieldPrefix}.expiration_date must be a valid date or null`);
  }

  if (
    definition.barcode !== undefined &&
    definition.barcode !== null &&
    typeof definition.barcode !== "string"
  ) {
    throw new Error(`${fieldPrefix}.barcode must be a string or null`);
  }

  if (
    definition.is_perishable !== undefined &&
    typeof definition.is_perishable !== "boolean"
  ) {
    throw new Error(`${fieldPrefix}.is_perishable must be a boolean when provided`);
  }

  const normalizedCategory = definition.category.trim().toLowerCase();

  return {
    item_name: definition.item_name.trim(),
    category:
      normalizedCategory === "perishable"
        ? "Perishable"
        : normalizedCategory === "non-perishable"
          ? "Non-Perishable"
          : definition.category.trim(),
    unit_of_measure: definition.unit_of_measure.trim(),
    unit_of_measure_value: unitOfMeasureValue,
    packaging: definition.packaging.trim(),
    packaging_count: packagingCount,
    quantity,
    expiration_date: definition.expiration_date ?? null,
    barcode: definition.barcode?.trim() || null,
    is_perishable:
      definition.is_perishable ?? normalizedCategory === "perishable",
    is_active: true,
    skip_opening_stock: true,
  };
};

const validateDonationNeedId = (req, res, next) => {
  if (!isValidUuid(req.params.id)) {
    return res.status(400).json({
      message: "id must be a valid UUID",
    });
  }

  return next();
};

const validateDonationId = (req, res, next) => {
  if (!isValidUuid(req.params.id)) {
    return res.status(400).json({
      message: "id must be a valid UUID",
    });
  }

  return next();
};

const validateDonationItemId = (req, res, next) => {
  if (!isValidUuid(req.params.id)) {
    return res.status(400).json({
      message: "id must be a valid UUID",
    });
  }

  return next();
};

const validateDonationNeedFilters = (req, res, next) => {
  const { disaster_event_id, inventory_item_id, is_active, search } = req.query;
  const parsedIsActive = parseOptionalBoolean(is_active);

  if (disaster_event_id !== undefined && !isValidUuid(disaster_event_id)) {
    return res.status(400).json({
      message: "disaster_event_id must be a valid UUID when provided",
    });
  }

  if (inventory_item_id !== undefined && !isValidUuid(inventory_item_id)) {
    return res.status(400).json({
      message: "inventory_item_id must be a valid UUID when provided",
    });
  }

  if (parsedIsActive.value === "invalid") {
    return res.status(400).json({
      message: "is_active must be true or false when provided",
    });
  }

  req.validatedQuery = {
    disaster_event_id: disaster_event_id || null,
    inventory_item_id: inventory_item_id || null,
    is_active: parsedIsActive.isProvided ? parsedIsActive.value : null,
    search: typeof search === "string" && search.trim() ? search.trim() : null,
  };

  return next();
};

const validateDonationNeedPayload = (req, res, next) => {
  const {
    disaster_event_id,
    inventory_item_id,
    quantity_needed,
    priority_level,
    notes,
    is_active,
  } = req.body;

  if (!isValidUuid(disaster_event_id)) {
    return res.status(400).json({
      message: "disaster_event_id is required and must be a valid UUID",
    });
  }

  if (!isValidUuid(inventory_item_id)) {
    return res.status(400).json({
      message: "inventory_item_id is required and must be a valid UUID",
    });
  }

  if (!Number.isInteger(quantity_needed) || quantity_needed < 0) {
    return res.status(400).json({
      message: "quantity_needed is required and must be a non-negative integer",
    });
  }

  if (!priorityLevels.includes(priority_level)) {
    return res.status(400).json({
      message: "priority_level must be one of: LOW, MEDIUM, HIGH, URGENT",
    });
  }

  if (notes !== undefined && notes !== null && typeof notes !== "string") {
    return res.status(400).json({
      message: "notes must be a string or null",
    });
  }

  if (is_active !== undefined && typeof is_active !== "boolean") {
    return res.status(400).json({
      message: "is_active must be a boolean when provided",
    });
  }

  req.validatedBody = {
    disaster_event_id,
    inventory_item_id,
    quantity_needed,
    priority_level,
    notes: notes?.trim() || null,
    is_active: is_active ?? true,
  };

  return next();
};

const validateDonationFilters = (req, res, next) => {
  const { disaster_event_id, donor_type, status, search } = req.query;

  if (disaster_event_id !== undefined && !isValidUuid(disaster_event_id)) {
    return res.status(400).json({
      message: "disaster_event_id must be a valid UUID when provided",
    });
  }

  if (donor_type !== undefined && !donorTypes.includes(donor_type)) {
    return res.status(400).json({
      message: invalidDonorTypeMessage,
    });
  }

  if (status !== undefined && !donationStatuses.includes(status)) {
    return res.status(400).json({
      message:
        "status must be one of: RECEIVED, PARTIALLY_DISTRIBUTED, DISTRIBUTED, CANCELLED",
    });
  }

  req.validatedQuery = {
    disaster_event_id: disaster_event_id || null,
    donor_type: donor_type || null,
    status: status || null,
    search: typeof search === "string" && search.trim() ? search.trim() : null,
  };

  return next();
};

const validateDonationExportFilters = (req, res, next) => {
  const {
    disaster_event_id,
    donation_type,
    donor_type,
    sort_order,
    search,
  } = req.query;

  if (disaster_event_id !== undefined && !isValidUuid(disaster_event_id)) {
    return res.status(400).json({
      message: "disaster_event_id must be a valid UUID when provided",
    });
  }

  if (donation_type !== undefined && !donationExportTypes.includes(donation_type)) {
    return res.status(400).json({
      message: "donation_type must be one of: LOOSE_ITEM, RELIEF_PACK",
    });
  }

  if (donor_type !== undefined && !donorTypes.includes(donor_type)) {
    return res.status(400).json({
      message: invalidDonorTypeMessage,
    });
  }

  if (
    sort_order !== undefined &&
    !donationExportSortOrders.includes(sort_order)
  ) {
    return res.status(400).json({
      message: "sort_order must be one of: newest, oldest, az, za",
    });
  }

  req.validatedQuery = {
    disaster_event_id: disaster_event_id || null,
    donation_type: donation_type || null,
    donor_type: donor_type || null,
    sort_order: sort_order || "newest",
    search: typeof search === "string" && search.trim() ? search.trim() : null,
  };

  return next();
};

const validateDonationTransparencyExportFilters = (req, res, next) => {
  const { disaster_event_id, sort_order } = req.query;

  if (disaster_event_id !== undefined && !isValidUuid(disaster_event_id)) {
    return res.status(400).json({
      message: "disaster_event_id must be a valid UUID when provided",
    });
  }

  if (
    sort_order !== undefined &&
    !donationExportSortOrders.includes(sort_order)
  ) {
    return res.status(400).json({
      message: "sort_order must be one of: newest, oldest, az, za",
    });
  }

  req.validatedQuery = {
    disaster_event_id: disaster_event_id || null,
    sort_order: sort_order || "newest",
  };

  return next();
};

const normalizeDonationItem = (item, index) => {
  if (!item || typeof item !== "object") {
    throw new Error(`items[${index}] must be an object`);
  }

  const inventoryItemId =
    item.inventory_item_id === undefined ||
    item.inventory_item_id === null ||
    item.inventory_item_id === ""
      ? null
      : item.inventory_item_id;
  const newInventoryItem =
    item.new_inventory_item === undefined || item.new_inventory_item === null
      ? null
      : normalizeDonationInventoryItemDefinition(item.new_inventory_item, index);

  if (inventoryItemId && !isValidUuid(inventoryItemId)) {
    throw new Error(`items[${index}].inventory_item_id must be a valid UUID`);
  }

  if (!inventoryItemId && !newInventoryItem) {
    throw new Error(
      `items[${index}] must include inventory_item_id or new_inventory_item`,
    );
  }

  if (inventoryItemId && newInventoryItem) {
    throw new Error(
      `items[${index}] cannot include both inventory_item_id and new_inventory_item`,
    );
  }

  if (
    item.inventory_batch_id !== undefined &&
    item.inventory_batch_id !== null &&
    !isValidUuid(item.inventory_batch_id)
  ) {
    throw new Error(`items[${index}].inventory_batch_id must be a valid UUID or null`);
  }

  if (!Number.isInteger(item.quantity_received) || item.quantity_received <= 0) {
    throw new Error(`items[${index}].quantity_received must be a positive integer`);
  }

  if (item.remarks !== undefined && item.remarks !== null && typeof item.remarks !== "string") {
    throw new Error(`items[${index}].remarks must be a string or null`);
  }

  if (
    !isReliefPackRemark(item.remarks) &&
    !isPerFamilyAllocationRemark(item.remarks)
  ) {
    throw new Error(
      `items[${index}].remarks must include a valid Per Family Allocation for loose donated items`,
    );
  }

  const perFamilyAllocation = parsePerFamilyAllocationRemark(item.remarks);

  if (
    perFamilyAllocation > 0 &&
    perFamilyAllocation > item.quantity_received
  ) {
    throw new Error(
      `items[${index}].remarks Per Family Allocation cannot exceed quantity_received`,
    );
  }

  if (
    item.expiration_date !== undefined &&
    item.expiration_date !== null &&
    !isValidDateTimeString(item.expiration_date)
  ) {
    throw new Error(`items[${index}].expiration_date must be a valid date or null`);
  }

  if (
    item.storage_location !== undefined &&
    item.storage_location !== null &&
    typeof item.storage_location !== "string"
  ) {
    throw new Error(`items[${index}].storage_location must be a string or null`);
  }

  if (
    item.inventory_item_stock_form_id !== undefined &&
    item.inventory_item_stock_form_id !== null &&
    !isValidUuid(item.inventory_item_stock_form_id)
  ) {
    throw new Error(
      `items[${index}].inventory_item_stock_form_id must be a valid UUID or null`,
    );
  }

  if (
    item.stock_form_barcode !== undefined &&
    item.stock_form_barcode !== null &&
    typeof item.stock_form_barcode !== "string"
  ) {
    throw new Error(`items[${index}].stock_form_barcode must be a string or null`);
  }

  if (
    item.stock_form_packaging !== undefined &&
    item.stock_form_packaging !== null &&
    (typeof item.stock_form_packaging !== "string" ||
      !item.stock_form_packaging.trim())
  ) {
    throw new Error(
      `items[${index}].stock_form_packaging must be a non-empty string or null`,
    );
  }

  if (
    item.stock_form_units_per_packaging !== undefined &&
    item.stock_form_units_per_packaging !== null &&
    (!Number.isInteger(item.stock_form_units_per_packaging) ||
      item.stock_form_units_per_packaging <= 0)
  ) {
    throw new Error(
      `items[${index}].stock_form_units_per_packaging must be a positive integer or null`,
    );
  }

  if (
    item.stock_form_unit_of_measure !== undefined &&
    item.stock_form_unit_of_measure !== null &&
    (typeof item.stock_form_unit_of_measure !== "string" ||
      !item.stock_form_unit_of_measure.trim())
  ) {
    throw new Error(
      `items[${index}].stock_form_unit_of_measure must be a non-empty string or null`,
    );
  }

  if (
    item.stock_form_unit_of_measure_value !== undefined &&
    item.stock_form_unit_of_measure_value !== null &&
    (!Number.isFinite(Number(item.stock_form_unit_of_measure_value)) ||
      Number(item.stock_form_unit_of_measure_value) <= 0)
  ) {
    throw new Error(
      `items[${index}].stock_form_unit_of_measure_value must be a positive number or null`,
    );
  }

  return {
    inventory_item_id: inventoryItemId,
    new_inventory_item: newInventoryItem,
    inventory_batch_id: item.inventory_batch_id ?? null,
    inventory_item_stock_form_id: item.inventory_item_stock_form_id ?? null,
    quantity_received: item.quantity_received,
    remarks: item.remarks?.trim() || null,
    expiration_date: item.expiration_date ?? null,
    storage_location: item.storage_location?.trim() || null,
    stock_form_barcode: item.stock_form_barcode?.trim() || null,
    stock_form_packaging: item.stock_form_packaging?.trim() || null,
    stock_form_units_per_packaging: item.stock_form_units_per_packaging ?? null,
    stock_form_unit_of_measure: item.stock_form_unit_of_measure?.trim() || null,
    stock_form_unit_of_measure_value:
      item.stock_form_unit_of_measure_value ?? null,
  };
};

const validateDonationPayload = (req, res, next) => {
  const {
    disaster_event_id,
    donor_name,
    donor_type,
    donor_type_other,
    contact_information,
    received_at,
    status,
    remarks,
    items,
  } = req.body;

  if (!isValidUuid(disaster_event_id)) {
    return res.status(400).json({
      message: "disaster_event_id is required and must be a valid UUID",
    });
  }

  if (!donor_name || typeof donor_name !== "string" || !donor_name.trim()) {
    return res.status(400).json({
      message: "donor_name is required and must be a non-empty string",
    });
  }

  if (!donorTypes.includes(donor_type)) {
    return res.status(400).json({
      message: invalidDonorTypeMessage,
    });
  }

  const normalizedOtherDonorType = normalizeNullableString(donor_type_other);

  if (normalizedOtherDonorType === "invalid") {
    return res.status(400).json({
      message: "donor_type_other must be a string or null",
    });
  }

  if (donor_type === "OTHER" && !normalizedOtherDonorType) {
    return res.status(400).json({
      message: invalidDonorTypeOtherMessage,
    });
  }

  if (
    contact_information !== undefined &&
    contact_information !== null &&
    typeof contact_information !== "string"
  ) {
    return res.status(400).json({
      message: "contact_information must be a string or null",
    });
  }

  if (received_at !== undefined && received_at !== null && !isValidDateTimeString(received_at)) {
    return res.status(400).json({
      message: "received_at must be a valid date-time string or null",
    });
  }

  if (!donationStatuses.includes(status)) {
    return res.status(400).json({
      message:
        "status must be one of: RECEIVED, PARTIALLY_DISTRIBUTED, DISTRIBUTED, CANCELLED",
    });
  }

  if (remarks !== undefined && remarks !== null && typeof remarks !== "string") {
    return res.status(400).json({
      message: "remarks must be a string or null",
    });
  }

  if (items !== undefined && !Array.isArray(items)) {
    return res.status(400).json({
      message: "items must be an array when provided",
    });
  }

  try {
    req.validatedBody = {
      disaster_event_id,
      donor_name: donor_name.trim(),
      donor_type,
      donor_type_other:
        donor_type === "OTHER" ? normalizedOtherDonorType : null,
      contact_information: contact_information?.trim() || null,
      received_at: received_at ?? null,
      status,
      remarks: remarks?.trim() || null,
      items: Array.isArray(items)
        ? items.map((item, index) => normalizeDonationItem(item, index))
        : [],
    };
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    });
  }

  return next();
};

const validateDonationUpdatePayload = (req, res, next) => {
  req.body.items = undefined;
  return validateDonationPayload(req, res, next);
};

const validateDonationPublicNamePayload = (req, res, next) => {
  if (typeof req.body?.donor_name_public !== "boolean") {
    return res.status(400).json({
      message: "donor_name_public must be a boolean",
    });
  }

  req.validatedBody = {
    donor_name_public: req.body.donor_name_public,
  };

  return next();
};

const validateDonationItemPayload = (req, res, next) => {
  try {
    req.validatedBody = normalizeDonationItem(req.body, 0);
    return next();
  } catch (error) {
    return res.status(400).json({
      message: error.message.replace(/^items\[0\]\./, ""),
    });
  }
};

const validateReassignLeftoverStockPayload = (req, res, next) => {
  const {
    target_disaster_event_id,
    quantity,
    per_family_allocation,
  } = req.body;

  if (!isValidUuid(target_disaster_event_id)) {
    return res.status(400).json({
      message: "target_disaster_event_id must be a valid UUID",
    });
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return res.status(400).json({
      message: "quantity must be a positive whole number",
    });
  }

  if (!Number.isInteger(per_family_allocation) || per_family_allocation <= 0) {
    return res.status(400).json({
      message: "per_family_allocation must be a positive whole number",
    });
  }

  if (per_family_allocation > quantity) {
    return res.status(400).json({
      message: "per_family_allocation cannot exceed quantity",
    });
  }

  req.validatedBody = {
    target_disaster_event_id,
    quantity,
    per_family_allocation,
  };

  return next();
};

const validatePublicDonationPortal = (req, res, next) => {
  const { disaster_event_id } = req.query;

  if (disaster_event_id !== undefined && !isValidUuid(disaster_event_id)) {
    return res.status(400).json({
      message: "disaster_event_id must be a valid UUID when provided",
    });
  }

  req.validatedQuery = {
    disaster_event_id: disaster_event_id || null,
  };

  return next();
};

module.exports = {
  validateDonationNeedId,
  validateDonationNeedFilters,
  validateDonationNeedPayload,
  validateDonationId,
  validateDonationExportFilters,
  validateDonationFilters,
  validateDonationTransparencyExportFilters,
  validateDonationPayload,
  validateDonationUpdatePayload,
  validateDonationPublicNamePayload,
  validateDonationItemId,
  validateDonationItemPayload,
  validateReassignLeftoverStockPayload,
  validatePublicDonationPortal,
};
