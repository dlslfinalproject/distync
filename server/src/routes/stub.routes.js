const express = require("express");

const { ROLE_CODES, requireRoles } = require("../modules/auth/auth.middleware");
const stubService = require("../services/stub.service");
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
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      error: error.code || null,
      message: error.message || "Failed to claim stub",
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

    return res.status(200).json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      message: error.message || "Failed to verify stub",
    });
  }
  },
);

module.exports = router;
