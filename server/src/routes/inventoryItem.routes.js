const express = require("express");

const { ROLE_CODES, requireRoles } = require("../modules/auth/auth.middleware");
const inventoryItemService = require("../services/inventoryItem.service");
const {
  validateExportInventoryItems,
  validateInventoryItemId,
  validateGetInventoryItems,
  validateInventoryItemPayload,
} = require("../validators/inventoryItem.validator");

const router = express.Router();

router.get(
  "/",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO, ROLE_CODES.MAYOR),
  validateGetInventoryItems,
  async (req, res) => {
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
  },
);

router.get(
  "/export",
  requireRoles(ROLE_CODES.MAYOR),
  validateExportInventoryItems,
  async (req, res) => {
  try {
    const file = await inventoryItemService.exportInventoryItems(
      req.validatedQuery,
    );

    res.setHeader("Content-Type", file.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${file.filename}"`,
    );

    return res.status(200).send(file.buffer);
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      message: error.message || "Failed to export inventory items",
    });
  }
  },
);

router.get(
  "/:id",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO, ROLE_CODES.MAYOR),
  validateInventoryItemId,
  async (req, res) => {
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
  },
);

router.post(
  "/",
  requireRoles(ROLE_CODES.MAYOR),
  validateInventoryItemPayload,
  async (req, res) => {
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
  },
);

router.put(
  "/:id",
  requireRoles(ROLE_CODES.MAYOR),
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
