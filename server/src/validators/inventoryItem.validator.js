const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const {
  isValidInventoryBarcode,
  normalizeInventoryBarcode,
} = require("../utils/inventoryBarcode");

const allowedUnitOfMeasureValues = ["kg", "g", "L", "mL", "pc"];
const allowedPackagingValues = ["piece", "sack", "box", "carton", "case", "pack", "bottle"];
const categoryValueMap = {
  perishable: "Perishable",
  "non-perishable": "Non-Perishable",
};
const allowedExportFormats = ["pdf", "excel", "csv"];
const allowedStatusFilters = [
  "All",
  "Available",
  "Low Stock",
  "Near Expiry",
  "Expired",
  "Depleted",
];
const allowedConditionReportTypes = [
  "LOW_STOCK",
  "NEAR_EXPIRY",
  "EXPIRED",
  "INCIDENT_LOSS",
];
const allowedForecastModels = [
  "MOVING_AVERAGE",
  "EXPONENTIAL_SMOOTHING",
  "TREND_PROJECTION",
];

const isValidUuid = (value) => {
  return typeof value === "string" && uuidPattern.test(value);
};

const normalizeAllowedValue = (value, allowedValues) => {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const normalizedValue = value.trim().toLowerCase();

  return (
    allowedValues.find(
      (allowedValue) => allowedValue.toLowerCase() === normalizedValue,
    ) || null
  );
};

const normalizeCategory = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const normalizedValue = value.trim().toLowerCase();
  return categoryValueMap[normalizedValue] || value.trim();
};

const parsePositiveInteger = (value) => {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : null;
  }

  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) {
    return null;
  }

  const parsedValue = Number.parseInt(value.trim(), 10);
  return parsedValue > 0 ? parsedValue : null;
};

const parsePositiveNumber = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  if (typeof value !== "string" || !/^\d+(\.\d+)?$/.test(value.trim())) {
    return null;
  }

  const parsedValue = Number.parseFloat(value.trim());
  return parsedValue > 0 ? parsedValue : null;
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

const parseOptionalDate = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return "invalid";
  }

  const parsedDate = new Date(`${value.trim()}T00:00:00Z`);

  if (Number.isNaN(parsedDate.getTime())) {
    return "invalid";
  }

  return value.trim();
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

const validateInventoryItemBarcodeLookup = (req, res, next) => {
  try {
    const { barcode } = req.params;
    const normalizedBarcode = normalizeInventoryBarcode(barcode);

    if (!normalizedBarcode) {
      return res.status(400).json({
        message: "barcode is required",
      });
    }

    if (!isValidInventoryBarcode(normalizedBarcode)) {
      return res.status(400).json({
        message: "barcode must contain 8 to 18 digits",
      });
    }

    req.validatedParams = {
      barcode: normalizedBarcode,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate inventory barcode lookup",
      error: error.message,
    });
  }
};

const validateGetInventoryItems = (req, res, next) => {
  try {
    const { category, search, is_perishable } = req.query;

    const parsedIsPerishable = parseOptionalBoolean(is_perishable);

    if (parsedIsPerishable.value === "invalid") {
      return res.status(400).json({
        message: "is_perishable must be true or false when provided",
      });
    }

    req.validatedQuery = {
      category: typeof category === "string" && category.trim() ? category.trim() : null,
      search: typeof search === "string" && search.trim() ? search.trim() : null,
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

const validateExportInventoryItems = (req, res, next) => {
  try {
    const {
      format,
      category,
      search,
      is_perishable,
      status,
      report_type,
      near_expiry_days,
    } =
      req.query;
    const normalizedFormat = String(format || "").toLowerCase();
    const parsedIsPerishable = parseOptionalBoolean(is_perishable);
    const normalizedStatus =
      typeof status === "string" && status.trim()
        ? normalizeAllowedValue(status, allowedStatusFilters)
        : "All";

    if (!allowedExportFormats.includes(normalizedFormat)) {
      return res.status(400).json({
        message: "format must be one of: pdf, excel, csv",
      });
    }

    if (parsedIsPerishable.value === "invalid") {
      return res.status(400).json({
        message: "is_perishable must be true or false when provided",
      });
    }

    if (!normalizedStatus) {
      return res.status(400).json({
        message:
          "status must be one of: All, Available, Low Stock, Near Expiry, Expired, Depleted",
      });
    }

    if (
      report_type !== undefined &&
      !allowedConditionReportTypes.includes(report_type)
    ) {
      return res.status(400).json({
        message:
          "report_type must be one of: LOW_STOCK, NEAR_EXPIRY, EXPIRED, INCIDENT_LOSS",
      });
    }

    const parsedNearExpiryDays =
      near_expiry_days === undefined
        ? 14
        : Number.parseInt(String(near_expiry_days), 10);

    if (
      Number.isNaN(parsedNearExpiryDays) ||
      parsedNearExpiryDays < 1 ||
      parsedNearExpiryDays > 30
    ) {
      return res.status(400).json({
        message: "near_expiry_days must be an integer between 1 and 30",
      });
    }

    req.validatedQuery = {
      format: normalizedFormat,
      category: typeof category === "string" && category.trim() ? category.trim() : null,
      search: typeof search === "string" && search.trim() ? search.trim() : null,
      is_perishable: parsedIsPerishable.isProvided ? parsedIsPerishable.value : null,
      status: normalizedStatus,
      report_type: report_type || null,
      near_expiry_days: parsedNearExpiryDays,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate inventory item export request",
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
      unit_of_measure_value,
      packaging,
      packaging_count,
      quantity,
      reorder_level,
      expiration_date,
      barcode,
      is_perishable,
      skip_opening_stock,
    } = req.body;

    if (
      item_code !== undefined &&
      item_code !== null &&
      (typeof item_code !== "string" || !item_code.trim())
    ) {
      return res.status(400).json({
        message: "item_code must be a non-empty string when provided",
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

    const normalizedUnitOfMeasure = normalizeAllowedValue(
      unit_of_measure,
      allowedUnitOfMeasureValues,
    );

    if (!normalizedUnitOfMeasure) {
      return res.status(400).json({
        message: `unit_of_measure is required and must be one of: ${allowedUnitOfMeasureValues.join(", ")}`,
      });
    }

    const parsedUnitOfMeasureValue = parsePositiveNumber(unit_of_measure_value);

    if (!parsedUnitOfMeasureValue) {
      return res.status(400).json({
        message: "unit_of_measure_value is required and must be a positive number",
      });
    }

    const normalizedPackaging = normalizeAllowedValue(
      packaging,
      allowedPackagingValues,
    );

    if (!normalizedPackaging) {
      return res.status(400).json({
        message: `packaging is required and must be one of: ${allowedPackagingValues.join(", ")}`,
      });
    }

    const parsedQuantity = parsePositiveInteger(quantity);

    if (!parsedQuantity) {
      return res.status(400).json({
        message: "quantity is required and must be a positive integer",
      });
    }

    const parsedPackagingCount = parsePositiveInteger(packaging_count);

    if (!parsedPackagingCount) {
      return res.status(400).json({
        message: "packaging_count is required and must be a positive integer",
      });
    }

    const parsedExpirationDate = parseOptionalDate(expiration_date);
    const shouldAllowNullableReorderLevel =
      req.method === "POST" && skip_opening_stock === true;
    const isNullableReorderLevelValue =
      reorder_level === undefined || reorder_level === null;
    const parsedReorderLevel =
      shouldAllowNullableReorderLevel && isNullableReorderLevelValue
        ? null
        : parsePositiveInteger(reorder_level);

    if (parsedExpirationDate === "invalid") {
      return res.status(400).json({
        message: "expiration_date must be a valid date in YYYY-MM-DD format",
      });
    }

    if (
      parsedReorderLevel === null &&
      !(shouldAllowNullableReorderLevel && isNullableReorderLevelValue)
    ) {
      return res.status(400).json({
        message: "reorder_level is required and must be a positive integer",
      });
    }

    if (barcode !== undefined && barcode !== null && typeof barcode !== "string") {
      return res.status(400).json({
        message: "barcode must be a string or null",
      });
    }

    const normalizedBarcode = normalizeInventoryBarcode(barcode);

    if (normalizedBarcode && !isValidInventoryBarcode(normalizedBarcode)) {
      return res.status(400).json({
        message: "barcode must contain 8 to 18 digits",
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

    if (
      skip_opening_stock !== undefined &&
      typeof skip_opening_stock !== "boolean"
    ) {
      return res.status(400).json({
        message: "skip_opening_stock must be a boolean when provided",
      });
    }

    const normalizedCategory = normalizeCategory(category);

    req.validatedBody = {
      item_code:
        typeof item_code === "string" && item_code.trim()
          ? item_code.trim()
          : null,
      item_name: item_name.trim(),
      category: normalizedCategory,
      unit_of_measure: normalizedUnitOfMeasure,
      unit_of_measure_value: parsedUnitOfMeasureValue,
      packaging: normalizedPackaging,
      packaging_count: parsedPackagingCount,
      quantity: parsedQuantity,
      reorder_level: parsedReorderLevel,
      expiration_date: parsedExpirationDate,
      barcode:
        normalizedBarcode || null,
      is_perishable:
        is_perishable ??
        (normalizedCategory === "Perishable"
          ? true
          : normalizedCategory === "Non-Perishable"
            ? false
            : false),
      skip_opening_stock: skip_opening_stock ?? false,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate inventory item payload",
      error: error.message,
    });
  }
};

const validateForecastRunPayload = (req, res, next) => {
  try {
    const { disaster_event_id, model_name, model_type } = req.body;
    const resolvedModelName = model_name || model_type || "MOVING_AVERAGE";

    if (!isValidUuid(disaster_event_id)) {
      return res.status(400).json({
        message: "disaster_event_id must be a valid UUID",
      });
    }

    if (!allowedForecastModels.includes(resolvedModelName)) {
      return res.status(400).json({
        message:
          "model_name must be one of: MOVING_AVERAGE, EXPONENTIAL_SMOOTHING, TREND_PROJECTION",
      });
    }

    req.validatedBody = {
      disaster_event_id,
      model_name: resolvedModelName,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate forecast run payload",
      error: error.message,
    });
  }
};

const validateForecastLatestQuery = (req, res, next) => {
  try {
    const { disaster_event_id } = req.query;

    if (!isValidUuid(disaster_event_id)) {
      return res.status(400).json({
        message: "disaster_event_id must be a valid UUID",
      });
    }

    req.validatedQuery = {
      disaster_event_id,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate forecast query",
      error: error.message,
    });
  }
};

const validateForecastHistoryQuery = (req, res, next) => {
  try {
    const { disaster_event_id, limit } = req.query;
    const parsedLimit =
      limit === undefined ? 10 : Number.parseInt(String(limit), 10);

    if (
      disaster_event_id !== undefined &&
      disaster_event_id !== null &&
      disaster_event_id !== "" &&
      !isValidUuid(disaster_event_id)
    ) {
      return res.status(400).json({
        message: "disaster_event_id must be a valid UUID when provided",
      });
    }

    if (Number.isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
      return res.status(400).json({
        message: "limit must be an integer between 1 and 50",
      });
    }

    req.validatedQuery = {
      disaster_event_id: disaster_event_id || null,
      limit: parsedLimit,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate forecast history query",
      error: error.message,
    });
  }
};

const validateForecastRunIdParam = (req, res, next) => {
  try {
    const { runId } = req.params;

    if (!isValidUuid(runId)) {
      return res.status(400).json({
        message: "runId must be a valid UUID",
      });
    }

    req.validatedParams = {
      runId,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate forecast run id",
      error: error.message,
    });
  }
};

module.exports = {
  validateInventoryItemId,
  validateInventoryItemBarcodeLookup,
  validateExportInventoryItems,
  validateGetInventoryItems,
  validateInventoryItemPayload,
  validateForecastRunPayload,
  validateForecastLatestQuery,
  validateForecastHistoryQuery,
  validateForecastRunIdParam,
};
