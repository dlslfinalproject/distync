const pool = require("../config/db");
const distributionTransactionRepository = require("../repositories/distributionTransaction.repository");
const assignmentRepository = require("../repositories/stubDonatedReliefPackAssignment.repository");
const {
  isInventoryBatchExpired,
  isInventoryBatchNearExpiry,
} = require("../utils/inventoryBatchStatus");

const parseDonatedReliefPackRemarks = (remarks) => {
  const normalizedRemarks = String(remarks || "").trim();

  if (!normalizedRemarks.toLowerCase().startsWith("relief pack:")) {
    return null;
  }

  const remarkBody = normalizedRemarks.slice("Relief Pack:".length).trim();
  const quantityMatch = remarkBody.match(/^(.*?)(?:\s+x\s+(\d+))$/i);
  const packName = (quantityMatch ? quantityMatch[1] : remarkBody).trim();
  const packSize = quantityMatch ? Number(quantityMatch[2]) : 0;

  if (!packName || !Number.isInteger(packSize) || packSize <= 0) {
    return null;
  }

  return { packName, packSize };
};

const buildDonatedReliefPackGroups = (donatedRows = []) => {
  const groupsByKey = new Map();

  for (const row of donatedRows) {
    const packMeta = parseDonatedReliefPackRemarks(row.remarks);

    if (!packMeta) {
      continue;
    }

    const groupKey = [
      row.donation_id,
      packMeta.packName.toLowerCase(),
      packMeta.packSize,
    ].join(":");
    const existingGroup = groupsByKey.get(groupKey) || {
      donation_id: row.donation_id,
      donor_name: row.donor_name,
      pack_name: packMeta.packName,
      pack_size: packMeta.packSize,
      donation_received_at: row.donation_received_at,
      donation_created_at: row.donation_created_at,
      items: [],
    };
    const quantityPerPack = Math.floor(
      Number(row.quantity_received || 0) / packMeta.packSize,
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
      reorder_level: row.reorder_level,
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

    return (
      String(left.pack_name || "").localeCompare(String(right.pack_name || "")) ||
      String(left.donation_id || "").localeCompare(String(right.donation_id || ""))
    );
  });
};

const getAssignmentItems = (assignment) => {
  if (Array.isArray(assignment?.items_snapshot)) {
    return assignment.items_snapshot;
  }

  if (typeof assignment?.items_snapshot === "string") {
    try {
      const parsed = JSON.parse(assignment.items_snapshot);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  }

  return [];
};

const isCurrentlyAvailable = (item) => {
  const status = String(item?.previous_status || "")
    .trim()
    .toUpperCase();

  return Boolean(
    ["AVAILABLE", "LOW_STOCK"].includes(status) &&
      Number(item?.quantity_available || 0) > 0 &&
      !isInventoryBatchExpired(item?.expiration_date) &&
      !isInventoryBatchNearExpiry(item?.expiration_date, 30),
  );
};

const getReservedQuantityByBatch = (assignments = []) => {
  const reservedQuantityByBatch = new Map();

  for (const assignment of assignments) {
    for (const item of getAssignmentItems(assignment)) {
      const batchId = item?.inventory_batch_id;
      const quantity = Number(item?.quantity_reserved || item?.quantity_per_pack || 0);

      if (!batchId || quantity <= 0) {
        continue;
      }

      reservedQuantityByBatch.set(
        batchId,
        Number(reservedQuantityByBatch.get(batchId) || 0) + quantity,
      );
    }
  }

  return reservedQuantityByBatch;
};

const getAvailablePackCount = (group, reservedQuantityByBatch) => {
  if (!group?.items?.length || !group.items.every(isCurrentlyAvailable)) {
    return 0;
  }

  const itemPackCounts = group.items.map((item) => {
    const quantityPerPack = Number(item.quantity_per_pack || 0);
    const reservedQuantity = Number(
      reservedQuantityByBatch.get(item.inventory_batch_id) || 0,
    );
    const unreservedQuantity = Math.max(
      0,
      Number(item.quantity_available || 0) - reservedQuantity,
    );

    if (quantityPerPack <= 0) {
      return 0;
    }

    return Math.floor(unreservedQuantity / quantityPerPack);
  });

  return itemPackCounts.length > 0 ? Math.min(...itemPackCounts) : 0;
};

const getGroupKey = (group) =>
  [
    group?.donation_id,
    String(group?.pack_name || "").trim().toLowerCase(),
    group?.pack_size,
  ].join(":");

const getGroupKeyFromAssignment = (assignment) =>
  [
    assignment?.donation_id,
    String(assignment?.pack_name || "").trim().toLowerCase(),
    assignment?.pack_size,
  ].join(":");

const buildAssignmentItemsSnapshot = (group) =>
  group.items.map((item) => ({
    inventory_batch_id: item.inventory_batch_id,
    inventory_item_id: item.inventory_item_id,
    donation_item_id: item.donation_item_id,
    quantity_reserved: item.quantity_per_pack,
    quantity_per_pack: item.quantity_per_pack,
    batch_no: item.batch_no,
    item_code: item.item_code,
    item_name: item.item_name,
    category: item.category,
    unit_of_measure: item.unit_of_measure,
    reorder_level: item.reorder_level,
    expiration_date: item.expiration_date,
    previous_status: item.previous_status,
  }));

const getCandidateDonatedRows = async (disasterEventId, client, forUpdate = false) => {
  if (
    typeof distributionTransactionRepository
      .getDonatedReliefPackItemsByDisasterEventId !== "function"
  ) {
    return [];
  }

  return distributionTransactionRepository.getDonatedReliefPackItemsByDisasterEventId(
    disasterEventId,
    client,
    { forUpdate },
  );
};

const ensureDonatedReliefPackAssignmentsForEvent = async (
  disasterEventId,
  dbClient = null,
) => {
  if (!disasterEventId) {
    return [];
  }

  const client = dbClient || (await pool.connect());
  const ownsTransaction = !dbClient;
  const createdAssignments = [];

  try {
    if (ownsTransaction) {
      await client.query("BEGIN");
    }

    const lockedEvent =
      await assignmentRepository.lockDisasterEventForDonationAssignments(
        disasterEventId,
        client,
      );

    if (
      !lockedEvent ||
      String(lockedEvent.status || "").toUpperCase() !== "ACTIVE"
    ) {
      if (ownsTransaction) {
        await client.query("COMMIT");
      }
      return [];
    }

    const eligibleStubs =
      await assignmentRepository.getEligibleUnclaimedStubsForDonationAssignments(
        disasterEventId,
        client,
      );
    const candidateRows = await getCandidateDonatedRows(
      disasterEventId,
      client,
      true,
    );

    if (eligibleStubs.length === 0 || candidateRows.length === 0) {
      if (ownsTransaction) {
        await client.query("COMMIT");
      }
      return [];
    }

    const activeAssignments =
      await assignmentRepository.getActiveAssignmentsByEvent(
        disasterEventId,
        client,
      );
    const reservedQuantityByBatch = getReservedQuantityByBatch(activeAssignments);
    const groups = buildDonatedReliefPackGroups(candidateRows);
    const groupStates = groups.map((group) => ({
      group,
      remainingPackCount: getAvailablePackCount(group, reservedQuantityByBatch),
    }));
    const groupsByPackName = new Map();

    for (const groupState of groupStates) {
      const packNameKey = String(groupState.group.pack_name || "")
        .trim()
        .toLowerCase();

      if (!groupsByPackName.has(packNameKey)) {
        groupsByPackName.set(packNameKey, []);
      }

      groupsByPackName.get(packNameKey).push(groupState);
    }

    const assignmentKeysByStub = new Map();
    for (const assignment of activeAssignments) {
      if (!assignmentKeysByStub.has(assignment.stub_id)) {
        assignmentKeysByStub.set(assignment.stub_id, new Set());
      }
      assignmentKeysByStub
        .get(assignment.stub_id)
        .add(getGroupKeyFromAssignment(assignment));
    }

    for (const stub of eligibleStubs) {
      const assignmentKeys =
        assignmentKeysByStub.get(stub.id) || new Set();

      for (const groupStatesForPackName of groupsByPackName.values()) {
        const groupState = groupStatesForPackName.find(
          (candidate) =>
            candidate.remainingPackCount > 0 &&
            !assignmentKeys.has(getGroupKey(candidate.group)),
        );

        if (!groupState) {
          continue;
        }

        const assignment = await assignmentRepository.insertAssignment(
          {
            stub_id: stub.id,
            disaster_event_id: disasterEventId,
            donation_id: groupState.group.donation_id,
            pack_name: groupState.group.pack_name,
            pack_size: groupState.group.pack_size,
            items_snapshot: buildAssignmentItemsSnapshot(groupState.group),
          },
          client,
        );

        if (assignment) {
          createdAssignments.push(assignment);
          assignmentKeys.add(getGroupKey(groupState.group));
          groupState.remainingPackCount -= 1;
        }
      }
    }

    if (ownsTransaction) {
      await client.query("COMMIT");
    }

    return createdAssignments;
  } catch (error) {
    if (ownsTransaction) {
      await client.query("ROLLBACK");
    }
    throw error;
  } finally {
    if (ownsTransaction) {
      client.release();
    }
  }
};

const mapAssignmentForDisplay = (assignment) => ({
  id: assignment.id,
  donation_id: assignment.donation_id,
  donor_name: assignment.donor_name || null,
  name: assignment.pack_name,
  pack_quantity: 1,
  assignment_status: assignment.assignment_status,
  assigned_at: assignment.assigned_at || null,
  items: getAssignmentItems(assignment).map((item) => ({
    inventory_item_id: item.inventory_item_id,
    item_name: item.item_name,
    category: item.category,
    quantity_released: Number(
      item.quantity_reserved || item.quantity_per_pack || 0,
    ),
    unit_of_measure: item.unit_of_measure,
  })),
});

const getAssignedDonatedReliefPacksByStubIds = async (
  stubIds,
  dbClient = pool,
) => {
  const assignments = await assignmentRepository.getAssignmentsByStubIds(
    stubIds,
    dbClient,
  );
  const assignmentsByStubId = new Map();

  for (const assignment of assignments) {
    if (!assignmentsByStubId.has(assignment.stub_id)) {
      assignmentsByStubId.set(assignment.stub_id, []);
    }
    assignmentsByStubId
      .get(assignment.stub_id)
      .push(mapAssignmentForDisplay(assignment));
  }

  return assignmentsByStubId;
};

const getDonatedReliefPackClaimPlanForStub = async ({
  stubId,
  disasterEventId,
  client,
}) => {
  const assignments = await assignmentRepository.getAssignmentsByStubIds(
    [stubId],
    client,
    { includeReleased: false, forUpdate: true },
  );
  const reservedAssignments = assignments.filter(
    (assignment) => assignment.assignment_status === "RESERVED",
  );

  if (reservedAssignments.length === 0) {
    return {
      hasPersistedAssignment: false,
      donatedReliefPacks: [],
      allocations: [],
    };
  }

  const allocations = [];

  for (const assignment of reservedAssignments) {
    for (const item of getAssignmentItems(assignment)) {
      const batch =
        await distributionTransactionRepository.getInventoryBatchByIdForUpdate(
          item.inventory_batch_id,
          client,
        );
      const quantityToRelease = Number(
        item.quantity_reserved || item.quantity_per_pack || 0,
      );
      const batchStatus = String(batch?.status || "").toUpperCase();

      if (
        !batch ||
        batch.source_type !== "DONATED" ||
        quantityToRelease <= 0 ||
        Number(batch.quantity_available || 0) < quantityToRelease ||
        !["AVAILABLE", "LOW_STOCK"].includes(batchStatus) ||
        isInventoryBatchExpired(batch.expiration_date) ||
        isInventoryBatchNearExpiry(batch.expiration_date, 30)
      ) {
        const error = new Error(
          `The donated relief pack assigned to stub ${stubId} is no longer available.`,
        );
        error.statusCode = 409;
        error.code = "ASSIGNED_DONATED_RELIEF_PACK_UNAVAILABLE";
        throw error;
      }

      allocations.push({
        inventory_batch_id: batch.id,
        inventory_item_id: batch.inventory_item_id,
        quantity_released: quantityToRelease,
        batch_no: batch.batch_no || item.batch_no,
        item_code: batch.item_code || item.item_code,
        item_name: batch.item_name || item.item_name,
        category: batch.category || item.category,
        unit_of_measure: batch.unit_of_measure || item.unit_of_measure,
        reorder_level: batch.reorder_level || item.reorder_level,
        previous_quantity_available: Number(batch.quantity_available || 0),
        previous_status: batch.status,
        expiration_date: batch.expiration_date || item.expiration_date || null,
        source_type: "DONATED",
        source_relief_type: "DONATED_RELIEF_PACK",
        relief_pack_type_snapshot: "DONATED_RELIEF_PACK",
        donated_relief_pack_name: assignment.pack_name,
        donation_id: assignment.donation_id,
        donation_item_id: item.donation_item_id,
        donor_name: assignment.donor_name || null,
      });
    }
  }

  return {
    hasPersistedAssignment: true,
    assignmentIds: reservedAssignments.map((assignment) => assignment.id),
    donatedReliefPacks: reservedAssignments.map(mapAssignmentForDisplay),
    allocations,
  };
};

const markDonatedReliefPackAssignmentsClaimed = async (stubId, client) =>
  assignmentRepository.markAssignmentsClaimedForStub(stubId, client);

const releaseDonatedReliefPackAssignmentsForHousehold = async ({
  householdId,
  disasterEventId,
  releaseReason,
  client,
}) => {
  if (!householdId || !disasterEventId) {
    return [];
  }

  await assignmentRepository.lockDisasterEventForDonationAssignments(
    disasterEventId,
    client,
  );

  return assignmentRepository.releaseAssignmentsForHousehold(
    householdId,
    disasterEventId,
    releaseReason,
    client,
  );
};

const releaseDonatedReliefPackAssignmentsForEvent = async ({
  disasterEventId,
  releaseReason,
  client,
}) => {
  if (!disasterEventId) {
    return [];
  }

  await assignmentRepository.lockDisasterEventForDonationAssignments(
    disasterEventId,
    client,
  );

  return assignmentRepository.releaseAssignmentsForEvent(
    disasterEventId,
    releaseReason,
    client,
  );
};

module.exports = {
  ensureDonatedReliefPackAssignmentsForEvent,
  getAssignedDonatedReliefPacksByStubIds,
  getDonatedReliefPackClaimPlanForStub,
  markDonatedReliefPackAssignmentsClaimed,
  releaseDonatedReliefPackAssignmentsForHousehold,
  releaseDonatedReliefPackAssignmentsForEvent,
  buildDonatedReliefPackGroups,
  getAvailablePackCount,
};
