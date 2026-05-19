const express = require("express");

const { ROLE_CODES, requireRoles } = require("../modules/auth/auth.middleware");
const stubService = require("../services/stub.service");
const {
  validateGetBarangayStubDashboard,
  validateStubSearch,
  validateStubId,
  validateStubVerify,
  validateClaimBarangayStub,
} = require("../validators/stub.validator");

const router = express.Router();

router.get(
  "/barangay-dashboard",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO),
  validateGetBarangayStubDashboard,
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
          }
        : {
            ...req.validatedBody,
            user_id: null,
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
