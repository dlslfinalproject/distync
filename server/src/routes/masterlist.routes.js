const express = require("express");

const {
  ROLE_CODES,
  requireAuthentication,
  requireRoles,
} = require("../modules/auth/auth.middleware");
const masterlistService = require("../services/masterlist.service");
const {
  validateExportMswdoMasterlist,
  validateGetBarangayDashboard,
  validateGetMasterlist,
} = require("../validators/masterlist.validator");

const router = express.Router();

router.get(
  "/barangay-dashboard",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO),
  validateGetBarangayDashboard,
  async (req, res) => {
    try {
      const dashboardQuery =
        req.auth.roleCode === ROLE_CODES.BARANGAY
          ? {
              ...req.validatedQuery,
              user_id: req.auth.userId,
              override_barangay_id: null,
            }
          : {
              ...req.validatedQuery,
              user_id: null,
            };

      const dashboard = await masterlistService.getBarangayDashboard(
        dashboardQuery,
      );

      return res.status(200).json(dashboard);
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        error: error.code || null,
        message: error.message || "Failed to fetch barangay dashboard",
      });
    }
  },
);

router.get(
  "/mswdo-dashboard",
  requireAuthentication,
  requireRoles(ROLE_CODES.MSWDO),
  validateGetMasterlist,
  async (req, res) => {
    try {
      const dashboard = await masterlistService.getMswdoMasterlistDashboard(
        req.validatedQuery,
      );

      return res.status(200).json(dashboard);
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        message: error.message || "Failed to fetch MSWDO masterlist dashboard",
      });
    }
  },
);

router.get(
  "/export",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO),
  validateExportMswdoMasterlist,
  async (req, res) => {
  try {
    const protectedQuery =
      req.auth.roleCode === ROLE_CODES.BARANGAY
        ? {
            ...req.validatedQuery,
            barangay_id: req.auth.defaultBarangayId,
            barangay_ids: req.auth.defaultBarangayId
              ? [req.auth.defaultBarangayId]
              : [],
            source_role: req.auth.roleCode,
          }
        : {
            ...req.validatedQuery,
            source_role: req.auth.roleCode,
          };

    const file = await masterlistService.exportMswdoMasterlist(
      protectedQuery,
    );

    res.setHeader("Content-Type", file.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${file.filename}"`,
    );

    return res.status(200).send(file.buffer);
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      message: error.message || "Failed to export MSWDO masterlist",
    });
  }
  },
);

router.get(
  "/",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO, ROLE_CODES.MAYOR),
  validateGetMasterlist,
  async (req, res) => {
  try {
    const protectedQuery =
      req.auth.roleCode === ROLE_CODES.BARANGAY
        ? {
            ...req.validatedQuery,
            barangay_id: req.auth.defaultBarangayId,
          }
        : req.validatedQuery;
    const masterlist = await masterlistService.getMasterlist(protectedQuery);

    return res.status(200).json(masterlist);
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      message: error.message || "Failed to fetch masterlist",
    });
  }
  },
);

module.exports = router;
