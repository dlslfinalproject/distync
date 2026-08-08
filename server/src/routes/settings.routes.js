const express = require("express");
const crypto = require("crypto");

const { ROLE_CODES, requireRoles } = require("../modules/auth/auth.middleware");
const settingsService = require("../services/settings.service");
const { validateSaveCurrentSettings } = require("../validators/settings.validator");

const router = express.Router();

const buildRouteErrorContext = (req, error, operation) => ({
  requestId: crypto.randomUUID(),
  operation,
  statusCode: error?.statusCode || 500,
  sqlState: error?.code || "",
  userId: req?.auth?.userId || "",
  roleCode: req?.auth?.roleCode || "",
  stack:
    process.env.SERVER_ACCESS_MODE === "DEVELOPMENT" ? error?.stack || "" : "",
});

const logRouteError = (context, error) => {
  console.error(
    `[settings:${context.operation}] requestId=${context.requestId} status=${context.statusCode} sqlState=${context.sqlState || "n/a"} userId=${context.userId || "n/a"} role=${context.roleCode || "n/a"} message=${error?.message || "Unknown error"}`,
  );

  if (context.stack) {
    console.error(context.stack);
  }
};

const sendSettingsFailure = ({ req, res, error, operation, pictureAction = "" }) => {
  const statusCode = error?.statusCode || 500;

  if (statusCode < 500) {
    return res.status(statusCode).json({
      message: error.message || "Failed to save current settings",
    });
  }

  const context = buildRouteErrorContext(req, error, operation);
  logRouteError(context, error);

  if (pictureAction === "REPLACE" || pictureAction === "REMOVE") {
    return res.status(500).json({
      code: "PROFILE_PICTURE_SAVE_FAILED",
      message: "The selected profile picture could not be saved. Please try again.",
      requestId: context.requestId,
    });
  }

  return res.status(500).json({
    code: "SETTINGS_SAVE_FAILED",
    message: "Account settings could not be saved.",
    requestId: context.requestId,
  });
};

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
      const pictureAction =
        String(req?.validatedBody?.settings?.profilePicture?.action || "")
          .trim()
          .toUpperCase();

      return sendSettingsFailure({
        req,
        res,
        error,
        operation: "save-current-settings",
        pictureAction,
      });
    }
  },
);

module.exports = router;
