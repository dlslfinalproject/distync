const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isValidUuid = (value) => {
  return typeof value === "string" && uuidPattern.test(value);
};

const validateGetMasterlist = (req, res, next) => {
  try {
    const { disaster_event_id, barangay_id } = req.query;

    if (!isValidUuid(disaster_event_id)) {
      return res.status(400).json({
        message: "disaster_event_id is required and must be a valid UUID",
      });
    }

    if (barangay_id !== undefined && !isValidUuid(barangay_id)) {
      return res.status(400).json({
        message: "barangay_id must be a valid UUID when provided",
      });
    }

    req.validatedQuery = {
      disaster_event_id,
      barangay_id: barangay_id || null,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate masterlist request",
      error: error.message,
    });
  }
};

module.exports = {
  validateGetMasterlist,
};
