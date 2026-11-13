const express = require("express");

const { ROLE_CODES, requireRoles } = require("../modules/auth/auth.middleware");
const inventoryTransactionService = require("../services/inventoryTransaction.service");
const { ALLOWED_EXPORT_FORMATS } = require("../utils/mayorReportExport");
const {
  validateInventoryTransactionId,
  validateGetInventoryTransactions,
  validateCreateInventoryTransaction,
} = require("../validators/inventoryTransaction.validator");

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
  validateGetInventoryTransactions,
  async (req, res) => {
    try {
      const exportFormat = resolveExportFormat(req.query.format);

      if (!exportFormat) {
        return res.status(400).json({
          message: "format must be one of: csv, excel, pdf",
        });
      }

      const file = await inventoryTransactionService.exportInventoryTransactions(
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
        message: error.message || "Failed to export inventory transactions",
      });
    }
  },
);

router.get(
  "/",
  requireRoles(ROLE_CODES.MAYOR),
  validateGetInventoryTransactions,
  async (req, res) => {
  try {
    const inventoryTransactions =
      await inventoryTransactionService.getInventoryTransactions(
        req.validatedQuery,
      );

    return res.status(200).json(inventoryTransactions);
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      message: error.message || "Failed to fetch inventory transactions",
    });
  }
  },
);

router.get(
  "/:id",
  requireRoles(ROLE_CODES.MAYOR),
  validateInventoryTransactionId,
  async (req, res) => {
  try {
    const inventoryTransaction =
      await inventoryTransactionService.getInventoryTransactionById(req.params.id);

    if (!inventoryTransaction) {
      return res.status(404).json({
        message: "Inventory transaction not found",
      });
    }

    return res.status(200).json(inventoryTransaction);
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      message: error.message || "Failed to fetch inventory transaction",
    });
  }
  },
);

router.post(
  "/",
  requireRoles(ROLE_CODES.MAYOR),
  validateCreateInventoryTransaction,
  async (req, res) => {
  try {
    const inventoryTransaction =
      await inventoryTransactionService.createInventoryTransaction(
        {
          ...req.validatedBody,
          performed_by: req.auth.userId,
        },
      );

    return res.status(201).json({
      message: "Inventory transaction recorded successfully",
      data: inventoryTransaction,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      message: error.message || "Failed to record inventory transaction",
    });
  }
  },
);

module.exports = router;
