const allowedTransactionTypes = [
  "INFLOW",
  "OUTFLOW",
  "ADJUSTMENT",
  "EXPIRED",
  "MISSING",
  "DAMAGED",
  "SPOILED",
  "STOLEN",
  "RETURN",
];

const allowedReferenceTypes = [
  "MANUAL",
  "BARCODE_SCAN",
  "QR_SCAN",
  "DISTRIBUTION",
  "DONATION",
  "PROOF_OF_RECEIPT",
  "SYNC",
  "SYSTEM",
];

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isValidUuid = (value) => {
  return typeof value === "string" && uuidPattern.test(value);
};

const validateInventoryTransactionId = (req, res, next) => {
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
      message: "Failed to validate inventory transaction id",
      error: error.message,
    });
  }
};

const validateGetInventoryTransactions = (req, res, next) => {
  try {
    const {
      inventory_batch_id,
      inventory_item_id,
      transaction_type,
      reference_type,
      disaster_event_id,
      performed_by,
      search,
    } = req.query;

    if (inventory_batch_id !== undefined && !isValidUuid(inventory_batch_id)) {
      return res.status(400).json({
        message: "inventory_batch_id must be a valid UUID when provided",
      });
    }

    if (inventory_item_id !== undefined && !isValidUuid(inventory_item_id)) {
      return res.status(400).json({
        message: "inventory_item_id must be a valid UUID when provided",
      });
    }

    if (
      transaction_type !== undefined &&
      !allowedTransactionTypes.includes(transaction_type)
    ) {
      return res.status(400).json({
        message:
          "transaction_type must be one of: INFLOW, OUTFLOW, ADJUSTMENT, EXPIRED, MISSING, DAMAGED, SPOILED, STOLEN, RETURN",
      });
    }

    if (
      reference_type !== undefined &&
      !allowedReferenceTypes.includes(reference_type)
    ) {
      return res.status(400).json({
        message:
          "reference_type must be one of: MANUAL, BARCODE_SCAN, QR_SCAN, DISTRIBUTION, DONATION, PROOF_OF_RECEIPT, SYNC, SYSTEM",
      });
    }

    if (disaster_event_id !== undefined && !isValidUuid(disaster_event_id)) {
      return res.status(400).json({
        message: "disaster_event_id must be a valid UUID when provided",
      });
    }

    if (performed_by !== undefined && !isValidUuid(performed_by)) {
      return res.status(400).json({
        message: "performed_by must be a valid UUID when provided",
      });
    }

    req.validatedQuery = {
      inventory_batch_id: inventory_batch_id || null,
      inventory_item_id: inventory_item_id || null,
      transaction_type:
        typeof transaction_type === "string" && transaction_type.trim()
          ? transaction_type.trim()
          : null,
      reference_type:
        typeof reference_type === "string" && reference_type.trim()
          ? reference_type.trim()
          : null,
      disaster_event_id: disaster_event_id || null,
      performed_by: performed_by || null,
      search: typeof search === "string" && search.trim() ? search.trim() : null,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate inventory transaction filters",
      error: error.message,
    });
  }
};

const validateCreateInventoryTransaction = (req, res, next) => {
  try {
    const {
      disaster_event_id,
      inventory_batch_id,
      inventory_item_id,
      transaction_type,
      quantity,
      reference_type,
      reference_id,
      performed_by,
      remarks,
    } = req.body;

    if (
      (inventory_batch_id === undefined || inventory_batch_id === null || inventory_batch_id === "") &&
      (inventory_item_id === undefined || inventory_item_id === null || inventory_item_id === "")
    ) {
      return res.status(400).json({
        message: "inventory_batch_id or inventory_item_id is required",
      });
    }

    if (
      inventory_batch_id !== undefined &&
      inventory_batch_id !== null &&
      inventory_batch_id !== "" &&
      !isValidUuid(inventory_batch_id)
    ) {
      return res.status(400).json({
        message: "inventory_batch_id must be a valid UUID when provided",
      });
    }

    if (
      inventory_item_id !== undefined &&
      inventory_item_id !== null &&
      inventory_item_id !== "" &&
      !isValidUuid(inventory_item_id)
    ) {
      return res.status(400).json({
        message: "inventory_item_id must be a valid UUID when provided",
      });
    }

    if (!allowedTransactionTypes.includes(transaction_type)) {
      return res.status(400).json({
        message:
          "transaction_type is required and must be one of: INFLOW, OUTFLOW, ADJUSTMENT, EXPIRED, MISSING, DAMAGED, SPOILED, STOLEN, RETURN",
      });
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({
        message: "quantity is required and must be a positive integer",
      });
    }

    if (disaster_event_id !== undefined && disaster_event_id !== null && !isValidUuid(disaster_event_id)) {
      return res.status(400).json({
        message: "disaster_event_id must be a valid UUID or null",
      });
    }

    if (
      reference_type !== undefined &&
      reference_type !== null &&
      !allowedReferenceTypes.includes(reference_type)
    ) {
      return res.status(400).json({
        message:
          "reference_type must be one of: MANUAL, BARCODE_SCAN, QR_SCAN, DISTRIBUTION, DONATION, PROOF_OF_RECEIPT, SYNC, SYSTEM",
      });
    }

    if (reference_id !== undefined && reference_id !== null && !isValidUuid(reference_id)) {
      return res.status(400).json({
        message: "reference_id must be a valid UUID or null",
      });
    }

    if (performed_by !== undefined && performed_by !== null && !isValidUuid(performed_by)) {
      return res.status(400).json({
        message: "performed_by must be a valid UUID or null",
      });
    }

    if (remarks !== undefined && remarks !== null && typeof remarks !== "string") {
      return res.status(400).json({
        message: "remarks must be a string or null",
      });
    }

    req.validatedBody = {
      disaster_event_id: disaster_event_id ?? null,
      inventory_batch_id: inventory_batch_id ?? null,
      inventory_item_id: inventory_item_id ?? null,
      transaction_type,
      quantity,
      reference_type: reference_type ?? "MANUAL",
      reference_id: reference_id ?? null,
      performed_by: performed_by ?? null,
      remarks: remarks ?? null,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate inventory transaction payload",
      error: error.message,
    });
  }
};

module.exports = {
  validateInventoryTransactionId,
  validateGetInventoryTransactions,
  validateCreateInventoryTransaction,
};
