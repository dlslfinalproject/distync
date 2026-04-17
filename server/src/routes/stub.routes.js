const express = require("express");

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
  validateGetBarangayStubDashboard,
  async (req, res) => {
    try {
      const dashboard = await stubService.getBarangayStubDashboard(
        req.validatedQuery,
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

router.get("/search", validateStubSearch, async (req, res) => {
  try {
    const results = await stubService.getSearchResults(req.validatedQuery);

    return res.status(200).json(results);
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      message: error.message || "Failed to search stubs",
    });
  }
});

router.post("/:id/claim", validateClaimBarangayStub, async (req, res) => {
  try {
    const result = await stubService.claimBarangayStub(req.validatedBody);

    return res.status(200).json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      error: error.code || null,
      message: error.message || "Failed to claim stub",
    });
  }
});

router.get("/:id", validateStubId, async (req, res) => {
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
});

router.post("/verify", validateStubVerify, async (req, res) => {
  try {
    const result = await stubService.verifyStub(req.validatedBody);

    return res.status(200).json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      message: error.message || "Failed to verify stub",
    });
  }
});

module.exports = router;
