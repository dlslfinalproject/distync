const express = require("express");

const inventoryBatchService = require("../services/inventoryBatch.service");
const {
  validateInventoryBatchId,
  validateGetInventoryBatches,
  validateCreateInventoryBatch,
} = require("../validators/inventoryBatch.validator");

const router = express.Router();

router.get("/", validateGetInventoryBatches, async (req, res) => {
  try {
    const inventoryBatches = await inventoryBatchService.getInventoryBatches(
      req.validatedQuery,
    );

    return res.status(200).json(inventoryBatches);
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      message: error.message || "Failed to fetch inventory batches",
    });
  }
});

router.get("/:id", validateInventoryBatchId, async (req, res) => {
  try {
    const inventoryBatch = await inventoryBatchService.getInventoryBatchById(
      req.params.id,
    );

    if (!inventoryBatch) {
      return res.status(404).json({
        message: "Inventory batch not found",
      });
    }

    return res.status(200).json(inventoryBatch);
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      message: error.message || "Failed to fetch inventory batch",
    });
  }
});

router.post("/", validateCreateInventoryBatch, async (req, res) => {
  try {
    const inventoryBatch = await inventoryBatchService.createInventoryBatch(
      req.validatedBody,
    );

    return res.status(201).json({
      message: "Inventory batch created successfully",
      data: inventoryBatch,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      message: error.message || "Failed to create inventory batch",
    });
  }
});

module.exports = router;
