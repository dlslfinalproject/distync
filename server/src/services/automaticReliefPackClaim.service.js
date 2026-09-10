const distributionTransactionRepository = require("../repositories/distributionTransaction.repository");
const inventoryTransactionRepository = require("../repositories/inventoryTransaction.repository");
const inventoryItemRepository = require("../repositories/inventoryItem.repository");
const reliefPackTemplateRepository = require("../repositories/reliefPackTemplate.repository");
const inventoryBatchStatusService = require("./inventoryBatchStatus.service");
const donatedReliefPackAssignmentService = require("./donatedReliefPackAssignment.service");
const {
  getPrimaryAssignedReliefPackTemplate,
  resolveAssignedReliefPackTemplatesForHousehold,
} = require("./reliefPackAssignment.service");
const {
  getInventoryBatchStatus,
  isInventoryBatchExpired,
  isInventoryBatchNearExpiry,
  isInventoryBatchDerivedStatus,
} = require("../utils/inventoryBatchStatus");
const {
  isReliefPackClaimHouseholdCurrentlyEligible,
} = require("../utils/reliefPackEligibility");
const {
  getDistributionItemSourceReliefTypeSnapshot,
} = require("../utils/distributionTransactionItemSnapshot");

const lockInventoryItemsForUpdate = async (inventoryItemIds, client) => {
  const uniqueInventoryItemIds = [
    ...new Set((inventoryItemIds || []).filter(Boolean).map(String)),
  ].sort();

  if (
    uniqueInventoryItemIds.length > 0 &&
    typeof inventoryItemRepository.getInventoryItemsByIdsForUpdate === "function"
  ) {
    await inventoryItemRepository.getInventoryItemsByIdsForUpdate(
      uniqueInventoryItemIds,
      client,
    );
  }
};

const getTemplateFamilySizeCoverage = (template) => {
  const parsedCoverage = Number.parseInt(String(template?.description || "").trim(), 10);
  return Number.isInteger(parsedCoverage) && parsedCoverage > 0 ? parsedCoverage : 0;
};

const getTemplatePackMultiplier = (template, householdSize) => {
  if (
    template?.assignment_snapshot &&
    Number.isInteger(Number(template?.pack_multiplier)) &&
    Number(template.pack_multiplier) > 0
  ) {
    return Number(template.pack_multiplier);
  }

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

const parseDonatedReliefPackRemarks = (remarks) => {
  const normalizedRemarks = String(remarks || "").trim();

  if (!normalizedRemarks.toLowerCase().startsWith("relief pack:")) {
    return null;
  }

  const remarkBody = normalizedRemarks.slice("Relief Pack:".length).trim();
  const quantityMatch = remarkBody.match(/^(.*?)(?:\s+x\s+(\d+))$/i);
  const packName = (quantityMatch ? quantityMatch[1] : remarkBody).trim();
  const packQuantity = quantityMatch ? Number(quantityMatch[2]) : 0;

  if (!packName || !Number.isInteger(packQuantity) || packQuantity <= 0) {
    return null;
  }

  return {
    packName,
    packQuantity,
  };
};

const buildDonatedReliefPackGroups = (donatedRows) => {
  const groupsByKey = new Map();

  for (const row of donatedRows || []) {
    const packMeta = parseDonatedReliefPackRemarks(row.remarks);

    if (!packMeta) {
      continue;
    }

    const groupKey = [
      row.donation_id,
      packMeta.packName.toLowerCase(),
      packMeta.packQuantity,
    ].join(":");
    const existingGroup = groupsByKey.get(groupKey) || {
      donation_id: row.donation_id,
      donor_name: row.donor_name,
      pack_name: packMeta.packName,
      donated_pack_quantity: packMeta.packQuantity,
      donation_received_at: row.donation_received_at,
      donation_created_at: row.donation_created_at,
      items: [],
    };
    const quantityPerPack = Math.floor(
      Number(row.quantity_received || 0) / packMeta.packQuantity,
    );

    existingGroup.items.push({
      donation_item_id: row.donation_item_id,
      inventory_batch_id: row.inventory_batch_id,
      inventory_item_id: row.inventory_item_id,
      quantity_per_pack: quantityPerPack,
      quantity_available: Number(row.quantity_available || 0),
      batch_no: row.batch_no,
      item_code: row.item_code,
      item_name: row.item_name,
      category: row.category,
      unit_of_measure: row.unit_of_measure,
      expiration_date: row.expiration_date || null,
      previous_status: row.status,
    });

    groupsByKey.set(groupKey, existingGroup);
  }

  return [...groupsByKey.values()].sort((left, right) => {
    const leftTime = new Date(
      left.donation_received_at || left.donation_created_at || 0,
    ).getTime();
    const rightTime = new Date(
      right.donation_received_at || right.donation_created_at || 0,
    ).getTime();

    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    return String(left.pack_name || "").localeCompare(
      String(right.pack_name || ""),
    );
  });
};

const getDonatedReliefPackGroupAvailablePackCount = (group) => {
  if (!group?.items?.length) {
    return 0;
  }

  if (!group.items.every(isDonatedReliefPackItemCurrentlyAvailable)) {
    return 0;
  }

  return Math.min(
    ...group.items.map((item) =>
      Math.floor(Number(item.quantity_available || 0) / item.quantity_per_pack),
    ),
  );
};

const isDonatedReliefPackItemCurrentlyAvailable = (item) => {
  const normalizedStatus = String(item?.previous_status || "")
    .trim()
    .toUpperCase();

  if (
    !item ||
    !["AVAILABLE", "LOW_STOCK"].includes(normalizedStatus) ||
    Number(item.quantity_per_pack || 0) <= 0
  ) {
    return false;
  }

  if (
    isInventoryBatchExpired(item.expiration_date) ||
    isInventoryBatchNearExpiry(item.expiration_date, 30)
  ) {
    return false;
  }

  return Number(item.quantity_available || 0) >= item.quantity_per_pack;
};

const selectDonatedReliefPackGroupsForQueuePosition = (
  donatedGroups,
  queuePosition,
) => {
  const normalizedQueuePosition = Number(queuePosition || 0);

  if (normalizedQueuePosition <= 0) {
    return [];
  }

  const groupsByPackName = new Map();

  for (const group of donatedGroups) {
    const normalizedPackName = String(group.pack_name || "").trim().toLowerCase();

    if (!normalizedPackName) {
      continue;
    }

    if (!groupsByPackName.has(normalizedPackName)) {
      groupsByPackName.set(normalizedPackName, []);
    }

    groupsByPackName.get(normalizedPackName).push(group);
  }

  const selectedGroups = [];

  for (const groups of groupsByPackName.values()) {
    let remainingQueuePosition = normalizedQueuePosition;

    for (const group of groups) {
      const availablePackCount = getDonatedReliefPackGroupAvailablePackCount(group);

      if (availablePackCount <= 0) {
        continue;
      }

      if (remainingQueuePosition <= availablePackCount) {
        selectedGroups.push(group);
        break;
      }

      remainingQueuePosition -= availablePackCount;
    }
  }

  return selectedGroups;
};

const buildDonatedReliefPackClaimPlan = async (
  disasterEventId,
  client,
  queuePosition,
) => {
  const candidateRows =
    await distributionTransactionRepository.getDonatedReliefPackItemsByDisasterEventId(
      disasterEventId,
      client,
    );
  await lockInventoryItemsForUpdate(
    candidateRows.map((row) => row.inventory_item_id),
    client,
  );
  const donatedRows =
    await distributionTransactionRepository.getDonatedReliefPackItemsByDisasterEventId(
      disasterEventId,
      client,
      { forUpdate: true },
    );
  const donatedGroups = buildDonatedReliefPackGroups(donatedRows);
  const selectedGroups = selectDonatedReliefPackGroupsForQueuePosition(
    donatedGroups,
    queuePosition,
  );
  const allocations = selectedGroups.flatMap((group) =>
    group.items.map((item) => ({
      inventory_batch_id: item.inventory_batch_id,
      inventory_item_id: item.inventory_item_id,
      quantity_released: item.quantity_per_pack,
      batch_no: item.batch_no,
      item_code: item.item_code,
      item_name: item.item_name,
      category: item.category,
      unit_of_measure: item.unit_of_measure,
      previous_quantity_available: item.quantity_available,
      previous_status: item.previous_status,
      expiration_date: item.expiration_date,
      source_type: "DONATED",
      source_relief_type: "DONATED_RELIEF_PACK",
      relief_pack_type_snapshot: "DONATED_RELIEF_PACK",
      donated_relief_pack_name: group.pack_name,
      donation_id: group.donation_id,
      donation_item_id: item.donation_item_id,
      donor_name: group.donor_name,
    })),
  );

  return {
    donatedReliefPacks: selectedGroups.map((group) => ({
      donation_id: group.donation_id,
      donor_name: group.donor_name,
      name: group.pack_name,
      pack_quantity: 1,
    })),
    allocations,
  };
};

const getAvailableDonatedReliefPacksForClaimPreview = async (
  disasterEventId,
  queuePosition = 1,
) => {
  if (!disasterEventId) {
    return [];
  }

  const donatedRows =
    await distributionTransactionRepository.getDonatedReliefPackItemsByDisasterEventId(
      disasterEventId,
    );
  const donatedGroups = buildDonatedReliefPackGroups(donatedRows);
  const selectedGroups = selectDonatedReliefPackGroupsForQueuePosition(
    donatedGroups,
    queuePosition,
  );

  return selectedGroups.map((group) => ({
    donation_id: group.donation_id,
    donor_name: group.donor_name,
    name: group.pack_name,
    pack_quantity: 1,
    items: group.items.map((item) => ({
      inventory_item_id: item.inventory_item_id,
      item_name: item.item_name,
      category: item.category,
      quantity_released: item.quantity_per_pack,
      unit_of_measure: item.unit_of_measure,
    })),
  }));
};

const buildAutomaticClaimAllocations = async (
  assignedTemplateItems,
  householdSize,
  disasterEventId,
  client,
) => {
  const allocations = [];
  const requiredItemsByInventoryItemId = new Map();

  for (const { template, templateItems } of assignedTemplateItems) {
    const packMultiplier = getTemplatePackMultiplier(template, householdSize);
    const sourceReliefType = template.is_additional_pack
      ? "ADDITIONAL_RELIEF_PACK"
      : "STANDARD_RELIEF_PACK";

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
        existingItem.sourceReliefTypes.add(sourceReliefType);
        existingItem.sourceReliefTypeQuantities.set(
          sourceReliefType,
          (existingItem.sourceReliefTypeQuantities.get(sourceReliefType) || 0) +
            requiredQuantity,
        );
        const existingTemplateQuantity =
          existingItem.sourceTemplateQuantities.get(template.id);
        existingItem.sourceTemplateQuantities.set(template.id, {
          sourceReliefType,
          quantity:
            Number(existingTemplateQuantity?.quantity || 0) +
            requiredQuantity,
        });
        continue;
      }

      requiredItemsByInventoryItemId.set(templateItem.inventory_item_id, {
        inventory_item_id: templateItem.inventory_item_id,
        item_code: templateItem.item_code || null,
        item_name: templateItem.item_name,
        category: templateItem.category || null,
        unit_of_measure: templateItem.unit_of_measure || null,
        requiredQuantity,
        sourceTemplateNames: [template.name],
        sourceReliefTypes: new Set([sourceReliefType]),
        sourceReliefTypeQuantities: new Map([[sourceReliefType, requiredQuantity]]),
        sourceTemplateQuantities: new Map([
          [
            template.id,
            {
              sourceReliefType,
              quantity: requiredQuantity,
            },
          ],
        ]),
      });
    }
  }

  const availableBatchesByInventoryItemId = new Map();
  await lockInventoryItemsForUpdate(
    [...requiredItemsByInventoryItemId.keys()],
    client,
  );
  const availableBatches =
    await inventoryTransactionRepository.getDistributableInventoryBatchesByItemIdsForUpdate(
      [...requiredItemsByInventoryItemId.keys()],
      disasterEventId,
      client,
    );

  for (const batch of availableBatches) {
    const inventoryItemId = batch.inventory_item_id;

    if (!availableBatchesByInventoryItemId.has(inventoryItemId)) {
      availableBatchesByInventoryItemId.set(inventoryItemId, []);
    }

    availableBatchesByInventoryItemId.get(inventoryItemId).push(batch);
  }

  for (const requiredItem of requiredItemsByInventoryItemId.values()) {
    const requiredQuantity =
      Number(requiredItem.requiredQuantity || 0);

    if (requiredQuantity <= 0) {
      continue;
    }

    const availableBatches =
      availableBatchesByInventoryItemId.get(requiredItem.inventory_item_id) || [];

    const eligibleBatches = availableBatches.filter((batch) => {
      if (Number(batch.quantity_available || 0) <= 0) {
        return false;
      }

      return getInventoryBatchStatus({
        quantityAvailable: Number(batch.quantity_available || 0),
        expirationDate: batch.expiration_date,
        reorderLevel: batch.reorder_level,
      }) !== "EXPIRED";
    });

    const remainingQuantityByTemplate = new Map(
      [...requiredItem.sourceTemplateQuantities.entries()].map(
        ([templateId, templateQuantity]) => [templateId, { ...templateQuantity }],
      ),
    );
    const allocatedQuantityByBatch = new Map();

    for (const batch of eligibleBatches) {
      const alreadyAllocatedFromBatch = Number(
        allocatedQuantityByBatch.get(batch.id) || 0,
      );
      let remainingBatchQuantity = Math.max(
        0,
        Number(batch.quantity_available || 0) - alreadyAllocatedFromBatch,
      );

      if (remainingBatchQuantity <= 0) {
        continue;
      }

      while (remainingBatchQuantity > 0) {
        const nextTemplate = [...remainingQuantityByTemplate.entries()].find(
          ([, templateQuantity]) =>
            Number(templateQuantity?.quantity || 0) > 0,
        );

        if (!nextTemplate) {
          break;
        }

        const [reliefPackTemplateId, templateQuantity] = nextTemplate;
        const sourceReliefType = templateQuantity.sourceReliefType;
        const typeRemainingQuantity = Number(templateQuantity.quantity || 0);
        const quantityToRelease = Math.min(
          remainingBatchQuantity,
          typeRemainingQuantity,
        );

        if (quantityToRelease <= 0) {
          break;
        }

        const previouslyAllocatedFromBatch = Number(
          allocatedQuantityByBatch.get(batch.id) || 0,
        );

        allocations.push({
          inventory_batch_id: batch.id,
          inventory_item_id: batch.inventory_item_id,
          quantity_released: quantityToRelease,
          batch_no: batch.batch_no,
          item_code: requiredItem.item_code || batch.item_code,
          item_name: requiredItem.item_name || batch.item_name,
          category: requiredItem.category || batch.category || null,
          unit_of_measure:
            requiredItem.unit_of_measure || batch.unit_of_measure,
          reorder_level: batch.reorder_level,
          previous_quantity_available:
            Number(batch.quantity_available || 0) - previouslyAllocatedFromBatch,
          previous_status: batch.status,
          expiration_date: batch.expiration_date || null,
          source_type: batch.source_type || "LGU",
          donation_id: batch.donation_id || null,
          donor_name: batch.donor_name || null,
          donation_item_id: batch.donation_item_id || null,
          source_relief_type: sourceReliefType,
          relief_pack_type_snapshot: sourceReliefType,
          relief_pack_template_id_snapshot: reliefPackTemplateId,
        });

        allocatedQuantityByBatch.set(
          batch.id,
          previouslyAllocatedFromBatch + quantityToRelease,
        );
        remainingQuantityByTemplate.set(reliefPackTemplateId, {
          ...templateQuantity,
          quantity: typeRemainingQuantity - quantityToRelease,
        });
        remainingBatchQuantity -= quantityToRelease;
      }

      if (
        [...remainingQuantityByTemplate.values()].reduce(
          (total, templateQuantity) =>
            total + Number(templateQuantity?.quantity || 0),
          0,
        ) <= 0
      ) {
        break;
      }
    }

    const remainingQuantity = [...remainingQuantityByTemplate.values()].reduce(
      (total, templateQuantity) =>
        total + Number(templateQuantity?.quantity || 0),
      0,
    );

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
  if (
    !isReliefPackClaimHouseholdCurrentlyEligible(stub, latestAttendance)
  ) {
    const error = new Error(
      "Relief packs can only be claimed by households currently present in an evacuation center.",
    );
    error.statusCode = 400;
    error.code = "HOUSEHOLD_NOT_PRESENT_IN_EVAC_CENTER";
    throw error;
  }

  // A claim is the point at which the current assignment becomes historical.
  // Resolve it immediately from the active templates so a snapshot created
  // when the stub was issued cannot make a later valid pack change stale.
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
      templateItems: Array.isArray(template?.items)
        ? template.items
        : await reliefPackTemplateRepository.getReliefPackTemplateItemsByTemplateId(
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

  await donatedReliefPackAssignmentService.ensureDonatedReliefPackAssignmentsForEvent(
    stub.disaster_event_id,
    client,
  );

  const allocations = await buildAutomaticClaimAllocations(
    assignedTemplateItems,
    stub.household_size,
    stub.disaster_event_id,
    client,
  );
  const persistedDonatedClaimPlan =
    await donatedReliefPackAssignmentService.getDonatedReliefPackClaimPlanForStub({
      stubId: stub.id,
      disasterEventId: stub.disaster_event_id,
      client,
    });
  let donatedClaimPlan = persistedDonatedClaimPlan;

  // Keep the pre-assignment path as a compatibility fallback for rows created
  // before the assignment migration is applied or when no donated stock is
  // available yet. New rows are assigned by the event-wide reservation flow.
  if (!persistedDonatedClaimPlan.hasPersistedAssignment) {
    const donatedQueueContext =
      await distributionTransactionRepository.getPresentUnclaimedStubQueueContext(
        stub.id,
        client,
      );
    const donatedQueuePosition = donatedQueueContext.queue_position;
    donatedClaimPlan = await buildDonatedReliefPackClaimPlan(
      stub.disaster_event_id,
      client,
      donatedQueuePosition,
    );
  }
  const combinedAllocations = [
    ...allocations,
    ...donatedClaimPlan.allocations,
  ];
  const receiptNo =
    await distributionTransactionRepository.getDistributionReceiptSequence(client);
  const assignedReliefPackNames = assignedReliefPackTemplates
    .map((template) => template.name)
    .filter(Boolean)
    .join(", ");
  const donatedReliefPackNames = donatedClaimPlan.donatedReliefPacks
    .map((pack) => pack.name)
    .filter(Boolean)
    .join(", ");
  const reliefPackRemarks = [
    remarks,
    `Assigned relief pack(s): ${assignedReliefPackNames || "Relief pack"}`,
    donatedReliefPackNames
      ? `Donated relief pack(s): ${donatedReliefPackNames}`
      : null,
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

  await distributionTransactionRepository.insertDistributionTransactionReliefPackTemplates(
    distributionTransaction.id,
    assignedReliefPackTemplates,
    client,
  );

  const releasedItems = [];
  const batchAlertPayloads = [];
  const touchedInventoryItemIds = new Set();
  const releasedQuantityByItemId = combinedAllocations.reduce(
    (totals, allocation) => {
      const itemId = allocation.inventory_item_id;
      totals.set(
        itemId,
        (totals.get(itemId) || 0) + Number(allocation.quantity_released || 0),
      );
      return totals;
    },
    new Map(),
  );
  const currentItemStockResult =
    releasedQuantityByItemId.size > 0
      ? await client.query(
          `
            SELECT
              inventory_item_id,
              COALESCE(SUM(quantity_available), 0)::integer AS total_quantity
            FROM inventory_batches
            WHERE inventory_item_id = ANY($1::uuid[])
            GROUP BY inventory_item_id
          `,
          [[...releasedQuantityByItemId.keys()]],
        )
      : { rows: [] };
  const currentItemStockById = new Map(
    currentItemStockResult.rows.map((row) => [
      row.inventory_item_id,
      Number(row.total_quantity || 0),
    ]),
  );
  const remainingQuantityByBatch = new Map();

  for (const allocation of combinedAllocations) {
    const insertedItem =
      await distributionTransactionRepository.insertDistributionTransactionItem(
        {
          distribution_transaction_id: distributionTransaction.id,
          inventory_batch_id: allocation.inventory_batch_id,
          inventory_item_id: allocation.inventory_item_id,
          quantity_released: allocation.quantity_released,
          item_code_snapshot: allocation.item_code,
          item_name_snapshot: allocation.item_name,
          unit_of_measure_snapshot: allocation.unit_of_measure,
          category_snapshot: allocation.category,
          relief_pack_type_snapshot: allocation.relief_pack_type_snapshot,
          relief_pack_template_id_snapshot:
            allocation.relief_pack_template_id_snapshot,
          source_type_snapshot: allocation.source_type || "LGU",
          source_relief_type_snapshot:
            getDistributionItemSourceReliefTypeSnapshot(allocation),
          donation_id_snapshot: allocation.donation_id,
          donation_item_id_snapshot: allocation.donation_item_id,
          donor_name_snapshot: allocation.donor_name,
          donated_relief_pack_name_snapshot:
            allocation.donated_relief_pack_name,
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

    const previousQuantityAvailable = remainingQuantityByBatch.has(
      allocation.inventory_batch_id,
    )
      ? remainingQuantityByBatch.get(allocation.inventory_batch_id)
      : Number(allocation.previous_quantity_available || 0);
    const remainingQuantity =
      previousQuantityAvailable - Number(allocation.quantity_released || 0);
    remainingQuantityByBatch.set(
      allocation.inventory_batch_id,
      remainingQuantity,
    );
    const nextItemQuantity = Math.max(
      0,
      (currentItemStockById.get(allocation.inventory_item_id) || 0) -
        (releasedQuantityByItemId.get(allocation.inventory_item_id) || 0),
    );
    const nextBatchStatus = isInventoryBatchDerivedStatus(
      allocation.previous_status,
    )
      ? getInventoryBatchStatus({
          quantityAvailable: remainingQuantity,
          expirationDate: allocation.expiration_date,
          reorderLevel: allocation.reorder_level,
          totalQuantityAvailable: nextItemQuantity,
        })
      : allocation.previous_status;
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
      category: allocation.category || null,
      unit_of_measure: allocation.unit_of_measure,
      relief_pack_type_snapshot: allocation.relief_pack_type_snapshot,
      relief_pack_template_id_snapshot:
        allocation.relief_pack_template_id_snapshot || null,
      source_type: allocation.source_type || "LGU",
      source_relief_type: allocation.source_relief_type,
      donated_relief_pack_name: allocation.donated_relief_pack_name || null,
      donor_name: allocation.donor_name || null,
      donation_item_id: allocation.donation_item_id || null,
    });

    batchAlertPayloads.push({
      batch: {
        id: allocation.inventory_batch_id,
        batch_no: allocation.batch_no,
        quantity_available: updatedBatch.quantity_available,
        status: updatedBatch.status,
        reorder_level: allocation.reorder_level,
        item_total_stock: nextItemQuantity,
        item_name: allocation.item_name,
      },
      previousQuantityAvailable,
      previousStatus: allocation.previous_status,
    });

    touchedInventoryItemIds.add(allocation.inventory_item_id);
  }

  await inventoryBatchStatusService.refreshDerivedInventoryBatchStatusesForItems(
    [...touchedInventoryItemIds],
    { dbClient: client },
  );

  const touchedDonationIds = [
    ...new Set(
      combinedAllocations
        .map((allocation) => allocation.donation_id)
        .filter(Boolean),
    ),
  ];
  await distributionTransactionRepository.updateDonationStatusesByIds(
    touchedDonationIds,
    client,
  );

  const updatedStub = await distributionTransactionRepository.updateStubAsClaimed(
    stub.id,
    client,
    claimedAt,
  );

  if (persistedDonatedClaimPlan.hasPersistedAssignment) {
    await donatedReliefPackAssignmentService.markDonatedReliefPackAssignmentsClaimed(
      stub.id,
      client,
    );
  }

  return {
    assignedReliefPackTemplate: primaryAssignedReliefPackTemplate,
    assignedReliefPackTemplates,
    donatedReliefPacks: donatedClaimPlan.donatedReliefPacks,
    donatedLooseItems: [],
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
  getAvailableDonatedReliefPacksForClaimPreview,
  recordAutomaticReliefPackClaim,
};
