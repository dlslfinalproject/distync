const allowedStatuses = ["PLANNED", "ACTIVE", "CLOSED"];
// ARCHIVED is retained only for read/report compatibility with legacy rows.
const reportAllowedStatuses = [...allowedStatuses, "ARCHIVED"];
const allowedSortOrders = ["newest", "oldest", "az", "za"];
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const {
  isValidDisasterEventReportSelection,
  normalizeDisasterEventReportSelection,
} = require("../utils/disasterEventReportSelection");
const DISASTER_EVENT_EXPORT_TYPE_OPTIONS = [
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

const isValidDateString = (value) => {
  if (typeof value !== "string") {
    return false;
  }

  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

const requiresCompletedEndDate = (status) => status === "CLOSED";

const validateCreateDisasterEvent = (req, res, next) => {
  try {
    const {
      event_code,
      event_name,
      title,
      disaster_type,
      description,
      start_date,
      end_date,
      status,
      created_by,
      barangay_ids,
    } = req.body;

    const normalizedTitle = title ?? event_name;

    if (!normalizedTitle || typeof normalizedTitle !== "string") {
      return res.status(400).json({
        message: "title is required and must be a string",
      });
    }

    if (!disaster_type || typeof disaster_type !== "string") {
      return res.status(400).json({
        message: "disaster_type is required and must be a string",
      });
    }

    if (description !== undefined && description !== null && typeof description !== "string") {
      return res.status(400).json({
        message: "description must be a string or null",
      });
    }

    if (!start_date || !isValidDateString(start_date)) {
      return res.status(400).json({
        message: "start_date is required and must be a valid date",
      });
    }

    if (end_date !== undefined && end_date !== null && !isValidDateString(end_date)) {
      return res.status(400).json({
        message: "end_date must be a valid date or null",
      });
    }

    const normalizedStatus = status ?? "ACTIVE";

    if (status !== undefined && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "status must be one of: PLANNED, ACTIVE, CLOSED",
      });
    }

    if (end_date && new Date(end_date) < new Date(start_date)) {
      return res.status(400).json({
        message: "end_date must not be earlier than start_date",
      });
    }

    if (requiresCompletedEndDate(normalizedStatus) && !end_date) {
      return res.status(400).json({
        message: "end_date is required when status is CLOSED",
      });
    }

    if (created_by !== undefined && created_by !== null && typeof created_by !== "string") {
      return res.status(400).json({
        message: "created_by must be a string or null",
      });
    }

    if (barangay_ids !== undefined && !Array.isArray(barangay_ids)) {
      return res.status(400).json({
        message: "barangay_ids must be an array when provided",
      });
    }

    if (Array.isArray(barangay_ids)) {
      const hasInvalidBarangayId = barangay_ids.some(
        (barangayId) => typeof barangayId !== "string" || !barangayId.trim(),
      );

      if (hasInvalidBarangayId) {
        return res.status(400).json({
          message: "barangay_ids must contain only non-empty string values",
        });
      }
    }

    req.validatedBody = {
      event_code:
        typeof event_code === "string" && event_code.trim()
          ? event_code.trim()
          : null,
      title: normalizedTitle.trim(),
      disaster_type: disaster_type.trim(),
      description: description ?? null,
      start_date,
      end_date: end_date ?? null,
      status: normalizedStatus,
      created_by: created_by ?? null,
      barangay_ids: barangay_ids ?? [],
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate disaster event request",
      error: error.message,
    });
  }
};

const validateExtendDisasterEvent = (req, res, next) => {
  try {
    const { end_date } = req.body;

    if (!end_date || !isValidDateString(end_date)) {
      return res.status(400).json({
        message: "end_date is required and must be a valid date",
      });
    }

    req.validatedBody = {
      end_date,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate disaster event extension request",
      error: error.message,
    });
  }
};

const validateUpdateDisasterEvent = (req, res, next) => {
  return validateCreateDisasterEvent(req, res, next);
};

const validateExportDisasterEvents = (req, res, next) => {
  try {
    const {
      scope,
      format,
      search,
      disaster_event_id,
      disaster_types,
      affected_barangay_ids,
      sort_order,
    } = req.query;
    const normalizedScope = String(scope || "all").toLowerCase();
    const normalizedFormat = String(format || "").toLowerCase();
    const normalizedSortOrder = String(sort_order || "newest").toLowerCase();
    const parsedDisasterTypes = String(disaster_types || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const parsedAffectedBarangayIds = String(affected_barangay_ids || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (!["active", "closed", "all"].includes(normalizedScope)) {
      return res.status(400).json({
        message: "scope must be one of: active, closed, all",
      });
    }

    if (!["pdf", "excel", "csv"].includes(normalizedFormat)) {
      return res.status(400).json({
        message: "format must be one of: pdf, excel, csv",
      });
    }

    if (!["newest", "oldest", "az", "za"].includes(normalizedSortOrder)) {
      return res.status(400).json({
        message: "sort_order must be one of: newest, oldest, az, za",
      });
    }

    const hasInvalidDisasterType = parsedDisasterTypes.some(
      (disasterType) =>
        !DISASTER_EVENT_EXPORT_TYPE_OPTIONS.includes(disasterType),
    );

    if (hasInvalidDisasterType) {
      return res.status(400).json({
        message: "disaster_types contains an invalid disaster type",
      });
    }

    if (disaster_event_id && !uuidPattern.test(String(disaster_event_id))) {
      return res.status(400).json({
        message: "disaster_event_id must be a valid UUID",
      });
    }

    const hasInvalidBarangayId = parsedAffectedBarangayIds.some(
      (barangayId) => !uuidPattern.test(barangayId),
    );

    if (hasInvalidBarangayId) {
      return res.status(400).json({
        message: "affected_barangay_ids must contain valid UUID values",
      });
    }

    req.validatedQuery = {
      scope: normalizedScope,
      format: normalizedFormat,
      sort_order: normalizedSortOrder,
      search: typeof search === "string" ? search : "",
      disaster_event_id:
        typeof disaster_event_id === "string" ? disaster_event_id : "",
      disaster_types: parsedDisasterTypes,
      affected_barangay_ids: parsedAffectedBarangayIds,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate disaster events export request",
      error: error.message,
    });
  }
};

const validateDisasterEventReportSummary = (req, res, next) => {
  try {
    const {
      disaster_event_id,
      event_selection,
      barangay_id,
      status,
      date_from,
      date_to,
      sort_order,
      limit,
    } = req.query;

    const normalizedDisasterEventId =
      typeof disaster_event_id === "string" ? disaster_event_id : "";
    const normalizedEventSelection = normalizeDisasterEventReportSelection({
      eventSelection:
        typeof event_selection === "string" ? event_selection : "",
      disasterEventId: normalizedDisasterEventId,
    });

    if (!isValidDisasterEventReportSelection(normalizedEventSelection)) {
      return res.status(400).json({
        message:
          "event_selection must be one of: ALL, ACTIVE, ENDED, or EVENT:<valid UUID>",
      });
    }

    const resolvedDisasterEventId = normalizedEventSelection.startsWith("EVENT:")
      ? normalizedEventSelection.slice("EVENT:".length)
      : normalizedDisasterEventId;

    if (resolvedDisasterEventId && !uuidPattern.test(String(resolvedDisasterEventId))) {
      return res.status(400).json({
        message: "disaster_event_id must be a valid UUID",
      });
    }

    if (barangay_id && !uuidPattern.test(String(barangay_id))) {
      return res.status(400).json({
        message: "barangay_id must be a valid UUID",
      });
    }

    if (status && !reportAllowedStatuses.includes(String(status).toUpperCase())) {
      return res.status(400).json({
        message:
          "status must be one of: PLANNED, ACTIVE, CLOSED (ARCHIVED is legacy-only)",
      });
    }

    if (date_from && !isValidDateString(date_from)) {
      return res.status(400).json({
        message: "date_from must be a valid date",
      });
    }

    if (date_to && !isValidDateString(date_to)) {
      return res.status(400).json({
        message: "date_to must be a valid date",
      });
    }

    const normalizedSortOrder = String(sort_order || "newest").toLowerCase();

    if (!allowedSortOrders.includes(normalizedSortOrder)) {
      return res.status(400).json({
        message: "sort_order must be one of: newest, oldest, az, za",
      });
    }

    const parsedLimit = limit ? Number.parseInt(limit, 10) : 100;

    if (!Number.isInteger(parsedLimit) || parsedLimit <= 0 || parsedLimit > 1000) {
      return res.status(400).json({
        message: "limit must be an integer between 1 and 1000",
      });
    }

    req.validatedQuery = {
      disaster_event_id: resolvedDisasterEventId,
      event_selection: normalizedEventSelection,
      barangay_id: typeof barangay_id === "string" ? barangay_id : "",
      status: typeof status === "string" ? status.toUpperCase() : "",
      date_from: typeof date_from === "string" ? date_from : "",
      date_to: typeof date_to === "string" ? date_to : "",
      sort_order: normalizedSortOrder,
      limit: parsedLimit,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate disaster event report request",
      error: error.message,
    });
  }
};

const validateExportDisasterEventReportSummary = (req, res, next) => {
  const normalizedFormat = String(req.query.format || "").toLowerCase();

  if (!["csv", "excel", "pdf"].includes(normalizedFormat)) {
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
  validateCreateDisasterEvent,
  validateUpdateDisasterEvent,
  validateExtendDisasterEvent,
  validateExportDisasterEvents,
  validateDisasterEventReportSummary,
  validateExportDisasterEventReportSummary,
};
