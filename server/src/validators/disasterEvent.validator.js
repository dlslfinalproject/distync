const allowedStatuses = ["PLANNED", "ACTIVE", "CLOSED", "ARCHIVED"];
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

const isValidDateString = (value) => {
  if (typeof value !== "string") {
    return false;
  }

  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

const requiresCompletedEndDate = (status) =>
  status === "CLOSED" || status === "ARCHIVED";

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
        message: "status must be one of: PLANNED, ACTIVE, CLOSED, ARCHIVED",
      });
    }

    if (end_date && new Date(end_date) < new Date(start_date)) {
      return res.status(400).json({
        message: "end_date must not be earlier than start_date",
      });
    }

    if (requiresCompletedEndDate(normalizedStatus) && !end_date) {
      return res.status(400).json({
        message: "end_date is required when status is CLOSED or ARCHIVED",
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

const validateExportDisasterEvents = (req, res, next) => {
  try {
    const { scope, format, search, disaster_type, affected_barangay_id } =
      req.query;
    const normalizedScope = String(scope || "all").toLowerCase();
    const normalizedFormat = String(format || "").toLowerCase();

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

    if (
      affected_barangay_id &&
      !uuidPattern.test(String(affected_barangay_id))
    ) {
      return res.status(400).json({
        message: "affected_barangay_id must be a valid UUID",
      });
    }

    req.validatedQuery = {
      scope: normalizedScope,
      format: normalizedFormat,
      search: typeof search === "string" ? search : "",
      disaster_type: typeof disaster_type === "string" ? disaster_type : "",
      affected_barangay_id:
        typeof affected_barangay_id === "string"
          ? affected_barangay_id
          : "",
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate disaster events export request",
      error: error.message,
    });
  }
};

module.exports = {
  validateCreateDisasterEvent,
  validateExtendDisasterEvent,
  validateExportDisasterEvents,
};
