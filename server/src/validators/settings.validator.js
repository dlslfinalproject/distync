const ALLOWED_EXPORT_FORMATS = new Set(["csv", "excel", "pdf"]);
const MAX_PROFILE_PICTURE_DATA_URL_LENGTH = 4 * 1024 * 1024;

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const validateOptionalString = (value, fieldName) => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return `${fieldName} must be a string`;
  }

  return null;
};

const validateSaveCurrentSettings = (req, res, next) => {
  try {
    const { settings } = req.body || {};

    if (!isPlainObject(settings)) {
      return res.status(400).json({
        message: "settings must be an object",
      });
    }

    if (
      settings.enabledNotificationRuleCodes !== undefined &&
      !Array.isArray(settings.enabledNotificationRuleCodes)
    ) {
      return res.status(400).json({
        message: "enabledNotificationRuleCodes must be an array",
      });
    }

    if (Array.isArray(settings.enabledNotificationRuleCodes)) {
      const hasInvalidRuleCode = settings.enabledNotificationRuleCodes.some(
        (entry) => typeof entry !== "string",
      );

      if (hasInvalidRuleCode) {
        return res.status(400).json({
          message: "enabledNotificationRuleCodes must contain string values",
        });
      }
    }

    if (settings.preferredExportFormat !== undefined) {
      if (typeof settings.preferredExportFormat !== "string") {
        return res.status(400).json({
          message: "preferredExportFormat must be a string",
        });
      }

      const normalizedExportFormat =
        settings.preferredExportFormat.trim().toLowerCase();

      if (!ALLOWED_EXPORT_FORMATS.has(normalizedExportFormat)) {
        return res.status(400).json({
          message: "preferredExportFormat must be csv, excel, or pdf",
        });
      }
    }

    if (
      settings.profile !== undefined &&
      !isPlainObject(settings.profile)
    ) {
      return res.status(400).json({
        message: "profile must be an object",
      });
    }

    if (isPlainObject(settings.profile)) {
      const stringFieldChecks = [
        ["fullName", "profile.fullName"],
        ["position", "profile.position"],
        ["contactNumber", "profile.contactNumber"],
        ["emailAddress", "profile.emailAddress"],
        ["profilePictureDataUrl", "profile.profilePictureDataUrl"],
        ["profilePictureFileName", "profile.profilePictureFileName"],
      ];

      for (const [fieldKey, fieldName] of stringFieldChecks) {
        const validationError = validateOptionalString(
          settings.profile[fieldKey],
          fieldName,
        );

        if (validationError) {
          return res.status(400).json({
            message: validationError,
          });
        }
      }

      const profilePictureDataUrl = settings.profile.profilePictureDataUrl?.trim();

      if (
        profilePictureDataUrl &&
        !profilePictureDataUrl.startsWith("data:image/")
      ) {
        return res.status(400).json({
          message:
            "profile.profilePictureDataUrl must be a valid image data URL",
        });
      }

      if (
        typeof profilePictureDataUrl === "string" &&
        profilePictureDataUrl.length > MAX_PROFILE_PICTURE_DATA_URL_LENGTH
      ) {
        return res.status(400).json({
          message: "profile.profilePictureDataUrl is too large",
        });
      }
    }

    if (
      settings.notificationChannels !== undefined &&
      !isPlainObject(settings.notificationChannels)
    ) {
      return res.status(400).json({
        message: "notificationChannels must be an object",
      });
    }

    if (isPlainObject(settings.notificationChannels)) {
      for (const [channelKey, channelValue] of Object.entries(
        settings.notificationChannels,
      )) {
        if (!isPlainObject(channelValue)) {
          return res.status(400).json({
            message: `notificationChannels.${channelKey} must be an object`,
          });
        }

        if (
          channelValue.inApp !== undefined &&
          typeof channelValue.inApp !== "boolean"
        ) {
          return res.status(400).json({
            message: `notificationChannels.${channelKey}.inApp must be a boolean`,
          });
        }

        if (
          channelValue.email !== undefined &&
          typeof channelValue.email !== "boolean"
        ) {
          return res.status(400).json({
            message: `notificationChannels.${channelKey}.email must be a boolean`,
          });
        }
      }
    }

    if (
      settings.metadata !== undefined &&
      !isPlainObject(settings.metadata)
    ) {
      return res.status(400).json({
        message: "metadata must be an object",
      });
    }

    if (isPlainObject(settings.metadata)) {
      const metadataFieldChecks = [
        ["lastProfileUpdateAt", "metadata.lastProfileUpdateAt"],
        ["lastPreferenceSaveAt", "metadata.lastPreferenceSaveAt"],
      ];

      for (const [fieldKey, fieldName] of metadataFieldChecks) {
        const validationError = validateOptionalString(
          settings.metadata[fieldKey],
          fieldName,
        );

        if (validationError) {
          return res.status(400).json({
            message: validationError,
          });
        }
      }
    }

    req.validatedBody = {
      settings,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate settings payload",
      error: error.message,
    });
  }
};

module.exports = {
  validateSaveCurrentSettings,
};
