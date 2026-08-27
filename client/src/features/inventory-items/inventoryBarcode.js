const INVENTORY_BARCODE_PATTERN = /^\d{8,18}$/;

export const normalizeInventoryBarcode = (value) =>
  String(value ?? "").replace(/\s+/g, "").trim();

export const isValidInventoryBarcode = (value) =>
  INVENTORY_BARCODE_PATTERN.test(normalizeInventoryBarcode(value));
