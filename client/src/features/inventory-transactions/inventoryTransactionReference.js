export const INVENTORY_TRANSACTION_REFERENCE_PATTERN = /^ITR-[0-9]{4}-[0-9]{6}$/;

export const normalizeInventoryTransactionReferenceNo = (value) => {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim().toUpperCase();
};

export const isValidInventoryTransactionReferenceNo = (value) => {
  const normalized = normalizeInventoryTransactionReferenceNo(value);

  return (
    INVENTORY_TRANSACTION_REFERENCE_PATTERN.test(normalized) &&
    !normalized.endsWith("000000")
  );
};
