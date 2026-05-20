const express = require("express");

const { ROLE_CODES, requireRoles } = require("../modules/auth/auth.middleware");
const householdRegistrationService = require("../services/householdRegistration.service");
const {
  validateCreateHouseholdRegistration,
  validateDepartHousehold,
  validateGetHouseholdDetails,
  validateUpdateHouseholdDetails,
} = require("../validators/householdRegistration.validator");

const router = express.Router();

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
        message: error.message || "Failed to update household",
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
        );

      return res.status(200).json({
        message: "Household departure recorded successfully",
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
