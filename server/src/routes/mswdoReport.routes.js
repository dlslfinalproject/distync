const express = require("express");

const { ROLE_CODES, requireRoles } = require("../modules/auth/auth.middleware");
const mswdoReportService = require("../services/mswdoReport.service");
const settingsRepository = require("../repositories/settings.repository");
const {
  validateMswdoReportFilters,
} = require("../validators/mswdoReport.validator");

const router = express.Router();

router.get(
  "/anomalies",
  requireRoles(ROLE_CODES.MSWDO, ROLE_CODES.BARANGAY),
  validateMswdoReportFilters,
  async (req, res) => {
    try {
      let assignedBarangayId = req.auth.defaultBarangayId;

      if (
        req.auth.roleCode === ROLE_CODES.BARANGAY &&
        !assignedBarangayId &&
        req.auth.userId
      ) {
        const user = await settingsRepository.getUserById(req.auth.userId);
        assignedBarangayId = user?.default_barangay_id || null;
      }

      if (req.auth.roleCode === ROLE_CODES.BARANGAY && !assignedBarangayId) {
        return res.status(403).json({
          message: "No assigned barangay. Please contact administrator.",
        });
      }

      const protectedQuery =
        req.auth.roleCode === ROLE_CODES.BARANGAY
          ? {
              ...req.validatedQuery,
              barangay_id: assignedBarangayId,
            }
          : req.validatedQuery;

      const rows = await mswdoReportService.getAnomalyTracking(
        protectedQuery,
      );

      return res.status(200).json({
        message: "MSWDO anomaly tracking fetched successfully",
        data: rows,
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        message: error.message || "Failed to fetch MSWDO anomalies",
      });
    }
  },
);

module.exports = router;
