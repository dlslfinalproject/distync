const pool = require("../config/db");
const distributionTransactionRepository = require("../repositories/distributionTransaction.repository");
const notificationService = require("../modules/notifications/notification.service");
const stubRepository = require("../repositories/stub.repository");
const settingsRepository = require("../repositories/settings.repository");
const { logAuditSafely, pickDefined } = require("../utils/systemLog");
const mswdoReportExport = require("../utils/mswdoReportExport");

const buildFullName = (firstName, middleName, lastName, suffix) => {
  return [firstName, middleName, lastName, suffix].filter(Boolean).join(" ");
};

const formatStubDisplayNo = (sequenceNo, fallbackStubNo = null) => {
  const parsedSequenceNo = Number(sequenceNo || 0);
  return parsedSequenceNo > 0 ? `STUB#${parsedSequenceNo}` : fallbackStubNo || "--";
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
          relief_pack_template_id: requestData.relief_pack_template_id,
          remarks: requestData.remarks,
        },
        client,
      );

    const releasedItems = [];
    const batchAlertPayloads = [];

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
          device_id: null,
          is_offline_encoded: false,
          sync_status: "SYNCED",
          qr_reference_value:
            requestData.qr_reference_value || stub.qr_code_value || null,
          qr_scanned_at: qrScannedAt,
          qr_scanned_by: requestData.qr_reference_value
            ? requestData.verified_by
            : null,
          receipt_no: receiptNo,
          receipt_status: "GENERATED",
          received_at: receivedAt,
          relief_pack_template_id: null,
          remarks:
            requestData.remarks ||
            "Claimed through QR stub verification page",
        },
        client,
      );

    const updatedStub = await distributionTransactionRepository.updateStubAsClaimed(
      requestData.stub_id,
      client,
    );

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
      items_count: 0,
      items: [],
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

  return attachHistorySectors(rows);
};

const exportDistributionHistory = async ({ requester, filters }) => {
  if (requester?.roleCode !== "MSWDO") {
    const error = new Error("Only MSWDO can export distribution history.");
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

  return mswdoReportExport.buildExportFile({
    filePrefix: "mswdo-distribution-history",
    worksheetName: "Distribution History",
    reportTitle: "MSWDO Distribution History",
    metadata: [
      {
        label: "Disaster Event",
        value: filters.disaster_event_id || "All",
      },
      {
        label: "Barangay",
        value: filters.barangay_id || "All",
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
      { key: "event_label", label: "Disaster Event", width: 28, pdfWidth: 90 },
      { key: "stub_reference", label: "Stub / QR", width: 24, pdfWidth: 80 },
      { key: "relief_summary", label: "Relief Item / Pack", width: 32, pdfWidth: 120 },
      { key: "total_quantity_released", label: "Quantity", width: 14, pdfWidth: 45 },
      { key: "claimed_recorded_by", label: "Claimed / Recorded By", width: 30, pdfWidth: 90 },
      { key: "distribution_status", label: "Status", width: 14, pdfWidth: 55 },
      { key: "distribution_date_label", label: "Date / Time", width: 22, pdfWidth: 80 },
    ],
    rows: rows.map((row) => ({
      family_head_name: row.family_head_name || "--",
      barangay_name: row.barangay_name || "--",
      event_label: [row.event_code, row.disaster_event_title].filter(Boolean).join(" - ") || "--",
      stub_reference:
        [
          `Stub: ${formatStubDisplayNo(row.stub_sequence_no, row.stub_no)}`,
          row.qr_reference_value ? `QR: ${row.qr_reference_value}` : "",
        ]
          .filter(Boolean)
          .join(" | ") || "--",
      relief_summary:
        row.relief_pack_template_name || row.released_items_summary || "--",
      total_quantity_released: row.total_quantity_released || 0,
      claimed_recorded_by: `Claimed: ${row.claimed_by_name || "--"} | Recorded: ${row.verified_by_name || "--"}`,
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

    const batchSummaries = [];

    for (const item of transactionItems) {
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
