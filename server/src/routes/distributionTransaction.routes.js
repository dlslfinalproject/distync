const express = require("express");

const { ROLE_CODES, requireRoles } = require("../modules/auth/auth.middleware");
const distributionTransactionService = require("../services/distributionTransaction.service");
const {
  validateCreateDistributionTransaction,
  validateClaimDistributionFromQr,
  validateGetDistributionHistory,
  validateExportDistributionHistory,
  validateUpdateDistributionLifecycle,
} = require("../validators/distributionTransaction.validator");

const router = express.Router();

router.get(
  "/history",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO, ROLE_CODES.MAYOR),
  validateGetDistributionHistory,
  async (req, res) => {
    try {
      const historyRows =
        await distributionTransactionService.getDistributionHistory({
          requester: req.auth,
          filters: req.validatedQuery,
        });

      return res.status(200).json({
        message: "Distribution history fetched successfully",
        data: historyRows,
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        message: error.message || "Failed to fetch distribution history",
      });
    }
  },
);

router.get(
  "/history/export",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO),
  validateGetDistributionHistory,
  validateExportDistributionHistory,
  async (req, res) => {
    try {
      const file = await distributionTransactionService.exportDistributionHistory({
        requester: req.auth,
        filters: req.validatedQuery,
      });

      res.setHeader("Content-Type", file.contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${file.filename}"`,
      );

      return res.status(200).send(file.buffer);
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        message: error.message || "Failed to export distribution history",
      });
    }
  },
);

router.post(
  "/claim-from-qr",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO),
  validateClaimDistributionFromQr,
  async (req, res) => {
  try {
    const distributionTransaction =
      await distributionTransactionService.claimDistributionTransactionFromQr(
        {
          ...req.validatedBody,
          verified_by: req.auth.userId,
          requester: req.auth,
        },
      );

    return res.status(201).json({
      message: "Stub marked as claimed successfully",
      data: distributionTransaction,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      message: error.message || "Failed to claim stub from QR verification",
    });
  }
  },
);

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
          requester: req.auth,
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

router.patch(
  "/:transactionId/lifecycle",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO),
  validateUpdateDistributionLifecycle,
  async (req, res) => {
    try {
      const updatedDistributionTransaction =
        await distributionTransactionService.updateDistributionTransactionLifecycle({
          transactionId: req.validatedParams.transactionId,
          actionType: req.validatedBody.action,
          remarks: req.validatedBody.remarks,
          requester: req.auth,
        });

      return res.status(200).json({
        message:
          req.validatedBody.action === "REVERSED"
            ? "Distribution reversed successfully"
            : "Distribution cancelled successfully",
        data: updatedDistributionTransaction,
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        message: error.message || "Failed to update distribution status",
      });
    }
  },
);

module.exports = router;
