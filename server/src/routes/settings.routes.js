const express = require("express");

const { ROLE_CODES, requireRoles } = require("../modules/auth/auth.middleware");
const settingsService = require("../services/settings.service");
const {
  validateSaveCurrentSettings,
  validateUploadCurrentProfilePicture,
} = require("../validators/settings.validator");

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

router.get(
  "/current/profile-picture",
  requireRoles(ROLE_CODES.MAYOR, ROLE_CODES.MSWDO, ROLE_CODES.BARANGAY),
  async (req, res) => {
    try {
      const profilePicture = await settingsService.getCurrentProfilePicture({
        userId: req.auth.userId,
        roleCode: req.auth.roleCode,
      });

      return res.status(200).json({
        data: profilePicture,
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        message: error.message || "Failed to load current profile picture",
      });
    }
  },
);

router.post(
  "/current/profile-picture",
  requireRoles(ROLE_CODES.MAYOR, ROLE_CODES.MSWDO, ROLE_CODES.BARANGAY),
  validateUploadCurrentProfilePicture,
  async (req, res) => {
    try {
      const settings = await settingsService.uploadCurrentProfilePicture({
        userId: req.auth.userId,
        roleCode: req.auth.roleCode,
        fileName: req.validatedBody.fileName,
        mimeType: req.validatedBody.mimeType,
        fileDataBase64: req.validatedBody.fileDataBase64,
        ipAddress: req.ip || null,
      });

      return res.status(200).json({
        message: "Profile picture uploaded successfully",
        data: {
          profilePicturePath: settings.profile.profilePicturePath || "",
          profilePictureUrl: settings.profile.profilePictureUrl || "",
          profilePictureUrlExpiresAt:
            settings.profile.profilePictureUrlExpiresAt || "",
          profilePictureFileName:
            settings.profile.profilePictureFileName || "",
          profilePictureUpdatedAt:
            settings.profile.profilePictureUpdatedAt || "",
        },
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        message: error.message || "Failed to upload the profile picture",
      });
    }
  },
);

router.delete(
  "/current/profile-picture",
  requireRoles(ROLE_CODES.MAYOR, ROLE_CODES.MSWDO, ROLE_CODES.BARANGAY),
  async (req, res) => {
    try {
      const profilePicture = await settingsService.removeCurrentProfilePicture({
        userId: req.auth.userId,
        roleCode: req.auth.roleCode,
        ipAddress: req.ip || null,
      });

      return res.status(200).json({
        message: "Profile picture removed successfully",
        data: profilePicture,
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        message: error.message || "Failed to remove the profile picture",
      });
    }
  },
);

module.exports = router;
