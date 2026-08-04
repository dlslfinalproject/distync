const express = require("express");

const { ROLE_CODES, requireRoles } = require("../modules/auth/auth.middleware");
const householdRegistrationService = require("../services/householdRegistration.service");
const {
  validateCreateHouseholdRegistration,
  validateDuplicateRegistrationSuggestions,
  validateDepartHousehold,
  validateGetHouseholdDetails,
  validateUpdateHouseholdDetails,
  validateArchiveHousehold,
  validateRestoreHousehold,
  validateCorrectEvacuationLog,
} = require("../validators/householdRegistration.validator");

const router = express.Router();

router.post(
  "/duplicate-suggestions",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO),
  validateDuplicateRegistrationSuggestions,
  async (req, res) => {
    try {
      const suggestions =
        await householdRegistrationService.getDuplicateRegistrationSuggestions({
          ...req.validatedBody,
          registered_by: req.auth.userId,
        });

      return res.status(200).json({
        message: "Duplicate registration suggestions retrieved successfully",
        data: suggestions,
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        message: error.message || "Failed to fetch duplicate registration suggestions",
      });
    }
  },
);

router.post(
  "/register",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO),
  validateCreateHouseholdRegistration,
  async (req, res) => {
    try {
      const registrationResult =
        await householdRegistrationService.registerHousehold({
          ...req.validatedBody,
          registered_by: req.auth.userId,
        });

      return res.status(201).json({
        message: "Household registered successfully",
        data: registrationResult,
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        code: error.code || null,
        message: error.message || "Failed to register household",
      });
    }
  },
);

router.get(
  "/:householdId",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO),
  validateGetHouseholdDetails,
  async (req, res) => {
    try {
      const householdDetails =
        await householdRegistrationService.getHouseholdDetails({
          householdId: req.validatedParams.householdId,
          requester: req.auth,
        });

      return res.status(200).json({
        message: "Household details retrieved successfully",
        data: householdDetails,
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        message: error.message || "Failed to fetch household details",
      });
    }
  },
);

router.patch(
  "/:householdId",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO),
  validateUpdateHouseholdDetails,
  async (req, res) => {
    try {
      const householdDetails =
        await householdRegistrationService.updateHouseholdDetails({
          householdId: req.validatedParams.householdId,
          requester: req.auth,
          requestData: {
            ...req.validatedBody,
            registered_by: req.auth.userId,
          },
        });

      return res.status(200).json({
        message: "Household updated successfully",
        data: householdDetails,
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        code: error.code || null,
        message: error.message || "Failed to update household",
      });
    }
  },
);

router.patch(
  "/:householdId/archive",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO),
  validateArchiveHousehold,
  async (req, res) => {
    try {
      const archiveResult = await householdRegistrationService.archiveHousehold({
        householdId: req.validatedParams.householdId,
        requester: req.auth,
        archiveData: req.validatedBody,
      });

      return res.status(200).json({
        message: "Household archived successfully",
        data: archiveResult,
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        message: error.message || "Failed to archive household",
      });
    }
  },
);

router.patch(
  "/:householdId/restore",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO),
  validateRestoreHousehold,
  async (req, res) => {
    try {
      const restoreResult = await householdRegistrationService.restoreHousehold({
        householdId: req.validatedParams.householdId,
        requester: req.auth,
        restoreData: req.validatedBody,
      });

      return res.status(200).json({
        message: "Household return recorded successfully",
        data: restoreResult,
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        message: error.message || "Failed to record household return",
      });
    }
  },
);

router.patch(
  "/:householdId/evacuation-logs/:evacuationLogId/correct",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO),
  validateCorrectEvacuationLog,
  async (req, res) => {
    try {
      const correctionResult =
        await householdRegistrationService.correctEvacuationLog({
          householdId: req.validatedParams.householdId,
          evacuationLogId: req.validatedParams.evacuationLogId,
          requester: req.auth,
          correctionData: req.validatedBody,
        });

      return res.status(200).json({
        message: "Evacuation log corrected successfully",
        data: correctionResult,
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        message: error.message || "Failed to correct evacuation log",
      });
    }
  },
);

router.post(
  "/:householdId/depart",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO),
  validateDepartHousehold,
  async (req, res) => {
    try {
      const departureResult =
        await householdRegistrationService.departHousehold(
          req.validatedParams.householdId,
          req.validatedBody,
          req.auth,
        );

      return res.status(200).json({
        message: "Household departure recorded successfully and archived automatically",
        data: departureResult,
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        message: error.message || "Failed to record household departure",
      });
    }
  },
);

module.exports = router;
