const DUPLICATE_INVENTORY_BATCH = "DUPLICATE_INVENTORY_BATCH";
const INVENTORY_BATCH_IDENTITY_CONSTRAINT =
  "inventory_batches_inventory_item_id_batch_no_unique";
const INVENTORY_BATCH_DUPLICATE_MESSAGE =
  "This batch number already exists for the selected inventory item.";

const createDuplicateInventoryBatchError = (existingBatch = null) => {
  const error = new Error(INVENTORY_BATCH_DUPLICATE_MESSAGE);
  error.code = DUPLICATE_INVENTORY_BATCH;
  error.statusCode = 409;
  error.entityServerId = existingBatch?.id || null;
  error.serverPayload = existingBatch || {};
  return error;
};

module.exports = {
  DUPLICATE_INVENTORY_BATCH,
  INVENTORY_BATCH_IDENTITY_CONSTRAINT,
  INVENTORY_BATCH_DUPLICATE_MESSAGE,
  createDuplicateInventoryBatchError,
};
