const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RELIEF_PACK_DISASTER_TYPE_OPTIONS = [
  "Typhoon",
  "Flood",
  "Earthquake",
  "Landslide",
  "Volcanic Eruption",
  "Storm Surge",
  "Drought / El Ni\u00f1o",
  "Tsunami",
  "Fire",
  "Other",
];

const isValidUuid = (value) => {
  return typeof value === "string" && uuidPattern.test(value);
};

const parseOptionalBoolean = (value) => {
  if (value === undefined) {
    return { isProvided: false, value: null };
  }

  if (value === "true") {
    return { isProvided: true, value: true };
  }

  if (value === "false") {
    return { isProvided: true, value: false };
  }

  return { isProvided: true, value: "invalid" };
};

const validateReliefPackTemplateId = (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidUuid(id)) {
      return res.status(400).json({
        message: "id must be a valid UUID",
      });
    }

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate relief pack template id",
      error: error.message,
    });
  }
};

const validateGetReliefPackTemplates = (req, res, next) => {
  try {
    const {
      is_active,
      based_on_family_size,
      based_on_sector,
      search,
      disaster_event_id,
      disaster_type,
    } = req.query;

    const parsedIsActive = parseOptionalBoolean(is_active);
    const parsedBasedOnFamilySize = parseOptionalBoolean(based_on_family_size);
    const parsedBasedOnSector = parseOptionalBoolean(based_on_sector);

    if (parsedIsActive.value === "invalid") {
      return res.status(400).json({
        message: "is_active must be true or false when provided",
      });
    }

    if (parsedBasedOnFamilySize.value === "invalid") {
      return res.status(400).json({
        message: "based_on_family_size must be true or false when provided",
      });
    }

    if (parsedBasedOnSector.value === "invalid") {
      return res.status(400).json({
        message: "based_on_sector must be true or false when provided",
      });
    }

    if (
      disaster_event_id !== undefined &&
      disaster_event_id !== null &&
      disaster_event_id !== "" &&
      !isValidUuid(String(disaster_event_id))
    ) {
      return res.status(400).json({
        message: "disaster_event_id must be a valid UUID when provided",
      });
    }

    req.validatedQuery = {
      is_active: parsedIsActive.isProvided ? parsedIsActive.value : null,
      based_on_family_size: parsedBasedOnFamilySize.isProvided
        ? parsedBasedOnFamilySize.value
        : null,
      based_on_sector: parsedBasedOnSector.isProvided
        ? parsedBasedOnSector.value
        : null,
      search: typeof search === "string" && search.trim() ? search.trim() : null,
      disaster_event_id:
        typeof disaster_event_id === "string" && disaster_event_id.trim()
          ? disaster_event_id.trim()
          : null,
      disaster_type:
        typeof disaster_type === "string" && disaster_type.trim()
          ? disaster_type.trim()
          : null,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate relief pack template filters",
      error: error.message,
    });
  }
};

const validateTemplateItemsArray = (items, allowEmpty = true) => {
  if (!Array.isArray(items)) {
    return "items must be an array when provided";
  }

  if (!allowEmpty && items.length === 0) {
    return "items must be a non-empty array";
  }

  for (const item of items) {
    if (!isValidUuid(item.inventory_item_id)) {
      return "Each item.inventory_item_id must be a valid UUID";
    }

    if (
      !Number.isInteger(item.quantity_required) ||
      item.quantity_required <= 0
    ) {
      return "Each item.quantity_required must be a positive integer";
    }
  }

  return null;
};

const normalizeDisasterTypes = (disasterTypes) => {
  if (!Array.isArray(disasterTypes)) {
    return [];
  }

  return Array.from(
    new Set(
      disasterTypes
        .map((disasterType) => String(disasterType || "").trim())
        .filter(Boolean),
    ),
  );
};

const normalizeSectorIds = (sectorIds, fallbackSectorId = null) => {
  return Array.from(
    new Set(
      [
        ...(Array.isArray(sectorIds) ? sectorIds : []),
        fallbackSectorId,
      ]
        .map((sectorId) => String(sectorId || "").trim())
        .filter(Boolean),
    ),
  );
};

const validateSectorIds = (sectorIds) => {
  if (sectorIds !== undefined && !Array.isArray(sectorIds)) {
    return "sector_ids must be an array when provided";
  }

  const hasInvalidSectorId = normalizeSectorIds(sectorIds).some(
    (sectorId) => !isValidUuid(sectorId),
  );

  return hasInvalidSectorId ? "sector_ids contains an invalid sector id" : null;
};

const validateTemplateDisasterApplicability = ({
  applies_to_all_disasters,
  disaster_types,
}) => {
  if (
    applies_to_all_disasters !== undefined &&
    typeof applies_to_all_disasters !== "boolean"
  ) {
    return "applies_to_all_disasters must be a boolean when provided";
  }

  if (disaster_types !== undefined && !Array.isArray(disaster_types)) {
    return "disaster_types must be an array when provided";
  }

  const normalizedDisasterTypes = normalizeDisasterTypes(disaster_types);
  const hasInvalidDisasterType = normalizedDisasterTypes.some(
    (disasterType) =>
      !RELIEF_PACK_DISASTER_TYPE_OPTIONS.includes(disasterType),
  );

  if (hasInvalidDisasterType) {
    return "disaster_types contains an invalid disaster type";
  }

  if ((applies_to_all_disasters ?? true) === false && normalizedDisasterTypes.length === 0) {
    return "Select at least one disaster type when applies_to_all_disasters is false";
  }

  return null;
};

const validateCreateReliefPackTemplate = (req, res, next) => {
  try {
    const {
      name,
      description,
      based_on_family_size,
      based_on_sector,
      is_additional_pack,
      sector_id,
      sector_ids,
      applies_to_all_disasters,
      created_by,
      is_active,
      items,
      disaster_types,
    } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        message: "name is required and must be a non-empty string",
      });
    }

    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      return res.status(400).json({
        message: "description must be a string or null",
      });
    }

    if (
      based_on_family_size !== undefined &&
      typeof based_on_family_size !== "boolean"
    ) {
      return res.status(400).json({
        message: "based_on_family_size must be a boolean when provided",
      });
    }

    if (
      based_on_sector !== undefined &&
      typeof based_on_sector !== "boolean"
    ) {
      return res.status(400).json({
        message: "based_on_sector must be a boolean when provided",
      });
    }

    if (
      is_additional_pack !== undefined &&
      typeof is_additional_pack !== "boolean"
    ) {
      return res.status(400).json({
        message: "is_additional_pack must be a boolean when provided",
      });
    }

    if (sector_id !== undefined && sector_id !== null && !isValidUuid(sector_id)) {
      return res.status(400).json({
        message: "sector_id must be a valid UUID or null",
      });
    }

    const sectorIdsValidationError = validateSectorIds(sector_ids);

    if (sectorIdsValidationError) {
      return res.status(400).json({
        message: sectorIdsValidationError,
      });
    }

    const normalizedSectorIds = normalizeSectorIds(sector_ids, sector_id);

    if ((is_additional_pack ?? false) && normalizedSectorIds.length === 0) {
      return res.status(400).json({
        message: "sector_ids is required when is_additional_pack is true",
      });
    }

    if (created_by !== undefined && created_by !== null && !isValidUuid(created_by)) {
      return res.status(400).json({
        message: "created_by must be a valid UUID or null",
      });
    }

    if (is_active !== undefined && typeof is_active !== "boolean") {
      return res.status(400).json({
        message: "is_active must be a boolean when provided",
      });
    }

    if (items !== undefined) {
      const itemsValidationError = validateTemplateItemsArray(items, false);

      if (itemsValidationError) {
        return res.status(400).json({
          message: itemsValidationError,
        });
      }
    }

    const disasterApplicabilityValidationError =
      validateTemplateDisasterApplicability({
        applies_to_all_disasters,
        disaster_types,
      });

    if (disasterApplicabilityValidationError) {
      return res.status(400).json({
        message: disasterApplicabilityValidationError,
      });
    }

    const normalizedDisasterTypes = normalizeDisasterTypes(disaster_types);
    const isAdditionalPack = is_additional_pack ?? false;

    req.validatedBody = {
      name: name.trim(),
      description: description ?? null,
      based_on_family_size: based_on_family_size ?? false,
      based_on_sector: isAdditionalPack ? based_on_sector ?? true : false,
      is_additional_pack: isAdditionalPack,
      sector_id: isAdditionalPack ? normalizedSectorIds[0] ?? null : null,
      sector_ids: isAdditionalPack ? normalizedSectorIds : [],
      applies_to_all_disasters: applies_to_all_disasters ?? true,
      created_by: created_by ?? null,
      is_active: is_active ?? true,
      items: items ?? [],
      disaster_types:
        (applies_to_all_disasters ?? true) === false ? normalizedDisasterTypes : [],
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate relief pack template payload",
      error: error.message,
    });
  }
};

const validateUpdateReliefPackTemplate = (req, res, next) => {
  try {
    const {
      name,
      description,
      based_on_family_size,
      based_on_sector,
      is_additional_pack,
      sector_id,
      sector_ids,
      applies_to_all_disasters,
      is_active,
      items,
      disaster_types,
    } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        message: "name is required and must be a non-empty string",
      });
    }

    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      return res.status(400).json({
        message: "description must be a string or null",
      });
    }

    if (
      based_on_family_size !== undefined &&
      typeof based_on_family_size !== "boolean"
    ) {
      return res.status(400).json({
        message: "based_on_family_size must be a boolean when provided",
      });
    }

    if (
      based_on_sector !== undefined &&
      typeof based_on_sector !== "boolean"
    ) {
      return res.status(400).json({
        message: "based_on_sector must be a boolean when provided",
      });
    }

    if (
      is_additional_pack !== undefined &&
      typeof is_additional_pack !== "boolean"
    ) {
      return res.status(400).json({
        message: "is_additional_pack must be a boolean when provided",
      });
    }

    if (sector_id !== undefined && sector_id !== null && !isValidUuid(sector_id)) {
      return res.status(400).json({
        message: "sector_id must be a valid UUID or null",
      });
    }

    const sectorIdsValidationError = validateSectorIds(sector_ids);

    if (sectorIdsValidationError) {
      return res.status(400).json({
        message: sectorIdsValidationError,
      });
    }

    const normalizedSectorIds = normalizeSectorIds(sector_ids, sector_id);

    if ((is_additional_pack ?? false) && normalizedSectorIds.length === 0) {
      return res.status(400).json({
        message: "sector_ids is required when is_additional_pack is true",
      });
    }

    if (is_active !== undefined && typeof is_active !== "boolean") {
      return res.status(400).json({
        message: "is_active must be a boolean when provided",
      });
    }

    if (items !== undefined) {
      const itemsValidationError = validateTemplateItemsArray(items, false);

      if (itemsValidationError) {
        return res.status(400).json({
          message: itemsValidationError,
        });
      }
    }

    const disasterApplicabilityValidationError =
      validateTemplateDisasterApplicability({
        applies_to_all_disasters,
        disaster_types,
      });

    if (disasterApplicabilityValidationError) {
      return res.status(400).json({
        message: disasterApplicabilityValidationError,
      });
    }

    const normalizedDisasterTypes = normalizeDisasterTypes(disaster_types);
    const isAdditionalPack = is_additional_pack ?? false;

    req.validatedBody = {
      name: name.trim(),
      description: description ?? null,
      based_on_family_size: based_on_family_size ?? false,
      based_on_sector: isAdditionalPack ? based_on_sector ?? true : false,
      is_additional_pack: isAdditionalPack,
      sector_id: isAdditionalPack ? normalizedSectorIds[0] ?? null : null,
      sector_ids: isAdditionalPack ? normalizedSectorIds : [],
      applies_to_all_disasters: applies_to_all_disasters ?? true,
      is_active: is_active ?? true,
      items,
      disaster_types:
        (applies_to_all_disasters ?? true) === false ? normalizedDisasterTypes : [],
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate relief pack template update payload",
      error: error.message,
    });
  }
};

const validateReplaceReliefPackTemplateItems = (req, res, next) => {
  try {
    const { items } = req.body;
    const itemsValidationError = validateTemplateItemsArray(items, false);

    if (itemsValidationError) {
      return res.status(400).json({
        message: itemsValidationError,
      });
    }

    req.validatedBody = {
      items,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate relief pack template items payload",
      error: error.message,
    });
  }
};

module.exports = {
  validateReliefPackTemplateId,
  validateGetReliefPackTemplates,
  validateCreateReliefPackTemplate,
  validateUpdateReliefPackTemplate,
  validateReplaceReliefPackTemplateItems,
};
