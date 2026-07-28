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
const invalidDonorTypeMessage = "Please select a valid donor type.";

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

const normalizeDonationItem = (item, index) => {
  if (!item || typeof item !== "object") {
    throw new Error(`items[${index}] must be an object`);
  }

  if (!isValidUuid(item.inventory_item_id)) {
    throw new Error(`items[${index}].inventory_item_id must be a valid UUID`);
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

  return {
    inventory_item_id: item.inventory_item_id,
    inventory_batch_id: item.inventory_batch_id ?? null,
    quantity_received: item.quantity_received,
    remarks: item.remarks?.trim() || null,
    expiration_date: item.expiration_date ?? null,
    storage_location: item.storage_location?.trim() || null,
  };
};

const validateDonationPayload = (req, res, next) => {
  const {
    disaster_event_id,
    donor_name,
    donor_type,
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
  validateDonationFilters,
  validateDonationPayload,
  validateDonationUpdatePayload,
  validateDonationItemId,
  validateDonationItemPayload,
  validatePublicDonationPortal,
};
