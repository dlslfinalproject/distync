const INVENTORY_TRANSACTION_REFERENCE_PATTERN = /^ITR-[0-9]{4}-[0-9]{6}$/;
const DUPLICATE_INVENTORY_TRANSACTION_REFERENCE_NO =
  "DUPLICATE_INVENTORY_TRANSACTION_REFERENCE_NO";
const INVENTORY_TRANSACTION_REFERENCE_DUPLICATE_MESSAGE =
  "This Inventory Transaction Reference No. has already been recorded. Check the written inventory transaction before trying again.";

const normalizeInventoryTransactionReferenceNo = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim().toUpperCase();
  return normalized || null;
};

const isValidInventoryTransactionReferenceNo = (value) => {
  const normalized = normalizeInventoryTransactionReferenceNo(value);

  return (
    Boolean(normalized) &&
    INVENTORY_TRANSACTION_REFERENCE_PATTERN.test(normalized) &&
    !normalized.endsWith("000000")
  );
};

const createDuplicateInventoryTransactionReferenceError = (
  existingTransaction = null,
) => {
  const error = new Error(INVENTORY_TRANSACTION_REFERENCE_DUPLICATE_MESSAGE);
  error.code = DUPLICATE_INVENTORY_TRANSACTION_REFERENCE_NO;
  error.statusCode = 409;
  error.entityServerId = existingTransaction?.id || null;
  error.serverPayload = existingTransaction || {};
  return error;
};

module.exports = {
  DUPLICATE_INVENTORY_TRANSACTION_REFERENCE_NO,
  INVENTORY_TRANSACTION_REFERENCE_DUPLICATE_MESSAGE,
  normalizeInventoryTransactionReferenceNo,
  isValidInventoryTransactionReferenceNo,
  createDuplicateInventoryTransactionReferenceError,
};
