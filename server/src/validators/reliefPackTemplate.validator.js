const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    const { is_active, based_on_family_size, based_on_sector, search } = req.query;

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

    req.validatedQuery = {
      is_active: parsedIsActive.isProvided ? parsedIsActive.value : null,
      based_on_family_size: parsedBasedOnFamilySize.isProvided
        ? parsedBasedOnFamilySize.value
        : null,
      based_on_sector: parsedBasedOnSector.isProvided
        ? parsedBasedOnSector.value
        : null,
      search: typeof search === "string" && search.trim() ? search.trim() : null,
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

const validateCreateReliefPackTemplate = (req, res, next) => {
  try {
    const {
      name,
      description,
      based_on_family_size,
      based_on_sector,
      created_by,
      is_active,
      items,
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
      const itemsValidationError = validateTemplateItemsArray(items, true);

      if (itemsValidationError) {
        return res.status(400).json({
          message: itemsValidationError,
        });
      }
    }

    req.validatedBody = {
      name: name.trim(),
      description: description ?? null,
      based_on_family_size: based_on_family_size ?? false,
      based_on_sector: based_on_sector ?? false,
      created_by: created_by ?? null,
      is_active: is_active ?? true,
      items: items ?? [],
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
      is_active,
      items,
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

    if (is_active !== undefined && typeof is_active !== "boolean") {
      return res.status(400).json({
        message: "is_active must be a boolean when provided",
      });
    }

    if (items !== undefined) {
      const itemsValidationError = validateTemplateItemsArray(items, true);

      if (itemsValidationError) {
        return res.status(400).json({
          message: itemsValidationError,
        });
      }
    }

    req.validatedBody = {
      name: name.trim(),
      description: description ?? null,
      based_on_family_size: based_on_family_size ?? false,
      based_on_sector: based_on_sector ?? false,
      is_active: is_active ?? true,
      items,
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
