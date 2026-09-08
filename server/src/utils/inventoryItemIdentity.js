const DUPLICATE_INVENTORY_ITEM = "DUPLICATE_INVENTORY_ITEM";
const DUPLICATE_INVENTORY_BARCODE = "DUPLICATE_INVENTORY_BARCODE";

const createInventoryIdentityConflictError = ({
  code,
  message,
  existingItem = null,
  existingStockForm = null,
  field = null,
}) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 409;
  error.entityServerId =
    existingItem?.id || existingStockForm?.inventory_item_id || null;
  error.serverPayload = {
    ...(existingItem || {}),
    ...(existingStockForm
      ? {
          inventory_item_stock_form: {
            id: existingStockForm.id || null,
            inventory_item_id: existingStockForm.inventory_item_id || null,
            barcode: existingStockForm.barcode || null,
            packaging: existingStockForm.packaging || null,
            units_per_packaging: existingStockForm.units_per_packaging ?? null,
            unit_of_measure: existingStockForm.unit_of_measure || null,
            unit_of_measure_value:
              existingStockForm.unit_of_measure_value ?? null,
          },
        }
      : {}),
  };
  error.duplicateField = field;
  return error;
};

const createDuplicateInventoryItemError = ({
  existingItem = null,
  field = "item",
}) =>
  createInventoryIdentityConflictError({
    code: DUPLICATE_INVENTORY_ITEM,
    message:
      field === "item_code"
        ? "An inventory item with this item code already exists"
        : field === "item_name"
          ? "An inventory item with this name already exists"
          : "This inventory item already exists",
    existingItem,
    field,
  });

const createDuplicateInventoryBarcodeError = ({
  existingItem = null,
  existingStockForm = null,
  packagingConflict = false,
}) =>
  createInventoryIdentityConflictError({
    code: DUPLICATE_INVENTORY_BARCODE,
    message: packagingConflict
      ? "This barcode is already assigned to another packaging"
      : "This barcode is already assigned to another item",
    existingItem,
    existingStockForm,
    field: "barcode",
  });

module.exports = {
  DUPLICATE_INVENTORY_ITEM,
  DUPLICATE_INVENTORY_BARCODE,
  createDuplicateInventoryItemError,
  createDuplicateInventoryBarcodeError,
};
