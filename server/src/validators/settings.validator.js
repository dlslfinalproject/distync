const MAX_PROFILE_PICTURE_BASE64_LENGTH = 3 * 1024 * 1024;
const PHILIPPINE_CONTACT_NUMBER_PATTERN = /^\+639\d{9}$/;
const PROFILE_PICTURE_ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
const NAME_VALUE_PATTERN =
  /^[\p{L}\p{M}][\p{L}\p{M}\p{N} .'-]*[\p{L}\p{M}\p{N}.']?$|^[\p{L}\p{M}]$/u;
const NAME_MAX_LENGTH = 100;
const PROFILE_ALLOWED_FIELDS = new Set([
  "firstName",
  "middleName",
  "lastName",
  "contactNumber",
]);
const PROFILE_PICTURE_ACTIONS = new Set(["UNCHANGED", "REPLACE", "REMOVE"]);
const SETTINGS_ALLOWED_FIELDS = new Set([
  "profile",
  "notificationRulePreferences",
  "profilePicture",
  "metadata",
]);
const LEGACY_NOTIFICATION_SETTINGS_FIELDS = new Set([
  "enabledNotificationRuleCodes",
  "notificationChannels",
  "preferences",
  "enabled_notification_rule_codes_json",
  "notification_channels_json",
  "notification_rule_preferences_json",
]);
const LEGACY_PROFILE_PICTURE_FIELDS = new Set([
  "profilePictureDataUrl",
  "profile_picture_data_url",
]);
const PROFILE_PROTECTED_FIELDS = new Set([
  "fullName",
  "email",
  "emailAddress",
  "role",
  "roleCode",
  "position",
  "assignedBarangay",
  "barangayId",
  "accountStatus",
  "userId",
  "createdAt",
  "updatedAt",
  "provider",
  "googleSub",
  "profilePicturePath",
  "profilePictureUrl",
  "profilePictureUrlExpiresAt",
  "profilePictureFileName",
  "profilePictureUpdatedAt",
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

const normalizeProfileName = (value = "") =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ");

const isRejectedProfilePictureContent = (value = "") => {
  const normalizedValue = String(value || "").trim().toLowerCase();

  if (!normalizedValue) {
    return false;
  }

  return (
    normalizedValue.startsWith("data:") ||
    normalizedValue.startsWith("blob:") ||
    normalizedValue.startsWith("http://") ||
    normalizedValue.startsWith("https://") ||
    normalizedValue.startsWith("/assets/") ||
    normalizedValue.startsWith("/public/") ||
    normalizedValue.startsWith("./") ||
    normalizedValue.startsWith("../") ||
    normalizedValue.includes("\\") ||
    /^[a-z]:/i.test(normalizedValue)
  );
};

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

const validateProfileNameField = ({ label, value, required = false }) => {
  if (value === undefined || value === null) {
    return required ? `${label} is required.` : "";
  }

  if (typeof value !== "string") {
    return `${label} must be a string.`;
  }

  const normalizedValue = normalizeProfileName(value);

  if (!normalizedValue) {
    return required ? `${label} is required.` : "";
  }

  if (normalizedValue.length > NAME_MAX_LENGTH) {
    return `${label} is too long.`;
  }

  if (!NAME_VALUE_PATTERN.test(normalizedValue)) {
    return "The name contains unsupported characters.";
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

    const settingsKeys = Object.keys(settings);
    const legacyNotificationFields = settingsKeys.filter((key) =>
      LEGACY_NOTIFICATION_SETTINGS_FIELDS.has(key),
    );
    const unsupportedSettingsFields = settingsKeys.filter(
      (key) =>
        !SETTINGS_ALLOWED_FIELDS.has(key) &&
        !LEGACY_NOTIFICATION_SETTINGS_FIELDS.has(key),
    );

    if (legacyNotificationFields.length > 0) {
      return res.status(400).json({
        message:
          "Notification preferences must be submitted through the approved modern settings format.",
      });
    }

    if (unsupportedSettingsFields.length > 0) {
      return res.status(400).json({
        message: "The settings update contains unsupported fields.",
      });
    }

    if (settings.profile !== undefined && !isPlainObject(settings.profile)) {
      return res.status(400).json({
        message: "profile must be an object",
      });
    }

    if (isPlainObject(settings.profile)) {
      const profileKeys = Object.keys(settings.profile);
      const legacyProfilePictureFields = profileKeys.filter((key) =>
        LEGACY_PROFILE_PICTURE_FIELDS.has(key),
      );
      const protectedFields = profileKeys.filter((key) =>
        PROFILE_PROTECTED_FIELDS.has(key),
      );
      const unknownFields = profileKeys.filter(
        (key) =>
          !PROFILE_ALLOWED_FIELDS.has(key) && !PROFILE_PROTECTED_FIELDS.has(key),
      );

      if (legacyProfilePictureFields.length > 0) {
        return res.status(400).json({
          message:
            "Profile picture data must be uploaded through the approved profile-picture workflow.",
        });
      }

      if (protectedFields.length > 0) {
        return res.status(400).json({
          message:
            "Email, role, and barangay assignment cannot be changed from Account Settings.",
        });
      }

      if (unknownFields.length > 0) {
        return res.status(400).json({
          message: "The profile update contains unsupported fields.",
        });
      }

      const firstNameError = validateProfileNameField({
        label: "First name",
        value: settings.profile.firstName,
        required: true,
      });

      if (firstNameError) {
        return res.status(400).json({ message: firstNameError });
      }

      const middleNameError = validateProfileNameField({
        label: "Middle name",
        value: settings.profile.middleName,
      });

      if (middleNameError) {
        return res.status(400).json({ message: middleNameError });
      }

      const lastNameError = validateProfileNameField({
        label: "Last name",
        value: settings.profile.lastName,
        required: true,
      });

      if (lastNameError) {
        return res.status(400).json({ message: lastNameError });
      }

      const contactNumberValidationError = validateOptionalString(
        settings.profile.contactNumber,
        "profile.contactNumber",
      );

      if (contactNumberValidationError) {
        return res.status(400).json({ message: contactNumberValidationError });
      }

      const contactNumber = normalizePhilippineContactNumber(
        settings.profile.contactNumber,
      );

      if (
        settings.profile.contactNumber !== undefined &&
        (!contactNumber || !PHILIPPINE_CONTACT_NUMBER_PATTERN.test(contactNumber))
      ) {
        return res.status(400).json({
          message: "Please enter a valid contact number.",
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

    if (
      settings.profilePicture !== undefined &&
      !isPlainObject(settings.profilePicture)
    ) {
      return res.status(400).json({
        message: "profilePicture must be an object",
      });
    }

    if (isPlainObject(settings.profilePicture)) {
      const { action, fileName, mimeType, fileDataBase64 } =
        settings.profilePicture;
      const normalizedAction = String(action || "UNCHANGED").trim().toUpperCase();

      if (!PROFILE_PICTURE_ACTIONS.has(normalizedAction)) {
        return res.status(400).json({
          message: "profilePicture.action is invalid",
        });
      }

      if (normalizedAction === "REPLACE") {
        const stringChecks = [
          [fileName, "profilePicture.fileName"],
          [mimeType, "profilePicture.mimeType"],
          [fileDataBase64, "profilePicture.fileDataBase64"],
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
          return res.status(400).json({
            message: "profilePicture.fileName is required",
          });
        }

        if (!PROFILE_PICTURE_ALLOWED_MIME_TYPES.has(normalizedMimeType)) {
          return res.status(400).json({
            message: "Profile picture must be a JPG, PNG, or WEBP image.",
          });
        }

        if (!normalizedFileDataBase64) {
          return res.status(400).json({
            message: "profilePicture.fileDataBase64 is required",
          });
        }

        if (isRejectedProfilePictureContent(normalizedFileDataBase64)) {
          return res.status(400).json({
            message:
              "The selected profile picture could not be processed. Choose another image and try again.",
          });
        }

        if (!/^[A-Za-z0-9+/=]+$/.test(normalizedFileDataBase64)) {
          return res.status(400).json({
            message: "profilePicture.fileDataBase64 must be a valid Base64 string",
          });
        }

        if (normalizedFileDataBase64.length > MAX_PROFILE_PICTURE_BASE64_LENGTH) {
          return res.status(400).json({
            message: "Profile picture is too large.",
          });
        }
      } else if (
        fileName !== undefined ||
        mimeType !== undefined ||
        fileDataBase64 !== undefined
      ) {
        return res.status(400).json({
          message:
            normalizedAction === "REMOVE"
              ? "Profile picture removal cannot include replacement content."
              : "Unchanged profile pictures cannot include upload content.",
        });
      }

      req.validatedBody = {
        ...(req.validatedBody || {}),
        settings: {
          ...settings,
          profilePicture: {
            action: normalizedAction,
            ...(normalizedAction === "REPLACE"
              ? {
                  fileName: String(fileName || "").trim(),
                  mimeType: String(mimeType || "").trim().toLowerCase(),
                  fileDataBase64: String(fileDataBase64 || "").trim(),
                }
              : {}),
          },
        },
      };
    }

    if (settings.metadata !== undefined && !isPlainObject(settings.metadata)) {
      return res.status(400).json({
        message: "metadata must be an object",
      });
    }

    req.validatedBody = req.validatedBody || { settings };
    return next();
  } catch (_error) {
    return res.status(500).json({
      message: "Failed to validate settings payload",
    });
  }
};

module.exports = {
  validateSaveCurrentSettings,
};
