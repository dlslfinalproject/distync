const express = require("express");

const { ROLE_CODES, requireRoles } = require("../modules/auth/auth.middleware");
const syncService = require("../services/sync.service");
const {
  validateAuditSyncRetryRequest,
  validateGetSyncHistory,
  validateGetSyncConflictDetail,
  validateProcessSyncEntries,
} = require("../validators/sync.validator");

const router = express.Router();

router.post(
  "/retry-audit",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO, ROLE_CODES.MAYOR),
  validateAuditSyncRetryRequest,
  async (req, res) => {
    try {
      await syncService.auditSyncRetryRequest({
        auth: req.auth,
        entries: req.validatedBody.entries,
      });

      return res.status(200).json({
        message: "Sync retry audit logged successfully",
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        message: error.message || "Failed to audit sync retry request",
      });
    }
  },
);

router.post(
  "/process",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO, ROLE_CODES.MAYOR),
  validateProcessSyncEntries,
  async (req, res) => {
    try {
      const results = await syncService.processSyncEntries({
        entries: req.validatedBody.entries,
        auth: req.auth,
      });

      return res.status(200).json({
        message: "Sync processing completed",
        data: results,
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        message: error.message || "Failed to process sync entries",
      });
    }
  },
);

router.get(
  "/status-summary",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO, ROLE_CODES.MAYOR),
  async (req, res) => {
    try {
      const payload = await syncService.getSyncStatusSummary({
        auth: req.auth,
      });

      return res.status(200).json({
        message: "Sync status summary fetched successfully",
        data: payload,
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        message: error.message || "Failed to fetch sync status summary",
      });
    }
  },
);

router.get(
  "/history",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO, ROLE_CODES.MAYOR),
  validateGetSyncHistory,
  async (req, res) => {
    try {
      const payload = await syncService.getSyncHistory({
        auth: req.auth,
        syncStatus: req.validatedQuery.sync_status,
        conflictStatus: req.validatedQuery.conflict_status,
        limit: req.validatedQuery.limit,
      });

      return res.status(200).json(payload);
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        message: error.message || "Failed to fetch sync history",
      });
    }
  },
);

router.get(
  "/conflicts/:conflictId",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO, ROLE_CODES.MAYOR),
  validateGetSyncConflictDetail,
  async (req, res) => {
    try {
      const payload = await syncService.getSyncConflictDetail({
        auth: req.auth,
        conflictId: req.validatedParams.conflictId,
      });

      return res.status(200).json({
        message: "Sync conflict detail fetched successfully",
        data: payload,
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        message: error.message || "Failed to fetch sync conflict detail",
      });
    }
  },
);

module.exports = router;
