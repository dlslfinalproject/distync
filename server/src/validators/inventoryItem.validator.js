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

const validateInventoryItemId = (req, res, next) => {
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
      message: "Failed to validate inventory item id",
      error: error.message,
    });
  }
};

const validateGetInventoryItems = (req, res, next) => {
  try {
    const { category, search, is_active, is_perishable } = req.query;

    const parsedIsActive = parseOptionalBoolean(is_active);
    const parsedIsPerishable = parseOptionalBoolean(is_perishable);

    if (parsedIsActive.value === "invalid") {
      return res.status(400).json({
        message: "is_active must be true or false when provided",
      });
    }

    if (parsedIsPerishable.value === "invalid") {
      return res.status(400).json({
        message: "is_perishable must be true or false when provided",
      });
    }

    req.validatedQuery = {
      category: typeof category === "string" && category.trim() ? category.trim() : null,
      search: typeof search === "string" && search.trim() ? search.trim() : null,
      is_active: parsedIsActive.isProvided ? parsedIsActive.value : null,
      is_perishable: parsedIsPerishable.isProvided ? parsedIsPerishable.value : null,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate inventory item filters",
      error: error.message,
    });
  }
};

const validateInventoryItemPayload = (req, res, next) => {
  try {
    const {
      item_code,
      item_name,
      category,
      unit_of_measure,
      barcode,
      is_perishable,
      is_active,
    } = req.body;

    if (!item_code || typeof item_code !== "string" || !item_code.trim()) {
      return res.status(400).json({
        message: "item_code is required and must be a non-empty string",
      });
    }

    if (!item_name || typeof item_name !== "string" || !item_name.trim()) {
      return res.status(400).json({
        message: "item_name is required and must be a non-empty string",
      });
    }

    if (!category || typeof category !== "string" || !category.trim()) {
      return res.status(400).json({
        message: "category is required and must be a non-empty string",
      });
    }

    if (
      !unit_of_measure ||
      typeof unit_of_measure !== "string" ||
      !unit_of_measure.trim()
    ) {
      return res.status(400).json({
        message: "unit_of_measure is required and must be a non-empty string",
      });
    }

    if (barcode !== undefined && barcode !== null && typeof barcode !== "string") {
      return res.status(400).json({
        message: "barcode must be a string or null",
      });
    }

    if (
      is_perishable !== undefined &&
      typeof is_perishable !== "boolean"
    ) {
      return res.status(400).json({
        message: "is_perishable must be a boolean when provided",
      });
    }

    if (is_active !== undefined && typeof is_active !== "boolean") {
      return res.status(400).json({
        message: "is_active must be a boolean when provided",
      });
    }

    req.validatedBody = {
      item_code: item_code.trim(),
      item_name: item_name.trim(),
      category: category.trim(),
      unit_of_measure: unit_of_measure.trim(),
      barcode: barcode ?? null,
      is_perishable: is_perishable ?? false,
      is_active: is_active ?? true,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate inventory item payload",
      error: error.message,
    });
  }
};

module.exports = {
  validateInventoryItemId,
  validateGetInventoryItems,
  validateInventoryItemPayload,
};
