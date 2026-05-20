const express = require("express");

const { ROLE_CODES, requireRoles } = require("../modules/auth/auth.middleware");
const inventoryTransactionService = require("../services/inventoryTransaction.service");
const {
  validateInventoryTransactionId,
  validateGetInventoryTransactions,
  validateCreateInventoryTransaction,
} = require("../validators/inventoryTransaction.validator");

const router = express.Router();

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
