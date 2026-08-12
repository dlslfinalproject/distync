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
    const {
      user_id,
      disaster_event_id,
      barangay_id,
      override_barangay_id,
    } = req.query;

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
      barangay_id !== undefined &&
      barangay_id !== null &&
      barangay_id !== "" &&
      !isValidUuid(barangay_id)
    ) {
      return res.status(400).json({
        message: "barangay_id must be a valid UUID when provided",
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

    if (!hasUserId && !barangay_id && !override_barangay_id) {
      return res.status(400).json({
        error: "NO_ASSIGNED_BARANGAY",
        message: "No assigned barangay. Please contact administrator.",
      });
    }

    req.validatedQuery = {
      user_id: hasUserId ? user_id : null,
      disaster_event_id,
      barangay_id: barangay_id || null,
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
    const { stub_no, serial_no, qr_code_value } = req.body;

    if (
      (stub_no === undefined || stub_no === null || stub_no === "") &&
      (serial_no === undefined || serial_no === null || serial_no === "") &&
      (qr_code_value === undefined || qr_code_value === null || qr_code_value === "")
    ) {
      return res.status(400).json({
        message: "Either stub_no, serial_no, or qr_code_value is required",
      });
    }

    req.validatedBody = {
      stub_no: typeof stub_no === "string" && stub_no.trim() ? stub_no.trim() : null,
      serial_no:
        typeof serial_no === "string" && serial_no.trim() ? serial_no.trim() : null,
      qr_code_value:
        typeof qr_code_value === "string" && qr_code_value.trim()
          ? qr_code_value.trim()
          : null,
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
    const {
      user_id,
      barangay_id,
      override_barangay_id,
      donated_loose_items,
    } = req.body;

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
      barangay_id !== undefined &&
      barangay_id !== null &&
      barangay_id !== "" &&
      !isValidUuid(barangay_id)
    ) {
      return res.status(400).json({
        message: "barangay_id must be a valid UUID when provided",
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

    if (!hasUserId && !barangay_id && !override_barangay_id) {
      return res.status(400).json({
        error: "NO_ASSIGNED_BARANGAY",
        message: "No assigned barangay. Please contact administrator.",
      });
    }

    if (
      donated_loose_items !== undefined &&
      !Array.isArray(donated_loose_items)
    ) {
      return res.status(400).json({
        message: "donated_loose_items must be an array when provided",
      });
    }

    const normalizedDonatedLooseItems = Array.isArray(donated_loose_items)
      ? donated_loose_items
          .map((item) => ({
            donation_item_id: item?.donation_item_id,
            quantity: Number.parseInt(String(item?.quantity || 0), 10),
          }))
          .filter((item) => item.donation_item_id || item.quantity > 0)
      : [];

    for (const item of normalizedDonatedLooseItems) {
      if (!isValidUuid(item.donation_item_id)) {
        return res.status(400).json({
          message: "donated_loose_items donation_item_id must be a valid UUID",
        });
      }

      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        return res.status(400).json({
          message: "donated_loose_items quantity must be a positive integer",
        });
      }
    }

    req.validatedBody = {
      id,
      user_id: hasUserId ? user_id : null,
      barangay_id: barangay_id || null,
      override_barangay_id: override_barangay_id || null,
      donated_loose_items: normalizedDonatedLooseItems,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate stub claim request",
      error: error.message,
    });
  }
};

const validateStubHistory = (req, res, next) => {
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

    if (status && !["CLAIMED", "UNCLAIMED", "INVALID"].includes(status)) {
      return res.status(400).json({
        message: "status must be one of: CLAIMED, UNCLAIMED, INVALID",
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
      status: status || null,
      date_from: date_from || null,
      date_to: date_to || null,
      limit: parsedLimit,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate stub history request",
      error: error.message,
    });
  }
};

const validateStubHistoryExport = (req, res, next) => {
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
  validateGetBarangayStubDashboard,
  validateStubSearch,
  validateStubId,
  validateStubVerify,
  validateClaimBarangayStub,
  validateStubHistory,
  validateStubHistoryExport,
};
