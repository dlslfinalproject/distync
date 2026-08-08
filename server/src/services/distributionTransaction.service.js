const pool = require("../config/db");
const distributionTransactionRepository = require("../repositories/distributionTransaction.repository");
const disasterEventRepository = require("../repositories/disasterEvent.repository");
const reliefPackTemplateRepository = require("../repositories/reliefPackTemplate.repository");
const notificationService = require("../modules/notifications/notification.service");
const stubRepository = require("../repositories/stub.repository");
const settingsRepository = require("../repositories/settings.repository");
const inventoryItemRepository = require("../repositories/inventoryItem.repository");
const {
  recordAutomaticReliefPackClaim,
} = require("./automaticReliefPackClaim.service");
const { logAuditSafely, pickDefined } = require("../utils/systemLog");
const mswdoReportExport = require("../utils/mswdoReportExport");

const buildFullName = (firstName, middleName, lastName, suffix) => {
  return [firstName, middleName, lastName, suffix].filter(Boolean).join(" ");
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

const formatStubDisplayNo = (sequenceNo, fallbackStubNo = null) => {
  const parsedSequenceNo = Number(sequenceNo || 0);
  return parsedSequenceNo > 0 ? `STUB#${parsedSequenceNo}` : fallbackStubNo || "--";
};

const getHistoryRowTime = (row) => {
  const parsedTime = new Date(row?.distribution_date || 0).getTime();
  return Number.isNaN(parsedTime) ? 0 : parsedTime;
};

const sortDistributionHistoryRows = (rows, sortOrder = "newest") => {
  return [...rows].sort((leftRow, rightRow) => {
    if (sortOrder === "az" || sortOrder === "za") {
      const comparison = String(leftRow.family_head_name || "").localeCompare(
        String(rightRow.family_head_name || ""),
        undefined,
        { sensitivity: "base" },
      );

      return sortOrder === "za" ? -comparison : comparison;
    }

    const leftTime = getHistoryRowTime(leftRow);
    const rightTime = getHistoryRowTime(rightRow);

    return sortOrder === "oldest" ? leftTime - rightTime : rightTime - leftTime;
  });
};

const buildReportSourceName = (requester, rows = []) => {
  if (requester?.roleCode !== ROLE_CODES.BARANGAY) {
    return "MSWDO";
  }

  const barangayName = rows.find((row) => row.barangay_name)?.barangay_name;
  return barangayName ? `Barangay ${barangayName}` : "Barangay";
};

const formatDisasterEventStatusLabel = (status) =>
  String(status || "").toUpperCase() === "ACTIVE" ? "Active" : "Ended";

const buildDistributionHistorySummaryRows = ({
  rows,
  disasterEvents = [],
  selectedBarangayId = null,
}) => {
  const summaryByEventId = new Map();

  (Array.isArray(disasterEvents) ? disasterEvents : []).forEach((event) => {
    const affectedBarangays = Array.isArray(event?.affected_barangays)
      ? event.affected_barangays
      : [];
    const affectedBarangayIds = affectedBarangays
      .map((barangay) => barangay?.id || barangay?.barangay_id || "")
      .filter(Boolean);

    if (
      selectedBarangayId &&
      affectedBarangayIds.length > 0 &&
      !affectedBarangayIds.includes(selectedBarangayId)
    ) {
      return;
    }

    const barangayNames = selectedBarangayId
      ? affectedBarangays
          .filter(
            (barangay) =>
              (barangay?.id || barangay?.barangay_id || "") === selectedBarangayId,
          )
          .map((barangay) => barangay?.name)
          .filter(Boolean)
      : affectedBarangays.map((barangay) => barangay?.name).filter(Boolean);

    summaryByEventId.set(event.id, {
      disaster_event_id: event.id,
      event_code: event.event_code || "",
      disaster_event_title: event.title || "--",
      disaster_event_status: event.status || "",
      start_date: event.start_date || null,
      barangayNames: new Set(barangayNames),
      reliefPacks: new Set(),
      latest_distribution_date: null,
      issued_stubs_count: 0,
      claimed_stubs_count: 0,
      unclaimed_stubs_count: 0,
    });
  });

  rows.forEach((row) => {
    const eventId = row.disaster_event_id || "unknown-event";
    const existingSummary = summaryByEventId.get(eventId) || {
      disaster_event_id: eventId,
      event_code: row.event_code || "",
      disaster_event_title: row.disaster_event_title || "--",
      disaster_event_status: row.disaster_event_status || "",
      start_date: row.start_date || null,
      barangayNames: new Set(),
      reliefPacks: new Set(),
      latest_distribution_date: null,
      issued_stubs_count: Number(row.issued_stubs_count || 0),
      claimed_stubs_count: Number(row.claimed_stubs_count || 0),
      unclaimed_stubs_count: Number(row.unclaimed_stubs_count || 0),
    };

    if (row.barangay_name) {
      existingSummary.barangayNames.add(row.barangay_name);
    }

    const reliefPackName =
      row.relief_pack_template_name || row.released_items_summary || "";
    if (reliefPackName) {
      existingSummary.reliefPacks.add(reliefPackName);
    }

    existingSummary.issued_stubs_count = Number(
      row.issued_stubs_count || existingSummary.issued_stubs_count || 0,
    );
    existingSummary.claimed_stubs_count = Number(
      row.claimed_stubs_count || existingSummary.claimed_stubs_count || 0,
    );
    existingSummary.unclaimed_stubs_count = Number(
      row.unclaimed_stubs_count || existingSummary.unclaimed_stubs_count || 0,
    );

    const currentLatestTime = getHistoryRowTime({
      distribution_date: existingSummary.latest_distribution_date,
    });
    const rowTime = getHistoryRowTime(row);

    if (rowTime > currentLatestTime) {
      existingSummary.latest_distribution_date = row.distribution_date;
    }

    summaryByEventId.set(eventId, existingSummary);
  });

  return Array.from(summaryByEventId.values()).map((summary) => ({
    disaster_event_id: summary.disaster_event_id,
    event_code: summary.event_code,
    disaster_event_title: summary.disaster_event_title,
    disaster_event_status: summary.disaster_event_status,
    start_date: summary.start_date,
    barangay_summary: Array.from(summary.barangayNames).sort().join(", ") || "--",
    barangay_count: summary.barangayNames.size,
    issued_stubs_count: summary.issued_stubs_count,
    claimed_stubs_count: summary.claimed_stubs_count,
    unclaimed_stubs_count: summary.unclaimed_stubs_count,
    relief_pack_summary: Array.from(summary.reliefPacks).sort().join(", ") || "--",
    latest_distribution_date: summary.latest_distribution_date,
  }));
};

const attachDistributionHistoryStubCounts = async ({
  rows,
  requester,
  filters,
}) => {
  if (!Array.isArray(rows) || rows.length === 0 || filters?.disaster_event_id) {
    return rows;
  }

  const eventIds = [...new Set(rows.map((row) => row.disaster_event_id).filter(Boolean))];

  if (eventIds.length === 0) {
    return rows;
  }

  const stubSummaryRows =
    await distributionTransactionRepository.getDistributionHistoryStubSummaryByEventIds({
      eventIds,
      barangayId:
        requester?.roleCode === BARANGAY_ROLE_CODE
          ? requester.defaultBarangayId
          : filters?.barangay_id || null,
    });

  const stubSummaryByEventId = new Map(
    stubSummaryRows.map((row) => [row.disaster_event_id, row]),
  );

  return rows.map((row) => {
    const stubSummary = stubSummaryByEventId.get(row.disaster_event_id);

    return {
      ...row,
      issued_stubs_count: Number(stubSummary?.issued_stubs_count || 0),
      claimed_stubs_count: Number(stubSummary?.claimed_stubs_count || 0),
      unclaimed_stubs_count: Number(stubSummary?.unclaimed_stubs_count || 0),
    };
  });
};

const sortDistributionHistorySummaryRows = (rows, sortOrder = "newest") => {
  return [...rows].sort((leftRow, rightRow) => {
    if (sortOrder === "az" || sortOrder === "za") {
      const comparison = String(leftRow.disaster_event_title || "").localeCompare(
        String(rightRow.disaster_event_title || ""),
        undefined,
        { sensitivity: "base" },
      );

      return sortOrder === "za" ? -comparison : comparison;
    }

    const leftTime = getHistoryRowTime({
      distribution_date: leftRow.latest_distribution_date,
    });
    const rightTime = getHistoryRowTime({
      distribution_date: rightRow.latest_distribution_date,
    });

    if (leftTime !== rightTime) {
      return sortOrder === "oldest" ? leftTime - rightTime : rightTime - leftTime;
    }

    const leftStartTime = new Date(leftRow?.start_date || 0).getTime();
    const rightStartTime = new Date(rightRow?.start_date || 0).getTime();

    if (leftStartTime !== rightStartTime) {
      return sortOrder === "oldest"
        ? leftStartTime - rightStartTime
        : rightStartTime - leftStartTime;
    }

    return 0;
  });
};

const attachAffectedBarangaysToEvents = async (events) => {
  if (!Array.isArray(events) || events.length === 0) {
    return [];
  }

  const affectedBarangays =
    await disasterEventRepository.getAffectedBarangaysByDisasterEventIds(
      events.map((event) => event.id).filter(Boolean),
    );
  const affectedBarangaysByEventId = affectedBarangays.reduce((grouped, row) => {
    if (!grouped[row.disaster_event_id]) {
      grouped[row.disaster_event_id] = [];
    }

    grouped[row.disaster_event_id].push(row);
    return grouped;
  }, {});

  return events.map((event) => ({
    ...event,
    affected_barangays: affectedBarangaysByEventId[event.id] || [],
  }));
};

const getDistributionHistorySummaryEvents = async ({ requester, filters }) => {
  if (requester?.roleCode === BARANGAY_ROLE_CODE) {
    const barangayId = await resolveRequesterBarangayId(requester);

    if (!barangayId) {
      return [];
    }

    const events = await disasterEventRepository.getDisasterEventsByBarangayId(
      barangayId,
    );
    return attachAffectedBarangaysToEvents(events);
  }

  const events = await disasterEventRepository.getAllDisasterEvents();
  return attachAffectedBarangaysToEvents(events);
};

const groupByKey = (rows, key) => {
  return rows.reduce((groupedRows, row) => {
    const groupKey = row[key];

    if (!groupKey) {
      return groupedRows;
    }

    if (!groupedRows[groupKey]) {
      groupedRows[groupKey] = [];
    }

    groupedRows[groupKey].push(row);
    return groupedRows;
  }, {});
};

const buildSectorsText = (
  householdId,
  householdSectorsByHouseholdId,
  memberSectorsByHouseholdId,
) => {
  const householdSectorNames = (householdSectorsByHouseholdId[householdId] || []).map(
    (sector) => sector.name,
  );
  const memberSectorNames = (memberSectorsByHouseholdId[householdId] || []).map(
    (sector) => sector.name,
  );
  const uniqueSectorNames = [
    ...new Set([...householdSectorNames, ...memberSectorNames]),
  ];

  return uniqueSectorNames.length > 0 ? uniqueSectorNames.join(", ") : "-";
};

const attachHistorySectors = async (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  const householdIds = [...new Set(rows.map((row) => row.household_id).filter(Boolean))];
  const [householdSectors, memberSectors] = await Promise.all([
    stubRepository.getHouseholdSectorsByHouseholdIds(householdIds),
    stubRepository.getMemberSectorsByHouseholdIds(householdIds),
  ]);
  const householdSectorsByHouseholdId = groupByKey(
    householdSectors,
    "household_id",
  );
  const memberSectorsByHouseholdId = groupByKey(memberSectors, "household_id");

  return rows.map((row) => ({
    ...row,
    sectors_text: buildSectorsText(
      row.household_id,
      householdSectorsByHouseholdId,
      memberSectorsByHouseholdId,
    ),
  }));
};

const ACTIVE_QR_STATUS = "ACTIVE";
const BARANGAY_ROLE_CODE = "BARANGAY";
const ROLE_CODES = {
  BARANGAY: "BARANGAY",
  MSWDO: "MSWDO",
};

const resolveRequesterBarangayId = async (requester) => {
  if (requester?.defaultBarangayId) {
    return requester.defaultBarangayId;
  }

  if (!requester?.userId) {
    return null;
  }

  const user = await settingsRepository.getUserById(requester.userId);
  return user?.default_barangay_id || null;
};

const assertBarangayDistributionScope = (stub, requester) => {
  if (requester?.roleCode !== BARANGAY_ROLE_CODE) {
    return;
  }

  if (!requester.defaultBarangayId) {
    const error = new Error(
      "Barangay distribution requires an account with an assigned barangay.",
    );
    error.statusCode = 403;
    throw error;
  }

  if (stub.barangay_id !== requester.defaultBarangayId) {
    const error = new Error(
      "You can only claim or distribute stubs under your assigned barangay.",
    );
    error.statusCode = 403;
    throw error;
  }
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

const STANDARD_DISASTER_TYPES = [
  "Typhoon",
  "Flood",
  "Earthquake",
  "Landslide",
  "Volcanic Eruption",
  "Storm Surge",
  "Drought / El Ni\u00f1o",
  "Tsunami",
  "Fire",
];

const isTemplateApplicableToDisasterType = (templateDisasterTypes, disasterType) => {
  const normalizedDisasterType = String(disasterType || "").trim();

  if (!normalizedDisasterType) {
    return true;
  }

  const isOtherDisasterType =
    !STANDARD_DISASTER_TYPES.includes(normalizedDisasterType);

  return (templateDisasterTypes || []).some((row) => {
    const normalizedTemplateType = String(row.disaster_type || "").trim();

    return (
      normalizedTemplateType === normalizedDisasterType ||
      (isOtherDisasterType && normalizedTemplateType === "Other")
    );
  });
};

const NEAR_EXPIRY_DAYS = 30;

const isNearExpiryDate = (value, thresholdDays = NEAR_EXPIRY_DAYS) => {
  if (!value) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const thresholdDate = new Date(today);
  thresholdDate.setDate(thresholdDate.getDate() + thresholdDays);

  const parsedDate = new Date(value);
  parsedDate.setHours(0, 0, 0, 0);

  return (
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate >= today &&
    parsedDate <= thresholdDate
  );
};

const isDistributableBatch = (batch) =>
  Boolean(batch) &&
  ["AVAILABLE", "LOW_STOCK"].includes(batch.status) &&
  !isNearExpiryDate(batch.expiration_date);

const getInventoryBatchStatusWithExpiry = (batch, quantityAvailable) => {
  const normalizedQuantity = Number(quantityAvailable || 0);

  if (normalizedQuantity <= 0) {
    return "DEPLETED";
  }

  if (batch?.expiration_date) {
    const today = new Date();
    const todayDateOnly = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const expirationDate = new Date(batch.expiration_date);

    if (expirationDate < todayDateOnly) {
      return "EXPIRED";
    }
  }

  if (normalizedQuantity <= 10) {
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

const isOperationallyActiveClaimHousehold = (stub, latestAttendance) => {
  if (!stub || stub.is_active === false) {
    return false;
  }

  if (String(stub.current_stay_type || "").toUpperCase() !== "EVAC_CENTER") {
    return false;
  }

  const latestStatus = String(latestAttendance?.status || "").toUpperCase();

  if (latestAttendance?.time_out) {
    return false;
  }

  if (latestStatus === "LEFT" || latestStatus === "TRANSFERRED") {
    return false;
  }

  return true;
};

const buildDistributionInventoryRemarks = ({
  templateName,
  packQuantity,
  batchNo,
  quantityReleased,
}) => {
  const remarkParts = [
    "Relief distribution outflow",
    templateName ? `pack: ${templateName}` : null,
    packQuantity && packQuantity > 1 ? `pack_quantity: ${packQuantity}` : null,
    batchNo ? `batch: ${batchNo}` : null,
    quantityReleased ? `quantity: ${quantityReleased}` : null,
  ].filter(Boolean);

  return remarkParts.join(" | ");
};

const buildReturnInventoryRemarks = ({
  transactionId,
  batchNo,
  quantityRestored,
}) => {
  return [
    "Relief distribution stock restored",
    transactionId ? `distribution_transaction_id: ${transactionId}` : null,
    batchNo ? `batch: ${batchNo}` : null,
    quantityRestored ? `quantity: ${quantityRestored}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
};

const recomputeAndUpdateInventoryItemSnapshots = async (
  inventoryItemsById,
  dbClient,
) => {
  for (const [inventoryItemId, inventoryItem] of inventoryItemsById.entries()) {
    const recomputedQuantityResult = await dbClient.query(
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
      dbClient,
    );
  }
};

const buildTemplateReleasePlan = async ({
  reliefPackTemplateId,
  client,
  inventoryItemsById,
  disasterType,
  householdSize,
}) => {
  const reliefPackTemplate =
    await distributionTransactionRepository.getReliefPackTemplateByIdForUpdate(
      reliefPackTemplateId,
      client,
    );

  if (!reliefPackTemplate || reliefPackTemplate.is_active === false) {
    const error = new Error("Selected relief pack template is no longer available");
    error.statusCode = 404;
    throw error;
  }

  if (
    reliefPackTemplate.applies_to_all_disasters === false &&
    String(disasterType || "").trim()
  ) {
    const templateDisasterTypes =
      await reliefPackTemplateRepository.getReliefPackTemplateDisasterTypesByTemplateId(
        reliefPackTemplateId,
      );
    const isApplicableToDisasterType = isTemplateApplicableToDisasterType(
      templateDisasterTypes,
      disasterType,
    );

    if (!isApplicableToDisasterType) {
      const error = new Error(
        `Selected relief pack template is not applicable to ${disasterType}.`,
      );
      error.statusCode = 400;
      throw error;
    }
  }

  const templateItems =
    await distributionTransactionRepository.getReliefPackTemplateItemsByTemplateIdForUpdate(
      reliefPackTemplateId,
      client,
    );

  if (!Array.isArray(templateItems) || templateItems.length === 0) {
    const error = new Error(
      "Selected relief pack template does not have configured inventory items",
    );
    error.statusCode = 400;
    throw error;
  }

  const packMultiplier = getTemplatePackMultiplier(
    reliefPackTemplate,
    householdSize,
  );
  const releasePlan = [];

  for (const templateItem of templateItems) {
    const inventoryItem = await inventoryItemRepository.getInventoryItemByIdForUpdate(
      templateItem.inventory_item_id,
      client,
    );

    if (!inventoryItem || inventoryItem.is_active === false) {
      const error = new Error(
        `Relief pack item is no longer available: ${templateItem.item_name || templateItem.inventory_item_id}`,
      );
      error.statusCode = 400;
      throw error;
    }

    inventoryItemsById.set(templateItem.inventory_item_id, inventoryItem);

    const candidateBatches =
      await distributionTransactionRepository.getAvailableInventoryBatchesByItemIdForUpdate(
        templateItem.inventory_item_id,
        client,
      );
    const requiredQuantity =
      Number(templateItem.quantity_required || 0) * packMultiplier;
    const totalAvailableQuantity = candidateBatches.reduce(
      (total, batch) => total + Number(batch.quantity_available || 0),
      0,
    );

    if (totalAvailableQuantity < requiredQuantity) {
      const error = new Error(
        `Insufficient stock for ${templateItem.item_name}. Required: ${requiredQuantity}, available: ${totalAvailableQuantity}.`,
      );
      error.statusCode = 400;
      throw error;
    }

    let remainingQuantity = requiredQuantity;

    for (const batch of candidateBatches) {
      if (remainingQuantity <= 0) {
        break;
      }

      const quantityReleased = Math.min(
        Number(batch.quantity_available || 0),
        remainingQuantity,
      );

      if (quantityReleased <= 0) {
        continue;
      }

      releasePlan.push({
        inventory_batch_id: batch.id,
        inventory_item_id: templateItem.inventory_item_id,
        quantity_released: quantityReleased,
        batch_no: batch.batch_no,
        item_code: batch.item_code,
        item_name: batch.item_name,
        unit_of_measure: batch.unit_of_measure,
      });

      remainingQuantity -= quantityReleased;
    }
  }

  return {
    reliefPackTemplate,
    packMultiplier,
    releasePlan,
  };
};

const buildManualReleasePlan = async ({
  items,
  client,
  inventoryItemsById,
}) => {
  const groupedItems = groupRequestedItemsByBatch(items);
  const lockedBatches = new Map();
  const releasePlan = [];

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

    if (!isDistributableBatch(inventoryBatch)) {
      const error = new Error(
        `Batch ${inventoryBatch.batch_no} is not eligible for distribution.`,
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

    const inventoryItem = await inventoryItemRepository.getInventoryItemByIdForUpdate(
      groupedItem.inventory_item_id,
      client,
    );

    if (!inventoryItem || inventoryItem.is_active === false) {
      const error = new Error(
        `Inventory item is no longer available for batch ${inventoryBatch.batch_no}`,
      );
      error.statusCode = 400;
      throw error;
    }

    inventoryItemsById.set(groupedItem.inventory_item_id, inventoryItem);
    lockedBatches.set(groupedItem.inventory_batch_id, inventoryBatch);
  }

  for (const item of items) {
    const batchDetails = lockedBatches.get(item.inventory_batch_id);

    releasePlan.push({
      inventory_batch_id: item.inventory_batch_id,
      inventory_item_id: item.inventory_item_id,
      quantity_released: item.quantity_released,
      batch_no: batchDetails.batch_no,
      item_code: batchDetails.item_code,
      item_name: batchDetails.item_name,
      unit_of_measure: batchDetails.unit_of_measure,
    });
  }

  return releasePlan;
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

const summarizeDistributionTransaction = (transaction) =>
  pickDefined(transaction, [
    "id",
    "disaster_event_id",
    "household_id",
    "stub_id",
    "distribution_status",
    "claimed_by_name",
    "verified_by",
    "qr_reference_value",
    "receipt_no",
    "receipt_status",
    "received_at",
    "relief_pack_template_id",
    "remarks",
  ]);

const summarizeDistributionItems = (items) =>
  (Array.isArray(items) ? items : []).map((item) =>
    pickDefined(item, [
      "id",
      "inventory_batch_id",
      "inventory_item_id",
      "quantity_released",
      "batch_no",
      "item_name",
      "unit_of_measure",
    ]),
  );

const formatDistributionActionRemarks = ({
  actionType,
  reason,
  previousRemarks,
}) => {
  const actionLabel = actionType === "REVERSED" ? "Reversal" : "Cancellation";
  const normalizedReason = String(reason || "").trim();
  const normalizedPreviousRemarks = String(previousRemarks || "").trim();

  if (!normalizedPreviousRemarks) {
    return `${actionLabel} reason: ${normalizedReason}`;
  }

  return `${actionLabel} reason: ${normalizedReason}\nPrevious remarks: ${normalizedPreviousRemarks}`;
};

const normalizeRestoredBatchStatus = (batch, restoredQuantity) => {
  if (!batch) {
    return "AVAILABLE";
  }

  if (batch.status === "EXPIRED") {
    return "EXPIRED";
  }

  return getInventoryBatchStatus(restoredQuantity);
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

    assertBarangayDistributionScope(stub, requestData.requester);

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

    const disasterEvent = await disasterEventRepository.getDisasterEventById(
      stub.disaster_event_id,
    );

    if (!disasterEvent) {
      const error = new Error("Disaster event not found");
      error.statusCode = 404;
      throw error;
    }

    const latestAttendance =
      await distributionTransactionRepository.getLatestAttendanceByHouseholdId(
        stub.household_id,
        stub.disaster_event_id,
        client,
      );

    if (!isOperationallyActiveClaimHousehold(stub, latestAttendance)) {
      const error = new Error(
        "Only active evacuation-center households can claim a relief pack.",
      );
      error.statusCode = 400;
      throw error;
    }

    if (
      requestData.qr_reference_value &&
      stub.qr_code_value !== requestData.qr_reference_value
    ) {
      const error = new Error("qr_reference_value does not match the stub record");
      error.statusCode = 400;
      throw error;
    }

    if (
      requestData.qr_reference_value &&
      stub.qr_status &&
      stub.qr_status !== ACTIVE_QR_STATUS
    ) {
      const error = new Error("The scanned QR reference is not active");
      error.statusCode = 400;
      throw error;
    }

    const inventoryItemsById = new Map();
    const templateReleasePlan = requestData.relief_pack_template_id
      ? await buildTemplateReleasePlan({
          reliefPackTemplateId: requestData.relief_pack_template_id,
          client,
          inventoryItemsById,
          disasterType: disasterEvent.disaster_type,
          householdSize: stub.household_size,
        })
      : null;
    const releasePlan = templateReleasePlan
      ? templateReleasePlan.releasePlan
      : await buildManualReleasePlan({
          items: requestData.items,
          client,
          inventoryItemsById,
        });

    const receiptNo =
      await distributionTransactionRepository.getDistributionReceiptSequence(
        client,
      );
    const receivedAt = new Date().toISOString();
    const qrScannedAt = requestData.qr_reference_value
      ? new Date().toISOString()
      : null;

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
          qr_reference_value:
            requestData.qr_reference_value || stub.qr_code_value || null,
          qr_scanned_at: qrScannedAt,
          qr_scanned_by: requestData.qr_reference_value
            ? requestData.verified_by
            : null,
          receipt_no: receiptNo,
          receipt_status: requestData.receipt_status,
          received_at: receivedAt,
          relief_pack_template_id:
            requestData.relief_pack_template_id ||
            templateReleasePlan?.reliefPackTemplate?.id ||
            null,
          remarks: requestData.remarks,
        },
        client,
      );

    const releasedItems = [];
    const batchAlertPayloads = [];
    const deductedBatchTotals = new Map();

    for (const item of releasePlan) {
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

      const batchDetails =
        await distributionTransactionRepository.getInventoryBatchByIdForUpdate(
          item.inventory_batch_id,
          client,
        );

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

      deductedBatchTotals.set(item.inventory_batch_id, {
        ...batchDetails,
        total_quantity_released:
          Number(deductedBatchTotals.get(item.inventory_batch_id)?.total_quantity_released || 0) +
          Number(item.quantity_released || 0),
      });
    }

    for (const groupedItem of deductedBatchTotals.values()) {
      const batchDetails =
        await distributionTransactionRepository.getInventoryBatchByIdForUpdate(
          groupedItem.id,
          client,
        );
      const remainingQuantity =
        Number(batchDetails.quantity_available || 0) -
        Number(groupedItem.total_quantity_released || 0);

      if (remainingQuantity < 0) {
        const error = new Error(`Insufficient stock for batch ${batchDetails.batch_no}`);
        error.statusCode = 400;
        throw error;
      }

      const nextStatus = getInventoryBatchStatusWithExpiry(
        batchDetails,
        remainingQuantity,
      );

      const updatedBatch =
        await distributionTransactionRepository.updateInventoryBatchQuantityAndStatus(
          groupedItem.id,
          remainingQuantity,
          nextStatus,
          client,
        );

      batchAlertPayloads.push({
        batch: {
          id: batchDetails.id,
          batch_no: batchDetails.batch_no,
          quantity_available: updatedBatch.quantity_available,
          status: updatedBatch.status,
          item_name: batchDetails.item_name,
        },
        previousQuantityAvailable: batchDetails.quantity_available,
        previousStatus: batchDetails.status,
      });
    }

    for (const item of releasedItems) {
      await distributionTransactionRepository.insertInventoryTransaction(
        {
          disaster_event_id: requestData.disaster_event_id,
          inventory_batch_id: item.inventory_batch_id,
          transaction_type: "OUTFLOW",
          quantity: item.quantity_released,
          reference_type: "DISTRIBUTION",
          reference_id: distributionTransaction.id,
          performed_by: requestData.verified_by || null,
          remarks: buildDistributionInventoryRemarks({
            templateName: templateReleasePlan?.reliefPackTemplate?.name || null,
            packQuantity: templateReleasePlan?.packMultiplier || 1,
            batchNo: item.batch_no,
            quantityReleased: item.quantity_released,
          }),
        },
        client,
      );
    }

    await recomputeAndUpdateInventoryItemSnapshots(inventoryItemsById, client);

    const updatedStub = await distributionTransactionRepository.updateStubAsClaimed(
      requestData.stub_id,
      client,
    );

    await client.query("COMMIT");

    await notificationService.emitSafely(async () => {
      for (const batchAlertPayload of batchAlertPayloads) {
        await notificationService.emitBatchAlerts({
          ...batchAlertPayload,
          disasterEventId: requestData.disaster_event_id,
        });
      }

      await notificationService.emitDistributionUpdate({
        disasterEventId: requestData.disaster_event_id,
        stubNo: updatedStub.stub_no,
        familyHeadName: buildFullName(
          stub.family_head_first_name,
          stub.family_head_middle_name,
          stub.family_head_last_name,
          stub.family_head_suffix,
        ),
        distributionTransactionId: distributionTransaction.id,
      });
    });

    await logAuditSafely({
      actor: requestData.requester,
      action: "DISTRIBUTION_RECORD",
      entityType: "DISTRIBUTION_TRANSACTION",
      entityId: distributionTransaction.id,
      oldValues: {},
      newValues: summarizeDistributionTransaction(distributionTransaction),
    });

    return {
      distribution_transaction_id: distributionTransaction.id,
      distribution_date: distributionTransaction.distribution_date,
      qr_reference_value: distributionTransaction.qr_reference_value,
      qr_scanned_at: distributionTransaction.qr_scanned_at,
      qr_scanned_by: distributionTransaction.qr_scanned_by,
      receipt_no: distributionTransaction.receipt_no,
      receipt_status: distributionTransaction.receipt_status,
      received_at: distributionTransaction.received_at,
      relief_pack_template_id: distributionTransaction.relief_pack_template_id,
      relief_pack_template_name:
        templateReleasePlan?.reliefPackTemplate?.name || null,
      relief_pack_quantity: templateReleasePlan?.packMultiplier || 1,
      stub: {
        id: updatedStub.id,
        stub_no: updatedStub.stub_no,
        serial_no: updatedStub.serial_no,
        status: updatedStub.status,
        claimed_at: updatedStub.claimed_at,
        qr_code_value: updatedStub.qr_code_value || null,
        qr_generated_at: updatedStub.qr_generated_at || null,
        qr_generated_by: updatedStub.qr_generated_by || null,
        qr_status: updatedStub.qr_status || null,
        qr_notes: updatedStub.qr_notes || null,
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

const claimDistributionTransactionFromQr = async (requestData) => {
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

    assertBarangayDistributionScope(stub, requestData.requester);

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

    if (
      requestData.qr_reference_value &&
      stub.qr_code_value !== requestData.qr_reference_value
    ) {
      const error = new Error("qr_reference_value does not match the stub record");
      error.statusCode = 400;
      throw error;
    }

    if (
      requestData.qr_reference_value &&
      stub.qr_status &&
      stub.qr_status !== ACTIVE_QR_STATUS
    ) {
      const error = new Error("The scanned QR reference is not active");
      error.statusCode = 400;
      throw error;
    }

    const receivedAt = new Date().toISOString();
    const qrScannedAt = requestData.qr_reference_value
      ? new Date().toISOString()
      : null;
    const automaticClaimResult = await recordAutomaticReliefPackClaim({
      client,
      stub,
      claimedByName: requestData.claimed_by_name,
      verifiedBy: requestData.verified_by,
      qrReferenceValue: requestData.qr_reference_value || null,
      qrScannedAt,
      qrScannedBy: requestData.qr_reference_value
        ? requestData.verified_by
        : null,
      receivedAt,
      remarks:
        requestData.remarks ||
        "Claimed through QR stub verification page",
    });
    const {
      assignedReliefPackTemplate,
      distributionTransaction,
      releasedItems,
      updatedStub,
      donatedReliefPacks,
    } = automaticClaimResult;

    await client.query("COMMIT");

    await notificationService.emitSafely(() =>
      notificationService.emitDistributionUpdate({
        disasterEventId: requestData.disaster_event_id,
        stubNo: updatedStub.stub_no,
        familyHeadName: buildFullName(
          stub.family_head_first_name,
          stub.family_head_middle_name,
          stub.family_head_last_name,
          stub.family_head_suffix,
        ),
        distributionTransactionId: distributionTransaction.id,
      }),
    );

    await logAuditSafely({
      actor: requestData.requester,
      action: "DISTRIBUTION_QR_CLAIM",
      entityType: "DISTRIBUTION_TRANSACTION",
      entityId: distributionTransaction.id,
      oldValues: {},
      newValues: summarizeDistributionTransaction(distributionTransaction),
    });

    return {
      distribution_transaction_id: distributionTransaction.id,
      distribution_date: distributionTransaction.distribution_date,
      qr_reference_value: distributionTransaction.qr_reference_value,
      qr_scanned_at: distributionTransaction.qr_scanned_at,
      qr_scanned_by: distributionTransaction.qr_scanned_by,
      receipt_no: distributionTransaction.receipt_no,
      receipt_status: distributionTransaction.receipt_status,
      received_at: distributionTransaction.received_at,
      relief_pack_template_id: distributionTransaction.relief_pack_template_id,
      relief_pack_template_name: assignedReliefPackTemplate?.name || null,
      relief_pack_quantity: automaticClaimResult.packQuantity || 1,
      donated_relief_packs: donatedReliefPacks || [],
      stub: {
        id: updatedStub.id,
        stub_no: updatedStub.stub_no,
        serial_no: updatedStub.serial_no,
        status: updatedStub.status,
        claimed_at: updatedStub.claimed_at,
        qr_code_value: updatedStub.qr_code_value || null,
        qr_generated_at: updatedStub.qr_generated_at || null,
        qr_generated_by: updatedStub.qr_generated_by || null,
        qr_status: updatedStub.qr_status || null,
        qr_notes: updatedStub.qr_notes || null,
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

const getDistributionHistory = async ({ requester, filters }) => {
  const roleCode = requester?.roleCode;
  const isBarangay = roleCode === BARANGAY_ROLE_CODE;
  const requesterBarangayId = isBarangay
    ? await resolveRequesterBarangayId(requester)
    : null;

  if (isBarangay && !requesterBarangayId) {
    const error = new Error(
      "Barangay distribution history requires an account with an assigned barangay.",
    );
    error.statusCode = 403;
    throw error;
  }

  const rows = await distributionTransactionRepository.getDistributionHistory({
    barangayId: isBarangay
      ? requesterBarangayId
      : filters.barangay_id || null,
    disasterEventId: filters.disaster_event_id || null,
    status: filters.status || null,
    dateFrom: filters.date_from || null,
    dateTo: filters.date_to || null,
    limit: filters.limit || 100,
  });

  const rowsWithSectors = await attachHistorySectors(rows);
  const rowsWithStubCounts = await attachDistributionHistoryStubCounts({
    rows: rowsWithSectors,
    requester,
    filters,
  });

  return sortDistributionHistoryRows(
    rowsWithStubCounts,
    filters.sort_order || "newest",
  );
};

const exportDistributionHistory = async ({ requester, filters }) => {
  if (
    requester?.roleCode !== ROLE_CODES.BARANGAY &&
    requester?.roleCode !== ROLE_CODES.MSWDO
  ) {
    const error = new Error("Only Barangay and MSWDO can export distribution history.");
    error.statusCode = 403;
    throw error;
  }

  const rows = await getDistributionHistory({
    requester,
    filters: {
      ...filters,
      limit: 1000,
    },
  });

  const isSummaryExport = !filters.disaster_event_id;
  const sortedRows = sortDistributionHistoryRows(rows, filters.sort_order || "newest");
  const sourceName = buildReportSourceName(requester, sortedRows);
  const selectedDisasterEventLabel =
    filters.disaster_event_id && sortedRows[0]
      ? [sortedRows[0].event_code, sortedRows[0].disaster_event_title]
          .filter(Boolean)
          .join(" - ") || sortedRows[0].disaster_event_title || filters.disaster_event_id
      : "All";

  if (isSummaryExport) {
    const disasterEvents = await getDistributionHistorySummaryEvents({
      requester,
      filters,
    });
    const summaryRows = sortDistributionHistorySummaryRows(
      buildDistributionHistorySummaryRows({
        rows: sortedRows,
        disasterEvents,
        selectedBarangayId:
          requester?.roleCode === BARANGAY_ROLE_CODE
            ? requester.defaultBarangayId || null
            : filters.barangay_id || null,
      }),
      filters.sort_order || "newest",
    );

    return mswdoReportExport.buildExportFile({
      filePrefix:
        requester?.roleCode === ROLE_CODES.BARANGAY
          ? "barangay-distribution-history-summary"
          : "mswdo-distribution-history-summary",
      worksheetName: "Distribution Summary",
      reportTitle:
        requester?.roleCode === ROLE_CODES.BARANGAY
          ? "Barangay Distribution History Summary"
          : "MSWDO Distribution History Summary",
      sourceName,
      metadata: [
        {
          label: "Disaster Event",
          value: selectedDisasterEventLabel,
        },
        {
          label: "Barangay",
          value:
            filters.barangay_id ||
            (requester?.roleCode === ROLE_CODES.BARANGAY
              ? "Assigned Barangay"
              : "All"),
        },
        {
          label: "Date Range",
          value:
            filters.date_from || filters.date_to
              ? `${filters.date_from || "--"} to ${filters.date_to || "--"}`
              : "All",
        },
      ],
      columns: [
        { key: "event_label", label: "Disaster Event", width: 32, pdfWidth: 120 },
        { key: "event_status", label: "Status", width: 14, pdfWidth: 48 },
        { key: "barangay_summary", label: "Barangays", width: 34, pdfWidth: 120 },
        { key: "issued_stubs_count", label: "Issued Stubs", width: 16, pdfWidth: 60 },
        { key: "claimed_stubs_count", label: "Claimed", width: 14, pdfWidth: 42 },
        { key: "unclaimed_stubs_count", label: "Unclaimed", width: 14, pdfWidth: 42 },
        { key: "relief_pack_summary", label: "Relief Pack", width: 32, pdfWidth: 115 },
        { key: "latest_distribution_date_label", label: "Latest Claim", width: 22, pdfWidth: 80 },
      ],
      rows: summaryRows.map((row) => ({
        event_label:
          [row.event_code, row.disaster_event_title].filter(Boolean).join(" - ") || "--",
        event_status: formatDisasterEventStatusLabel(row.disaster_event_status),
        barangay_summary:
          row.barangay_count > 0
            ? `${row.barangay_summary} (Count: ${row.barangay_count})`
            : "--",
        issued_stubs_count: row.issued_stubs_count || 0,
        claimed_stubs_count: row.claimed_stubs_count || 0,
        unclaimed_stubs_count: row.unclaimed_stubs_count || 0,
        relief_pack_summary: row.relief_pack_summary,
        latest_distribution_date_label: mswdoReportExport.formatDateTime(
          row.latest_distribution_date,
        ),
      })),
      format: filters.format,
    });
  }

  return mswdoReportExport.buildExportFile({
    filePrefix:
      requester?.roleCode === ROLE_CODES.BARANGAY
        ? "barangay-distribution-history"
        : "mswdo-distribution-history",
    worksheetName: "Distribution History",
    reportTitle:
      requester?.roleCode === ROLE_CODES.BARANGAY
        ? "Barangay Distribution History"
        : "MSWDO Distribution History",
    sourceName,
    metadata: [
      {
        label: "Disaster Event",
        value: selectedDisasterEventLabel,
      },
      {
        label: "Barangay",
        value:
          filters.barangay_id ||
          (requester?.roleCode === ROLE_CODES.BARANGAY
            ? "Assigned Barangay"
            : "All"),
      },
      {
        label: "Status",
        value: filters.status || "All",
      },
      {
        label: "Date Range",
        value:
          filters.date_from || filters.date_to
            ? `${filters.date_from || "--"} to ${filters.date_to || "--"}`
            : "All",
      },
    ],
    columns: [
      { key: "family_head_name", label: "Family Head", width: 28, pdfWidth: 100 },
      { key: "barangay_name", label: "Barangay", width: 20, pdfWidth: 70 },
      { key: "event_label", label: "Disaster Event", width: 24, pdfWidth: 84 },
      { key: "stub_reference", label: "Stub", width: 12, pdfWidth: 46 },
      { key: "qr_reference_value", label: "QR", width: 26, pdfWidth: 110 },
      { key: "relief_summary", label: "Relief Item / Pack", width: 24, pdfWidth: 118 },
      { key: "recorded_by_name", label: "Recorded By", width: 18, pdfWidth: 70 },
      { key: "distribution_status", label: "Status", width: 14, pdfWidth: 55 },
      { key: "distribution_date_label", label: "Date / Time", width: 18, pdfWidth: 72 },
    ],
    rows: sortedRows.map((row) => ({
      family_head_name: row.family_head_name || "--",
      barangay_name: row.barangay_name || "--",
      event_label: [row.event_code, row.disaster_event_title].filter(Boolean).join(" - ") || "--",
      stub_reference: formatStubDisplayNo(row.stub_sequence_no, row.stub_no),
      qr_reference_value: row.qr_reference_value || "--",
      relief_summary:
        row.relief_pack_template_name || row.released_items_summary || "--",
      recorded_by_name: row.verified_by_name || "--",
      distribution_status: row.distribution_status || "--",
      distribution_date_label: mswdoReportExport.formatDateTime(row.distribution_date),
    })),
    format: filters.format,
  });
};

const updateDistributionTransactionLifecycle = async ({
  transactionId,
  actionType,
  remarks,
  requester,
}) => {
  const normalizedActionType = String(actionType || "").toUpperCase();
  const normalizedRemarks = String(remarks || "").trim();

  if (!["CANCELLED", "REVERSED"].includes(normalizedActionType)) {
    const error = new Error("distribution action must be CANCELLED or REVERSED");
    error.statusCode = 400;
    throw error;
  }

  if (!normalizedRemarks) {
    const error = new Error("remarks are required for distribution cancel/reversal");
    error.statusCode = 400;
    throw error;
  }

  if (
    requester?.roleCode !== ROLE_CODES.BARANGAY &&
    requester?.roleCode !== ROLE_CODES.MSWDO
  ) {
    const error = new Error("Only Barangay and MSWDO can cancel or reverse distributions.");
    error.statusCode = 403;
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const distributionTransaction =
      await distributionTransactionRepository.getDistributionTransactionByIdForUpdate(
        transactionId,
        client,
      );

    if (!distributionTransaction) {
      const error = new Error("Distribution transaction not found");
      error.statusCode = 404;
      throw error;
    }

    assertBarangayDistributionScope(
      {
        barangay_id: distributionTransaction.barangay_id,
      },
      requester,
    );

    if (distributionTransaction.distribution_status === normalizedActionType) {
      const duplicateActionLabel =
        normalizedActionType === "REVERSED" ? "reversed" : "cancelled";
      const error = new Error(
        `This distribution record has already been ${duplicateActionLabel}.`,
      );
      error.statusCode = 409;
      throw error;
    }

    if (distributionTransaction.distribution_status !== "CLAIMED") {
      const error = new Error(
        "Only currently claimed distribution records can be cancelled or reversed.",
      );
      error.statusCode = 400;
      throw error;
    }

    const transactionItems =
      await distributionTransactionRepository.getDistributionTransactionItemsForUpdate(
        distributionTransaction.id,
        client,
      );
    const inventoryItemsById = new Map();

    const batchSummaries = [];

    for (const item of transactionItems) {
      const inventoryItem = await inventoryItemRepository.getInventoryItemByIdForUpdate(
        item.inventory_item_id,
        client,
      );

      if (inventoryItem) {
        inventoryItemsById.set(item.inventory_item_id, inventoryItem);
      }

      const restoredQuantity =
        Number(item.quantity_available || 0) + Number(item.quantity_released || 0);
      const nextStatus = normalizeRestoredBatchStatus(item, restoredQuantity);

      await distributionTransactionRepository.updateInventoryBatchQuantityAndStatus(
        item.inventory_batch_id,
        restoredQuantity,
        nextStatus,
        client,
      );

      batchSummaries.push({
        inventory_batch_id: item.inventory_batch_id,
        batch_no: item.batch_no,
        item_name: item.item_name,
        restored_quantity: item.quantity_released,
        next_quantity_available: restoredQuantity,
        next_status: nextStatus,
      });

      await distributionTransactionRepository.insertInventoryTransaction(
        {
          disaster_event_id: distributionTransaction.disaster_event_id,
          inventory_batch_id: item.inventory_batch_id,
          transaction_type: "RETURN",
          quantity: item.quantity_released,
          reference_type: "DISTRIBUTION",
          reference_id: distributionTransaction.id,
          performed_by: requester?.userId || null,
          remarks: buildReturnInventoryRemarks({
            transactionId: distributionTransaction.id,
            batchNo: item.batch_no,
            quantityRestored: item.quantity_released,
          }),
        },
        client,
      );
    }

    const nextReceiptStatus =
      normalizedActionType === "REVERSED" ? "VOIDED" : "CANCELLED";
    const nextRemarks = formatDistributionActionRemarks({
      actionType: normalizedActionType,
      reason: normalizedRemarks,
      previousRemarks: distributionTransaction.remarks,
    });

    const updatedTransaction =
      await distributionTransactionRepository.updateDistributionTransactionStatus(
        distributionTransaction.id,
        {
          distribution_status: normalizedActionType,
          receipt_status: nextReceiptStatus,
          remarks: nextRemarks,
        },
        client,
      );

    const updatedStub = await distributionTransactionRepository.updateStubStatus(
      distributionTransaction.stub_id,
      "CANCELLED",
      client,
    );

    await recomputeAndUpdateInventoryItemSnapshots(inventoryItemsById, client);

    await client.query("COMMIT");

    await logAuditSafely({
      actor: requester,
      action:
        normalizedActionType === "REVERSED"
          ? "DISTRIBUTION_REVERSE"
          : "DISTRIBUTION_CANCEL",
      entityType: "DISTRIBUTION_TRANSACTION",
      entityId: updatedTransaction.id,
      oldValues: {
        transaction: summarizeDistributionTransaction(distributionTransaction),
        items: summarizeDistributionItems(transactionItems),
        stub: pickDefined(distributionTransaction, [
          "stub_id",
          "stub_no",
          "serial_no",
          "stub_status",
        ]),
      },
      newValues: {
        transaction: summarizeDistributionTransaction(updatedTransaction),
        stub: pickDefined(updatedStub, [
          "id",
          "stub_no",
          "serial_no",
          "status",
        ]),
        reason: normalizedRemarks,
        restored_batches: batchSummaries,
      },
    });

    return {
      id: updatedTransaction.id,
      distribution_status: updatedTransaction.distribution_status,
      receipt_status: updatedTransaction.receipt_status,
      remarks: updatedTransaction.remarks,
      stub: pickDefined(updatedStub, [
        "id",
        "stub_no",
        "serial_no",
        "status",
      ]),
      restored_batches: batchSummaries,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  createDistributionTransaction,
  claimDistributionTransactionFromQr,
  getDistributionHistory,
  exportDistributionHistory,
  updateDistributionTransactionLifecycle,
};
