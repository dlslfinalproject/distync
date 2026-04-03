const express = require("express");

const inventoryItemService = require("../services/inventoryItem.service");
const {
  validateInventoryItemId,
  validateGetInventoryItems,
  validateInventoryItemPayload,
} = require("../validators/inventoryItem.validator");

const router = express.Router();

router.get("/", validateGetInventoryItems, async (req, res) => {
  try {
    const inventoryItems = await inventoryItemService.getInventoryItems(
      req.validatedQuery,
    );

    return res.status(200).json(inventoryItems);
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      message: error.message || "Failed to fetch inventory items",
    });
  }
});

router.get("/:id", validateInventoryItemId, async (req, res) => {
  try {
    const inventoryItem = await inventoryItemService.getInventoryItemById(
      req.params.id,
    );

    if (!inventoryItem) {
      return res.status(404).json({
        message: "Inventory item not found",
      });
    }

    return res.status(200).json(inventoryItem);
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      message: error.message || "Failed to fetch inventory item",
    });
  }
});

router.post("/", validateInventoryItemPayload, async (req, res) => {
  try {
    const inventoryItem = await inventoryItemService.createInventoryItem(
      req.validatedBody,
    );

    return res.status(201).json({
      message: "Inventory item created successfully",
      data: inventoryItem,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      message: error.message || "Failed to create inventory item",
    });
  }
});

router.put(
  "/:id",
  validateInventoryItemId,
  validateInventoryItemPayload,
  async (req, res) => {
    try {
      const inventoryItem = await inventoryItemService.updateInventoryItem(
        req.params.id,
        req.validatedBody,
      );

      return res.status(200).json({
        message: "Inventory item updated successfully",
        data: inventoryItem,
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        message: error.message || "Failed to update inventory item",
      });
    }
  },
);

module.exports = router;
