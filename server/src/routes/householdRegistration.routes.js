const express = require("express");

const householdRegistrationService = require("../services/householdRegistration.service");
const {
  validateCreateHouseholdRegistration,
  validateDepartHousehold,
} = require("../validators/householdRegistration.validator");

const router = express.Router();

router.post(
  "/register",
  validateCreateHouseholdRegistration,
  async (req, res) => {
    try {
      const registrationResult =
        await householdRegistrationService.registerHousehold(req.validatedBody);

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

router.post(
  "/:householdId/depart",
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
