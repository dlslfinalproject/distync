const allowedSourceTypes = ["PURCHASED", "DONATED", "DSWD", "LGU", "OTHER"];

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isValidUuid = (value) => {
  return typeof value === "string" && uuidPattern.test(value);
};

const isValidDateString = (value) => {
  if (typeof value !== "string") {
    return false;
  }

  const date = new Date(value);
  return !Number.isNaN(date.getTime());
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

const validateInventoryBatchId = (req, res, next) => {
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
      message: "Failed to validate inventory batch id",
      error: error.message,
    });
  }
};

const validateGetInventoryBatches = (req, res, next) => {
  try {
    const {
      inventory_item_id,
      supplier_id,
      source_type,
      status,
      is_expiring,
      is_expired,
      search,
    } = req.query;

    if (inventory_item_id !== undefined && !isValidUuid(inventory_item_id)) {
      return res.status(400).json({
        message: "inventory_item_id must be a valid UUID when provided",
      });
    }

    if (supplier_id !== undefined && !isValidUuid(supplier_id)) {
      return res.status(400).json({
        message: "supplier_id must be a valid UUID when provided",
      });
    }

    const parsedIsExpiring = parseOptionalBoolean(is_expiring);
    const parsedIsExpired = parseOptionalBoolean(is_expired);

    if (parsedIsExpiring.value === "invalid") {
      return res.status(400).json({
        message: "is_expiring must be true or false when provided",
      });
    }

    if (parsedIsExpired.value === "invalid") {
      return res.status(400).json({
        message: "is_expired must be true or false when provided",
      });
    }

    req.validatedQuery = {
      inventory_item_id: inventory_item_id || null,
      supplier_id: supplier_id || null,
      source_type: typeof source_type === "string" && source_type.trim() ? source_type.trim() : null,
      status: typeof status === "string" && status.trim() ? status.trim() : null,
      is_expiring: parsedIsExpiring.isProvided ? parsedIsExpiring.value : null,
      is_expired: parsedIsExpired.isProvided ? parsedIsExpired.value : null,
      search: typeof search === "string" && search.trim() ? search.trim() : null,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate inventory batch filters",
      error: error.message,
    });
  }
};

const validateCreateInventoryBatch = (req, res, next) => {
  try {
    const {
      inventory_item_id,
      inventory_item_stock_form_id,
      stock_form_barcode,
      stock_form_packaging,
      stock_form_units_per_packaging,
      stock_form_unit_of_measure,
      stock_form_unit_of_measure_value,
      batch_no,
      supplier_id,
      source_type,
      quantity_received,
      expiration_date,
      storage_location,
      created_by,
    } = req.body;

    if (!isValidUuid(inventory_item_id)) {
      return res.status(400).json({
        message: "inventory_item_id is required and must be a valid UUID",
      });
    }

    if (
      inventory_item_stock_form_id !== undefined &&
      inventory_item_stock_form_id !== null &&
      !isValidUuid(inventory_item_stock_form_id)
    ) {
      return res.status(400).json({
        message: "inventory_item_stock_form_id must be a valid UUID or null",
      });
    }

    if (
      stock_form_barcode !== undefined &&
      stock_form_barcode !== null &&
      typeof stock_form_barcode !== "string"
    ) {
      return res.status(400).json({
        message: "stock_form_barcode must be a string or null",
      });
    }

    if (
      stock_form_packaging !== undefined &&
      stock_form_packaging !== null &&
      (typeof stock_form_packaging !== "string" || !stock_form_packaging.trim())
    ) {
      return res.status(400).json({
        message: "stock_form_packaging must be a non-empty string when provided",
      });
    }

    if (
      stock_form_units_per_packaging !== undefined &&
      stock_form_units_per_packaging !== null &&
      (!Number.isInteger(stock_form_units_per_packaging) ||
        stock_form_units_per_packaging <= 0)
    ) {
      return res.status(400).json({
        message: "stock_form_units_per_packaging must be a positive integer or null",
      });
    }

    if (
      stock_form_unit_of_measure !== undefined &&
      stock_form_unit_of_measure !== null &&
      (typeof stock_form_unit_of_measure !== "string" ||
        !stock_form_unit_of_measure.trim())
    ) {
      return res.status(400).json({
        message: "stock_form_unit_of_measure must be a non-empty string when provided",
      });
    }

    if (
      stock_form_unit_of_measure_value !== undefined &&
      stock_form_unit_of_measure_value !== null &&
      (!Number.isFinite(Number(stock_form_unit_of_measure_value)) ||
        Number(stock_form_unit_of_measure_value) <= 0)
    ) {
      return res.status(400).json({
        message:
          "stock_form_unit_of_measure_value must be a positive number or null",
      });
    }

    if (!batch_no || typeof batch_no !== "string" || !batch_no.trim()) {
      return res.status(400).json({
        message: "batch_no is required and must be a non-empty string",
      });
    }

    if (supplier_id !== undefined && supplier_id !== null && !isValidUuid(supplier_id)) {
      return res.status(400).json({
        message: "supplier_id must be a valid UUID or null",
      });
    }

    if (!allowedSourceTypes.includes(source_type)) {
      return res.status(400).json({
        message: "source_type must be one of: PURCHASED, DONATED, DSWD, LGU, OTHER",
      });
    }

    if (!Number.isInteger(quantity_received) || quantity_received <= 0) {
      return res.status(400).json({
        message: "quantity_received is required and must be a positive integer",
      });
    }

    if (
      expiration_date !== undefined &&
      expiration_date !== null &&
      !isValidDateString(expiration_date)
    ) {
      return res.status(400).json({
        message: "expiration_date must be a valid date or null",
      });
    }

    if (
      storage_location !== undefined &&
      storage_location !== null &&
      typeof storage_location !== "string"
    ) {
      return res.status(400).json({
        message: "storage_location must be a string or null",
      });
    }

    if (created_by !== undefined && created_by !== null && !isValidUuid(created_by)) {
      return res.status(400).json({
        message: "created_by must be a valid UUID or null",
      });
    }

    req.validatedBody = {
      inventory_item_id,
      inventory_item_stock_form_id: inventory_item_stock_form_id ?? null,
      stock_form_barcode:
        typeof stock_form_barcode === "string" && stock_form_barcode.trim()
          ? stock_form_barcode.trim()
          : null,
      stock_form_packaging:
        typeof stock_form_packaging === "string" && stock_form_packaging.trim()
          ? stock_form_packaging.trim()
          : null,
      stock_form_units_per_packaging: stock_form_units_per_packaging ?? null,
      stock_form_unit_of_measure:
        typeof stock_form_unit_of_measure === "string" &&
        stock_form_unit_of_measure.trim()
          ? stock_form_unit_of_measure.trim()
          : null,
      stock_form_unit_of_measure_value:
        stock_form_unit_of_measure_value ?? null,
      batch_no: batch_no.trim(),
      supplier_id: supplier_id ?? null,
      source_type,
      quantity_received,
      expiration_date: expiration_date ?? null,
      storage_location: storage_location ?? null,
      created_by: created_by ?? null,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate inventory batch payload",
      error: error.message,
    });
  }
};

module.exports = {
  validateInventoryBatchId,
  validateGetInventoryBatches,
  validateCreateInventoryBatch,
};
