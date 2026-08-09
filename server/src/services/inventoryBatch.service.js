const inventoryBatchRepository = require("../repositories/inventoryBatch.repository");
const inventoryItemStockFormRepository = require("../repositories/inventoryItemStockForm.repository");
const inventoryTransactionRepository = require("../repositories/inventoryTransaction.repository");
const systemLogRepository = require("../repositories/systemLog.repository");
const mayorReportExport = require("../utils/mayorReportExport");
const notificationService = require("../modules/notifications/notification.service");
const { logAuditSafely, pickDefined } = require("../utils/systemLog");
const { createInventoryStateBasis } = require("../utils/inventoryStateBasis");
const {
  createDuplicateInventoryBatchError,
} = require("../utils/inventoryBatchIdentity");

const buildFullName = (firstName, lastName) =>
  [firstName, lastName].filter(Boolean).join(" ").trim();

const mapInventoryBatch = (batch) => {
  return {
    id: batch.id,
    inventory_item_id: batch.inventory_item_id,
    inventory_item_stock_form_id: batch.inventory_item_stock_form_id,
    batch_no: batch.batch_no,
    supplier_id: batch.supplier_id,
    source_type: batch.source_type,
    quantity_received: batch.quantity_received,
    quantity_available: batch.quantity_available,
    stock_version: batch.stock_version,
    inventoryStateBasis: createInventoryStateBasis(batch),
    expiration_date: batch.expiration_date,
    received_at: batch.received_at,
    storage_location: batch.storage_location,
    status: batch.status,
    created_by: batch.created_by,
    created_at: batch.created_at,
    updated_at: batch.updated_at,
    inventory_item: {
      id: batch.inventory_item_id,
      item_code: batch.item_code,
      item_name: batch.item_name,
      category: batch.category,
      unit_of_measure: batch.unit_of_measure,
      barcode: batch.barcode,
      is_perishable: batch.is_perishable,
      is_active: batch.is_active,
    },
    inventory_item_stock_form: batch.inventory_item_stock_form_id
      ? {
          id: batch.inventory_item_stock_form_id,
          barcode: batch.stock_form_barcode,
          packaging: batch.stock_form_packaging,
          units_per_packaging: batch.stock_form_units_per_packaging,
          unit_of_measure: batch.stock_form_unit_of_measure,
          unit_of_measure_value: batch.stock_form_unit_of_measure_value,
          is_active: batch.stock_form_is_active,
        }
      : null,
    supplier: batch.supplier_id
      ? {
          id: batch.supplier_id,
          name: batch.supplier_name,
          contact_person: batch.supplier_contact_person,
          contact_number: batch.supplier_contact_number,
          address: batch.supplier_address,
          has_moa: batch.supplier_has_moa,
          notes: batch.supplier_notes,
        }
      : null,
    donation: batch.source_donation_id
      ? {
          id: batch.source_donation_id,
          donor_name: batch.source_donor_name || null,
        }
      : null,
    creator: batch.created_by
      ? {
          id: batch.created_by,
          full_name:
            buildFullName(
              batch.created_by_first_name,
              batch.created_by_last_name,
            ) || "--",
        }
      : null,
  };
};

const summarizeInventoryBatch = (batch) =>
  pickDefined(batch, [
    "inventory_item_id",
    "inventory_item_stock_form_id",
    "batch_no",
    "supplier_id",
    "source_type",
    "quantity_received",
    "quantity_available",
    "expiration_date",
    "received_at",
    "storage_location",
    "status",
    "created_by",
  ]);

const getInitialStatus = (expirationDate) => {
  if (!expirationDate) {
    return "AVAILABLE";
  }

  const today = new Date();
  const todayDateOnly = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const expiration = new Date(expirationDate);

  if (expiration < todayDateOnly) {
    return "EXPIRED";
  }

  return "AVAILABLE";
};

const getBatchStatusFromQuantityAndExpiry = (quantityAvailable, expirationDate) => {
  const resolvedQuantity = Number(quantityAvailable || 0);

  if (resolvedQuantity <= 0) {
    return "DEPLETED";
  }

  if (expirationDate) {
    const today = new Date();
    const todayDateOnly = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const resolvedExpirationDate = new Date(expirationDate);

    if (resolvedExpirationDate < todayDateOnly) {
      return "EXPIRED";
    }
  }

  if (resolvedQuantity <= 10) {
    return "LOW_STOCK";
  }

  return "AVAILABLE";
};

const normalizeStockFormDefinition = (batchData, inventoryItem) => {
  const packaging = String(
    batchData.stock_form_packaging || inventoryItem.packaging || "piece",
  )
    .trim()
    .toLowerCase();
  const unitsPerPackaging = Number(
    batchData.stock_form_units_per_packaging ??
      (packaging === "piece" ? 1 : null),
  );
  const unitOfMeasure = String(
    batchData.stock_form_unit_of_measure || inventoryItem.unit_of_measure || "pc",
  ).trim();
  const rawUnitValue =
    batchData.stock_form_unit_of_measure_value ??
    inventoryItem.unit_of_measure_value ??
    null;
  const unitOfMeasureValue =
    rawUnitValue === null || rawUnitValue === undefined || rawUnitValue === ""
      ? null
      : Number(rawUnitValue);

  if (!packaging) {
    return null;
  }

  if (!Number.isInteger(unitsPerPackaging) || unitsPerPackaging <= 0) {
    return null;
  }

  if (!unitOfMeasure) {
    return null;
  }

  if (
    unitOfMeasureValue !== null &&
    (!Number.isFinite(unitOfMeasureValue) || unitOfMeasureValue <= 0)
  ) {
    return null;
  }

  return {
    inventory_item_id: inventoryItem.id,
    barcode: batchData.stock_form_barcode || null,
    packaging,
    units_per_packaging: unitsPerPackaging,
    unit_of_measure: unitOfMeasure,
    unit_of_measure_value: unitOfMeasureValue,
    is_active: true,
  };
};

const getInventoryBatches = async (filters) => {
  const batches = await inventoryBatchRepository.getInventoryBatches(filters);
  return batches.map(mapInventoryBatch);
};

const getInventoryBatchById = async (id) => {
  const batch = await inventoryBatchRepository.getInventoryBatchById(id);

  if (!batch) {
    return null;
  }

  return mapInventoryBatch(batch);
};

const mapAuditLogRow = (row) => ({
  id: row.id,
  action: row.action,
  entity_type: row.entity_type,
  entity_id: row.entity_id,
  role_code: row.role_code,
  created_at: row.created_at,
  actor_name: [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || row.email || "Unknown User",
  old_values_json: row.old_values_json || {},
  new_values_json: row.new_values_json || {},
});

const buildBatchAlerts = (batch) => {
  const alerts = [];
  const quantityAvailable = Number(batch?.quantity_available || 0);

  if (quantityAvailable <= 10) {
    alerts.push("Low stock threshold reached");
  }

  if (batch?.status === "EXPIRED") {
    alerts.push("Batch is expired");
  } else if (batch?.expiration_date) {
    const expirationDate = new Date(batch.expiration_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expirationDate.setHours(0, 0, 0, 0);

    if (!Number.isNaN(expirationDate.getTime()) && expirationDate >= today) {
      const daysUntilExpiry =
        (expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);

      if (daysUntilExpiry <= 30) {
        alerts.push("Near expiry");
      }
    }
  }

  return alerts;
};

const getInventoryBatchDetail = async (id) => {
  const [batch, relatedTransactions, auditLogs] = await Promise.all([
    inventoryBatchRepository.getInventoryBatchById(id),
    inventoryTransactionRepository.getInventoryTransactions({ inventory_batch_id: id }),
    systemLogRepository.getAuditLogsByEntity({
      entityType: "INVENTORY_BATCH",
      entityId: id,
      limit: 20,
    }),
  ]);

  if (!batch) {
    return null;
  }

  return {
    batch: mapInventoryBatch(batch),
    related_transactions: relatedTransactions,
    alerts: buildBatchAlerts(batch),
    audit_history: auditLogs.map(mapAuditLogRow),
  };
};

const createInventoryBatch = async (batchData) => {
  const dbClient = batchData.dbClient || null;
  const inventoryItem = await inventoryBatchRepository.getInventoryItemById(
    batchData.inventory_item_id,
    dbClient || undefined,
  );

  if (!inventoryItem) {
    const error = new Error("inventory_item_id does not refer to an existing inventory item");
    error.statusCode = 400;
    throw error;
  }

  if (batchData.supplier_id) {
    const supplier = await inventoryBatchRepository.getSupplierById(
      batchData.supplier_id,
      dbClient || undefined,
    );

    if (!supplier) {
      const error = new Error("supplier_id does not refer to an existing supplier");
      error.statusCode = 400;
      throw error;
    }
  }

  let resolvedStockFormId = batchData.inventory_item_stock_form_id || null;

  if (resolvedStockFormId) {
    const stockForm =
      await inventoryItemStockFormRepository.getInventoryItemStockFormById(
        resolvedStockFormId,
        dbClient || undefined,
      );

    if (!stockForm) {
      const error = new Error(
        "inventory_item_stock_form_id does not refer to an existing stock form",
      );
      error.statusCode = 400;
      throw error;
    }

    if (String(stockForm.inventory_item_id) !== String(batchData.inventory_item_id)) {
      const error = new Error(
        "inventory_item_stock_form_id does not belong to the selected inventory_item_id",
      );
      error.statusCode = 400;
      throw error;
    }
  } else {
    const stockForms =
      await inventoryItemStockFormRepository.getInventoryItemStockFormsByItemId(
        batchData.inventory_item_id,
        dbClient || undefined,
      );

    const stockFormDefinition = normalizeStockFormDefinition(
      batchData,
      inventoryItem,
    );

    if (stockFormDefinition) {
      const matchedStockForm =
        await inventoryItemStockFormRepository.getInventoryItemStockFormByDefinition(
          stockFormDefinition,
          dbClient || undefined,
        );

      if (matchedStockForm) {
        resolvedStockFormId = matchedStockForm.id;
      } else {
        const createdStockForm =
          await inventoryItemStockFormRepository.insertInventoryItemStockForm(
            stockFormDefinition,
            dbClient || undefined,
          );
        resolvedStockFormId = createdStockForm.id;
      }
    } else if (stockForms.length === 1) {
      resolvedStockFormId = stockForms[0].id;
    } else if (stockForms.length > 1) {
      const error = new Error(
        "inventory_item_stock_form_id is required when the item has multiple stock forms",
      );
      error.statusCode = 400;
      throw error;
    }
  }

  const existingBatch =
    await inventoryBatchRepository.getInventoryBatchByItemIdAndBatchNo(
      batchData.inventory_item_id,
      batchData.batch_no,
      dbClient || undefined,
    );

  if (existingBatch) {
    throw createDuplicateInventoryBatchError(existingBatch);
  }

  const createdBatch = await inventoryBatchRepository.insertInventoryBatch({
    ...batchData,
    inventory_item_stock_form_id: resolvedStockFormId,
    quantity_available: batchData.quantity_received,
    status: getInitialStatus(batchData.expiration_date),
  }, dbClient || undefined);

  if (!createdBatch) {
    const authoritativeBatch =
      await inventoryBatchRepository.getInventoryBatchByItemIdAndBatchNo(
        batchData.inventory_item_id,
        batchData.batch_no,
        dbClient || undefined,
      );

    throw createDuplicateInventoryBatchError(authoritativeBatch);
  }

  const fullBatch = await inventoryBatchRepository.getInventoryBatchById(
    createdBatch.id,
    dbClient || undefined,
  );

  const mappedBatch = mapInventoryBatch(fullBatch);

  if (!dbClient) {
    await notificationService.emitSafely(() =>
      notificationService.emitBatchAlerts({
        batch: mappedBatch,
      }),
    );

    await logAuditSafely({
      actor: {
        userId: batchData.created_by,
        roleCode: "MAYOR",
      },
      action: "INVENTORY_BATCH_CREATE",
      entityType: "INVENTORY_BATCH",
      entityId: mappedBatch.id,
      oldValues: {},
      newValues: summarizeInventoryBatch(mappedBatch),
    });
  }

  return mappedBatch;
};

const updateInventoryBatchExpiry = async (id, payload, actor = null) => {
  const existingBatch = await inventoryBatchRepository.getInventoryBatchById(id);

  if (!existingBatch) {
    const error = new Error("Inventory batch not found");
    error.statusCode = 404;
    throw error;
  }

  const nextStatus = getBatchStatusFromQuantityAndExpiry(
    existingBatch.quantity_available,
    payload.expiration_date,
  );

  const updatedBatch = await inventoryBatchRepository.updateInventoryBatchExpiry(
    id,
    {
      expiration_date: payload.expiration_date,
      status: nextStatus,
    },
  );

  const fullBatch = await inventoryBatchRepository.getInventoryBatchById(
    updatedBatch.id,
  );
  const mappedBatch = mapInventoryBatch(fullBatch);

  await notificationService.emitSafely(() =>
    notificationService.emitBatchAlerts({
      batch: mappedBatch,
    }),
  );

  await logAuditSafely({
    actor,
    action: "INVENTORY_BATCH_UPDATE",
    entityType: "INVENTORY_BATCH",
    entityId: mappedBatch.id,
    oldValues: summarizeInventoryBatch(existingBatch),
    newValues: summarizeInventoryBatch(mappedBatch),
  });

  return mappedBatch;
};

const exportInventoryBatches = async (filters, format) => {
  const batches = await getInventoryBatches(filters);

  const rows = batches.map((batch) => ({
    batch_no: batch.batch_no || "--",
    item_name: batch.inventory_item?.item_name || "--",
    quantity_received: batch.quantity_received ?? 0,
    quantity_available: batch.quantity_available ?? 0,
    expiration_date: mayorReportExport.formatDateOnly(batch.expiration_date),
    status: batch.status || "--",
    supplier: batch.supplier?.name || "--",
    received_at: mayorReportExport.formatDateTime(batch.received_at),
  }));

  return mayorReportExport.buildExportFile({
    filePrefix: "office-mayor-inventory-batches",
    worksheetName: "Inventory Batches",
    reportTitle: "Inventory Batches Report",
    metadata: [
      { label: "Search", value: filters.search?.trim() || "None" },
      { label: "Source Type", value: filters.source_type || "All" },
      { label: "Status", value: filters.status || "All" },
    ],
    columns: [
      { key: "batch_no", label: "Batch No", width: 24, pdfWidth: 85 },
      { key: "item_name", label: "Item Name", width: 28, pdfWidth: 140 },
      { key: "quantity_received", label: "Quantity Received", width: 20, pdfWidth: 70 },
      { key: "quantity_available", label: "Quantity Available", width: 20, pdfWidth: 70 },
      { key: "expiration_date", label: "Expiration Date", width: 20, pdfWidth: 88 },
      { key: "status", label: "Status", width: 18, pdfWidth: 70 },
      { key: "supplier", label: "Supplier", width: 26, pdfWidth: 130 },
      { key: "received_at", label: "Received At", width: 22, pdfWidth: 109 },
    ],
    rows,
    format,
  });
};

module.exports = {
  getInventoryBatches,
  getInventoryBatchById,
  getInventoryBatchDetail,
  createInventoryBatch,
  updateInventoryBatchExpiry,
  exportInventoryBatches,
};
