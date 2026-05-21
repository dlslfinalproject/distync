const express = require("express");

const { ROLE_CODES, requireRoles } = require("../modules/auth/auth.middleware");
const mswdoReportService = require("../services/mswdoReport.service");
const {
  validateMswdoReportFilters,
} = require("../validators/mswdoReport.validator");

const router = express.Router();

router.get(
  "/anomalies",
  requireRoles(ROLE_CODES.MSWDO),
  validateMswdoReportFilters,
  async (req, res) => {
    try {
      const rows = await mswdoReportService.getAnomalyTracking(
        req.validatedQuery,
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
