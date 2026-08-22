const express = require("express");

const { ROLE_CODES, requireRoles } = require("../modules/auth/auth.middleware");
const mswdoReportService = require("../services/mswdoReport.service");
const settingsRepository = require("../repositories/settings.repository");
const {
  validateMswdoReportFilters,
  validateAnomalyReviewPayload,
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
              role_scope: ROLE_CODES.BARANGAY,
            }
          : {
              ...req.validatedQuery,
              role_scope: req.auth.roleCode,
            };

      const report = await mswdoReportService.getAnomalyTracking(
        protectedQuery,
      );
      const rows = Array.isArray(report) ? report : report.items;

      return res.status(200).json({
        message: "MSWDO anomaly tracking fetched successfully",
        data: rows || [],
        pagination: report.pagination || null,
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        message: error.message || "Failed to fetch MSWDO anomalies",
      });
    }
  },
);

router.post(
  "/anomalies/reviews",
  requireRoles(ROLE_CODES.BARANGAY),
  validateAnomalyReviewPayload,
  async (req, res) => {
    try {
      let assignedBarangayId = req.auth.defaultBarangayId;

      if (!assignedBarangayId && req.auth.userId) {
        const user = await settingsRepository.getUserById(req.auth.userId);
        assignedBarangayId = user?.default_barangay_id || null;
      }

      if (!assignedBarangayId) {
        return res.status(403).json({
          message: "No assigned barangay. Please contact administrator.",
        });
      }

      const review = await mswdoReportService.upsertBarangayAnomalyReview({
        payload: req.validatedBody,
        barangayId: assignedBarangayId,
        auth: {
          ...req.auth,
          ipAddress: req.ip || null,
        },
      });

      return res.status(200).json({
        message: "Barangay anomaly review saved successfully",
        data: review,
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        code: error.code || null,
        message: error.message || "Failed to save Barangay anomaly review",
      });
    }
  },
);

module.exports = router;
