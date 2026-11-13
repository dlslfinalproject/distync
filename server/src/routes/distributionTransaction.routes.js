const express = require("express");

const { ROLE_CODES, requireRoles } = require("../modules/auth/auth.middleware");
const distributionTransactionService = require("../services/distributionTransaction.service");
const syncService = require("../services/sync.service");
const { logErrorSafely } = require("../utils/systemLog");
const {
  validateCreateDistributionTransaction,
  validateClaimDistributionFromQr,
  validateGetDistributionHistory,
  validateExportDistributionHistory,
  validateExportInventoryDistribution,
  validateInventoryDistributionExportOptions,
  validateInventoryDistributionDetail,
  validateClaimProofPhotoRequest,
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
          requester: req.auth,
        });

      if (!detail) {
        return res.status(404).json({
          message: "Inventory distribution detail not found",
        });
      }

      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      res.setHeader("Pragma", "no-cache");
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
  "/claim-proof/:transactionId/photo",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO, ROLE_CODES.MAYOR),
  validateClaimProofPhotoRequest,
  async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Pragma", "no-cache");
    try {
      const proof = await distributionTransactionService.getClaimProofPhoto({
        transactionId: req.validatedParams.transactionId,
        requester: req.auth,
      });
      if (!proof) {
        return res.status(404).json({
          code: "CLAIM_PROOF_PHOTO_UNAVAILABLE",
          message: "Proof photo unavailable.",
        });
      }
      return res.status(200).json({
        message: "Claim proof photo fetched successfully",
        data: proof,
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        code: error.code || null,
        message: error.message || "Failed to fetch claim proof photo",
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
      const historyResult =
        await distributionTransactionService.getDistributionHistory({
          requester: req.auth,
          filters: req.validatedQuery,
        });
      const historyRows = Array.isArray(historyResult)
        ? historyResult
        : historyResult.data;
      const pagination = Array.isArray(historyResult)
        ? null
        : historyResult.pagination;

      const responseBody = {
        message: "Distribution history fetched successfully",
        data: historyRows,
      };

      if (pagination) {
        responseBody.pagination = pagination;
      }

      return res.status(200).json(responseBody);
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
    const {
      client_sync_id: clientSyncId,
      device_id: deviceId,
      ...payload
    } = req.validatedBody;
    const results = await syncService.processSyncEntries({
      auth: req.auth,
      entries: [
        {
          client_sync_id: clientSyncId,
          action_key: "STUB_CLAIM",
          entity_type: "STUB",
          entity_local_id: payload.stub_id,
          entity_server_id: payload.stub_id,
          device_id: deviceId,
          client_timestamp: new Date().toISOString(),
          client_updated_at: new Date().toISOString(),
          payload: { ...payload, proof_type: "QR" },
        },
      ],
    });
    const syncResult = Array.isArray(results) ? results[0] : null;
    if (!syncResult || syncResult.sync_status !== "SYNCED") {
      await logDistributionAnomalySource({
        req,
        error: {
          code:
            syncResult?.error_code ||
            syncResult?.conflict?.conflict_type ||
            null,
          message: syncResult?.message || "Failed to claim stub from QR verification",
        },
      });
      return res.status(syncResult?.status_code || 409).json({
        code: syncResult?.error_code || syncResult?.conflict?.conflict_type || null,
        message: syncResult?.message || "Failed to claim stub from QR verification",
        data: syncResult || null,
      });
    }

    return res.status(201).json({
      message: "Stub marked as claimed successfully",
      data: syncResult.data,
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

module.exports = router;
