const express = require("express");

const { ROLE_CODES, requireRoles } = require("../modules/auth/auth.middleware");
const inventoryBatchService = require("../services/inventoryBatch.service");
const { ALLOWED_EXPORT_FORMATS } = require("../utils/mayorReportExport");
const {
  validateInventoryBatchId,
  validateGetInventoryBatches,
  validateCreateInventoryBatch,
  validateUpdateInventoryBatchExpiry,
} = require("../validators/inventoryBatch.validator");

const router = express.Router();

const resolveExportFormat = (format) => {
  const normalizedFormat = String(format || "csv").toLowerCase();
  return ALLOWED_EXPORT_FORMATS.includes(normalizedFormat)
    ? normalizedFormat
    : null;
};

router.get(
  "/export",
  requireRoles(ROLE_CODES.MAYOR),
  validateGetInventoryBatches,
  async (req, res) => {
    try {
      const exportFormat = resolveExportFormat(req.query.format);

      if (!exportFormat) {
        return res.status(400).json({
          message: "format must be one of: csv, excel, pdf",
        });
      }

      const file = await inventoryBatchService.exportInventoryBatches(
        req.validatedQuery,
        exportFormat,
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
        message: error.message || "Failed to export inventory batches",
      });
    }
  },
);

router.get(
  "/",
  requireRoles(ROLE_CODES.MAYOR),
  validateGetInventoryBatches,
  async (req, res) => {
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
  },
);

router.get(
  "/:id/detail",
  requireRoles(ROLE_CODES.MAYOR),
  validateInventoryBatchId,
  async (req, res) => {
    try {
      const payload = await inventoryBatchService.getInventoryBatchDetail(
        req.params.id,
      );

      if (!payload) {
        return res.status(404).json({
          message: "Inventory batch not found",
        });
      }

      return res.status(200).json({
        data: payload,
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        message: error.message || "Failed to fetch inventory batch detail",
      });
    }
  },
);

router.get(
  "/:id",
  requireRoles(ROLE_CODES.MAYOR),
  validateInventoryBatchId,
  async (req, res) => {
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
  },
);

router.post(
  "/",
  requireRoles(ROLE_CODES.MAYOR),
  validateCreateInventoryBatch,
  async (req, res) => {
  try {
    const inventoryBatch = await inventoryBatchService.createInventoryBatch(
      {
        ...req.validatedBody,
        created_by: req.auth.userId,
      },
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
  },
);

router.put(
  "/:id/expiry",
  requireRoles(ROLE_CODES.MAYOR),
  validateInventoryBatchId,
  validateUpdateInventoryBatchExpiry,
  async (req, res) => {
    try {
      const inventoryBatch = await inventoryBatchService.updateInventoryBatchExpiry(
        req.params.id,
        req.validatedBody,
        req.auth,
      );

      return res.status(200).json({
        message: "Inventory batch expiry updated successfully",
        data: inventoryBatch,
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        message: error.message || "Failed to update inventory batch expiry",
      });
    }
  },
);

module.exports = router;
