const inventoryItemRepository = require("../repositories/inventoryItem.repository");
const inventoryBatchRepository = require("../repositories/inventoryBatch.repository");
const inventoryTransactionRepository = require("../repositories/inventoryTransaction.repository");
const inventoryItemExport = require("../utils/inventoryItemExport");
const mayorReportExport = require("../utils/mayorReportExport");
const { logAuditSafely, pickDefined } = require("../utils/systemLog");

const buildItemCodeSeed = (itemName) => {
  const normalizedName = itemName
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);

  return normalizedName || "ITEM";
};

const generateInventoryItemCode = async (itemName) => {
  const itemCodeSeed = buildItemCodeSeed(itemName);
  let sequenceNumber = 1;

  while (true) {
    const candidateCode = `INV-${itemCodeSeed}-${String(sequenceNumber).padStart(3, "0")}`;
    const existingItem = await inventoryItemRepository.getInventoryItemByCode(
      candidateCode,
    );

    if (!existingItem) {
      return candidateCode;
    }

    sequenceNumber += 1;
  }
};

const ensureUniqueFields = async (itemData, currentItemId = null) => {
  const existingItemByCode = await inventoryItemRepository.getInventoryItemByCode(
    itemData.item_code,
  );

  if (existingItemByCode && existingItemByCode.id !== currentItemId) {
    const error = new Error("item_code already exists");
    error.statusCode = 409;
    throw error;
  }

  const existingItemByName = await inventoryItemRepository.getInventoryItemByName(
    itemData.item_name,
  );

  if (existingItemByName && existingItemByName.id !== currentItemId) {
    const error = new Error("item_name already exists");
    error.statusCode = 409;
    throw error;
  }
};

const isItemExpiring = (item) => {
  if (!item.expiration_date) {
    return false;
  }

  const expirationDate = new Date(item.expiration_date);
  const comparisonDate = new Date();

  expirationDate.setHours(0, 0, 0, 0);
  comparisonDate.setHours(0, 0, 0, 0);

  if (Number.isNaN(expirationDate.getTime())) {
    return false;
  }

  const millisecondsUntilExpiration =
    expirationDate.getTime() - comparisonDate.getTime();
  const daysUntilExpiration = millisecondsUntilExpiration / (1000 * 60 * 60 * 24);

  return daysUntilExpiration >= 0 && daysUntilExpiration <= 30;
};

const getItemStatus = (item) => {
  if (!item.is_active) {
    return "Inactive";
  }

  if (isItemExpiring(item)) {
    return "Expiring";
  }

  return "Active";
};

const filterInventoryItemsByStatus = (items, selectedStatus) => {
  if (!selectedStatus || selectedStatus === "All") {
    return items;
  }

  return items.filter((item) => getItemStatus(item) === selectedStatus);
};

const formatPlural = (value, label) => {
  return `${value} ${label}${Number(value) > 1 ? "s" : ""}`;
};

const formatItemQuantity = (item) => {
  const packagingPart =
    item.packaging_count && item.packaging
      ? formatPlural(item.packaging_count, item.packaging)
      : item.packaging || "--";
  const unitPart =
    item.unit_of_measure_value && item.unit_of_measure
      ? `${item.unit_of_measure_value} ${item.unit_of_measure}`
      : item.unit_of_measure || "--";

  if (item.quantity) {
    return `${packagingPart} | ${item.quantity} per packaging | ${unitPart}`;
  }

  return `${packagingPart} | ${unitPart}`;
};

const mapInventoryItemToExportRow = (item) => ({
  item_name: item.item_name || "--",
  category: item.category || "--",
  quantity: formatItemQuantity(item),
  expiration_date: inventoryItemExport.formatDate(item.expiration_date),
  status: getItemStatus(item),
});

const summarizeInventoryItem = (item) =>
  pickDefined(item, [
    "item_code",
    "item_name",
    "category",
    "unit_of_measure",
    "unit_of_measure_value",
    "packaging",
    "packaging_count",
    "quantity",
    "expiration_date",
    "barcode",
    "is_perishable",
    "is_active",
  ]);

const buildInventoryTrackingMap = (inventoryItems, inventoryBatches, inventoryTransactions) => {
  const trackingMap = new Map();

  inventoryItems.forEach((item) => {
    trackingMap.set(item.id, {
      onHand: 0,
      distributed: 0,
      expired: 0,
      expiredOnHand: 0,
      damaged: 0,
      missing: 0,
      spoiled: 0,
      stolen: 0,
      nearestExpirationDate: item.expiration_date || null,
    });
  });

  inventoryBatches.forEach((batch) => {
    const tracking = trackingMap.get(batch.inventory_item_id);

    if (!tracking) {
      return;
    }

    const quantityAvailable = Number(batch.quantity_available || 0);
    tracking.onHand += quantityAvailable;

    if (batch.expiration_date) {
      if (
        !tracking.nearestExpirationDate ||
        new Date(batch.expiration_date) < new Date(tracking.nearestExpirationDate)
      ) {
        tracking.nearestExpirationDate = batch.expiration_date;
      }
    }

    if (batch.status === "EXPIRED") {
      tracking.expiredOnHand += quantityAvailable;
    }
  });

  inventoryTransactions.forEach((transaction) => {
    const tracking = trackingMap.get(transaction.inventory_item?.id);

    if (!tracking) {
      return;
    }

    const quantity = Number(transaction.quantity || 0);

    if (transaction.reference_type === "DISTRIBUTION") {
      tracking.distributed += quantity;
    }

    if (transaction.transaction_type === "EXPIRED") {
      tracking.expired += quantity;
    }

    if (transaction.transaction_type === "DAMAGED") {
      tracking.damaged += quantity;
    }

    if (transaction.transaction_type === "MISSING") {
      tracking.missing += quantity;
    }

    if (transaction.transaction_type === "SPOILED") {
      tracking.spoiled += quantity;
    }

    if (transaction.transaction_type === "STOLEN") {
      tracking.stolen += quantity;
    }
  });

  return trackingMap;
};

const isNearExpiryDate = (value, thresholdDays) => {
  if (!value) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const comparisonDate = new Date(value);
  comparisonDate.setHours(0, 0, 0, 0);

  if (Number.isNaN(comparisonDate.getTime()) || comparisonDate < today) {
    return false;
  }

  const differenceInDays =
    (comparisonDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);

  return differenceInDays <= thresholdDays;
};

const buildInventoryConditionRows = async ({
  report_type,
  near_expiry_days = 14,
  filters,
}) => {
  const [inventoryItems, inventoryBatches, inventoryTransactions] = await Promise.all([
    inventoryItemRepository.getInventoryItems(filters),
    inventoryBatchRepository.getInventoryBatches({}),
    inventoryTransactionRepository.getInventoryTransactions({}),
  ]);

  const trackingMap = buildInventoryTrackingMap(
    inventoryItems,
    inventoryBatches,
    inventoryTransactions,
  );

  if (report_type === "LOW_STOCK") {
    return inventoryBatches
      .filter((batch) => batch.status === "LOW_STOCK")
      .map((batch) => ({
        item_name: batch.item_name || "--",
        batch_no: batch.batch_no || "--",
        status: batch.status || "--",
        quantity_available: batch.quantity_available ?? 0,
        expiration_date: mayorReportExport.formatDateOnly(batch.expiration_date),
      }));
  }

  if (report_type === "NEAR_EXPIRY") {
    return inventoryBatches
      .filter((batch) => isNearExpiryDate(batch.expiration_date, near_expiry_days))
      .map((batch) => ({
        item_name: batch.item_name || "--",
        batch_no: batch.batch_no || "--",
        expiration_date: mayorReportExport.formatDateOnly(batch.expiration_date),
        quantity_available: batch.quantity_available ?? 0,
        status: batch.status || "--",
      }));
  }

  if (report_type === "EXPIRED") {
    return inventoryBatches
      .filter((batch) => batch.status === "EXPIRED")
      .map((batch) => ({
        item_name: batch.item_name || "--",
        batch_no: batch.batch_no || "--",
        expiration_date: mayorReportExport.formatDateOnly(batch.expiration_date),
        quantity_available: batch.quantity_available ?? 0,
        status: batch.status || "--",
      }));
  }

  return inventoryItems
    .map((item) => {
      const tracking = trackingMap.get(item.id);

      return {
        item_name: item.item_name || "--",
        damaged: tracking?.damaged || 0,
        missing: tracking?.missing || 0,
        spoiled: tracking?.spoiled || 0,
        stolen: tracking?.stolen || 0,
      };
    })
    .filter(
      (row) => row.damaged > 0 || row.missing > 0 || row.spoiled > 0 || row.stolen > 0,
    );
};

const getInventoryItems = async (filters) => {
  return inventoryItemRepository.getInventoryItems(filters);
};

const exportInventoryItems = async (filters) => {
  const inventoryItems = await inventoryItemRepository.getInventoryItems(filters);
  const exportRows = filterInventoryItemsByStatus(
    inventoryItems,
    filters.status,
  ).map(mapInventoryItemToExportRow);

  if (exportRows.length === 0) {
    const error = new Error(
      "No inventory items are available to export for the current filters.",
    );
    error.statusCode = 404;
    throw error;
  }

  return inventoryItemExport.buildExportFile({
    rows: exportRows,
    filters,
    format: filters.format,
  });
};

const exportInventoryConditionReport = async ({
  report_type,
  near_expiry_days,
  filters,
  format,
}) => {
  const rows = await buildInventoryConditionRows({
    report_type,
    near_expiry_days,
    filters,
  });

  if (rows.length === 0) {
    const error = new Error("No records are available for the selected condition report.");
    error.statusCode = 404;
    throw error;
  }

  const reportConfig = {
    LOW_STOCK: {
      filePrefix: "office-mayor-low-stock-report",
      title: "Office of the Mayor Low Stock Report",
      worksheetName: "Low Stock",
      columns: [
        { key: "item_name", label: "Item Name", width: 28, pdfWidth: 170 },
        { key: "batch_no", label: "Batch No", width: 22, pdfWidth: 95 },
        { key: "status", label: "Status", width: 16, pdfWidth: 70 },
        { key: "quantity_available", label: "Quantity Available", width: 18, pdfWidth: 90 },
        { key: "expiration_date", label: "Expiration Date", width: 18, pdfWidth: 88 },
      ],
    },
    NEAR_EXPIRY: {
      filePrefix: "office-mayor-near-expiry-report",
      title: "Office of the Mayor Near Expiry Report",
      worksheetName: "Near Expiry",
      columns: [
        { key: "item_name", label: "Item Name", width: 28, pdfWidth: 170 },
        { key: "batch_no", label: "Batch No", width: 22, pdfWidth: 95 },
        { key: "expiration_date", label: "Expiration Date", width: 18, pdfWidth: 88 },
        { key: "quantity_available", label: "Quantity Available", width: 18, pdfWidth: 90 },
        { key: "status", label: "Status", width: 16, pdfWidth: 70 },
      ],
    },
    EXPIRED: {
      filePrefix: "office-mayor-expired-items-report",
      title: "Office of the Mayor Expired Items Report",
      worksheetName: "Expired Items",
      columns: [
        { key: "item_name", label: "Item Name", width: 28, pdfWidth: 170 },
        { key: "batch_no", label: "Batch No", width: 22, pdfWidth: 95 },
        { key: "expiration_date", label: "Expiration Date", width: 18, pdfWidth: 88 },
        { key: "quantity_available", label: "Quantity Available", width: 18, pdfWidth: 90 },
        { key: "status", label: "Status", width: 16, pdfWidth: 70 },
      ],
    },
    INCIDENT_LOSS: {
      filePrefix: "office-mayor-damaged-missing-spoiled-stolen-report",
      title: "Office of the Mayor Inventory Loss Report",
      worksheetName: "Inventory Loss",
      columns: [
        { key: "item_name", label: "Item Name", width: 28, pdfWidth: 210 },
        { key: "damaged", label: "Damaged", width: 14, pdfWidth: 65 },
        { key: "missing", label: "Missing", width: 14, pdfWidth: 65 },
        { key: "spoiled", label: "Spoiled", width: 14, pdfWidth: 65 },
        { key: "stolen", label: "Stolen", width: 14, pdfWidth: 65 },
      ],
    },
  }[report_type];

  return mayorReportExport.buildExportFile({
    filePrefix: reportConfig.filePrefix,
    worksheetName: reportConfig.worksheetName,
    reportTitle: reportConfig.title,
    metadata: [
      { label: "Search", value: filters.search?.trim() || "None" },
      ...(report_type === "NEAR_EXPIRY"
        ? [{ label: "Threshold", value: `${near_expiry_days} days` }]
        : []),
    ],
    columns: reportConfig.columns,
    rows,
    format,
  });
};

const getInventoryItemById = async (id) => {
  return inventoryItemRepository.getInventoryItemById(id);
};

const createInventoryItem = async (itemData, actor = null) => {
  const inventoryItemToCreate = {
    ...itemData,
    item_code: itemData.item_code || await generateInventoryItemCode(itemData.item_name),
  };

  await ensureUniqueFields(inventoryItemToCreate);
  const createdItem =
    await inventoryItemRepository.insertInventoryItem(inventoryItemToCreate);

  await logAuditSafely({
    actor,
    action: "INVENTORY_ITEM_CREATE",
    entityType: "INVENTORY_ITEM",
    entityId: createdItem.id,
    oldValues: {},
    newValues: summarizeInventoryItem(createdItem),
  });

  return createdItem;
};

const updateInventoryItem = async (id, itemData, actor = null) => {
  const existingItem = await inventoryItemRepository.getInventoryItemById(id);

  if (!existingItem) {
    const error = new Error("Inventory item not found");
    error.statusCode = 404;
    throw error;
  }

  const inventoryItemToUpdate = {
    ...itemData,
    item_code: itemData.item_code || existingItem.item_code,
  };

  await ensureUniqueFields(inventoryItemToUpdate, id);

  const updatedItem = await inventoryItemRepository.updateInventoryItem(
    id,
    inventoryItemToUpdate,
  );

  await logAuditSafely({
    actor,
    action: "INVENTORY_ITEM_UPDATE",
    entityType: "INVENTORY_ITEM",
    entityId: updatedItem.id,
    oldValues: summarizeInventoryItem(existingItem),
    newValues: summarizeInventoryItem(updatedItem),
  });

  return updatedItem;
};

module.exports = {
  getInventoryItems,
  exportInventoryItems,
  exportInventoryConditionReport,
  getInventoryItemById,
  createInventoryItem,
  updateInventoryItem,
};
