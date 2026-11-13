const express = require("express");

const { ROLE_CODES, requireRoles } = require("../modules/auth/auth.middleware");
const stubService = require("../services/stub.service");
const syncService = require("../services/sync.service");
const { logErrorSafely } = require("../utils/systemLog");
const {
  validateGetBarangayStubDashboard,
  validateGetMunicipalStubDashboard,
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
  "HOUSEHOLD_ARCHIVED",
  "QR_INACTIVE",
  "STUB_NOT_CLAIMABLE",
  "HOUSEHOLD_NOT_PRESENT_IN_EVAC_CENTER",
  "DISASTER_EVENT_NOT_ACTIVE",
  "STUB_CANCELLED",
  "STUB_VOID",
  "STUB_UNAVAILABLE",
  "WRONG_EVENT",
  "STUB_EVENT_UNAVAILABLE",
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
      disaster_event_id: req.validatedBody?.disaster_event_id || null,
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
              barangay_id: null,
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
  "/municipal-dashboard",
  requireRoles(ROLE_CODES.MAYOR, ROLE_CODES.MSWDO),
  validateGetMunicipalStubDashboard,
  async (req, res) => {
    try {
      const dashboard = await stubService.getMunicipalStubDashboard({
        ...req.validatedQuery,
        requester: req.auth,
        qr_generated_by: req.auth.userId,
      });

      return res.status(200).json(dashboard);
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        error: error.code || null,
        message: error.message || "Failed to fetch municipal stub dashboard",
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
    const results = await stubService.getSearchResults(
      req.validatedQuery,
      req.auth,
    );

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
    const {
      client_sync_id: clientSyncId,
      device_id: deviceId,
      ...payload
    } = req.validatedBody;
    const result = await syncService.processSyncEntries({
      auth: req.auth,
      entries: [
        {
          client_sync_id: clientSyncId,
          action_key: "STUB_CLAIM",
          entity_type: "STUB",
          entity_local_id: req.validatedParams?.id || req.params?.id,
          entity_server_id: req.validatedParams?.id || req.params?.id,
          device_id: deviceId,
          client_timestamp: new Date().toISOString(),
          client_updated_at: new Date().toISOString(),
          payload,
        },
      ],
    });
    const syncResult = Array.isArray(result) ? result[0] : null;

    if (!syncResult || syncResult.sync_status !== "SYNCED") {
      const errorCode =
        syncResult?.error_code || syncResult?.conflict?.conflict_type || null;
      await logStubAnomalySource({
        req,
        code: errorCode,
        message: syncResult?.message || "Failed to claim stub",
        severity: errorCode === "STUB_ALREADY_CLAIMED" ? "WARNING" : "ERROR",
        referenceId: req.validatedParams?.id || req.params?.id || null,
        action:
          errorCode === "STUB_ALREADY_CLAIMED"
            ? "DIRECT_DUPLICATE_CLAIM_ATTEMPT"
            : "DIRECT_STUB_OR_QR_VERIFICATION_FAILURE",
      });
      return res.status(syncResult?.status_code || 409).json({
        success: false,
        code: errorCode,
        error: errorCode,
        message: syncResult?.message || "Failed to claim stub",
        details: syncResult?.details || null,
        data: syncResult || null,
      });
    }

    return res.status(200).json({ success: true, data: syncResult.data });
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
  "/:id/family-head-photo",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO, ROLE_CODES.MAYOR),
  validateStubId,
  async (req, res) => {
    try {
      const photo = await stubService.getStubFamilyHeadPhoto(
        req.params.id,
        req.auth,
      );
      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      res.setHeader("Pragma", "no-cache");
      return res.status(200).json({ data: photo });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        code: error.code || null,
        message: error.message || "Failed to retrieve family-head photo",
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
    const stub = await stubService.getStubDetails(req.params.id, req.auth);

    if (!stub) {
      return res.status(404).json({
        message: "Stub not found",
      });
    }

    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Pragma", "no-cache");
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
    const result = await stubService.verifyStub(req.validatedBody, req.auth);

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

    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Pragma", "no-cache");
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
