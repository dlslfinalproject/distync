const express = require("express");

const { ROLE_CODES, requireRoles } = require("../modules/auth/auth.middleware");
const stubService = require("../services/stub.service");
const { logErrorSafely } = require("../utils/systemLog");
const {
  validateGetBarangayStubDashboard,
  validateStubSearch,
  validateStubId,
  validateStubVerify,
  validateClaimBarangayStub,
  validateStubHistory,
  validateStubHistoryExport,
} = require("../validators/stub.validator");

const router = express.Router();

const DUPLICATE_CLAIM_ERROR_CODES = new Set(["STUB_ALREADY_CLAIMED"]);
const VERIFICATION_ERROR_CODES = new Set([
  "INVALID_QR_STUB",
  "STUB_NOT_FOUND",
  "QR_INACTIVE",
  "STUB_NOT_CLAIMABLE",
  "STUB_CANCELLED",
  "STUB_VOID",
  "STUB_UNAVAILABLE",
]);

const logStubAnomalySource = async ({
  req,
  code,
  message,
  severity = "ERROR",
  referenceId = null,
  action = "DIRECT_STUB_OR_QR_VERIFICATION_FAILURE",
  details = null,
}) => {
  if (!DUPLICATE_CLAIM_ERROR_CODES.has(code) && !VERIFICATION_ERROR_CODES.has(code)) {
    return;
  }

  await logErrorSafely({
    actor: req.auth,
    moduleName: "stubs",
    errorCode: code,
    errorMessage: message || "Stub verification failed.",
    severity,
    error: null,
    referenceType: referenceId ? "STUB" : null,
    referenceId,
    context: {
      route: req.originalUrl,
      action,
      has_qr_reference: Boolean(req.validatedBody?.qr_code_value),
      has_stub_identifier: Boolean(
        req.validatedBody?.stub_no || req.validatedBody?.serial_no,
      ),
      details: details || {},
    },
  });
};

router.get(
  "/barangay-dashboard",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO, ROLE_CODES.MAYOR),
  validateGetBarangayStubDashboard,
  async (req, res) => {
    try {
      const dashboardQuery =
        req.auth.roleCode === ROLE_CODES.BARANGAY
          ? {
              ...req.validatedQuery,
              user_id: req.auth.userId,
              override_barangay_id: null,
              qr_generated_by: req.auth.userId,
            }
          : {
              ...req.validatedQuery,
              user_id: null,
              qr_generated_by: req.auth.userId,
            };

      const dashboard = await stubService.getBarangayStubDashboard(
        dashboardQuery,
      );

      return res.status(200).json(dashboard);
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        error: error.code || null,
        message: error.message || "Failed to fetch stub dashboard",
      });
    }
  },
);

router.get(
  "/search",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO),
  validateStubSearch,
  async (req, res) => {
  try {
    const results = await stubService.getSearchResults(req.validatedQuery);

    return res.status(200).json(results);
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      message: error.message || "Failed to search stubs",
    });
  }
  },
);

router.post(
  "/:id/claim",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO),
  validateClaimBarangayStub,
  async (req, res) => {
  try {
    const claimBody =
      req.auth.roleCode === ROLE_CODES.BARANGAY
        ? {
            ...req.validatedBody,
            user_id: req.auth.userId,
            override_barangay_id: null,
            verified_by: req.auth.userId,
            requester: req.auth,
          }
        : {
            ...req.validatedBody,
            user_id: null,
            verified_by: req.auth.userId,
            requester: req.auth,
          };

    const result = await stubService.claimBarangayStub(claimBody);

    return res.status(200).json(result);
  } catch (error) {
    await logStubAnomalySource({
      req,
      code: error.code,
      message: error.message,
      severity: error.code === "STUB_ALREADY_CLAIMED" ? "WARNING" : "ERROR",
      referenceId:
        error.entityServerId ||
        error.serverPayload?.stub?.id ||
        req.validatedParams?.id ||
        req.params?.id ||
        null,
      action:
        error.code === "STUB_ALREADY_CLAIMED"
          ? "DIRECT_DUPLICATE_CLAIM_ATTEMPT"
          : "DIRECT_STUB_OR_QR_VERIFICATION_FAILURE",
      details: error.details || null,
    });
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      success: false,
      code: error.code || null,
      error: error.code || null,
      message: error.message || "Failed to claim stub",
      details: error.details || null,
    });
  }
  },
);

router.get(
  "/history",
  requireRoles(ROLE_CODES.MSWDO),
  validateStubHistory,
  async (req, res) => {
    try {
      const rows = await stubService.getStubClaimHistory(req.validatedQuery);

      return res.status(200).json({
        message: "Stub claim history fetched successfully",
        data: rows,
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        message: error.message || "Failed to fetch stub claim history",
      });
    }
  },
);

router.get(
  "/history/export",
  requireRoles(ROLE_CODES.MSWDO),
  validateStubHistory,
  validateStubHistoryExport,
  async (req, res) => {
    try {
      const file = await stubService.exportStubClaimHistory(req.validatedQuery);

      res.setHeader("Content-Type", file.contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${file.filename}"`,
      );

      return res.status(200).send(file.buffer);
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        message: error.message || "Failed to export stub claim history",
      });
    }
  },
);

router.get(
  "/:id",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO),
  validateStubId,
  async (req, res) => {
  try {
    const stub = await stubService.getStubDetails(req.params.id);

    if (!stub) {
      return res.status(404).json({
        message: "Stub not found",
      });
    }

    return res.status(200).json(stub);
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      message: error.message || "Failed to fetch stub",
    });
  }
  },
);

router.post(
  "/verify",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO),
  validateStubVerify,
  async (req, res) => {
  try {
    const result = await stubService.verifyStub(req.validatedBody);

    if (
      result?.data?.code &&
      !result.data.is_claimable &&
      VERIFICATION_ERROR_CODES.has(result.data.code)
    ) {
      await logStubAnomalySource({
        req,
        code: result.data.code,
        message: result.message,
        severity: "ERROR",
        referenceId: result.data.stub?.id || null,
        action: "DIRECT_STUB_OR_QR_VERIFICATION_FAILURE",
        details: result.data.details || null,
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    await logStubAnomalySource({
      req,
      code: error.code,
      message: error.message,
      severity: "ERROR",
      referenceId: error.entityServerId || null,
      details: error.details || null,
    });
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      success: false,
      code: error.code || null,
      message: error.message || "Failed to verify stub",
      details: error.details || null,
    });
  }
  },
);

module.exports = router;
