const allowedStatuses = ["PLANNED", "ACTIVE", "CLOSED", "ARCHIVED"];

const isValidDateString = (value) => {
  if (typeof value !== "string") {
    return false;
  }

  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

const validateCreateDisasterEvent = (req, res, next) => {
  try {
    const {
      event_code,
      title,
      disaster_type,
      description,
      start_date,
      end_date,
      status,
      created_by,
      barangay_ids,
    } = req.body;

    if (!event_code || typeof event_code !== "string") {
      return res.status(400).json({
        message: "event_code is required and must be a string",
      });
    }

    if (!title || typeof title !== "string") {
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

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "status must be one of: PLANNED, ACTIVE, CLOSED, ARCHIVED",
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
      event_code: event_code.trim(),
      title: title.trim(),
      disaster_type: disaster_type.trim(),
      description: description ?? null,
      start_date,
      end_date: end_date ?? null,
      status,
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

module.exports = {
  validateCreateDisasterEvent,
};
