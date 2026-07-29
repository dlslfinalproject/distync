const ALLOWED_EXPORT_FORMATS = new Set(["csv", "excel", "pdf"]);
const MAX_PROFILE_PICTURE_DATA_URL_LENGTH = 4 * 1024 * 1024;
const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHILIPPINE_CONTACT_NUMBER_PATTERN = /^\+639\d{9}$/;
const PROFILE_PICTURE_ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
const ALLOWED_NOTIFICATION_CHANNEL_KEYS = new Set([
  "disasterAlerts",
  "distributionSchedules",
  "reliefArrivalNotifications",
  "attendanceReminders",
  "systemAnnouncements",
]);

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

const normalizeEmailAddress = (value) => String(value || "").trim();

const normalizePhilippineContactNumber = (value = "") => {
  const rawValue = String(value || "").trim();

  if (!rawValue) {
    return "";
  }

  const compactValue = rawValue.replace(/[^\d+]/g, "");

  if (compactValue.startsWith("+")) {
    const digitsAfterPlus = compactValue.slice(1).replace(/\D/g, "");

    if (digitsAfterPlus.startsWith("639")) {
      return `+${digitsAfterPlus.slice(0, 12)}`;
    }

    return `+${digitsAfterPlus.slice(0, 12)}`;
  }

  const digitsOnly = compactValue.replace(/\D/g, "");

  if (digitsOnly.startsWith("09")) {
    return `+63${digitsOnly.slice(1, 11)}`;
  }

  if (digitsOnly.startsWith("639")) {
    return `+${digitsOnly.slice(0, 12)}`;
  }

  if (digitsOnly.startsWith("63")) {
    return `+${digitsOnly.slice(0, 12)}`;
  }

  if (digitsOnly.startsWith("9")) {
    return `+63${digitsOnly.slice(0, 10)}`;
  }

  return "";
};

const isSupportedProfilePictureReference = (value = "") => {
  const trimmedValue = String(value || "").trim();

  if (!trimmedValue) {
    return true;
  }

  if (trimmedValue.startsWith("data:image/")) {
    return true;
  }

  if (trimmedValue.startsWith("/")) {
    return true;
  }

  try {
    const parsedUrl = new URL(trimmedValue);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch (_error) {
    return false;
  }
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

      if (
        settings.profile.fullName !== undefined &&
        !settings.profile.fullName.trim()
      ) {
        return res.status(400).json({
          message: "profile.fullName must not be empty",
        });
      }

      const contactNumber = normalizePhilippineContactNumber(
        settings.profile.contactNumber,
      );

      if (
        typeof contactNumber === "string" &&
        contactNumber &&
        !PHILIPPINE_CONTACT_NUMBER_PATTERN.test(contactNumber)
      ) {
        return res.status(400).json({
          message: "Please enter a valid contact number.",
        });
      }

      const emailAddress = normalizeEmailAddress(settings.profile.emailAddress);

      if (
        typeof emailAddress === "string" &&
        emailAddress &&
        !EMAIL_ADDRESS_PATTERN.test(emailAddress)
      ) {
        return res.status(400).json({
          message: "Please enter a valid email address.",
        });
      }

      const profilePictureDataUrl = settings.profile.profilePictureDataUrl?.trim();

      if (profilePictureDataUrl && !isSupportedProfilePictureReference(profilePictureDataUrl)) {
        return res.status(400).json({
          message:
            "profile.profilePictureDataUrl must be a valid image reference",
        });
      }

      if (profilePictureDataUrl.startsWith("data:image/")) {
        const profilePictureMimeType =
          profilePictureDataUrl.slice(5).split(";")[0].toLowerCase();

        if (!PROFILE_PICTURE_ALLOWED_MIME_TYPES.has(profilePictureMimeType)) {
          return res.status(400).json({
            message: "Profile picture must be a JPG, PNG, or WEBP image.",
          });
        }

        if (
          typeof profilePictureDataUrl === "string" &&
          profilePictureDataUrl.length > MAX_PROFILE_PICTURE_DATA_URL_LENGTH
        ) {
          return res.status(400).json({
            message: "Profile picture is too large.",
          });
        }
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
        if (!ALLOWED_NOTIFICATION_CHANNEL_KEYS.has(channelKey)) {
          return res.status(400).json({
            message: `notificationChannels.${channelKey} is not supported`,
          });
        }

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
