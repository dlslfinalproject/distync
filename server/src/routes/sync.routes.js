const express = require("express");

const { ROLE_CODES, requireRoles } = require("../modules/auth/auth.middleware");
const syncService = require("../services/sync.service");
const {
  validateGetSyncHistory,
  validateProcessSyncEntries,
} = require("../validators/sync.validator");

const router = express.Router();

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

module.exports = router;
