const MAX_PROFILE_PICTURE_BASE64_LENGTH = 3 * 1024 * 1024;
const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHILIPPINE_CONTACT_NUMBER_PATTERN = /^\+639\d{9}$/;
const PROFILE_PICTURE_ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
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
    return `+${compactValue.slice(1).replace(/\D/g, "").slice(0, 12)}`;
  }

  const digitsOnly = compactValue.replace(/\D/g, "");

  if (digitsOnly.startsWith("09")) {
    return `+63${digitsOnly.slice(1, 11)}`;
  }

  if (digitsOnly.startsWith("639")) {
    return `+${digitsOnly.slice(0, 12)}`;
  }

  if (digitsOnly.startsWith("9")) {
    return `+63${digitsOnly.slice(0, 10)}`;
  }

  if (digitsOnly.startsWith("63")) {
    return `+${digitsOnly.slice(0, 12)}`;
  }

  return "";
};

const validateSaveCurrentSettings = (req, res, next) => {
  try {
    const { settings } = req.body || {};

    if (!isPlainObject(settings)) {
      return res.status(400).json({
        message: "settings must be an object",
      });
    }

    if (settings.profile !== undefined && !isPlainObject(settings.profile)) {
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
      ];

      for (const [fieldKey, fieldName] of stringFieldChecks) {
        const validationError = validateOptionalString(
          settings.profile[fieldKey],
          fieldName,
        );

        if (validationError) {
          return res.status(400).json({ message: validationError });
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
        contactNumber &&
        !PHILIPPINE_CONTACT_NUMBER_PATTERN.test(contactNumber)
      ) {
        return res.status(400).json({
          message: "Please enter a valid contact number.",
        });
      }

      const emailAddress = normalizeEmailAddress(settings.profile.emailAddress);

      if (emailAddress && !EMAIL_ADDRESS_PATTERN.test(emailAddress)) {
        return res.status(400).json({
          message: "Please enter a valid email address.",
        });
      }

      if (
        settings.profile.profilePicturePath !== undefined ||
        settings.profile.profilePictureUrl !== undefined ||
        settings.profile.profilePictureUrlExpiresAt !== undefined ||
        settings.profile.profilePictureFileName !== undefined ||
        settings.profile.profilePictureUpdatedAt !== undefined ||
        settings.profile.profilePictureDataUrl !== undefined
      ) {
        return res.status(400).json({
          message:
            "Profile picture changes must use the dedicated profile picture endpoint.",
        });
      }
    }

    if (
      settings.notificationRulePreferences !== undefined &&
      !isPlainObject(settings.notificationRulePreferences)
    ) {
      return res.status(400).json({
        message: "notificationRulePreferences must be an object",
      });
    }

    if (isPlainObject(settings.notificationRulePreferences)) {
      for (const [ruleCode, channelValue] of Object.entries(
        settings.notificationRulePreferences,
      )) {
        if (!ruleCode.trim()) {
          return res.status(400).json({
            message: "notificationRulePreferences contains an invalid rule code",
          });
        }

        if (!isPlainObject(channelValue)) {
          return res.status(400).json({
            message: `notificationRulePreferences.${ruleCode} must be an object`,
          });
        }

        if (
          channelValue.inApp !== undefined &&
          typeof channelValue.inApp !== "boolean"
        ) {
          return res.status(400).json({
            message: `notificationRulePreferences.${ruleCode}.inApp must be a boolean`,
          });
        }

        if (
          channelValue.email !== undefined &&
          typeof channelValue.email !== "boolean"
        ) {
          return res.status(400).json({
            message: `notificationRulePreferences.${ruleCode}.email must be a boolean`,
          });
        }
      }
    }

    if (settings.metadata !== undefined && !isPlainObject(settings.metadata)) {
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
          return res.status(400).json({ message: validationError });
        }
      }
    }

    req.validatedBody = { settings };
    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate settings payload",
      error: error.message,
    });
  }
};

const validateUploadCurrentProfilePicture = (req, res, next) => {
  try {
    const { fileName, mimeType, fileDataBase64 } = req.body || {};

    const stringChecks = [
      [fileName, "fileName"],
      [mimeType, "mimeType"],
      [fileDataBase64, "fileDataBase64"],
    ];

    for (const [value, fieldName] of stringChecks) {
      const validationError = validateOptionalString(value, fieldName);

      if (validationError) {
        return res.status(400).json({ message: validationError });
      }
    }

    const normalizedMimeType = String(mimeType || "").trim().toLowerCase();
    const normalizedFileName = String(fileName || "").trim();
    const normalizedFileDataBase64 = String(fileDataBase64 || "").trim();

    if (!normalizedFileName) {
      return res.status(400).json({ message: "fileName is required" });
    }

    if (!PROFILE_PICTURE_ALLOWED_MIME_TYPES.has(normalizedMimeType)) {
      return res.status(400).json({
        message: "Profile picture must be a JPG, PNG, or WEBP image.",
      });
    }

    if (!normalizedFileDataBase64) {
      return res.status(400).json({ message: "fileDataBase64 is required" });
    }

    if (!/^[A-Za-z0-9+/=]+$/.test(normalizedFileDataBase64)) {
      return res.status(400).json({
        message: "fileDataBase64 must be a valid Base64 string",
      });
    }

    if (normalizedFileDataBase64.length > MAX_PROFILE_PICTURE_BASE64_LENGTH) {
      return res.status(400).json({
        message: "Profile picture is too large.",
      });
    }

    req.validatedBody = {
      fileName: normalizedFileName,
      mimeType: normalizedMimeType,
      fileDataBase64: normalizedFileDataBase64,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate profile picture upload payload",
      error: error.message,
    });
  }
};

module.exports = {
  validateSaveCurrentSettings,
  validateUploadCurrentProfilePicture,
};
