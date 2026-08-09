const express = require("express");

const { ROLE_CODES, requireRoles } = require("../modules/auth/auth.middleware");
const distributionTransactionService = require("../services/distributionTransaction.service");
const { logErrorSafely } = require("../utils/systemLog");
const {
  validateCreateDistributionTransaction,
  validateClaimDistributionFromQr,
  validateGetDistributionHistory,
  validateExportDistributionHistory,
  validateExportInventoryDistribution,
  validateInventoryDistributionExportOptions,
  validateInventoryDistributionDetail,
  validateUpdateDistributionLifecycle,
} = require("../validators/distributionTransaction.validator");

const router = express.Router();

const DUPLICATE_CLAIM_ERROR_CODES = new Set(["STUB_ALREADY_CLAIMED"]);
const VERIFICATION_ERROR_CODES = new Set([
  "STUB_NOT_FOUND",
  "QR_REFERENCE_MISMATCH",
  "QR_INACTIVE",
  "STUB_NOT_CLAIMABLE",
]);

const getStubReferenceId = (error, requestBody = {}) =>
  error?.entityServerId ||
  error?.serverPayload?.stub?.id ||
  requestBody.stub_id ||
  null;

const logDistributionAnomalySource = async ({ req, error }) => {
  if (
    !DUPLICATE_CLAIM_ERROR_CODES.has(error?.code) &&
    !VERIFICATION_ERROR_CODES.has(error?.code)
  ) {
    return;
  }

  await logErrorSafely({
    actor: req.auth,
    moduleName: "distribution",
    errorCode: error.code,
    errorMessage: error.message || "Distribution verification failed.",
    severity: error.code === "STUB_ALREADY_CLAIMED" ? "WARNING" : "ERROR",
    error: null,
    referenceType: "STUB",
    referenceId: getStubReferenceId(error, req.validatedBody),
    context: {
      route: req.originalUrl,
      action:
        error.code === "STUB_ALREADY_CLAIMED"
          ? "DIRECT_DUPLICATE_CLAIM_ATTEMPT"
          : "DIRECT_STUB_OR_QR_VERIFICATION_FAILURE",
      disaster_event_id: req.validatedBody?.disaster_event_id || null,
      household_id: req.validatedBody?.household_id || null,
      has_qr_reference: Boolean(req.validatedBody?.qr_reference_value),
    },
  });
};

router.get(
  "/inventory-distribution/export-options",
  requireRoles(ROLE_CODES.MSWDO, ROLE_CODES.MAYOR),
  validateInventoryDistributionExportOptions,
  async (req, res) => {
    try {
      const options =
        await distributionTransactionService.getInventoryDistributionExportOptions({
          requester: req.auth,
          filters: req.validatedQuery,
        });

      return res.status(200).json({
        message: "Inventory distribution export options fetched successfully",
        data: options,
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        message:
          error.message || "Failed to fetch inventory distribution export options",
      });
    }
  },
);

router.get(
  "/inventory-distribution/export",
  requireRoles(ROLE_CODES.MSWDO, ROLE_CODES.MAYOR),
  validateExportInventoryDistribution,
  async (req, res) => {
    try {
      const file =
        await distributionTransactionService.exportInventoryDistribution({
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
        message: error.message || "Failed to export inventory distribution",
      });
    }
  },
);

router.get(
  "/inventory-distribution/:stubId",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO, ROLE_CODES.MAYOR),
  validateInventoryDistributionDetail,
  async (req, res) => {
    try {
      const detail =
        await distributionTransactionService.getInventoryDistributionDetail({
          stubId: req.validatedParams.stubId,
        });

      if (!detail) {
        return res.status(404).json({
          message: "Inventory distribution detail not found",
        });
      }

      return res.status(200).json({
        message: "Inventory distribution detail fetched successfully",
        data: detail,
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        message:
          error.message || "Failed to fetch inventory distribution detail",
      });
    }
  },
);

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
    await logDistributionAnomalySource({ req, error });
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      code: error.code || null,
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
    await logDistributionAnomalySource({ req, error });
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      code: error.code || null,
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
