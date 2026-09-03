const distributionTransactionRepository = require("../repositories/distributionTransaction.repository");
const inventoryTransactionRepository = require("../repositories/inventoryTransaction.repository");
const inventoryItemRepository = require("../repositories/inventoryItem.repository");
const reliefPackTemplateRepository = require("../repositories/reliefPackTemplate.repository");
const {
  getPrimaryAssignedReliefPackTemplate,
  resolveAssignedReliefPackTemplatesForHousehold,
} = require("./reliefPackAssignment.service");
const {
  getInventoryBatchStatus,
  isInventoryBatchExpired,
  isInventoryBatchNearExpiry,
} = require("../utils/inventoryBatchStatus");
const {
  isReliefPackClaimHouseholdCurrentlyEligible,
} = require("../utils/reliefPackEligibility");

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

const parseDonatedLooseItemPerFamilyAllocation = (remarks) => {
  const matchedRemarks = String(remarks || "")
    .trim()
    .match(/^Per Family Allocation:\s*(\d+)$/i);

  if (!matchedRemarks) {
    return 0;
  }

  return Number(matchedRemarks[1]) || 0;
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

    if (quantityPerPack <= 0) {
      continue;
    }

    existingGroup.items.push({
      donation_item_id: row.donation_item_id,
      inventory_batch_id: row.inventory_batch_id,
      inventory_item_id: row.inventory_item_id,
      quantity_per_pack: quantityPerPack,
      quantity_available: Number(row.quantity_available || 0),
      batch_no: row.batch_no,
      item_code: row.item_code,
      item_name: row.item_name,
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

  if (!item || !["AVAILABLE", "LOW_STOCK"].includes(normalizedStatus)) {
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
      unit_of_measure: item.unit_of_measure,
      previous_quantity_available: item.quantity_available,
      previous_status: item.previous_status,
      expiration_date: item.expiration_date,
      source_type: "DONATED",
      source_relief_type: "DONATED_RELIEF_PACK",
      donated_relief_pack_name: group.pack_name,
      donation_id: group.donation_id,
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
      quantity_released: item.quantity_per_pack,
      unit_of_measure: item.unit_of_measure,
    })),
  }));
};

const calculateDonatedLooseItemQuantityForQueuePosition = ({
  quantityAvailable,
  perFamilyAllocation,
  queuePosition,
}) => {
  const availableQuantity = Number(quantityAvailable || 0);
  const baseAllocation = Number(perFamilyAllocation || 0);
  const normalizedQueuePosition = Number(queuePosition || 0);

  if (
    availableQuantity <= 0 ||
    baseAllocation <= 0 ||
    normalizedQueuePosition <= 0
  ) {
    return 0;
  }

  const reachableHouseholds = Math.floor(availableQuantity / baseAllocation);

  return normalizedQueuePosition <= reachableHouseholds ? baseAllocation : 0;
};

const getDonatedLooseItemReachableHouseholds = ({
  quantityAvailable,
  perFamilyAllocation,
  eligibleHouseholdsCount,
}) => {
  const availableQuantity = Number(quantityAvailable || 0);
  const baseAllocation = Number(perFamilyAllocation || 0);
  const eligibleCount = Number(eligibleHouseholdsCount || 0);

  if (availableQuantity <= 0 || baseAllocation <= 0 || eligibleCount <= 0) {
    return 0;
  }

  return Math.min(eligibleCount, Math.floor(availableQuantity / baseAllocation));
};

const mapDonatedLooseItemPreview = (
  row,
  { queuePosition = 1, eligibleHouseholdsCount = 0 } = {},
) => {
  const perFamilyAllocation = parseDonatedLooseItemPerFamilyAllocation(row.remarks);
  const quantityAvailable = Number(row.quantity_available || 0);
  const quantityReleased = calculateDonatedLooseItemQuantityForQueuePosition({
    quantityAvailable,
    perFamilyAllocation,
    queuePosition,
  });

  return {
    donation_item_id: row.donation_item_id,
    donation_id: row.donation_id,
    donor_name: row.donor_name,
    inventory_batch_id: row.inventory_batch_id,
    inventory_item_id: row.inventory_item_id,
    item_code: row.item_code,
    item_name: row.item_name,
    unit_of_measure: row.unit_of_measure,
    batch_no: row.batch_no,
    quantity_available: quantityAvailable,
    quantity_released: quantityReleased,
    per_family_allocation: perFamilyAllocation,
    eligible_households_count: Number(eligibleHouseholdsCount || 0),
    reachable_households: getDonatedLooseItemReachableHouseholds({
      quantityAvailable,
      perFamilyAllocation,
      eligibleHouseholdsCount,
    }),
  };
};

const getAvailableDonatedLooseItemsForClaimPreview = async (
  disasterEventId,
  queuePosition = 1,
  eligibleHouseholdsCount = 0,
  { excludedInventoryItemIds = [] } = {},
) => {
  if (!disasterEventId) {
    return [];
  }

  const excludedInventoryItemIdSet = new Set(
    (Array.isArray(excludedInventoryItemIds) ? excludedInventoryItemIds : [])
      .map((inventoryItemId) => String(inventoryItemId || "").trim())
      .filter(Boolean),
  );

  const rows =
    await distributionTransactionRepository.getAvailableDonatedLooseItemsByDisasterEventId(
      disasterEventId,
    );

  return rows
    .filter(
      (row) =>
        !excludedInventoryItemIdSet.has(String(row.inventory_item_id || "")),
    )
    .map((row) =>
      mapDonatedLooseItemPreview(row, {
        queuePosition,
        eligibleHouseholdsCount,
      }),
    )
    .filter(
      (item) =>
        item.per_family_allocation > 0 &&
        item.quantity_released > 0,
    );
};

const buildDonatedLooseItemClaimPlan = async (
  disasterEventId,
  queuePosition,
  eligibleHouseholdsCount,
  client,
  { excludedInventoryItemIds = [] } = {},
) => {
  const normalizedQueuePosition = Number(queuePosition || 0);
  const normalizedEligibleHouseholdsCount = Number(eligibleHouseholdsCount || 0);
  const excludedInventoryItemIdSet = new Set(
    (Array.isArray(excludedInventoryItemIds) ? excludedInventoryItemIds : [])
      .map((inventoryItemId) => String(inventoryItemId || "").trim())
      .filter(Boolean),
  );

  const availableRows =
    await distributionTransactionRepository.getAvailableDonatedLooseItemsByDisasterEventId(
      disasterEventId,
      client,
      { forUpdate: true },
    );
  const allocations = [];
  const donatedLooseItems = [];

  for (const row of availableRows) {
    if (
      excludedInventoryItemIdSet.has(String(row.inventory_item_id || ""))
    ) {
      continue;
    }

    const perFamilyAllocation = parseDonatedLooseItemPerFamilyAllocation(row.remarks);
    const availableQuantity = Number(row.quantity_available || 0);
    const quantityReleased = calculateDonatedLooseItemQuantityForQueuePosition({
      quantityAvailable: availableQuantity,
      perFamilyAllocation,
      queuePosition: normalizedQueuePosition,
    });

    if (
      normalizedQueuePosition <= 0 ||
      perFamilyAllocation <= 0 ||
      normalizedEligibleHouseholdsCount <= 0 ||
      quantityReleased <= 0
    ) {
      continue;
    }

    allocations.push({
      inventory_batch_id: row.inventory_batch_id,
      inventory_item_id: row.inventory_item_id,
      quantity_released: quantityReleased,
      batch_no: row.batch_no,
      item_code: row.item_code,
      item_name: row.item_name,
      unit_of_measure: row.unit_of_measure,
      reorder_level: row.reorder_level,
      previous_quantity_available: availableQuantity,
      previous_status: row.status,
      expiration_date: row.expiration_date || null,
      source_type: "DONATED",
      source_relief_type: "DONATED_LOOSE_ITEM",
      donation_id: row.donation_id,
      donor_name: row.donor_name,
      donation_item_id: row.donation_item_id,
      per_family_allocation: perFamilyAllocation,
      eligible_households_count: normalizedEligibleHouseholdsCount,
    });

    donatedLooseItems.push({
      donation_item_id: row.donation_item_id,
      donation_id: row.donation_id,
      donor_name: row.donor_name,
      inventory_batch_id: row.inventory_batch_id,
      inventory_item_id: row.inventory_item_id,
      item_name: row.item_name,
      unit_of_measure: row.unit_of_measure,
      quantity_released: quantityReleased,
      per_family_allocation: perFamilyAllocation,
      eligible_households_count: normalizedEligibleHouseholdsCount,
    });
  }

  return {
    donatedLooseItems,
    allocations,
  };
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
        continue;
      }

      requiredItemsByInventoryItemId.set(templateItem.inventory_item_id, {
        inventory_item_id: templateItem.inventory_item_id,
        item_name: templateItem.item_name,
        requiredQuantity,
        sourceTemplateNames: [template.name],
        sourceReliefTypes: new Set([sourceReliefType]),
      });
    }
  }

  const availableBatchesByInventoryItemId = new Map();
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
        reorder_level: batch.reorder_level,
        previous_quantity_available: Number(batch.quantity_available || 0),
        previous_status: batch.status,
        expiration_date: batch.expiration_date || null,
        source_type: batch.source_type || "LGU",
        donation_id: batch.donation_id || null,
        donor_name: batch.donor_name || null,
        donation_item_id: batch.donation_item_id || null,
        source_relief_type:
          requiredItem.sourceReliefTypes.size === 1
            ? [...requiredItem.sourceReliefTypes][0]
            : "MIXED_RELIEF_PACK",
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
  const uniqueInventoryItemIds = [...new Set(inventoryItemIds || [])].filter(Boolean);

  if (uniqueInventoryItemIds.length === 0) {
    return;
  }

  const inventoryItems =
    await inventoryItemRepository.getInventoryItemsByIdsForUpdate(
      uniqueInventoryItemIds,
      client,
    );
  const recomputedQuantityResult = await client.query(
    `
      SELECT
        inventory_item_id,
        COALESCE(SUM(quantity_available), 0)::integer AS total_quantity
      FROM inventory_batches
      WHERE inventory_item_id = ANY($1::uuid[])
      GROUP BY inventory_item_id
    `,
    [uniqueInventoryItemIds],
  );
  const quantityByInventoryItemId = new Map(
    recomputedQuantityResult.rows.map((row) => [
      row.inventory_item_id,
      Number(row.total_quantity || 0),
    ]),
  );

  for (const inventoryItem of inventoryItems) {
    if (!inventoryItem) {
      continue;
    }

    const nextItemQuantity =
      quantityByInventoryItemId.get(inventoryItem.id) || 0;

    await inventoryItemRepository.updateInventoryItemStockSnapshot(
      inventoryItem.id,
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
    stub.disaster_event_id,
    client,
  );
  const donatedQueueContext =
    await distributionTransactionRepository.getPresentUnclaimedStubQueueContext(
      stub.id,
      client,
    );
  const donatedQueuePosition = donatedQueueContext.queue_position;
  const donatedClaimPlan = await buildDonatedReliefPackClaimPlan(
    stub.disaster_event_id,
    client,
    donatedQueuePosition,
  );
  const assignedTemplateComponentItemIds = [
    ...new Set(
      assignedTemplateItems.flatMap(({ templateItems }) =>
        (templateItems || [])
          .map((templateItem) => templateItem?.inventory_item_id)
          .filter(Boolean),
      ),
    ),
  ];
  const donatedLooseItemClaimPlan = await buildDonatedLooseItemClaimPlan(
    stub.disaster_event_id,
    donatedQueuePosition,
    donatedQueueContext.eligible_households_count,
    client,
    { excludedInventoryItemIds: assignedTemplateComponentItemIds },
  );
  const combinedAllocations = [
    ...allocations,
    ...donatedClaimPlan.allocations,
    ...donatedLooseItemClaimPlan.allocations,
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
  const donatedLooseItemNames = donatedLooseItemClaimPlan.donatedLooseItems
    .map((item) => `${item.item_name} x${item.quantity_released}`)
    .filter(Boolean)
    .join(", ");
  const reliefPackRemarks = [
    remarks,
    `Assigned relief pack(s): ${assignedReliefPackNames || "Relief pack"}`,
    donatedReliefPackNames
      ? `Donated relief pack(s): ${donatedReliefPackNames}`
      : null,
    donatedLooseItemNames
      ? `Donated loose item(s): ${donatedLooseItemNames}`
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
    const nextItemQuantity = Math.max(
      0,
      (currentItemStockById.get(allocation.inventory_item_id) || 0) -
        (releasedQuantityByItemId.get(allocation.inventory_item_id) || 0),
    );
    const nextBatchStatus = getInventoryBatchStatus({
      quantityAvailable: remainingQuantity,
      expirationDate: allocation.expiration_date,
      reorderLevel: allocation.reorder_level,
      totalQuantityAvailable: nextItemQuantity,
    });
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
      previousQuantityAvailable: allocation.previous_quantity_available,
      previousStatus: allocation.previous_status,
    });

    touchedInventoryItemIds.add(allocation.inventory_item_id);
  }

  await syncTouchedInventoryItems([...touchedInventoryItemIds], client);

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

  return {
    assignedReliefPackTemplate: primaryAssignedReliefPackTemplate,
    assignedReliefPackTemplates,
    donatedReliefPacks: donatedClaimPlan.donatedReliefPacks,
    donatedLooseItems: donatedLooseItemClaimPlan.donatedLooseItems,
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
  getAvailableDonatedLooseItemsForClaimPreview,
  getAvailableDonatedReliefPacksForClaimPreview,
  recordAutomaticReliefPackClaim,
};
