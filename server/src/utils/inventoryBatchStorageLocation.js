const INVENTORY_BATCH_STORAGE_LOCATION_MAX_LENGTH = 200;

const isInventoryBatchStorageLocationLengthValid = (value) =>
  typeof value !== "string" ||
  value.length <= INVENTORY_BATCH_STORAGE_LOCATION_MAX_LENGTH;

module.exports = {
  INVENTORY_BATCH_STORAGE_LOCATION_MAX_LENGTH,
  isInventoryBatchStorageLocationLengthValid,
};
