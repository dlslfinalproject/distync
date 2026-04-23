const inventoryItemRepository = require("../repositories/inventoryItem.repository");

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

const getInventoryItems = async (filters) => {
  return inventoryItemRepository.getInventoryItems(filters);
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
  getInventoryItemById,
  createInventoryItem,
  updateInventoryItem,
};
