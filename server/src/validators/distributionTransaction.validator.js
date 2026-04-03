const allowedSyncStatuses = ["PENDING", "SYNCED", "CONFLICT", "FAILED"];

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

module.exports = {
  validateCreateDistributionTransaction,
};
