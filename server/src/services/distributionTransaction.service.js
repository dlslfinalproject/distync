const pool = require("../config/db");
const distributionTransactionRepository = require("../repositories/distributionTransaction.repository");

const buildFullName = (firstName, middleName, lastName, suffix) => {
  return [firstName, middleName, lastName, suffix].filter(Boolean).join(" ");
};

const getInventoryBatchStatus = (quantityAvailable) => {
  if (quantityAvailable === 0) {
    return "DEPLETED";
  }

  if (quantityAvailable > 0 && quantityAvailable <= 10) {
    return "LOW_STOCK";
  }

  return "AVAILABLE";
};

const groupRequestedItemsByBatch = (items) => {
  const groupedItems = new Map();

  for (const item of items) {
    const existingBatchEntry = groupedItems.get(item.inventory_batch_id);

    if (!existingBatchEntry) {
      groupedItems.set(item.inventory_batch_id, {
        inventory_batch_id: item.inventory_batch_id,
        inventory_item_id: item.inventory_item_id,
        total_quantity_released: item.quantity_released,
      });
      continue;
    }

    if (existingBatchEntry.inventory_item_id !== item.inventory_item_id) {
      const error = new Error(
        "Items using the same inventory_batch_id must also use the same inventory_item_id",
      );
      error.statusCode = 400;
      throw error;
    }

    existingBatchEntry.total_quantity_released += item.quantity_released;
  }

  return [...groupedItems.values()];
};

const createDistributionTransaction = async (requestData) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const stub = await distributionTransactionRepository.getStubByIdForUpdate(
      requestData.stub_id,
      client,
    );

    if (!stub) {
      const error = new Error("Stub not found");
      error.statusCode = 404;
      throw error;
    }

    if (stub.disaster_event_id !== requestData.disaster_event_id) {
      const error = new Error("disaster_event_id does not match the stub record");
      error.statusCode = 400;
      throw error;
    }

    if (stub.household_id !== requestData.household_id) {
      const error = new Error("household_id does not match the stub record");
      error.statusCode = 400;
      throw error;
    }

    if (stub.status !== "ISSUED") {
      const error = new Error("Stub is not claimable");
      error.statusCode = 400;
      throw error;
    }

    const groupedItems = groupRequestedItemsByBatch(requestData.items);
    const lockedBatches = new Map();

    for (const groupedItem of groupedItems) {
      const inventoryBatch =
        await distributionTransactionRepository.getInventoryBatchByIdForUpdate(
          groupedItem.inventory_batch_id,
          client,
        );

      if (!inventoryBatch) {
        const error = new Error(
          `Inventory batch not found: ${groupedItem.inventory_batch_id}`,
        );
        error.statusCode = 404;
        throw error;
      }

      if (inventoryBatch.inventory_item_id !== groupedItem.inventory_item_id) {
        const error = new Error(
          `inventory_item_id does not match the selected batch for batch ${groupedItem.inventory_batch_id}`,
        );
        error.statusCode = 400;
        throw error;
      }

      if (inventoryBatch.quantity_available < groupedItem.total_quantity_released) {
        const error = new Error(
          `Insufficient stock for batch ${inventoryBatch.batch_no}`,
        );
        error.statusCode = 400;
        throw error;
      }

      lockedBatches.set(groupedItem.inventory_batch_id, inventoryBatch);
    }

    const distributionTransaction =
      await distributionTransactionRepository.insertDistributionTransaction(
        {
          disaster_event_id: requestData.disaster_event_id,
          household_id: requestData.household_id,
          stub_id: requestData.stub_id,
          distribution_status: "CLAIMED",
          claimed_by_name: requestData.claimed_by_name,
          verified_by: requestData.verified_by,
          device_id: requestData.device_id,
          is_offline_encoded: requestData.is_offline_encoded,
          sync_status: requestData.sync_status,
          remarks: requestData.remarks,
        },
        client,
      );

    const releasedItems = [];

    for (const item of requestData.items) {
      const insertedItem =
        await distributionTransactionRepository.insertDistributionTransactionItem(
          {
            distribution_transaction_id: distributionTransaction.id,
            inventory_batch_id: item.inventory_batch_id,
            inventory_item_id: item.inventory_item_id,
            quantity_released: item.quantity_released,
          },
          client,
        );

      const batchDetails = lockedBatches.get(item.inventory_batch_id);

      releasedItems.push({
        id: insertedItem.id,
        inventory_batch_id: insertedItem.inventory_batch_id,
        inventory_item_id: insertedItem.inventory_item_id,
        quantity_released: insertedItem.quantity_released,
        batch_no: batchDetails.batch_no,
        item_code: batchDetails.item_code,
        item_name: batchDetails.item_name,
        unit_of_measure: batchDetails.unit_of_measure,
      });
    }

    for (const groupedItem of groupedItems) {
      const batchDetails = lockedBatches.get(groupedItem.inventory_batch_id);
      const remainingQuantity =
        batchDetails.quantity_available - groupedItem.total_quantity_released;
      const nextStatus = getInventoryBatchStatus(remainingQuantity);

      const updatedBatch =
        await distributionTransactionRepository.updateInventoryBatchQuantityAndStatus(
          groupedItem.inventory_batch_id,
          remainingQuantity,
          nextStatus,
          client,
        );

      lockedBatches.set(groupedItem.inventory_batch_id, {
        ...batchDetails,
        quantity_available: updatedBatch.quantity_available,
        status: updatedBatch.status,
      });
    }

    const updatedStub = await distributionTransactionRepository.updateStubAsClaimed(
      requestData.stub_id,
      client,
    );

    await client.query("COMMIT");

    return {
      distribution_transaction_id: distributionTransaction.id,
      distribution_date: distributionTransaction.distribution_date,
      stub: {
        id: updatedStub.id,
        stub_no: updatedStub.stub_no,
        serial_no: updatedStub.serial_no,
        status: updatedStub.status,
        claimed_at: updatedStub.claimed_at,
      },
      household: {
        id: stub.household_id,
        family_head_name: buildFullName(
          stub.family_head_first_name,
          stub.family_head_middle_name,
          stub.family_head_last_name,
          stub.family_head_suffix,
        ),
      },
      items_count: releasedItems.length,
      items: releasedItems,
    };
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      const duplicateError = new Error("This stub has already been used for distribution");
      duplicateError.statusCode = 409;
      throw duplicateError;
    }

    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  createDistributionTransaction,
};
