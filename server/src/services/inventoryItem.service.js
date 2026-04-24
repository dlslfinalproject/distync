const inventoryItemRepository = require("../repositories/inventoryItem.repository");
const inventoryItemExport = require("../utils/inventoryItemExport");

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

const getInventoryItemById = async (id) => {
  return inventoryItemRepository.getInventoryItemById(id);
};

const createInventoryItem = async (itemData) => {
  const inventoryItemToCreate = {
    ...itemData,
    item_code: itemData.item_code || await generateInventoryItemCode(itemData.item_name),
  };

  await ensureUniqueFields(inventoryItemToCreate);
  return inventoryItemRepository.insertInventoryItem(inventoryItemToCreate);
};

const updateInventoryItem = async (id, itemData) => {
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

  return inventoryItemRepository.updateInventoryItem(id, inventoryItemToUpdate);
};

module.exports = {
  getInventoryItems,
  exportInventoryItems,
  getInventoryItemById,
  createInventoryItem,
  updateInventoryItem,
};
