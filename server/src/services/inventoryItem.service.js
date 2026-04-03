const inventoryItemRepository = require("../repositories/inventoryItem.repository");

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
  await ensureUniqueFields(itemData);
  return inventoryItemRepository.insertInventoryItem(itemData);
};

const updateInventoryItem = async (id, itemData) => {
  const existingItem = await inventoryItemRepository.getInventoryItemById(id);

  if (!existingItem) {
    const error = new Error("Inventory item not found");
    error.statusCode = 404;
    throw error;
  }

  await ensureUniqueFields(itemData, id);

  return inventoryItemRepository.updateInventoryItem(id, itemData);
};

module.exports = {
  getInventoryItems,
  getInventoryItemById,
  createInventoryItem,
  updateInventoryItem,
};
