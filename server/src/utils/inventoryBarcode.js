const INVENTORY_BARCODE_PATTERN = /^\d{8,18}$/;

const normalizeInventoryBarcode = (value) =>
  String(value ?? "").replace(/\s+/g, "").trim();

const isValidInventoryBarcode = (value) =>
  INVENTORY_BARCODE_PATTERN.test(normalizeInventoryBarcode(value));

module.exports = {
  INVENTORY_BARCODE_PATTERN,
  normalizeInventoryBarcode,
  isValidInventoryBarcode,
};
