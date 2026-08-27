const pool = require("../config/db");
const inventoryTransactionRepository = require("../repositories/inventoryTransaction.repository");
const inventoryItemRepository = require("../repositories/inventoryItem.repository");
const mayorReportExport = require("../utils/mayorReportExport");
const notificationService = require("../modules/notifications/notification.service");
const {
  logAuditSafely,
  logErrorSafely,
  pickDefined,
} = require("../utils/systemLog");
const {
  createDuplicateInventoryTransactionReferenceError,
  isValidInventoryTransactionReferenceNo,
  normalizeInventoryTransactionReferenceNo,
} = require("../utils/inventoryTransactionReference");
const additiveTransactionTypes = new Set(["INFLOW", "RETURN", "ADJUSTMENT"]);
const subtractiveTransactionTypes = new Set([
  "OUTFLOW",
  "EXPIRED",
  "MISSING",
  "DAMAGED",
  "SPOILED",
  "STOLEN",
]);

const isEventSpecificReliefOutflow = (transactionData) =>
  transactionData.transaction_type === "OUTFLOW" &&
  Boolean(transactionData.disaster_event_id);

const createDisasterEventNotActiveError = () => {
  const error = new Error(
    "Inventory outflow cannot be completed because the disaster event is not active.",
  );
  error.statusCode = 400;
  error.code = "DISASTER_EVENT_NOT_ACTIVE";
  return error;
};

const buildFullName = (firstName, lastName) => {
  return [firstName, lastName].filter(Boolean).join(" ");
};

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

const mapInventoryTransaction = (transaction) => {
  return {
    id: transaction.id,
    disaster_event_id: transaction.disaster_event_id,
    inventory_batch_id: transaction.inventory_batch_id,
    transaction_type: transaction.transaction_type,
    quantity: transaction.quantity,
    reference_type: transaction.reference_type,
    reference_id: transaction.reference_id,
    inventory_transaction_reference_no:
      transaction.inventory_transaction_reference_no,
    performed_by: transaction.performed_by,
    performed_at: transaction.performed_at,
    remarks: transaction.remarks,
    created_at: transaction.created_at,
    inventory_batch: {
      id: transaction.inventory_batch_id,
      batch_no: transaction.batch_no,
      inventory_item_stock_form_id: transaction.inventory_item_stock_form_id,
      supplier_id: transaction.supplier_id,
      source_type: transaction.source_type,
      status: transaction.batch_status,
      quantity_available: transaction.quantity_available,
      supplier: transaction.supplier_id
        ? {
            id: transaction.supplier_id,
            name: transaction.supplier_name || null,
          }
        : null,
      donation: transaction.source_donation_id
        ? {
            id: transaction.source_donation_id,
            donor_name: transaction.source_donor_name || null,
          }
        : null,
    },
    inventory_item: {
      id: transaction.inventory_item_id,
      item_code: transaction.item_code,
      item_name: transaction.item_name,
    },
    donation: transaction.donation_id
      ? {
          id: transaction.donation_id,
          donor_name: transaction.donor_name || null,
        }
      : null,
    inventory_item_stock_form: transaction.inventory_item_stock_form_id
      ? {
          id: transaction.inventory_item_stock_form_id,
          barcode: transaction.stock_form_barcode,
          packaging: transaction.stock_form_packaging,
          units_per_packaging: transaction.stock_form_units_per_packaging,
          unit_of_measure: transaction.stock_form_unit_of_measure,
          unit_of_measure_value: transaction.stock_form_unit_of_measure_value,
        }
      : null,
    performer: transaction.performed_by
      ? {
          id: transaction.performed_by,
          full_name: buildFullName(
            transaction.performed_by_first_name,
            transaction.performed_by_last_name,
          ),
        }
      : null,
  };
};

const summarizeInventoryTransaction = (transaction) =>
  pickDefined(transaction, [
    "disaster_event_id",
    "inventory_batch_id",
    "transaction_type",
    "quantity",
    "reference_type",
    "reference_id",
    "inventory_transaction_reference_no",
    "performed_by",
    "performed_at",
    "remarks",
  ]);

const INVENTORY_DOMAIN_EFFECT_BATCH_SIZE = Math.max(
  1,
  Number.parseInt(process.env.INVENTORY_DOMAIN_EFFECT_BATCH_SIZE || "25", 10) ||
    25,
);
const INVENTORY_DOMAIN_EFFECT_SCAN_INTERVAL_MS = Math.max(
  60 * 1000,
  Number.parseInt(
    process.env.INVENTORY_DOMAIN_EFFECT_SCAN_INTERVAL_MS || `${15 * 60 * 1000}`,
    10,
  ) ||
    15 * 60 * 1000,
);
let inventoryDomainEffectRecoveryInterval = null;

const buildInventoryTransactionAuditSourceKey = (transactionId) =>
  `INVENTORY_TRANSACTION_CREATE:${transactionId}`;

const buildInventoryBatchAuditSourceKey = ({ batchId, transactionId }) =>
  `INVENTORY_BATCH_CREATE:${batchId}:INVENTORY_TRANSACTION:${transactionId}`;

const persistInventoryAudit = async ({
  transaction,
  actor = {},
  fallbackBatch = null,
}) => {
  await logAuditSafely({
    actor,
    action: "INVENTORY_TRANSACTION_CREATE",
    entityType: "INVENTORY_TRANSACTION",
    entityId: transaction.id,
    oldValues: {},
    newValues: summarizeInventoryTransaction(transaction),
    sourceEventKey: buildInventoryTransactionAuditSourceKey(transaction.id),
    throwOnError: true,
  });

  if (fallbackBatch) {
    await logAuditSafely({
      actor,
      action: "INVENTORY_BATCH_CREATE",
      entityType: "INVENTORY_BATCH",
      entityId: fallbackBatch.id,
      oldValues: {},
      newValues: pickDefined(fallbackBatch, [
        "inventory_item_id",
        "batch_no",
        "source_type",
        "quantity_received",
        "quantity_available",
        "expiration_date",
        "storage_location",
        "status",
        "created_by",
      ]),
      sourceEventKey: buildInventoryBatchAuditSourceKey({
        batchId: fallbackBatch.id,
        transactionId: transaction.id,
      }),
      throwOnError: true,
    });
  }
};

const emitInventoryTransactionDomainSideEffects = async ({
  transaction,
  batch,
  previousQuantityAvailable,
  previousStatus,
  disasterEventId = null,
  actor = {},
  fallbackBatch = null,
}) => {
  await persistInventoryAudit({
    transaction,
    actor,
    fallbackBatch,
  });

  await notificationService.emitInventoryTransactionAlerts({
    transaction,
    batch,
    previousQuantityAvailable,
    previousStatus,
    disasterEventId,
  });
};

const processClaimedInventoryDomainEffectIntent = async (intent) => {
  const effectPayload =
    typeof intent.effect_payload_json === "string"
      ? JSON.parse(intent.effect_payload_json)
      : intent.effect_payload_json || {};

  if (!intent.audit_processed_at) {
    await persistInventoryAudit({
      transaction: effectPayload.transaction,
      actor: effectPayload.actor,
      fallbackBatch: effectPayload.fallbackBatch,
    });
    await inventoryTransactionRepository.markInventoryDomainEffectAuditProcessed(
      intent.id,
    );
  }

  if (!intent.alerts_processed_at) {
    await notificationService.emitInventoryTransactionAlerts({
      transaction: effectPayload.transaction,
      batch: effectPayload.batch,
      previousQuantityAvailable: effectPayload.previousQuantityAvailable,
      previousStatus: effectPayload.previousStatus,
      disasterEventId: effectPayload.disasterEventId,
    });
    await inventoryTransactionRepository.markInventoryDomainEffectAlertsProcessed(
      intent.id,
    );
  }

  await inventoryTransactionRepository.markInventoryDomainEffectIntentProcessed(
    intent.id,
  );
};

const processInventoryDomainEffectIntentById = async (intentId) => {
  const intent =
    await inventoryTransactionRepository.claimInventoryDomainEffectIntentById(
      intentId,
    );

  if (!intent) {
    return null;
  }

  try {
    await processClaimedInventoryDomainEffectIntent(intent);
    return { id: intent.id, status: "PROCESSED" };
  } catch (error) {
    await inventoryTransactionRepository.markInventoryDomainEffectIntentFailed({
      id: intent.id,
      errorMessage: error.message,
    });
    throw error;
  }
};

const processPendingInventoryDomainEffectIntents = async (
  limit = INVENTORY_DOMAIN_EFFECT_BATCH_SIZE,
) => {
  const intents =
    await inventoryTransactionRepository.claimPendingInventoryDomainEffectIntents(
      limit,
    );
  const results = [];

  for (const intent of intents) {
    try {
      await processClaimedInventoryDomainEffectIntent(intent);
      results.push({ id: intent.id, status: "PROCESSED" });
    } catch (error) {
      await inventoryTransactionRepository.markInventoryDomainEffectIntentFailed({
        id: intent.id,
        errorMessage: error.message,
      });
      results.push({ id: intent.id, status: "FAILED", error });
    }
  }

  return results;
};

const startInventoryDomainEffectRecovery = () => {
  if (inventoryDomainEffectRecoveryInterval) {
    return;
  }

  inventoryDomainEffectRecoveryInterval = setInterval(() => {
    processPendingInventoryDomainEffectIntents().catch((error) => {
      console.error(
        `Inventory domain effect recovery scan failed: ${error.message}`,
      );
    });
  }, INVENTORY_DOMAIN_EFFECT_SCAN_INTERVAL_MS);
};

const initializeInventoryDomainEffectRecovery = async () => {
  const results = await processPendingInventoryDomainEffectIntents();
  startInventoryDomainEffectRecovery();
  return results;
};

const getInventoryTransactions = async (filters) => {
  const transactions =
    await inventoryTransactionRepository.getInventoryTransactions(filters);

  return transactions.map(mapInventoryTransaction);
};

const getInventoryTransactionById = async (id) => {
  const transaction =
    await inventoryTransactionRepository.getInventoryTransactionById(id);

  if (!transaction) {
    return null;
  }

  return mapInventoryTransaction(transaction);
};

const createInventoryTransaction = async (transactionData) => {
  const externalClient = transactionData.dbClient || null;
  const deferDomainSideEffect =
    typeof transactionData.deferDomainSideEffect === "function"
      ? transactionData.deferDomainSideEffect
      : null;
  const syncTransactionId = transactionData.syncTransactionId || null;
  let committed = false;
  const rawReferenceNo =
    transactionData.inventoryTransactionReferenceNo ??
    transactionData.inventory_transaction_reference_no;
  const normalizedReferenceNo = normalizeInventoryTransactionReferenceNo(
    rawReferenceNo,
  );

  if (
    normalizedReferenceNo &&
    !isValidInventoryTransactionReferenceNo(normalizedReferenceNo)
  ) {
    const error = new Error(
      "Inventory Transaction Reference No. must use ITR-YYYY-NNNNNN and cannot end in 000000.",
    );
    error.statusCode = 400;
    throw error;
  }

  if (transactionData.performed_by) {
    const user = await inventoryTransactionRepository.getUserById(
      transactionData.performed_by,
    );

    if (!user) {
      const error = new Error("performed_by does not refer to an existing user");
      error.statusCode = 400;
      throw error;
    }
  }

  const client = externalClient || await pool.connect();

  try {
    if (!externalClient) {
      await client.query("BEGIN");
    }

    let inventoryBatch = null;
    let inventoryItem = null;

    if (normalizedReferenceNo) {
      const existingTransaction =
        await inventoryTransactionRepository.getInventoryTransactionByReferenceNo(
          normalizedReferenceNo,
          client,
        );

      if (existingTransaction) {
        throw createDuplicateInventoryTransactionReferenceError(
          existingTransaction,
        );
      }
    }

    if (transactionData.disaster_event_id) {
      const disasterEvent = await inventoryTransactionRepository.getDisasterEventById(
        transactionData.disaster_event_id,
        client,
      );

      if (!disasterEvent) {
        const error = new Error(
          "disaster_event_id does not refer to an existing disaster event",
        );
        error.statusCode = 400;
        throw error;
      }

      if (
        isEventSpecificReliefOutflow(transactionData) &&
        disasterEvent.status !== "ACTIVE"
      ) {
        throw createDisasterEventNotActiveError();
      }
    }

    if (transactionData.inventory_batch_id) {
      inventoryBatch =
        await inventoryTransactionRepository.getInventoryBatchByIdForUpdate(
          transactionData.inventory_batch_id,
          client,
        );

      if (inventoryBatch?.inventory_item_id) {
        inventoryItem = await inventoryItemRepository.getInventoryItemByIdForUpdate(
          inventoryBatch.inventory_item_id,
          client,
        );
      }
    } else if (transactionData.inventory_item_id) {
      const error = new Error(
        "inventory_batch_id is required for manual inventory transactions.",
      );
      error.statusCode = 400;
      throw error;
    }

    if (!inventoryBatch) {
      const error = new Error("Inventory batch not found");
      error.statusCode = 404;
      throw error;
    }

    let newQuantityAvailable = inventoryBatch.quantity_available;

    if (additiveTransactionTypes.has(transactionData.transaction_type)) {
      newQuantityAvailable += transactionData.quantity;
    } else if (subtractiveTransactionTypes.has(transactionData.transaction_type)) {
      if (inventoryBatch.quantity_available < transactionData.quantity) {
        const error = new Error(
          `Insufficient quantity_available for batch ${inventoryBatch.batch_no}`,
        );
        error.statusCode = 400;
        throw error;
      }

      newQuantityAvailable -= transactionData.quantity;
    }

    const newBatchStatus = getNextBatchStatus(
      inventoryBatch.expiration_date,
      newQuantityAvailable,
    );

    const createdTransaction =
      await inventoryTransactionRepository.insertInventoryTransaction(
        {
          ...transactionData,
          inventory_batch_id: inventoryBatch.id,
          // New callers omit the value; the database assigns it. Keep valid legacy values for queued work.
          inventory_transaction_reference_no: normalizedReferenceNo,
        },
        client,
      );

    await inventoryTransactionRepository.updateInventoryBatchQuantityAndStatus(
      inventoryBatch.id,
      newQuantityAvailable,
      newBatchStatus,
      client,
    );

    const recomputedQuantityResult = await client.query(
      `
        SELECT COALESCE(SUM(quantity_available), 0)::integer AS total_quantity
        FROM inventory_batches
        WHERE inventory_item_id = $1
      `,
      [inventoryBatch.inventory_item_id],
    );
    const nextItemQuantity = Number(
      recomputedQuantityResult.rows[0]?.total_quantity || 0,
    );
    const nextItemSnapshot = buildUpdatedItemStockSnapshot(
      inventoryItem,
      nextItemQuantity,
    );

    await inventoryItemRepository.updateInventoryItemStockSnapshot(
      inventoryBatch.inventory_item_id,
      nextItemSnapshot,
      client,
    );

    const domainSideEffect = {
      transaction: createdTransaction,
      batch: {
        id: inventoryBatch.id,
        inventory_item_id: inventoryBatch.inventory_item_id,
        batch_no: inventoryBatch.batch_no,
        quantity_available: newQuantityAvailable,
        status: newBatchStatus,
        expiration_date: inventoryBatch.expiration_date,
        item_name: inventoryBatch.item_name,
      },
      previousQuantityAvailable: inventoryBatch.quantity_available,
      previousStatus: inventoryBatch.status,
      disasterEventId: transactionData.disaster_event_id,
      actor: {
        userId: transactionData.performed_by,
        roleCode: transactionData.auditActor?.roleCode || "MAYOR",
        deviceId: transactionData.auditActor?.deviceId || null,
        ipAddress: transactionData.auditActor?.ipAddress || null,
      },
      fallbackBatch: null,
    };
    const domainEffectIntent =
      await inventoryTransactionRepository.ensureInventoryDomainEffectIntent(
        {
          inventoryTransactionId: createdTransaction.id,
          syncTransactionId,
          effectPayload: domainSideEffect,
        },
        client,
      );

    if (!externalClient) {
      await client.query("COMMIT");
      committed = true;
    }

    if (externalClient && deferDomainSideEffect) {
      deferDomainSideEffect(() =>
        processInventoryDomainEffectIntentById(domainEffectIntent.id),
      );
    } else if (!externalClient) {
      try {
        await processInventoryDomainEffectIntentById(domainEffectIntent.id);
      } catch (error) {
        await logErrorSafely({
          actor: domainSideEffect.actor,
          moduleName: "inventory",
          errorCode: "INVENTORY_DOMAIN_EFFECT_PROCESSING_FAILED",
          errorMessage:
            "Committed inventory domain effect could not be processed immediately.",
          error,
          referenceType: "INVENTORY_DOMAIN_EFFECT_INTENT",
          referenceId: domainEffectIntent.id,
        });
      }
    }

    return {
      transaction_id: createdTransaction.id,
      inventory_transaction_reference_no:
        createdTransaction.inventory_transaction_reference_no || null,
      inventory_batch_id: createdTransaction.inventory_batch_id,
      transaction_type: createdTransaction.transaction_type,
      quantity: createdTransaction.quantity,
      new_quantity_available: newQuantityAvailable,
      new_batch_status: newBatchStatus,
    };
  } catch (error) {
    if (!externalClient && !committed) {
      await client.query("ROLLBACK");
    }
    throw error;
  } finally {
    if (!externalClient) {
      client.release();
    }
  }
};

const exportInventoryTransactions = async (filters, format) => {
  const transactions = await getInventoryTransactions(filters);
  const rows = transactions.map((transaction) => ({
    transaction_type: transaction.transaction_type || "--",
    quantity: transaction.quantity ?? 0,
    inventory_transaction_reference_no:
      transaction.inventory_transaction_reference_no || "--",
    reference_type: transaction.reference_type || "--",
    performed_by: transaction.performer?.full_name || "--",
    performed_at: mayorReportExport.formatDateTime(transaction.performed_at),
    remarks: transaction.remarks || "--",
  }));

  return mayorReportExport.buildExportFile({
    filePrefix: "office-mayor-inventory-transactions",
    worksheetName: "Inventory Transactions",
    reportTitle: "Inventory Transactions Report",
    metadata: [
      { label: "Search", value: filters.search?.trim() || "None" },
      { label: "Transaction Type", value: filters.transaction_type || "All" },
      { label: "Reference Type", value: filters.reference_type || "All" },
    ],
    columns: [
      { key: "transaction_type", label: "Transaction Type", width: 20, pdfWidth: 95 },
      { key: "quantity", label: "Quantity", width: 12, pdfWidth: 55 },
      { key: "inventory_transaction_reference_no", label: "ITR No.", width: 18, pdfWidth: 85 },
      { key: "reference_type", label: "Reference Type", width: 18, pdfWidth: 90 },
      { key: "performed_by", label: "Performed By", width: 24, pdfWidth: 120 },
      { key: "performed_at", label: "Performed At", width: 22, pdfWidth: 95 },
      { key: "remarks", label: "Remarks", width: 34, pdfWidth: 300 },
    ],
    rows,
    format,
  });
};

module.exports = {
  getInventoryTransactions,
  getInventoryTransactionById,
  createInventoryTransaction,
  emitInventoryTransactionDomainSideEffects,
  processInventoryDomainEffectIntentById,
  processPendingInventoryDomainEffectIntents,
  startInventoryDomainEffectRecovery,
  initializeInventoryDomainEffectRecovery,
  exportInventoryTransactions,
};
