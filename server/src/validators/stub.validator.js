const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isValidUuid = (value) => {
  return typeof value === "string" && uuidPattern.test(value);
};

const validateStubSearch = (req, res, next) => {
  try {
    const { q, disaster_event_id, barangay_id } = req.query;

    if (!q || typeof q !== "string" || !q.trim()) {
      return res.status(400).json({
        message: "q is required and must be a non-empty string",
      });
    }

    if (disaster_event_id !== undefined && !isValidUuid(disaster_event_id)) {
      return res.status(400).json({
        message: "disaster_event_id must be a valid UUID when provided",
      });
    }

    if (barangay_id !== undefined && !isValidUuid(barangay_id)) {
      return res.status(400).json({
        message: "barangay_id must be a valid UUID when provided",
      });
    }

    req.validatedQuery = {
      q: q.trim(),
      disaster_event_id: disaster_event_id || null,
      barangay_id: barangay_id || null,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate stub search request",
      error: error.message,
    });
  }
};

const validateGetBarangayStubDashboard = (req, res, next) => {
  try {
    const { user_id, disaster_event_id, override_barangay_id } = req.query;

    const hasUserId =
      user_id !== undefined &&
      user_id !== null &&
      user_id !== "";

    if (hasUserId && !isValidUuid(user_id)) {
      return res.status(400).json({
        message: "user_id must be a valid UUID when provided",
      });
    }

    if (!isValidUuid(disaster_event_id)) {
      return res.status(400).json({
        message: "disaster_event_id is required and must be a valid UUID",
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
      disaster_event_id,
      override_barangay_id: override_barangay_id || null,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate stub dashboard request",
      error: error.message,
    });
  }
};

const validateStubId = (req, res, next) => {
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
      message: "Failed to validate stub id",
      error: error.message,
    });
  }
};

const validateStubVerify = (req, res, next) => {
  try {
    const { stub_no, serial_no } = req.body;

    if (
      (stub_no === undefined || stub_no === null || stub_no === "") &&
      (serial_no === undefined || serial_no === null || serial_no === "")
    ) {
      return res.status(400).json({
        message: "Either stub_no or serial_no is required",
      });
    }

    req.validatedBody = {
      stub_no: typeof stub_no === "string" && stub_no.trim() ? stub_no.trim() : null,
      serial_no:
        typeof serial_no === "string" && serial_no.trim() ? serial_no.trim() : null,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate stub verification request",
      error: error.message,
    });
  }
};

const validateClaimBarangayStub = (req, res, next) => {
  try {
    const { id } = req.params;
    const { user_id, override_barangay_id } = req.body;

    const hasUserId =
      user_id !== undefined &&
      user_id !== null &&
      user_id !== "";

    if (!isValidUuid(id)) {
      return res.status(400).json({
        message: "id must be a valid UUID",
      });
    }

    if (hasUserId && !isValidUuid(user_id)) {
      return res.status(400).json({
        message: "user_id must be a valid UUID when provided",
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

    req.validatedBody = {
      id,
      user_id: hasUserId ? user_id : null,
      override_barangay_id: override_barangay_id || null,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate stub claim request",
      error: error.message,
    });
  }
};

module.exports = {
  validateGetBarangayStubDashboard,
  validateStubSearch,
  validateStubId,
  validateStubVerify,
  validateClaimBarangayStub,
};
