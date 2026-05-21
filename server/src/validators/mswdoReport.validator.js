const { ALLOWED_EXPORT_FORMATS } = require("../utils/mswdoReportExport");

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isValidUuid = (value) =>
  typeof value === "string" && uuidPattern.test(value);

const validateMswdoReportFilters = (req, res, next) => {
  try {
    const {
      disaster_event_id,
      barangay_id,
      status,
      date_from,
      date_to,
      limit,
    } = req.query;

    if (disaster_event_id && !isValidUuid(disaster_event_id)) {
      return res.status(400).json({
        message: "disaster_event_id must be a valid UUID when provided",
      });
    }

    if (barangay_id && !isValidUuid(barangay_id)) {
      return res.status(400).json({
        message: "barangay_id must be a valid UUID when provided",
      });
    }

    if (date_from && Number.isNaN(new Date(date_from).getTime())) {
      return res.status(400).json({
        message: "date_from must be a valid date when provided",
      });
    }

    if (date_to && Number.isNaN(new Date(date_to).getTime())) {
      return res.status(400).json({
        message: "date_to must be a valid date when provided",
      });
    }

    const parsedLimit = limit ? Number.parseInt(limit, 10) : 100;

    if (!Number.isInteger(parsedLimit) || parsedLimit <= 0 || parsedLimit > 1000) {
      return res.status(400).json({
        message: "limit must be an integer between 1 and 1000",
      });
    }

    req.validatedQuery = {
      disaster_event_id: disaster_event_id || null,
      barangay_id: barangay_id || null,
      status: typeof status === "string" && status.trim() ? status.trim() : null,
      date_from: date_from || null,
      date_to: date_to || null,
      limit: parsedLimit,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate MSWDO report request",
      error: error.message,
    });
  }
};

const validateMswdoExportFormat = (req, res, next) => {
  const normalizedFormat = String(req.query.format || "").toLowerCase();

  if (!ALLOWED_EXPORT_FORMATS.includes(normalizedFormat)) {
    return res.status(400).json({
      message: "format must be one of: csv, excel, pdf",
    });
  }

  req.validatedQuery = {
    ...(req.validatedQuery || {}),
    format: normalizedFormat,
  };

  return next();
};

module.exports = {
  validateMswdoReportFilters,
  validateMswdoExportFormat,
};
