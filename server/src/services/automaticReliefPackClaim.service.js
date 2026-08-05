const distributionTransactionRepository = require("../repositories/distributionTransaction.repository");
const inventoryTransactionRepository = require("../repositories/inventoryTransaction.repository");
const inventoryItemRepository = require("../repositories/inventoryItem.repository");
const reliefPackTemplateRepository = require("../repositories/reliefPackTemplate.repository");
const {
  getPrimaryAssignedReliefPackTemplate,
  resolveAssignedReliefPackTemplatesForHousehold,
} = require("./reliefPackAssignment.service");

const getNextBatchStatus = (expirationDate, quantityAvailable) => {
  if (expirationDate) {
    const today = new Date();
    const todayDateOnly = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const batchExpirationDate = new Date(expirationDate);

    if (batchExpirationDate < todayDateOnly) {
      return "EXPIRED";
    }
  }

  if (quantityAvailable === 0) {
    return "DEPLETED";
  }

  if (quantityAvailable > 0 && quantityAvailable <= 10) {
    return "LOW_STOCK";
  }

  return "AVAILABLE";
};

const buildUpdatedItemStockSnapshot = (inventoryItem, onHandQuantity) => {
  const normalizedOnHandQuantity = Math.max(Number(onHandQuantity || 0), 0);
  const normalizedPackaging = String(inventoryItem?.packaging || "").toLowerCase();
  const unitsPerPackage = Number(inventoryItem?.quantity || 0);
  const existingPackagingCount = Number(inventoryItem?.packaging_count || 0);

  if (normalizedPackaging === "piece" || unitsPerPackage <= 1) {
    return {
      quantity: 1,
      packaging_count: normalizedOnHandQuantity > 0 ? normalizedOnHandQuantity : null,
    };
  }

  if (normalizedOnHandQuantity === 0) {
    return {
      quantity: inventoryItem?.quantity || null,
      packaging_count: null,
    };
  }

  if (normalizedOnHandQuantity % unitsPerPackage === 0) {
    return {
      quantity: inventoryItem?.quantity || null,
      packaging_count: normalizedOnHandQuantity / unitsPerPackage,
    };
  }

  return {
    quantity: inventoryItem?.quantity || null,
    packaging_count: existingPackagingCount > 0 ? existingPackagingCount : null,
  };
};

const getTemplateFamilySizeCoverage = (template) => {
  const parsedCoverage = Number.parseInt(String(template?.description || "").trim(), 10);
  return Number.isInteger(parsedCoverage) && parsedCoverage > 0 ? parsedCoverage : 0;
};

const getTemplatePackMultiplier = (template, householdSize) => {
  if (!template?.based_on_family_size) {
    return 1;
  }

  const normalizedHouseholdSize = Number.parseInt(String(householdSize || 0), 10);
  const familySizeCoverage = getTemplateFamilySizeCoverage(template);

  if (
    !Number.isInteger(normalizedHouseholdSize) ||
    normalizedHouseholdSize <= 0 ||
    familySizeCoverage <= 0
  ) {
    return 1;
  }

  return Math.max(1, Math.ceil(normalizedHouseholdSize / familySizeCoverage));
};

const buildAutomaticClaimAllocations = async (
  assignedTemplateItems,
  householdSize,
  client,
) => {
  const allocations = [];
  const requiredItemsByInventoryItemId = new Map();

  for (const { template, templateItems } of assignedTemplateItems) {
    const packMultiplier = getTemplatePackMultiplier(template, householdSize);

    for (const templateItem of templateItems) {
      const requiredQuantity =
        Number(templateItem.quantity_required || 0) * packMultiplier;

      if (requiredQuantity <= 0) {
        continue;
      }

      const existingItem = requiredItemsByInventoryItemId.get(
        templateItem.inventory_item_id,
      );

      if (existingItem) {
        existingItem.requiredQuantity += requiredQuantity;
        existingItem.sourceTemplateNames.push(template.name);
        continue;
      }

      requiredItemsByInventoryItemId.set(templateItem.inventory_item_id, {
        inventory_item_id: templateItem.inventory_item_id,
        item_name: templateItem.item_name,
        requiredQuantity,
        sourceTemplateNames: [template.name],
      });
    }
  }

  for (const requiredItem of requiredItemsByInventoryItemId.values()) {
    const requiredQuantity =
      Number(requiredItem.requiredQuantity || 0);

    if (requiredQuantity <= 0) {
      continue;
    }

    const availableBatches =
      await inventoryTransactionRepository.getDistributableInventoryBatchesByItemIdForUpdate(
        requiredItem.inventory_item_id,
        client,
      );

    const eligibleBatches = availableBatches.filter((batch) => {
      if (Number(batch.quantity_available || 0) <= 0) {
        return false;
      }

      return getNextBatchStatus(
        batch.expiration_date,
        Number(batch.quantity_available || 0),
      ) !== "EXPIRED";
    });

    let remainingQuantity = requiredQuantity;

    for (const batch of eligibleBatches) {
      if (remainingQuantity <= 0) {
        break;
      }

      const quantityToRelease = Math.min(
        remainingQuantity,
        Number(batch.quantity_available || 0),
      );

      if (quantityToRelease <= 0) {
        continue;
      }

      allocations.push({
        inventory_batch_id: batch.id,
        inventory_item_id: batch.inventory_item_id,
        quantity_released: quantityToRelease,
        batch_no: batch.batch_no,
        item_code: batch.item_code,
        item_name: batch.item_name,
        unit_of_measure: batch.unit_of_measure,
        previous_quantity_available: Number(batch.quantity_available || 0),
        previous_status: batch.status,
        expiration_date: batch.expiration_date || null,
      });

      remainingQuantity -= quantityToRelease;
    }

    if (remainingQuantity > 0) {
      const error = new Error(
        `Insufficient stock to release ${requiredItem.item_name || "the assigned relief pack item"}.`,
      );
      error.statusCode = 400;
      error.code = "INSUFFICIENT_RELIEF_PACK_STOCK";
      throw error;
    }
  }

  return allocations;
};

const syncTouchedInventoryItems = async (inventoryItemIds, client) => {
  for (const inventoryItemId of inventoryItemIds) {
    const inventoryItem =
      await inventoryItemRepository.getInventoryItemByIdForUpdate(
        inventoryItemId,
        client,
      );

    if (!inventoryItem) {
      continue;
    }

    const recomputedQuantityResult = await client.query(
      `
        SELECT COALESCE(SUM(quantity_available), 0)::integer AS total_quantity
        FROM inventory_batches
        WHERE inventory_item_id = $1
      `,
      [inventoryItemId],
    );
    const nextItemQuantity = Number(
      recomputedQuantityResult.rows[0]?.total_quantity || 0,
    );

    await inventoryItemRepository.updateInventoryItemStockSnapshot(
      inventoryItemId,
      buildUpdatedItemStockSnapshot(inventoryItem, nextItemQuantity),
      client,
    );
  }
};

const recordAutomaticReliefPackClaim = async ({
  client,
  stub,
  claimedByName,
  verifiedBy,
  qrReferenceValue = null,
  qrScannedAt = null,
  qrScannedBy = null,
  receivedAt,
  claimedAt = null,
  remarks,
  receiptStatus = "GENERATED",
  syncStatus = "SYNCED",
  isOfflineEncoded = false,
}) => {
  const latestAttendance =
    await distributionTransactionRepository.getLatestAttendanceByHouseholdId(
      stub.household_id,
      stub.disaster_event_id,
      client,
    );
  const latestAttendanceStatus = String(latestAttendance?.status || "").toUpperCase();

  if (
    String(stub.current_stay_type || "").toUpperCase() !== "EVAC_CENTER" ||
    stub.is_active === false ||
    latestAttendance?.time_out ||
    !(
      latestAttendanceStatus === "PRESENT" ||
      latestAttendanceStatus === "ARRIVED" ||
      latestAttendance?.time_in
    )
  ) {
    const error = new Error(
      "Relief packs can only be claimed by households currently present in an evacuation center.",
    );
    error.statusCode = 400;
    error.code = "HOUSEHOLD_NOT_PRESENT_IN_EVAC_CENTER";
    throw error;
  }

  const assignedReliefPackTemplates =
    await resolveAssignedReliefPackTemplatesForHousehold(
      stub.household_id,
      stub.disaster_event_id,
    );
  const primaryAssignedReliefPackTemplate =
    getPrimaryAssignedReliefPackTemplate(assignedReliefPackTemplates);

  if (!primaryAssignedReliefPackTemplate?.id) {
    const error = new Error(
      "No active standard relief pack is assigned to this family.",
    );
    error.statusCode = 400;
    error.code = "NO_ASSIGNED_RELIEF_PACK";
    throw error;
  }

  const assignedTemplateItems = await Promise.all(
    assignedReliefPackTemplates.map(async (template) => ({
      template,
      templateItems:
        await reliefPackTemplateRepository.getReliefPackTemplateItemsByTemplateId(
          template.id,
        ),
    })),
  );

  if (
    assignedTemplateItems.length === 0 ||
    assignedTemplateItems.every(
      ({ templateItems }) => !Array.isArray(templateItems) || templateItems.length === 0,
    )
  ) {
    const error = new Error(
      "The assigned relief packs do not contain any inventory items.",
    );
    error.statusCode = 400;
    error.code = "EMPTY_RELIEF_PACK_TEMPLATE";
    throw error;
  }

  const allocations = await buildAutomaticClaimAllocations(
    assignedTemplateItems,
    stub.household_size,
    client,
  );
  const receiptNo =
    await distributionTransactionRepository.getDistributionReceiptSequence(client);
  const assignedReliefPackNames = assignedReliefPackTemplates
    .map((template) => template.name)
    .filter(Boolean)
    .join(", ");
  const reliefPackRemarks = [
    remarks,
    `Assigned relief pack(s): ${assignedReliefPackNames || "Relief pack"}`,
  ]
    .filter(Boolean)
    .join(" | ");

  const distributionTransaction =
    await distributionTransactionRepository.insertDistributionTransaction(
      {
        disaster_event_id: stub.disaster_event_id,
        household_id: stub.household_id,
        stub_id: stub.id,
        distribution_status: "CLAIMED",
        claimed_by_name: claimedByName,
        verified_by: verifiedBy || null,
        device_id: null,
        is_offline_encoded: isOfflineEncoded,
        sync_status: syncStatus,
        qr_reference_value: qrReferenceValue || stub.qr_code_value || null,
        qr_scanned_at: qrScannedAt,
        qr_scanned_by: qrScannedBy,
        receipt_no: receiptNo,
        receipt_status: receiptStatus,
        received_at: receivedAt,
        relief_pack_template_id: primaryAssignedReliefPackTemplate.id,
        remarks: reliefPackRemarks,
      },
      client,
    );

  const releasedItems = [];
  const batchAlertPayloads = [];
  const touchedInventoryItemIds = new Set();

  for (const allocation of allocations) {
    const insertedItem =
      await distributionTransactionRepository.insertDistributionTransactionItem(
        {
          distribution_transaction_id: distributionTransaction.id,
          inventory_batch_id: allocation.inventory_batch_id,
          inventory_item_id: allocation.inventory_item_id,
          quantity_released: allocation.quantity_released,
        },
        client,
      );

    await inventoryTransactionRepository.insertInventoryTransaction(
      {
        disaster_event_id: stub.disaster_event_id,
        inventory_batch_id: allocation.inventory_batch_id,
        transaction_type: "OUTFLOW",
        quantity: allocation.quantity_released,
        reference_type: "DISTRIBUTION",
        reference_id: distributionTransaction.id,
        performed_by: verifiedBy || null,
        remarks: reliefPackRemarks,
      },
      client,
    );

    const remainingQuantity =
      allocation.previous_quantity_available - allocation.quantity_released;
    const nextBatchStatus = getNextBatchStatus(
      allocation.expiration_date,
      remainingQuantity,
    );
    const updatedBatch =
      await distributionTransactionRepository.updateInventoryBatchQuantityAndStatus(
        allocation.inventory_batch_id,
        remainingQuantity,
        nextBatchStatus,
        client,
      );

    releasedItems.push({
      id: insertedItem.id,
      inventory_batch_id: insertedItem.inventory_batch_id,
      inventory_item_id: insertedItem.inventory_item_id,
      quantity_released: insertedItem.quantity_released,
      batch_no: allocation.batch_no,
      item_code: allocation.item_code,
      item_name: allocation.item_name,
      unit_of_measure: allocation.unit_of_measure,
    });

    batchAlertPayloads.push({
      batch: {
        id: allocation.inventory_batch_id,
        batch_no: allocation.batch_no,
        quantity_available: updatedBatch.quantity_available,
        status: updatedBatch.status,
        item_name: allocation.item_name,
      },
      previousQuantityAvailable: allocation.previous_quantity_available,
      previousStatus: allocation.previous_status,
    });

    touchedInventoryItemIds.add(allocation.inventory_item_id);
  }

  await syncTouchedInventoryItems([...touchedInventoryItemIds], client);

  const updatedStub = await distributionTransactionRepository.updateStubAsClaimed(
    stub.id,
    client,
    claimedAt,
  );

  return {
    assignedReliefPackTemplate: primaryAssignedReliefPackTemplate,
    assignedReliefPackTemplates,
    packQuantity: getTemplatePackMultiplier(
      primaryAssignedReliefPackTemplate,
      stub.household_size,
    ),
    distributionTransaction,
    releasedItems,
    batchAlertPayloads,
    updatedStub,
  };
};

module.exports = {
  recordAutomaticReliefPackClaim,
};
