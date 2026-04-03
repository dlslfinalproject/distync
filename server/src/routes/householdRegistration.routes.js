const express = require("express");

const householdRegistrationService = require("../services/householdRegistration.service");
const {
  validateCreateHouseholdRegistration,
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

module.exports = router;
