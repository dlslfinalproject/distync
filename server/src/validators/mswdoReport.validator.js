const { ALLOWED_EXPORT_FORMATS } = require("../utils/mswdoReportExport");

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isValidUuid = (value) =>
  typeof value === "string" && uuidPattern.test(value);

const ANOMALY_PAGE_SIZE_DEFAULT = 50;
const ANOMALY_PAGE_SIZE_MAX = 100;
const allowedAnomalyTypes = new Set([
  "SUSPICIOUS_DISTRIBUTION_ACTIVITY",
  "SYNC_FAILED",
  "SYNC_CONFLICT",
  "DUPLICATE_CLAIM_ATTEMPT",
  "DUPLICATE_HOUSEHOLD_REGISTRATION",
  "INVENTORY_DISTRIBUTION_MISMATCH",
  "FAILED_STUB_OR_QR_VERIFICATION",
]);
const allowedStatusCategories = new Set(["open", "resolved", "failed"]);
const allowedSortOrders = new Set(["newest", "oldest", "az", "za"]);

const parsePositiveInteger = (value, fallback) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (!/^\d+$/.test(String(value))) {
    return null;
  }

  return Number.parseInt(String(value), 10);
};

const validateMswdoReportFilters = (req, res, next) => {
  try {
    const {
      disaster_event_id,
      barangay_id,
      status,
      status_category,
      anomaly_type,
      search,
      order,
      page,
      pageSize,
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

    const parsedLimit = parsePositiveInteger(limit, 100);

    if (!Number.isInteger(parsedLimit) || parsedLimit <= 0 || parsedLimit > 1000) {
      return res.status(400).json({
        message: "limit must be an integer between 1 and 1000",
      });
    }

    const parsedPage = parsePositiveInteger(page, 1);

    if (!Number.isInteger(parsedPage) || parsedPage < 1) {
      return res.status(400).json({
        message: "page must be an integer greater than or equal to 1",
      });
    }

    const parsedPageSize = parsePositiveInteger(pageSize, ANOMALY_PAGE_SIZE_DEFAULT);

    if (
      !Number.isInteger(parsedPageSize) ||
      parsedPageSize < 1 ||
      parsedPageSize > ANOMALY_PAGE_SIZE_MAX
    ) {
      return res.status(400).json({
        message: `pageSize must be an integer between 1 and ${ANOMALY_PAGE_SIZE_MAX}`,
      });
    }

    const normalizedAnomalyType =
      typeof anomaly_type === "string" && anomaly_type.trim()
        ? anomaly_type.trim()
        : null;

    if (normalizedAnomalyType && !allowedAnomalyTypes.has(normalizedAnomalyType)) {
      return res.status(400).json({
        message: "anomaly_type must be a supported anomaly type when provided",
      });
    }

    const normalizedStatusCategory =
      typeof status_category === "string" && status_category.trim()
        ? status_category.trim().toLowerCase()
        : null;

    if (
      normalizedStatusCategory &&
      !allowedStatusCategories.has(normalizedStatusCategory)
    ) {
      return res.status(400).json({
        message: "status_category must be one of: open, resolved, failed",
      });
    }

    const normalizedOrder =
      typeof order === "string" && order.trim() ? order.trim().toLowerCase() : "newest";

    if (!allowedSortOrders.has(normalizedOrder)) {
      return res.status(400).json({
        message: "order must be one of: newest, oldest, az, za",
      });
    }

    req.validatedQuery = {
      disaster_event_id: disaster_event_id || null,
      barangay_id: barangay_id || null,
      status: typeof status === "string" && status.trim() ? status.trim() : null,
      status_category: normalizedStatusCategory,
      anomaly_type: normalizedAnomalyType,
      search: typeof search === "string" && search.trim() ? search.trim() : null,
      order: normalizedOrder,
      date_from: date_from || null,
      date_to: date_to || null,
      limit: parsedLimit,
      page: parsedPage,
      pageSize: parsedPageSize,
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
