const allowedSyncStatuses = ["PENDING", "SYNCED", "CONFLICT", "FAILED"];
const allowedReceiptStatuses = [
  "GENERATED",
  "VOIDED",
  "REISSUED",
  "CANCELLED",
];

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isValidUuid = (value) => {
  return typeof value === "string" && uuidPattern.test(value);
};

const validateCreateDistributionTransaction = (req, res, next) => {
  try {
    const {
      disaster_event_id,
      household_id,
      stub_id,
      claimed_by_name,
      verified_by,
      device_id,
      is_offline_encoded,
      sync_status,
      remarks,
      qr_reference_value,
      receipt_status,
      relief_pack_template_id,
      items,
    } = req.body;

    if (!isValidUuid(disaster_event_id)) {
      return res.status(400).json({
        message: "disaster_event_id is required and must be a valid UUID",
      });
    }

    if (!isValidUuid(household_id)) {
      return res.status(400).json({
        message: "household_id is required and must be a valid UUID",
      });
    }

    if (!isValidUuid(stub_id)) {
      return res.status(400).json({
        message: "stub_id is required and must be a valid UUID",
      });
    }

    if (!claimed_by_name || typeof claimed_by_name !== "string" || !claimed_by_name.trim()) {
      return res.status(400).json({
        message: "claimed_by_name is required and must be a non-empty string",
      });
    }

    if (verified_by !== undefined && verified_by !== null && !isValidUuid(verified_by)) {
      return res.status(400).json({
        message: "verified_by must be a valid UUID or null",
      });
    }

    if (device_id !== undefined && device_id !== null && !isValidUuid(device_id)) {
      return res.status(400).json({
        message: "device_id must be a valid UUID or null",
      });
    }

    if (
      is_offline_encoded !== undefined &&
      typeof is_offline_encoded !== "boolean"
    ) {
      return res.status(400).json({
        message: "is_offline_encoded must be a boolean when provided",
      });
    }

    if (sync_status !== undefined && !allowedSyncStatuses.includes(sync_status)) {
      return res.status(400).json({
        message: "sync_status must be one of: PENDING, SYNCED, CONFLICT, FAILED",
      });
    }

    if (remarks !== undefined && remarks !== null && typeof remarks !== "string") {
      return res.status(400).json({
        message: "remarks must be a string or null",
      });
    }

    if (
      qr_reference_value !== undefined &&
      qr_reference_value !== null &&
      typeof qr_reference_value !== "string"
    ) {
      return res.status(400).json({
        message: "qr_reference_value must be a string or null",
      });
    }

    if (
      receipt_status !== undefined &&
      !allowedReceiptStatuses.includes(receipt_status)
    ) {
      return res.status(400).json({
        message:
          "receipt_status must be one of: GENERATED, VOIDED, REISSUED, CANCELLED",
      });
    }

    if (
      relief_pack_template_id !== undefined &&
      relief_pack_template_id !== null &&
      !isValidUuid(relief_pack_template_id)
    ) {
      return res.status(400).json({
        message: "relief_pack_template_id must be a valid UUID or null",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: "items must be a non-empty array",
      });
    }

    for (const item of items) {
      if (!isValidUuid(item.inventory_batch_id)) {
        return res.status(400).json({
          message: "Each item.inventory_batch_id must be a valid UUID",
        });
      }

      if (!isValidUuid(item.inventory_item_id)) {
        return res.status(400).json({
          message: "Each item.inventory_item_id must be a valid UUID",
        });
      }

      if (!Number.isInteger(item.quantity_released) || item.quantity_released <= 0) {
        return res.status(400).json({
          message: "Each item.quantity_released must be a positive integer",
        });
      }
    }

    req.validatedBody = {
      disaster_event_id,
      household_id,
      stub_id,
      claimed_by_name: claimed_by_name.trim(),
      verified_by: verified_by ?? null,
      device_id: device_id ?? null,
      is_offline_encoded: is_offline_encoded ?? false,
      sync_status: sync_status ?? "SYNCED",
      remarks: remarks ?? null,
      qr_reference_value:
        typeof qr_reference_value === "string" && qr_reference_value.trim()
          ? qr_reference_value.trim()
          : null,
      receipt_status: receipt_status ?? "GENERATED",
      relief_pack_template_id: relief_pack_template_id ?? null,
      items: items.map((item) => ({
        inventory_batch_id: item.inventory_batch_id,
        inventory_item_id: item.inventory_item_id,
        quantity_released: item.quantity_released,
      })),
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate distribution transaction request",
      error: error.message,
    });
  }
};

const validateClaimDistributionFromQr = (req, res, next) => {
  try {
    const {
      disaster_event_id,
      household_id,
      stub_id,
      claimed_by_name,
      qr_reference_value,
      remarks,
    } = req.body;

    if (!isValidUuid(disaster_event_id)) {
      return res.status(400).json({
        message: "disaster_event_id is required and must be a valid UUID",
      });
    }

    if (!isValidUuid(household_id)) {
      return res.status(400).json({
        message: "household_id is required and must be a valid UUID",
      });
    }

    if (!isValidUuid(stub_id)) {
      return res.status(400).json({
        message: "stub_id is required and must be a valid UUID",
      });
    }

    if (!claimed_by_name || typeof claimed_by_name !== "string" || !claimed_by_name.trim()) {
      return res.status(400).json({
        message: "claimed_by_name is required and must be a non-empty string",
      });
    }

    if (
      qr_reference_value !== undefined &&
      qr_reference_value !== null &&
      typeof qr_reference_value !== "string"
    ) {
      return res.status(400).json({
        message: "qr_reference_value must be a string or null",
      });
    }

    if (remarks !== undefined && remarks !== null && typeof remarks !== "string") {
      return res.status(400).json({
        message: "remarks must be a string or null",
      });
    }

    req.validatedBody = {
      disaster_event_id,
      household_id,
      stub_id,
      claimed_by_name: claimed_by_name.trim(),
      qr_reference_value:
        typeof qr_reference_value === "string" && qr_reference_value.trim()
          ? qr_reference_value.trim()
          : null,
      remarks: remarks ?? null,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate QR stub claim request",
      error: error.message,
    });
  }
};

const validateGetDistributionHistory = (req, res, next) => {
  try {
    const {
      disaster_event_id,
      barangay_id,
      status,
      date_from,
      date_to,
      limit,
    } = req.query;

    const allowedDistributionStatuses = ["CLAIMED", "CANCELLED", "REVERSED"];

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

    if (status && !allowedDistributionStatuses.includes(status)) {
      return res.status(400).json({
        message: "status must be one of: CLAIMED, CANCELLED, REVERSED",
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

    if (!Number.isInteger(parsedLimit) || parsedLimit <= 0 || parsedLimit > 500) {
      return res.status(400).json({
        message: "limit must be an integer between 1 and 500",
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
      message: "Failed to validate distribution history request",
      error: error.message,
    });
  }
};

module.exports = {
  validateCreateDistributionTransaction,
  validateClaimDistributionFromQr,
  validateGetDistributionHistory,
};
