const INVENTORY_BARCODE_PATTERN = /^\d{8,18}$/;
const INVENTORY_ITEM_STOCK_FORM_BARCODE_UNIQUE_CONSTRAINT =
  "inventory_item_stock_forms_barcode_key";

const normalizeInventoryBarcode = (value) =>
  String(value ?? "").replace(/\s+/g, "").trim();

const isValidInventoryBarcode = (value) =>
  INVENTORY_BARCODE_PATTERN.test(normalizeInventoryBarcode(value));

const isInventoryStockFormBarcodeUniqueViolation = (error) =>
  error?.code === "23505" &&
  error?.constraint === INVENTORY_ITEM_STOCK_FORM_BARCODE_UNIQUE_CONSTRAINT;

module.exports = {
  INVENTORY_BARCODE_PATTERN,
  INVENTORY_ITEM_STOCK_FORM_BARCODE_UNIQUE_CONSTRAINT,
  normalizeInventoryBarcode,
  isValidInventoryBarcode,
  isInventoryStockFormBarcodeUniqueViolation,
};
