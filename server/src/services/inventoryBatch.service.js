const pool = require("../config/db");
const inventoryBatchRepository = require("../repositories/inventoryBatch.repository");
const inventoryItemRepository = require("../repositories/inventoryItem.repository");
const inventoryItemStockFormRepository = require("../repositories/inventoryItemStockForm.repository");
const inventoryTransactionRepository = require("../repositories/inventoryTransaction.repository");
const systemLogRepository = require("../repositories/systemLog.repository");
const mayorReportExport = require("../utils/mayorReportExport");
const notificationService = require("../modules/notifications/notification.service");
const inventoryBatchStatusService = require("./inventoryBatchStatus.service");
const { logAuditSafely, pickDefined } = require("../utils/systemLog");
const { createInventoryStateBasis } = require("../utils/inventoryStateBasis");
const {
  createDuplicateInventoryBatchError,
} = require("../utils/inventoryBatchIdentity");
const {
  createDuplicateInventoryBarcodeError,
} = require("../utils/inventoryItemIdentity");
const {
  INVENTORY_BATCH_STORAGE_LOCATION_MAX_LENGTH,
  isInventoryBatchStorageLocationLengthValid,
} = require("../utils/inventoryBatchStorageLocation");
const {
  isValidInventoryBarcode,
  normalizeInventoryBarcode,
} = require("../utils/inventoryBarcode");
const {
  getInventoryBatchStatus,
  isInventoryBatchExpired,
  isInventoryBatchNearExpiry,
  isInventoryBatchLowStock,
  isInventoryBatchDerivedStatus,
} = require("../utils/inventoryBatchStatus");

const buildFullName = (firstName, lastName) =>
  [firstName, lastName].filter(Boolean).join(" ").trim();

const mapInventoryBatch = (batch) => {
  return {
    id: batch.id,
    inventory_item_id: batch.inventory_item_id,
    inventory_item_stock_form_id: batch.inventory_item_stock_form_id,
    batch_no: batch.batch_no,
    source_type: batch.source_type,
    source_donation_type: batch.source_donation_type || null,
    source_donation_disaster_event_id:
      batch.source_donation_disaster_event_id || null,
    source_donation_status: batch.source_donation_status || null,
    source_donation_received_at: batch.source_donation_received_at || null,
    source_donation_created_at: batch.source_donation_created_at || null,
    source_donation_item_id: batch.source_donation_item_id || null,
    quantity_received: batch.quantity_received,
    quantity_available: batch.quantity_available,
    stock_version: batch.stock_version,
    inventoryStateBasis: createInventoryStateBasis(batch),
    item_total_stock: batch.item_total_stock,
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
      reorder_level: batch.reorder_level,
      barcode: batch.barcode,
      is_perishable: batch.is_perishable,
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
    donation: batch.source_donation_id
      ? {
          id: batch.source_donation_id,
          donor_name: batch.source_donor_name || null,
          donation_item_id: batch.source_donation_item_id || null,
          disaster_event_id: batch.source_donation_disaster_event_id || null,
          status: batch.source_donation_status || null,
          donation_type: batch.source_donation_type || null,
          received_at: batch.source_donation_received_at || null,
          created_at: batch.source_donation_created_at || null,
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

const summarizeInventoryBatch = (batch) => {
  const summary = pickDefined(batch, [
    "inventory_item_id",
    "inventory_item_stock_form_id",
    "batch_no",
    "source_type",
    "quantity_received",
    "quantity_available",
    "expiration_date",
    "received_at",
    "storage_location",
    "status",
    "created_by",
  ]);

  if (batch?.batch_number_was_reassigned) {
    summary.batch_number_was_reassigned = true;
    summary.requested_batch_no = batch.requested_batch_no || null;
  }

  return summary;
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
    barcode: normalizeInventoryBarcode(batchData.stock_form_barcode) || null,
    packaging,
    units_per_packaging: unitsPerPackaging,
    unit_of_measure: unitOfMeasure,
    unit_of_measure_value: unitOfMeasureValue,
    is_active: true,
  };
};

const areStockFormDefinitionsEqual = (stockForm, stockFormDefinition) => {
  const normalizeNullableNumber = (value) => {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  };

  return (
    String(stockForm?.packaging || "").trim().toLowerCase() ===
      String(stockFormDefinition?.packaging || "").trim().toLowerCase() &&
    Number(stockForm?.units_per_packaging || 0) ===
      Number(stockFormDefinition?.units_per_packaging || 0) &&
    String(stockForm?.unit_of_measure || "").trim().toLowerCase() ===
      String(stockFormDefinition?.unit_of_measure || "").trim().toLowerCase() &&
    normalizeNullableNumber(stockForm?.unit_of_measure_value) ===
      normalizeNullableNumber(stockFormDefinition?.unit_of_measure_value)
  );
};

const hasStockFormDefinitionInput = (batchData) =>
  [
    batchData?.stock_form_packaging,
    batchData?.stock_form_units_per_packaging,
    batchData?.stock_form_unit_of_measure,
    batchData?.stock_form_unit_of_measure_value,
  ].some((value) => value !== undefined && value !== null && value !== "");

const MAX_BATCH_NUMBER_REASSIGNMENT_ATTEMPTS = 1000;

const buildBatchNumberCandidate = (requestedBatchNo, offset) => {
  const normalizedBatchNo = String(requestedBatchNo || "").trim();

  if (offset === 0) {
    return normalizedBatchNo;
  }

  const numericSuffixMatch = normalizedBatchNo.match(/^(.*?)(\d+)$/);

  if (numericSuffixMatch) {
    const [, prefix, numericSuffix] = numericSuffixMatch;
    const startingNumber = Number(numericSuffix);
    const candidateNumber = startingNumber + offset;

    if (
      Number.isSafeInteger(startingNumber) &&
      Number.isSafeInteger(candidateNumber)
    ) {
      return `${prefix}${String(candidateNumber).padStart(
        numericSuffix.length,
        "0",
      )}`;
    }
  }

  return `${normalizedBatchNo}-${offset + 1}`;
};

const findAvailableBatchNumber = async ({
  inventoryItemId,
  requestedBatchNo,
  startingOffset = 1,
  dbClient,
}) => {
  const normalizedStartingOffset = Math.max(1, Number(startingOffset) || 1);

  for (
    let offset = normalizedStartingOffset;
    offset <= MAX_BATCH_NUMBER_REASSIGNMENT_ATTEMPTS;
    offset += 1
  ) {
    const candidateBatchNo = buildBatchNumberCandidate(
      requestedBatchNo,
      offset,
    );
    const existingBatch =
      await inventoryBatchRepository.getInventoryBatchByItemIdAndBatchNo(
        inventoryItemId,
        candidateBatchNo,
        dbClient || undefined,
      );

    if (!existingBatch) {
      return {
        batchNo: candidateBatchNo,
        offset,
      };
    }
  }

  return null;
};

const areBatchPackagingDefinitionsEqual = ({
  existingBatch,
  requestedStockFormId,
  batchData,
  inventoryItem,
}) => {
  const existingStockFormId = existingBatch?.inventory_item_stock_form_id || null;
  const normalizedRequestedStockFormId = requestedStockFormId || null;

  if (existingStockFormId && normalizedRequestedStockFormId) {
    return String(existingStockFormId) === String(normalizedRequestedStockFormId);
  }

  const requestedDefinition = normalizeStockFormDefinition(
    batchData,
    inventoryItem,
  );

  if (!requestedDefinition) {
    return false;
  }

  const existingDefinition = {
    packaging:
      existingBatch?.stock_form_packaging || inventoryItem?.packaging || "piece",
    units_per_packaging:
      existingBatch?.stock_form_units_per_packaging ??
      (String(existingBatch?.stock_form_packaging || inventoryItem?.packaging || "piece")
        .trim()
        .toLowerCase() === "piece"
        ? 1
        : null),
    unit_of_measure:
      existingBatch?.stock_form_unit_of_measure ||
      inventoryItem?.unit_of_measure ||
      "pc",
    unit_of_measure_value:
      existingBatch?.stock_form_unit_of_measure_value ??
      inventoryItem?.unit_of_measure_value ??
      null,
  };

  return areStockFormDefinitionsEqual(existingDefinition, requestedDefinition);
};

const validateBarcodeAssignmentTarget = async ({
  batchData,
  inventoryItem,
  stockForm,
  dbClient,
}) => {
  const barcode = normalizeInventoryBarcode(batchData.stock_form_barcode);

  if (!barcode) {
    const error = new Error(
      "A barcode is required when assigning a barcode to existing packaging",
    );
    error.statusCode = 400;
    throw error;
  }

  if (String(stockForm.barcode || "").trim()) {
    const error = new Error(
      "This packaging already has a barcode and cannot be reassigned",
    );
    error.statusCode = 400;
    throw error;
  }

  if (
    typeof inventoryItemRepository.getInventoryItemByBarcode === "function"
  ) {
    const itemBarcodeOwner =
      await inventoryItemRepository.getInventoryItemByBarcode(
        barcode,
        dbClient || undefined,
      );

    if (
      itemBarcodeOwner &&
      String(itemBarcodeOwner.id) !== String(inventoryItem.id)
    ) {
      throw createDuplicateInventoryBarcodeError({
        existingItem: itemBarcodeOwner,
      });
    }
  }

  const barcodeOwner =
    await inventoryItemStockFormRepository.getInventoryItemStockFormByBarcode(
      barcode,
      dbClient || undefined,
    );

  if (barcodeOwner && String(barcodeOwner.id) !== String(stockForm.id)) {
    const existingItem =
      typeof inventoryItemRepository.getInventoryItemById === "function"
        ? await inventoryItemRepository.getInventoryItemById(
            barcodeOwner.inventory_item_id,
            dbClient || undefined,
          )
        : null;

    throw createDuplicateInventoryBarcodeError({
      existingItem,
      existingStockForm: barcodeOwner,
      packagingConflict: true,
    });
  }

  const stockFormDefinition = normalizeStockFormDefinition(
    batchData,
    inventoryItem,
  );

  if (
    hasStockFormDefinitionInput(batchData) &&
    (!stockFormDefinition || !areStockFormDefinitionsEqual(stockForm, stockFormDefinition))
  ) {
    const error = new Error(
      "The selected packaging does not match the existing stock form",
    );
    error.statusCode = 400;
    throw error;
  }

  return {
    ...stockForm,
    barcode,
    is_active: stockForm.is_active ?? true,
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
  const reorderLevel = Number(
    batch?.inventory_item?.reorder_level ?? batch?.reorder_level ?? 0,
  );
  const totalQuantityAvailable = Number(
    batch?.item_total_stock ?? quantityAvailable,
  );

  if (
    isInventoryBatchLowStock({
      quantityAvailable,
      totalQuantityAvailable,
      reorderLevel,
    })
  ) {
    alerts.push("Low stock threshold reached");
  }

  if (
    quantityAvailable > 0 &&
    (batch?.status === "EXPIRED" ||
      isInventoryBatchExpired(batch?.expiration_date))
  ) {
    alerts.push("Batch is expired");
  } else if (
    quantityAvailable > 0 &&
    isInventoryBatchNearExpiry(batch?.expiration_date)
  ) {
    alerts.push("Near expiry");
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

const emitInventoryBatchCreatedSideEffects = async (mappedBatch, batchData) => {
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

  if (batchData.inventory_item_reorder_level !== undefined) {
    await logAuditSafely({
      actor: {
        userId: batchData.created_by,
        roleCode: "MAYOR",
      },
      action: "INVENTORY_ITEM_REORDER_LEVEL_UPDATE",
      entityType: "INVENTORY_ITEM",
      entityId: batchData.inventory_item_id,
      oldValues: {},
      newValues: {
        reorder_level: batchData.inventory_item_reorder_level,
      },
    });
  }
};

const createInventoryBatchWithoutTransaction = async (batchData) => {
  const dbClient = batchData.dbClient || null;
  const allowBatchNumberReassignment =
    batchData.allowBatchNumberReassignment === true;
  const forceBatchNumberReassignment =
    batchData.forceBatchNumberReassignment === true;
  const requestedBatchNo = String(batchData.batch_no || "").trim();
  let resolvedBatchNo = requestedBatchNo;
  let resolvedBatchNumberOffset = 0;
  let batchNumberWasReassigned = false;
  const inventoryItem =
    typeof inventoryItemRepository.getInventoryItemByIdForUpdate === "function"
      ? await inventoryItemRepository.getInventoryItemByIdForUpdate(
          batchData.inventory_item_id,
          dbClient || undefined,
        )
      : await inventoryBatchRepository.getInventoryItemById(
          batchData.inventory_item_id,
          dbClient || undefined,
        );

  if (!inventoryItem) {
    const error = new Error("inventory_item_id does not refer to an existing inventory item");
    error.statusCode = 400;
    throw error;
  }

  const normalizedStockFormBarcode = normalizeInventoryBarcode(
    batchData.stock_form_barcode,
  );

  if (
    normalizedStockFormBarcode &&
    !isValidInventoryBarcode(normalizedStockFormBarcode)
  ) {
    const error = new Error("stock_form_barcode must contain 8 to 18 digits");
    error.statusCode = 400;
    throw error;
  }

  if (
    normalizedStockFormBarcode &&
    typeof inventoryItemRepository.getInventoryItemByBarcode === "function"
  ) {
    const itemBarcodeOwner =
      await inventoryItemRepository.getInventoryItemByBarcode(
        normalizedStockFormBarcode,
        dbClient || undefined,
      );

    if (
      itemBarcodeOwner &&
      String(itemBarcodeOwner.id) !== String(inventoryItem.id)
    ) {
      throw createDuplicateInventoryBarcodeError({
        existingItem: itemBarcodeOwner,
      });
    }
  }

  if (
    batchData.inventory_item_reorder_level !== undefined &&
    (!Number.isInteger(batchData.inventory_item_reorder_level) ||
      batchData.inventory_item_reorder_level <= 0)
  ) {
    const error = new Error(
      "inventory_item_reorder_level must be a positive integer when provided",
    );
    error.statusCode = 400;
    throw error;
  }

  let resolvedStockFormId = batchData.inventory_item_stock_form_id || null;
  let barcodeAssignmentTarget = null;

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

    if (stockForm.is_active === false) {
      const error = new Error("The selected packaging is inactive");
      error.statusCode = 400;
      throw error;
    }

    const stockFormDefinition = normalizeStockFormDefinition(
      batchData,
      inventoryItem,
    );

    if (
      hasStockFormDefinitionInput(batchData) &&
      (!stockFormDefinition || !areStockFormDefinitionsEqual(stockForm, stockFormDefinition))
    ) {
      const error = new Error(
        "The selected packaging does not match the submitted packaging details",
      );
      error.statusCode = 400;
      throw error;
    }

    const existingStockFormBarcode = normalizeInventoryBarcode(stockForm.barcode);

    if (normalizedStockFormBarcode) {
      if (
        existingStockFormBarcode &&
        existingStockFormBarcode !== normalizedStockFormBarcode
      ) {
        const error = new Error(
          "This packaging already has a different barcode. Choose different packaging details.",
        );
        error.statusCode = 409;
        throw error;
      }

      if (!existingStockFormBarcode) {
        barcodeAssignmentTarget = await validateBarcodeAssignmentTarget({
          batchData,
          inventoryItem,
          stockForm,
          dbClient,
        });
      }
    }
  } else {
    const stockForms =
      await inventoryItemStockFormRepository.getInventoryItemStockFormsByItemId(
        batchData.inventory_item_id,
        dbClient || undefined,
      );
    const activeStockForms = stockForms.filter(
      (stockForm) => stockForm?.is_active !== false,
    );

    const stockFormDefinition = normalizeStockFormDefinition(
      batchData,
      inventoryItem,
    );

    if (!stockFormDefinition && normalizedStockFormBarcode) {
      const error = new Error(
        "Packaging details are required when adding a barcode",
      );
      error.statusCode = 400;
      throw error;
    }

    const hasBarcodeStockForm =
      Boolean(String(inventoryItem.barcode || "").trim()) ||
      activeStockForms.some((stockForm) =>
        Boolean(String(stockForm?.barcode || "").trim()),
      );

    if (
      stockFormDefinition &&
      hasBarcodeStockForm &&
      !String(stockFormDefinition.barcode || "").trim()
    ) {
      const error = new Error(
        "barcode is required when adding a new packaging to a barcode-managed item",
      );
      error.statusCode = 400;
      throw error;
    }

    const matchingStockForm = stockFormDefinition
      ? activeStockForms.find((stockForm) =>
          areStockFormDefinitionsEqual(stockForm, stockFormDefinition),
        ) || null
      : null;

    if (
      stockFormDefinition?.barcode &&
      typeof inventoryItemStockFormRepository.getInventoryItemStockFormByBarcode ===
        "function"
    ) {
      const barcodeOwner =
        await inventoryItemStockFormRepository.getInventoryItemStockFormByBarcode(
          stockFormDefinition.barcode,
          dbClient || undefined,
        );

      if (
        barcodeOwner &&
        (barcodeOwner.is_active === false ||
          String(barcodeOwner.inventory_item_id) !== String(inventoryItem.id) ||
          !areStockFormDefinitionsEqual(barcodeOwner, stockFormDefinition))
      ) {
        const existingItem =
          typeof inventoryItemRepository.getInventoryItemById === "function"
            ? await inventoryItemRepository.getInventoryItemById(
                barcodeOwner.inventory_item_id,
                dbClient || undefined,
              )
            : null;

        throw createDuplicateInventoryBarcodeError({
          existingItem,
          existingStockForm: barcodeOwner,
          packagingConflict: true,
        });
      }
    }

    if (stockFormDefinition) {
      if (matchingStockForm) {
        const existingStockFormBarcode = normalizeInventoryBarcode(
          matchingStockForm.barcode,
        );

        if (
          existingStockFormBarcode &&
          existingStockFormBarcode !== stockFormDefinition.barcode
        ) {
          const error = new Error(
            "This packaging already has a different barcode. Choose different packaging details.",
          );
          error.statusCode = 409;
          throw error;
        }

        resolvedStockFormId = matchingStockForm.id;

        if (stockFormDefinition.barcode && !existingStockFormBarcode) {
          barcodeAssignmentTarget = await validateBarcodeAssignmentTarget({
            batchData,
            inventoryItem,
            stockForm: matchingStockForm,
            dbClient,
          });
        }
      } else {
        const createdStockForm =
          await inventoryItemStockFormRepository.insertInventoryItemStockForm(
            stockFormDefinition,
            dbClient || undefined,
          );
        resolvedStockFormId = createdStockForm.id;
      }
    } else if (activeStockForms.length === 1) {
      resolvedStockFormId = activeStockForms[0].id;
    } else if (activeStockForms.length > 1) {
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
    const samePackaging = areBatchPackagingDefinitionsEqual({
      existingBatch,
      requestedStockFormId: resolvedStockFormId,
      batchData,
      inventoryItem,
    });

    if (
      !allowBatchNumberReassignment ||
      (samePackaging && !forceBatchNumberReassignment)
    ) {
      throw createDuplicateInventoryBatchError(existingBatch);
    }

    const availableBatchNumber = await findAvailableBatchNumber({
      inventoryItemId: batchData.inventory_item_id,
      requestedBatchNo,
      startingOffset: 1,
      dbClient,
    });

    if (!availableBatchNumber) {
      throw createDuplicateInventoryBatchError(existingBatch);
    }

    resolvedBatchNo = availableBatchNumber.batchNo;
    resolvedBatchNumberOffset = availableBatchNumber.offset;
    batchNumberWasReassigned = true;
  }

  if (batchData.inventory_item_reorder_level !== undefined) {
    const updatedItem =
      await inventoryItemRepository.updateInventoryItemReorderLevel(
        batchData.inventory_item_id,
        batchData.inventory_item_reorder_level,
        dbClient || undefined,
      );

    if (!updatedItem) {
      const error = new Error("The inventory item could not be updated");
      error.statusCode = 404;
      throw error;
    }
  }

  if (barcodeAssignmentTarget) {
    const updatedStockForm =
      await inventoryItemStockFormRepository.updateInventoryItemStockForm(
        barcodeAssignmentTarget.id,
        barcodeAssignmentTarget,
        dbClient || undefined,
      );

    if (!updatedStockForm) {
      const error = new Error("The selected stock form could not be updated");
      error.statusCode = 404;
      throw error;
    }
  }

  const currentItemStock = Number(inventoryItem.item_total_stock || 0);
  const nextItemStock =
    currentItemStock + Number(batchData.quantity_received || 0);
  const reorderLevel =
    batchData.inventory_item_reorder_level ?? inventoryItem.reorder_level;

  let createdBatch = null;
  let lastAuthoritativeBatch = null;

  while (!createdBatch) {
    createdBatch = await inventoryBatchRepository.insertInventoryBatch(
      {
        inventory_item_id: batchData.inventory_item_id,
        inventory_item_stock_form_id: resolvedStockFormId,
        batch_no: resolvedBatchNo,
        source_type: batchData.source_type,
        quantity_received: batchData.quantity_received,
        quantity_available: batchData.quantity_received,
        expiration_date: batchData.expiration_date,
        received_at: batchData.received_at,
        storage_location: batchData.storage_location,
        status: getInventoryBatchStatus({
          quantityAvailable: batchData.quantity_received,
          totalQuantityAvailable: nextItemStock,
          expirationDate: batchData.expiration_date,
          reorderLevel,
        }),
        created_by: batchData.created_by,
      },
      dbClient || undefined,
    );

    if (createdBatch || !allowBatchNumberReassignment) {
      break;
    }

    lastAuthoritativeBatch =
      await inventoryBatchRepository.getInventoryBatchByItemIdAndBatchNo(
        batchData.inventory_item_id,
        resolvedBatchNo,
        dbClient || undefined,
      );

    if (!lastAuthoritativeBatch) {
      break;
    }

    const samePackaging = areBatchPackagingDefinitionsEqual({
      existingBatch: lastAuthoritativeBatch,
      requestedStockFormId: resolvedStockFormId,
      batchData,
      inventoryItem,
    });

    if (samePackaging && !forceBatchNumberReassignment) {
      throw createDuplicateInventoryBatchError(lastAuthoritativeBatch);
    }

    const availableBatchNumber = await findAvailableBatchNumber({
      inventoryItemId: batchData.inventory_item_id,
      requestedBatchNo,
      startingOffset: resolvedBatchNumberOffset + 1,
      dbClient,
    });

    if (!availableBatchNumber) {
      break;
    }

    resolvedBatchNo = availableBatchNumber.batchNo;
    resolvedBatchNumberOffset = availableBatchNumber.offset;
    batchNumberWasReassigned = true;
  }

  if (!createdBatch) {
    if (!lastAuthoritativeBatch) {
      lastAuthoritativeBatch =
        await inventoryBatchRepository.getInventoryBatchByItemIdAndBatchNo(
          batchData.inventory_item_id,
          resolvedBatchNo,
          dbClient || undefined,
        );
    }

    throw createDuplicateInventoryBatchError(lastAuthoritativeBatch);
  }

  const inflowTransaction = {
    disaster_event_id: null,
    inventory_batch_id: createdBatch.id,
    transaction_type: "INFLOW",
    quantity: Number(batchData.quantity_received || 0),
    reference_type: "MANUAL",
    reference_id: createdBatch.id,
    performed_by: batchData.created_by || null,
    remarks: "Stock received during inventory batch creation",
  };

  if (batchData.received_at) {
    inflowTransaction.performed_at = batchData.received_at;
  }

  await inventoryTransactionRepository.insertInventoryTransaction(
    inflowTransaction,
    dbClient || undefined,
  );

  await inventoryBatchStatusService.refreshDerivedInventoryBatchStatusesForItem(
    batchData.inventory_item_id,
    { dbClient },
  );

  const fullBatch = await inventoryBatchRepository.getInventoryBatchById(
    createdBatch.id,
    dbClient || undefined,
  );

  const mappedBatch = mapInventoryBatch(fullBatch);

  if (batchNumberWasReassigned) {
    mappedBatch.batch_number_was_reassigned = true;
    mappedBatch.requested_batch_no = requestedBatchNo;
  }

  if (!dbClient) {
    await emitInventoryBatchCreatedSideEffects(mappedBatch, batchData);
  }

  return mappedBatch;
};

const createInventoryBatch = async (batchData) => {
  if (
    batchData.storage_location !== undefined &&
    batchData.storage_location !== null &&
    typeof batchData.storage_location !== "string"
  ) {
    const error = new Error("storage_location must be a string or null");
    error.statusCode = 400;
    throw error;
  }

  if (!isInventoryBatchStorageLocationLengthValid(batchData.storage_location)) {
    const error = new Error(
      `storage_location must not exceed ${INVENTORY_BATCH_STORAGE_LOCATION_MAX_LENGTH} characters`,
    );
    error.statusCode = 400;
    throw error;
  }

  const requiresTransaction = !batchData.dbClient;

  if (!requiresTransaction) {
    return createInventoryBatchWithoutTransaction(batchData);
  }

  const client = await pool.connect();
  let transactionStarted = false;
  let mappedBatch;

  try {
    await client.query("BEGIN");
    transactionStarted = true;
    mappedBatch = await createInventoryBatchWithoutTransaction({
      ...batchData,
      dbClient: client,
    });
    await client.query("COMMIT");
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }
    throw error;
  } finally {
    client.release();
  }

  await emitInventoryBatchCreatedSideEffects(mappedBatch, batchData);
  return mappedBatch;
};

const updateInventoryBatchExpiry = async (id, payload, actor = null) => {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    const existingBatch = await inventoryBatchRepository.getInventoryBatchById(
      id,
      client,
    );

    if (!existingBatch) {
      const error = new Error("Inventory batch not found");
      error.statusCode = 404;
      throw error;
    }

    if (typeof inventoryItemRepository.getInventoryItemByIdForUpdate === "function") {
      await inventoryItemRepository.getInventoryItemByIdForUpdate(
        existingBatch.inventory_item_id,
        client,
      );
    }

    const nextStatus = isInventoryBatchDerivedStatus(existingBatch.status)
      ? getInventoryBatchStatus({
          quantityAvailable: existingBatch.quantity_available,
          totalQuantityAvailable: existingBatch.item_total_stock,
          expirationDate: payload.expiration_date,
          reorderLevel: existingBatch.reorder_level,
        })
      : existingBatch.status;

    const updatedBatch =
      await inventoryBatchRepository.updateInventoryBatchExpiry(
        id,
        {
          expiration_date: payload.expiration_date,
          status: nextStatus,
        },
        client,
      );

    await inventoryBatchStatusService.refreshDerivedInventoryBatchStatusesForItem(
      existingBatch.inventory_item_id,
      { dbClient: client },
    );

    await client.query("COMMIT");
    transactionStarted = false;

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
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }
    throw error;
  } finally {
    client.release();
  }
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
