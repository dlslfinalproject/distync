const express = require("express");

const { ROLE_CODES, requireRoles } = require("../modules/auth/auth.middleware");
const settingsService = require("../services/settings.service");
const { validateSaveCurrentSettings } = require("../validators/settings.validator");

const router = express.Router();

router.get(
  "/current",
  requireRoles(ROLE_CODES.MAYOR, ROLE_CODES.MSWDO, ROLE_CODES.BARANGAY),
  async (req, res) => {
    try {
      const settings = await settingsService.getCurrentSettings({
        userId: req.auth.userId,
        roleCode: req.auth.roleCode,
      });

      return res.status(200).json({
        data: settings,
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        message: error.message || "Failed to load current settings",
      });
    }
  },
);

router.put(
  "/current",
  requireRoles(ROLE_CODES.MAYOR, ROLE_CODES.MSWDO, ROLE_CODES.BARANGAY),
  validateSaveCurrentSettings,
  async (req, res) => {
    try {
      const result = await settingsService.saveCurrentSettings({
        userId: req.auth.userId,
        roleCode: req.auth.roleCode,
        settings: req.validatedBody.settings,
        ipAddress: req.ip || null,
      });

      return res.status(200).json({
        message: "Settings saved successfully",
        data: result.settings,
        user: result.user,
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        message: error.message || "Failed to save current settings",
      });
    }
  },
);

module.exports = router;
