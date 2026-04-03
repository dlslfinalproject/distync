const express = require("express");

const distributionTransactionService = require("../services/distributionTransaction.service");
const {
  validateCreateDistributionTransaction,
} = require("../validators/distributionTransaction.validator");

const router = express.Router();

router.post("/", validateCreateDistributionTransaction, async (req, res) => {
  try {
    const distributionTransaction =
      await distributionTransactionService.createDistributionTransaction(
        req.validatedBody,
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
});

module.exports = router;
