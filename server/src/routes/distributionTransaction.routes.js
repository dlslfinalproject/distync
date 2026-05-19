const express = require("express");

const { ROLE_CODES, requireRoles } = require("../modules/auth/auth.middleware");
const distributionTransactionService = require("../services/distributionTransaction.service");
const {
  validateCreateDistributionTransaction,
} = require("../validators/distributionTransaction.validator");

const router = express.Router();

router.post(
  "/",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO),
  validateCreateDistributionTransaction,
  async (req, res) => {
  try {
    const distributionTransaction =
      await distributionTransactionService.createDistributionTransaction(
        {
          ...req.validatedBody,
          verified_by: req.auth.userId,
        },
      );

    return res.status(201).json({
      message: "Distribution recorded successfully",
      data: distributionTransaction,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      message: error.message || "Failed to record distribution",
    });
  }
  },
);

module.exports = router;
