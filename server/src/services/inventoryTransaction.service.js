const pool = require("../config/db");
const inventoryTransactionRepository = require("../repositories/inventoryTransaction.repository");
const mayorReportExport = require("../utils/mayorReportExport");
const notificationService = require("../modules/notifications/notification.service");
const { logAuditSafely, pickDefined } = require("../utils/systemLog");

const additiveTransactionTypes = new Set(["INFLOW", "RETURN", "ADJUSTMENT"]);
const subtractiveTransactionTypes = new Set([
  "OUTFLOW",
  "EXPIRED",
  "MISSING",
  "DAMAGED",
  "SPOILED",
  "STOLEN",
]);

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

const mapInventoryTransaction = (transaction) => {
  return {
    id: transaction.id,
    disaster_event_id: transaction.disaster_event_id,
    inventory_batch_id: transaction.inventory_batch_id,
    transaction_type: transaction.transaction_type,
    quantity: transaction.quantity,
    reference_type: transaction.reference_type,
    reference_id: transaction.reference_id,
    performed_by: transaction.performed_by,
    performed_at: transaction.performed_at,
    remarks: transaction.remarks,
    created_at: transaction.created_at,
    inventory_batch: {
      id: transaction.inventory_batch_id,
      batch_no: transaction.batch_no,
      status: transaction.batch_status,
      quantity_available: transaction.quantity_available,
    },
    inventory_item: {
      id: transaction.inventory_item_id,
      item_code: transaction.item_code,
      item_name: transaction.item_name,
    },
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
    "performed_by",
    "performed_at",
    "remarks",
  ]);

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
  if (transactionData.disaster_event_id) {
    const disasterEvent = await inventoryTransactionRepository.getDisasterEventById(
      transactionData.disaster_event_id,
    );

    if (!disasterEvent) {
      const error = new Error(
        "disaster_event_id does not refer to an existing disaster event",
      );
      error.statusCode = 400;
      throw error;
    }
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

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const inventoryBatch =
      await inventoryTransactionRepository.getInventoryBatchByIdForUpdate(
        transactionData.inventory_batch_id,
        client,
      );

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
        transactionData,
        client,
      );

    await inventoryTransactionRepository.updateInventoryBatchQuantityAndStatus(
      transactionData.inventory_batch_id,
      newQuantityAvailable,
      newBatchStatus,
      client,
    );

    await client.query("COMMIT");

    await notificationService.emitSafely(() =>
      notificationService.emitInventoryTransactionAlerts({
        transaction: createdTransaction,
        batch: {
          id: inventoryBatch.id,
          batch_no: inventoryBatch.batch_no,
          quantity_available: newQuantityAvailable,
          status: newBatchStatus,
          expiration_date: inventoryBatch.expiration_date,
          item_name: inventoryBatch.item_name,
        },
        previousQuantityAvailable: inventoryBatch.quantity_available,
        previousStatus: inventoryBatch.status,
        disasterEventId: transactionData.disaster_event_id,
      }),
    );

    await logAuditSafely({
      actor: {
        userId: transactionData.performed_by,
        roleCode: "MAYOR",
      },
      action: "INVENTORY_TRANSACTION_CREATE",
      entityType: "INVENTORY_TRANSACTION",
      entityId: createdTransaction.id,
      oldValues: {},
      newValues: summarizeInventoryTransaction(createdTransaction),
    });

    return {
      transaction_id: createdTransaction.id,
      inventory_batch_id: createdTransaction.inventory_batch_id,
      transaction_type: createdTransaction.transaction_type,
      quantity: createdTransaction.quantity,
      new_quantity_available: newQuantityAvailable,
      new_batch_status: newBatchStatus,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const exportInventoryTransactions = async (filters, format) => {
  const transactions = await getInventoryTransactions(filters);
  const rows = transactions.map((transaction) => ({
    transaction_type: transaction.transaction_type || "--",
    quantity: transaction.quantity ?? 0,
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
  exportInventoryTransactions,
};
