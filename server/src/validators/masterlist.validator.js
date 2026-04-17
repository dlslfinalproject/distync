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

const validateGetBarangayDashboard = (req, res, next) => {
  try {
    const { user_id, disaster_event_id, event_scope, override_barangay_id } =
      req.query;

    const hasUserId =
      user_id !== undefined &&
      user_id !== null &&
      user_id !== "";

    if (hasUserId && !isValidUuid(user_id)) {
      return res.status(400).json({
        message: "user_id must be a valid UUID when provided",
      });
    }

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

    if (
      event_scope !== undefined &&
      !["active", "ended"].includes(String(event_scope).toLowerCase())
    ) {
      return res.status(400).json({
        message: "event_scope must be active or ended when provided",
      });
    }

    if (
      override_barangay_id !== undefined &&
      override_barangay_id !== null &&
      override_barangay_id !== "" &&
      !isValidUuid(override_barangay_id)
    ) {
      return res.status(400).json({
        message: "override_barangay_id must be a valid UUID when provided",
      });
    }

    if (!hasUserId && !override_barangay_id) {
      return res.status(400).json({
        error: "NO_ASSIGNED_BARANGAY",
        message: "No assigned barangay. Please contact administrator.",
      });
    }

    req.validatedQuery = {
      user_id: hasUserId ? user_id : null,
      disaster_event_id: disaster_event_id || null,
      event_scope: String(event_scope || "active").toLowerCase(),
      override_barangay_id: override_barangay_id || null,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate barangay dashboard request",
      error: error.message,
    });
  }
};

module.exports = {
  validateGetMasterlist,
  validateGetBarangayDashboard,
};
