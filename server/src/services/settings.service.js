const pool = require("../config/db");
const settingsRepository = require("../repositories/settings.repository");
const notificationRepository = require("../modules/notifications/notification.repository");
const notificationService = require("../modules/notifications/notification.service");
const profilePictureStorageService = require("./profilePictureStorage.service");
const { insertAuditLog } = require("../repositories/systemLog.repository");
const {
  buildPreferenceCategories,
  getDefaultEffectiveChannels,
  getEditableChannels,
  resolveEffectiveChannels,
  sanitizeNotificationRulePreferences,
} = require("../modules/notifications/notificationPreferenceUtils");

const SETTINGS_AUDIT_ACTION = "UPSERT_ROLE_SETTINGS";
const SETTINGS_ENTITY_TYPE = "ROLE_SETTINGS";
const PROFILE_UPDATED_AUDIT_ACTION = "PROFILE_UPDATED";
const PROFILE_PICTURE_UPLOADED_AUDIT_ACTION = "PROFILE_PICTURE_UPLOADED";
const PROFILE_PICTURE_REPLACED_AUDIT_ACTION = "PROFILE_PICTURE_REPLACED";
const PROFILE_PICTURE_REMOVED_AUDIT_ACTION = "PROFILE_PICTURE_REMOVED";
const NOTIFICATION_UPDATE_AUDIT_ACTION = "UPDATE_NOTIFICATION_PREFERENCES";
const NOTIFICATION_RESET_AUDIT_ACTION = "RESET_NOTIFICATION_PREFERENCES";
const NOTIFICATION_REJECTED_MANDATORY_ACTION =
  "REJECT_DISABLE_MANDATORY_NOTIFICATION";
const NOTIFICATION_REJECTED_EMAIL_ACTION =
  "REJECT_UNSUPPORTED_NOTIFICATION_EMAIL";
const NOTIFICATION_REJECTED_UNKNOWN_RULE_ACTION =
  "REJECT_UNKNOWN_NOTIFICATION_RULE";
const NOTIFICATION_REJECTED_CROSS_ROLE_ACTION =
  "REJECT_CROSS_ROLE_NOTIFICATION_RULE";
const ALLOWED_ROLE_CODES = new Set(["BARANGAY", "MSWDO", "MAYOR"]);
const ROLE_POSITION_LABELS = {
  BARANGAY: "Barangay Official",
  MSWDO: "MSWDO Personnel",
  MAYOR: "Office of the Mayor",
};
const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHILIPPINE_CONTACT_NUMBER_PATTERN = /^\+639\d{9}$/;
const NAME_VALUE_PATTERN =
  /^[\p{L}\p{M}][\p{L}\p{M}\p{N} .'-]*[\p{L}\p{M}\p{N}.']?$|^[\p{L}\p{M}]$/u;
const NAME_MAX_LENGTH = 100;
const PROFILE_PICTURE_ACTIONS = {
  UNCHANGED: "UNCHANGED",
  REPLACE: "REPLACE",
  REMOVE: "REMOVE",
};

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const sanitizeString = (value, fallbackValue = "") => {
  if (typeof value !== "string") {
    return fallbackValue;
  }

  return value.trim();
};

const normalizeEmailAddress = (value) => sanitizeString(value);
const normalizeNameField = (value) =>
  sanitizeString(value).replace(/\s+/g, " ");

const normalizePhilippineContactNumber = (value = "") => {
  const rawValue = sanitizeString(value);

  if (!rawValue) {
    return "";
  }

  const compactValue = rawValue.replace(/[^\d+]/g, "");

  if (compactValue.startsWith("+")) {
    const digitsAfterPlus = compactValue.slice(1).replace(/\D/g, "");
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

const normalizeTimestampValue = (value) => {
  if (!value) {
    return "";
  }

  const parsedValue = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsedValue.getTime()) ? "" : parsedValue.toISOString();
};

const parseTimestampValue = (value) => {
  const normalizedValue = sanitizeString(value);
  if (!normalizedValue) {
    return null;
  }

  const parsedValue = new Date(normalizedValue);
  return Number.isNaN(parsedValue.getTime()) ? null : parsedValue.toISOString();
};

const buildDisplayName = ({
  firstName = "",
  middleName = "",
  lastName = "",
} = {}) =>
  [firstName, middleName, lastName]
    .map((value) => normalizeNameField(value))
    .filter(Boolean)
    .join(" ");

const getRolePositionLabel = (roleCode) => ROLE_POSITION_LABELS[roleCode] || "";

const createDefaultRoleSettings = () => ({
  roleCode: "",
  profile: {
    firstName: "",
    middleName: "",
    lastName: "",
    position: "",
    contactNumber: "",
    emailAddress: "",
    assignedBarangay: null,
    profilePicturePath: "",
    profilePictureUrl: "",
    profilePictureUrlExpiresAt: "",
    profilePictureFileName: "",
    profilePictureUpdatedAt: "",
  },
  notificationRulePreferences: {},
  categories: [],
  metadata: {
    lastProfileUpdateAt: "",
    lastPreferenceSaveAt: "",
  },
});

const buildPersistedSnapshot = (settings = {}) => {
  const defaults = createDefaultRoleSettings();

  return {
    profile: {
      ...defaults.profile,
      firstName: normalizeNameField(settings?.profile?.firstName),
      middleName: normalizeNameField(settings?.profile?.middleName) || null,
      lastName: normalizeNameField(settings?.profile?.lastName),
      position: sanitizeString(settings?.profile?.position),
      contactNumber: sanitizeString(settings?.profile?.contactNumber),
      emailAddress: sanitizeString(settings?.profile?.emailAddress),
      assignedBarangay: isPlainObject(settings?.profile?.assignedBarangay)
        ? {
            id: sanitizeString(settings.profile.assignedBarangay.id),
            name: sanitizeString(settings.profile.assignedBarangay.name),
          }
        : null,
      profilePicturePath: profilePictureStorageService.normalizeStoragePath(
        settings?.profile?.profilePicturePath,
      ),
      profilePictureUrl: sanitizeString(settings?.profile?.profilePictureUrl),
      profilePictureUrlExpiresAt: sanitizeString(
        settings?.profile?.profilePictureUrlExpiresAt,
      ),
      profilePictureFileName: sanitizeString(
        settings?.profile?.profilePictureFileName,
      ),
      profilePictureUpdatedAt: sanitizeString(
        settings?.profile?.profilePictureUpdatedAt,
      ),
    },
    notificationRulePreferences: sanitizeNotificationRulePreferences(
      settings?.notificationRulePreferences,
    ),
    metadata: {
      ...defaults.metadata,
      lastProfileUpdateAt: sanitizeString(settings?.metadata?.lastProfileUpdateAt),
      lastPreferenceSaveAt: sanitizeString(settings?.metadata?.lastPreferenceSaveAt),
    },
  };
};

const buildEditableSettingsSnapshot = (settings = {}) => {
  const profile = isPlainObject(settings.profile) ? settings.profile : {};
  const metadata = isPlainObject(settings.metadata) ? settings.metadata : {};
  const hasProfilePayload = isPlainObject(settings.profile);
  const hasNotificationPreferencePayload = isPlainObject(
    settings.notificationRulePreferences || settings.preferences,
  );
  const profilePicture = isPlainObject(settings.profilePicture)
    ? settings.profilePicture
    : {};
  const normalizedPictureAction = sanitizeString(profilePicture.action).toUpperCase();

  return {
    profile: {
      firstName: hasProfilePayload
        ? normalizeNameField(profile.firstName)
        : undefined,
      middleName: hasProfilePayload
        ? normalizeNameField(profile.middleName)
        : undefined,
      lastName: hasProfilePayload
        ? normalizeNameField(profile.lastName)
        : undefined,
      contactNumber: hasProfilePayload
        ? sanitizeString(profile.contactNumber)
        : undefined,
    },
    notificationRulePreferences: sanitizeNotificationRulePreferences(
      settings.notificationRulePreferences || settings.preferences,
    ),
    hasNotificationPreferencePayload,
    profilePicture: {
      action:
        PROFILE_PICTURE_ACTIONS[normalizedPictureAction] ||
        PROFILE_PICTURE_ACTIONS.UNCHANGED,
      fileName: sanitizeString(profilePicture.fileName),
      mimeType: sanitizeString(profilePicture.mimeType).toLowerCase(),
      fileDataBase64: sanitizeString(profilePicture.fileDataBase64),
    },
    metadata: {
      lastProfileUpdateAt: sanitizeString(metadata.lastProfileUpdateAt),
      lastPreferenceSaveAt: sanitizeString(metadata.lastPreferenceSaveAt),
    },
  };
};

const buildPersistedSettingsFromRecord = (record = {}) => ({
  profile: {
    firstName: "",
    middleName: "",
    lastName: "",
    position: "",
    contactNumber: "",
    emailAddress: "",
    assignedBarangay: null,
    profilePicturePath: profilePictureStorageService.normalizeStoragePath(
      record.profile_picture_path,
    ),
    profilePictureUrl: "",
    profilePictureUrlExpiresAt: "",
    profilePictureFileName: sanitizeString(record.profile_picture_file_name),
    profilePictureUpdatedAt: normalizeTimestampValue(
      record.profile_picture_updated_at,
    ),
  },
  notificationRulePreferences: sanitizeNotificationRulePreferences(
    record.notification_rule_preferences_json,
  ),
  metadata: {
    lastProfileUpdateAt: normalizeTimestampValue(record.last_profile_update_at),
    lastPreferenceSaveAt: normalizeTimestampValue(record.last_preference_save_at),
  },
  legacyPreferenceSource: {
    enabledNotificationRuleCodes: record.enabled_notification_rule_codes_json || [],
    notificationChannels: record.notification_channels_json || {},
  },
});

const buildUserRoleSettingsPayload = (settings = {}) => ({
  profilePicturePath: profilePictureStorageService.normalizeStoragePath(
    settings?.profile?.profilePicturePath,
  ),
  profilePictureFileName: sanitizeString(settings?.profile?.profilePictureFileName),
  profilePictureUpdatedAt: parseTimestampValue(
    settings?.profile?.profilePictureUpdatedAt,
  ),
  enabledNotificationRuleCodesJson: [],
  notificationChannelsJson: {},
  notificationRulePreferencesJson: sanitizeNotificationRulePreferences(
    settings.notificationRulePreferences,
  ),
  lastProfileUpdateAt: parseTimestampValue(settings?.metadata?.lastProfileUpdateAt),
  lastPreferenceSaveAt:
    parseTimestampValue(settings?.metadata?.lastPreferenceSaveAt) ||
    new Date().toISOString(),
});

const validateNameFieldOrThrow = ({
  label,
  value,
  required = false,
}) => {
  const normalizedValue = normalizeNameField(value);

  if (!normalizedValue) {
    if (required) {
      const error = new Error(`${label} is required.`);
      error.statusCode = 400;
      throw error;
    }

    return null;
  }

  if (normalizedValue.length > NAME_MAX_LENGTH) {
    const error = new Error(`${label} is too long.`);
    error.statusCode = 400;
    throw error;
  }

  if (!NAME_VALUE_PATTERN.test(normalizedValue)) {
    const error = new Error("The name contains unsupported characters.");
    error.statusCode = 400;
    throw error;
  }

  return normalizedValue;
};

const validateEmailAddressOrThrow = (value) => {
  const normalizedValue = normalizeEmailAddress(value);

  if (!normalizedValue || !EMAIL_ADDRESS_PATTERN.test(normalizedValue)) {
    const error = new Error("Please enter a valid email address.");
    error.statusCode = 400;
    throw error;
  }

  return normalizedValue;
};

const validateContactNumberOrThrow = (value) => {
  const normalizedValue = normalizePhilippineContactNumber(value);

  if (!normalizedValue || !PHILIPPINE_CONTACT_NUMBER_PATTERN.test(normalizedValue)) {
    const error = new Error("Please enter a valid contact number.");
    error.statusCode = 400;
    throw error;
  }

  return normalizedValue;
};

const ensureAllowedRole = (roleCode) => {
  if (ALLOWED_ROLE_CODES.has(roleCode)) {
    return;
  }

  const error = new Error("This role is not allowed to manage settings.");
  error.statusCode = 403;
  throw error;
};

const ensureUserExists = (user) => {
  if (user) {
    return;
  }

  const error = new Error("Authenticated user account was not found.");
  error.statusCode = 404;
  throw error;
};

const ensureUserIsActive = (user) => {
  if (user?.is_active) {
    return;
  }

  const error = new Error("This account is inactive and cannot manage settings.");
  error.statusCode = 403;
  throw error;
};

const buildSessionUser = (user, roleCode) => ({
  id: user.id,
  email: user.email,
  first_name: user.first_name,
  middle_name: user.middle_name || null,
  last_name: user.last_name,
  contact_number: user.contact_number || null,
  role: roleCode,
  default_barangay_id: user.default_barangay_id || null,
  is_active: user.is_active,
});

const buildProfileFieldAuditValues = (user = {}) => ({
  firstName: normalizeNameField(user.first_name),
  middleName: normalizeNameField(user.middle_name) || null,
  lastName: normalizeNameField(user.last_name),
  contactNumber: sanitizeString(user.contact_number),
});

const buildAuditSafeSettingsSnapshot = (settings = {}) => {
  const normalizedSettings = buildPersistedSnapshot(settings);
  const hasProfilePicture = Boolean(normalizedSettings.profile.profilePicturePath);

  return {
    ...normalizedSettings,
    profile: {
      ...normalizedSettings.profile,
      profilePicturePath: hasProfilePicture ? "[private profile picture path]" : "",
      profilePictureUrl: "",
      profilePictureUrlExpiresAt: "",
    },
  };
};

const attachSignedProfilePictureMetadata = async (settings = {}) => {
  const normalizedSettings = buildPersistedSnapshot(settings);
  const profilePicturePath = normalizedSettings.profile.profilePicturePath;

  if (!profilePicturePath) {
    return {
      ...settings,
      profile: {
        ...(settings.profile || {}),
        ...normalizedSettings.profile,
      },
    };
  }

  const signedUrlMetadata =
    await profilePictureStorageService.createSignedProfilePictureUrl(
      profilePicturePath,
    );

  return {
    ...settings,
    profile: {
      ...(settings.profile || {}),
      ...normalizedSettings.profile,
      ...signedUrlMetadata,
    },
  };
};

const getRolePolicyRows = async ({ roleCode, dbClient }) =>
  notificationRepository.getNotificationPolicyRowsByRoleCode(roleCode, dbClient);

const buildEffectivePreferenceMap = ({
  policyRows,
  storedPreferences,
}) =>
  policyRows.reduce((current, policyRow) => {
    current[policyRow.code] = resolveEffectiveChannels({
      policyRow,
      storedPreferences,
    });
    return current;
  }, {});

const buildNotificationSettingsResponse = ({
  roleCode,
  policyRows,
  storedPreferences,
}) => ({
  notificationRulePreferences: sanitizeNotificationRulePreferences(storedPreferences),
  effectiveNotificationChannels: buildEffectivePreferenceMap({
    policyRows,
    storedPreferences,
  }),
  categories: buildPreferenceCategories({
    roleCode,
    policyRows,
    storedPreferences,
  }),
});

const buildRoleSettingsResponse = async ({
  roleCode,
  user,
  snapshot,
  assignedBarangay = null,
  dbClient,
}) => {
  const defaults = createDefaultRoleSettings();
  const normalizedSnapshot = buildPersistedSnapshot(snapshot || {});
  const policyRows = await getRolePolicyRows({ roleCode, dbClient });
  const notificationSettings = buildNotificationSettingsResponse({
    roleCode,
    policyRows,
    storedPreferences: normalizedSnapshot.notificationRulePreferences,
  });

  return {
    ...defaults,
    roleCode,
    profile: {
      ...defaults.profile,
      ...normalizedSnapshot.profile,
      firstName: normalizeNameField(user?.first_name),
      middleName: normalizeNameField(user?.middle_name) || null,
      lastName: normalizeNameField(user?.last_name),
      position: getRolePositionLabel(roleCode),
      contactNumber: sanitizeString(
        user?.contact_number || normalizedSnapshot.profile.contactNumber,
      ),
      emailAddress: sanitizeString(
        user?.email || normalizedSnapshot.profile.emailAddress,
      ),
      assignedBarangay:
        assignedBarangay && assignedBarangay.id
          ? {
              id: assignedBarangay.id,
              name: sanitizeString(assignedBarangay.name),
            }
          : null,
    },
    notificationRulePreferences: notificationSettings.notificationRulePreferences,
    effectiveNotificationChannels: notificationSettings.effectiveNotificationChannels,
    categories: notificationSettings.categories,
    metadata: {
      ...defaults.metadata,
      ...normalizedSnapshot.metadata,
    },
  };
};

const getValidatedUserAndSnapshot = async ({
  userId,
  roleCode,
  dbClient,
}) => {
  const [user, latestSnapshot] = await Promise.all([
    settingsRepository.getUserById(userId, dbClient),
    settingsRepository.getUserRoleSettings({ userId, roleCode }, dbClient),
  ]);

  ensureUserExists(user);
  ensureUserIsActive(user);

  const assignedBarangay = user.default_barangay_id
    ? await settingsRepository.getBarangayById(user.default_barangay_id, dbClient)
    : null;

  return {
    user,
    assignedBarangay,
    snapshot: buildPersistedSettingsFromRecord(latestSnapshot || {}),
  };
};

const logRejectedPreferenceAttempt = async ({
  dbClient,
  userId,
  roleCode,
  action,
  ruleCode,
  attemptedValues,
  reason,
}) => {
  await insertAuditLog(
    {
      user_id: userId,
      role_code: roleCode,
      device_id: null,
      action,
      entity_type: "NOTIFICATION_RULE",
      entity_id: ruleCode,
      old_values_json: {},
      new_values_json: {
        ruleCode,
        attemptedValues,
        reason,
      },
      ip_address: null,
    },
    dbClient,
  );
};

const validateAndNormalizeNotificationPreferences = async ({
  userId,
  roleCode,
  incomingPreferences,
  dbClient,
}) => {
  const policyRows = await getRolePolicyRows({ roleCode, dbClient });
  const policyMap = new Map(policyRows.map((row) => [row.code, row]));
  const sanitizedIncomingPreferences = sanitizeNotificationRulePreferences(
    incomingPreferences,
  );

  for (const [ruleCode, attemptedValues] of Object.entries(
    sanitizedIncomingPreferences,
  )) {
    const policyRow = policyMap.get(ruleCode);

    if (!policyRow) {
      await logRejectedPreferenceAttempt({
        dbClient,
        userId,
        roleCode,
        action: NOTIFICATION_REJECTED_UNKNOWN_RULE_ACTION,
        ruleCode,
        attemptedValues,
        reason: "unknown_or_cross_role_rule",
      });

      const error = new Error(
        `Notification rule ${ruleCode} is not available for your role.`,
      );
      error.statusCode = 400;
      throw error;
    }

    const editableChannels = getEditableChannels(policyRow);
    const defaults = getDefaultEffectiveChannels(policyRow);
    const nextPreference = {};

    if (typeof attemptedValues.inApp === "boolean") {
      if (!editableChannels.inApp) {
        if (attemptedValues.inApp !== defaults.inApp) {
          await logRejectedPreferenceAttempt({
            dbClient,
            userId,
            roleCode,
            action: NOTIFICATION_REJECTED_MANDATORY_ACTION,
            ruleCode,
            attemptedValues,
            reason: "in_app_channel_is_locked",
          });

          const error = new Error(
            `${policyRow.name} must remain enabled in the notification center.`,
          );
          error.statusCode = 400;
          throw error;
        }
      } else {
        nextPreference.inApp = attemptedValues.inApp;
      }
    }

    if (typeof attemptedValues.email === "boolean") {
      if (!editableChannels.email) {
        if (attemptedValues.email) {
          await logRejectedPreferenceAttempt({
            dbClient,
            userId,
            roleCode,
            action: NOTIFICATION_REJECTED_EMAIL_ACTION,
            ruleCode,
            attemptedValues,
            reason: "email_channel_unavailable",
          });

          const error = new Error(
            `${policyRow.name} does not support email delivery for your role.`,
          );
          error.statusCode = 400;
          throw error;
        }
      } else {
        nextPreference.email = attemptedValues.email;
      }
    }

    sanitizedIncomingPreferences[ruleCode] = nextPreference;
  }

  return sanitizedIncomingPreferences;
};

const isResetToDefaultPayload = ({
  policyRows,
  notificationRulePreferences,
}) => {
  const preferenceMap = sanitizeNotificationRulePreferences(notificationRulePreferences);

  return policyRows.every((policyRow) => {
    const editableChannels = getEditableChannels(policyRow);
    const defaults = getDefaultEffectiveChannels(policyRow);
    const rulePreferences = preferenceMap[policyRow.code] || {};

    if (
      editableChannels.inApp &&
      typeof rulePreferences.inApp === "boolean" &&
      rulePreferences.inApp !== defaults.inApp
    ) {
      return false;
    }

    if (
      editableChannels.email &&
      typeof rulePreferences.email === "boolean" &&
      rulePreferences.email !== defaults.email
    ) {
      return false;
    }

    return true;
  });
};

const getCurrentSettings = async ({ userId, roleCode }) => {
  ensureAllowedRole(roleCode);

  const { user, snapshot } = await getValidatedUserAndSnapshot({
    userId,
    roleCode,
  });

  const settings = await buildRoleSettingsResponse({
    roleCode,
    user,
    snapshot,
    assignedBarangay: user.default_barangay_id
      ? await settingsRepository.getBarangayById(user.default_barangay_id)
      : null,
  });

  return attachSignedProfilePictureMetadata(settings);
};

const saveCurrentSettings = async ({
  userId,
  roleCode,
  settings,
  ipAddress = null,
}) => {
  ensureAllowedRole(roleCode);

  const dbClient = await pool.connect();
  let uploadedProfilePicturePath = "";
  let uploadedProfilePictureFileName = "";
  let previousProfilePicturePath = "";

  try {
    await dbClient.query("BEGIN");

    const { user, snapshot, assignedBarangay } = await getValidatedUserAndSnapshot({
      userId,
      roleCode,
      dbClient,
    });
    const previousSettings = await buildRoleSettingsResponse({
      roleCode,
      user,
      snapshot,
      assignedBarangay,
      dbClient,
    });
    const incomingSnapshot = buildEditableSettingsSnapshot(settings || {});
    const hasIncomingProfileUpdate =
      incomingSnapshot.profile.firstName !== undefined ||
      incomingSnapshot.profile.middleName !== undefined ||
      incomingSnapshot.profile.lastName !== undefined ||
      incomingSnapshot.profile.contactNumber !== undefined;
    const hasIncomingNotificationPreferenceUpdate = Boolean(
      incomingSnapshot.hasNotificationPreferencePayload,
    );
    const normalizedFirstName = hasIncomingProfileUpdate
      ? validateNameFieldOrThrow({
          label: "First name",
          value: incomingSnapshot.profile.firstName,
          required: true,
        })
      : normalizeNameField(user.first_name);
    const normalizedMiddleName = hasIncomingProfileUpdate
      ? validateNameFieldOrThrow({
          label: "Middle name",
          value: incomingSnapshot.profile.middleName,
        })
      : normalizeNameField(user.middle_name) || null;
    const normalizedLastName = hasIncomingProfileUpdate
      ? validateNameFieldOrThrow({
          label: "Last name",
          value: incomingSnapshot.profile.lastName,
          required: true,
        })
      : normalizeNameField(user.last_name);
    const normalizedContactNumber = validateContactNumberOrThrow(
      (hasIncomingProfileUpdate
        ? incomingSnapshot.profile.contactNumber
        : user.contact_number) ||
        user.contact_number ||
        "",
    );
    const lockedEmailAddress = validateEmailAddressOrThrow(user.email);
    const normalizedNotificationRulePreferences =
      hasIncomingNotificationPreferenceUpdate
        ? await validateAndNormalizeNotificationPreferences({
            userId,
            roleCode,
            incomingPreferences: incomingSnapshot.notificationRulePreferences,
            dbClient,
          })
        : snapshot.notificationRulePreferences || {};
    const pictureAction =
      incomingSnapshot.profilePicture.action || PROFILE_PICTURE_ACTIONS.UNCHANGED;
    const hasPictureReplacement =
      pictureAction === PROFILE_PICTURE_ACTIONS.REPLACE;
    const hasPictureRemoval = pictureAction === PROFILE_PICTURE_ACTIONS.REMOVE;
    previousProfilePicturePath = snapshot.profile.profilePicturePath || "";

    if (hasPictureReplacement) {
      const uploadResult = await profilePictureStorageService.uploadProfilePicture({
        userId,
        fileName: incomingSnapshot.profilePicture.fileName,
        mimeType: incomingSnapshot.profilePicture.mimeType,
        fileDataBase64: incomingSnapshot.profilePicture.fileDataBase64,
      });

      uploadedProfilePicturePath = uploadResult.profilePicturePath;
      uploadedProfilePictureFileName = uploadResult.profilePictureFileName;
    }

    const mergedSnapshot = {
      ...snapshot,
      profile: {
        ...snapshot.profile,
        ...incomingSnapshot.profile,
        firstName: normalizedFirstName,
        middleName: normalizedMiddleName || "",
        lastName: normalizedLastName,
        position: getRolePositionLabel(roleCode),
        contactNumber: normalizedContactNumber,
        emailAddress: lockedEmailAddress,
        assignedBarangay:
          assignedBarangay && assignedBarangay.id
            ? {
                id: assignedBarangay.id,
                name: assignedBarangay.name,
              }
            : null,
        profilePicturePath: hasPictureRemoval
          ? ""
          : uploadedProfilePicturePath || snapshot.profile.profilePicturePath || "",
        profilePictureFileName: hasPictureRemoval
          ? ""
          : uploadedProfilePicturePath
            ? uploadedProfilePictureFileName
            : snapshot.profile.profilePictureFileName || "",
        profilePictureUpdatedAt:
          hasPictureRemoval || uploadedProfilePicturePath
            ? hasPictureRemoval
              ? ""
              : new Date().toISOString()
            : snapshot.profile.profilePictureUpdatedAt || "",
      },
      notificationRulePreferences: normalizedNotificationRulePreferences,
      metadata: {
        ...snapshot.metadata,
        ...incomingSnapshot.metadata,
        lastProfileUpdateAt: new Date().toISOString(),
        lastPreferenceSaveAt: hasIncomingNotificationPreferenceUpdate
          ? new Date().toISOString()
          : snapshot.metadata.lastPreferenceSaveAt || "",
      },
    };

    const updatedUser = hasIncomingProfileUpdate
      ? await settingsRepository.updateUserProfile(
          userId,
          {
            firstName: normalizedFirstName,
            middleName: normalizedMiddleName,
            lastName: normalizedLastName,
            contactNumber: normalizedContactNumber || null,
          },
          dbClient,
        )
      : user;

    const changedProfileFields = [];
    const previousProfileValues = buildProfileFieldAuditValues(user);
    const nextProfileValues = buildProfileFieldAuditValues(updatedUser);

    Object.keys(nextProfileValues).forEach((fieldName) => {
      if ((previousProfileValues[fieldName] || "") !== (nextProfileValues[fieldName] || "")) {
        changedProfileFields.push(fieldName);
      }
    });

    const nextSettings = await buildRoleSettingsResponse({
      roleCode,
      user: updatedUser,
      snapshot: mergedSnapshot,
      assignedBarangay,
      dbClient,
    });

    await settingsRepository.upsertUserRoleSettings(
      {
        userId,
        roleCode,
        ...buildUserRoleSettingsPayload(nextSettings),
      },
      dbClient,
    );

    await insertAuditLog(
      {
        user_id: userId,
        role_code: roleCode,
        device_id: null,
        action: PROFILE_UPDATED_AUDIT_ACTION,
        entity_type: "USER_PROFILE",
        entity_id: userId,
        old_values_json: {
          changedFields: changedProfileFields,
          profile: previousProfileValues,
        },
        new_values_json: {
          changedFields: changedProfileFields,
          profile: nextProfileValues,
        },
        ip_address: ipAddress,
      },
      dbClient,
    );

    if (hasPictureReplacement || hasPictureRemoval) {
      await settingsRepository.insertRoleSettingsSnapshot(
        {
          userId,
          roleCode,
          entityType: SETTINGS_ENTITY_TYPE,
          entityId: userId,
          action: hasPictureRemoval
            ? PROFILE_PICTURE_REMOVED_AUDIT_ACTION
            : previousProfilePicturePath
              ? PROFILE_PICTURE_REPLACED_AUDIT_ACTION
              : PROFILE_PICTURE_UPLOADED_AUDIT_ACTION,
          oldValues: buildAuditSafeSettingsSnapshot(previousSettings),
          newValues: buildAuditSafeSettingsSnapshot(nextSettings),
          ipAddress,
        },
        dbClient,
      );
    }

    if (hasIncomingNotificationPreferenceUpdate) {
      const policyRows = await getRolePolicyRows({ roleCode, dbClient });
      const notificationAction = isResetToDefaultPayload({
        policyRows,
        notificationRulePreferences: normalizedNotificationRulePreferences,
      })
        ? NOTIFICATION_RESET_AUDIT_ACTION
        : NOTIFICATION_UPDATE_AUDIT_ACTION;

      await insertAuditLog(
        {
          user_id: userId,
          role_code: roleCode,
          device_id: null,
          action: notificationAction,
          entity_type: "NOTIFICATION_PREFERENCES",
          entity_id: userId,
          old_values_json: {
            notificationRulePreferences:
              previousSettings.notificationRulePreferences || {},
          },
          new_values_json: {
            notificationRulePreferences:
              nextSettings.notificationRulePreferences || {},
          },
          ip_address: ipAddress,
        },
        dbClient,
      );
    }

    await settingsRepository.insertRoleSettingsSnapshot(
      {
        userId,
        roleCode,
        entityType: SETTINGS_ENTITY_TYPE,
        entityId: userId,
        action: SETTINGS_AUDIT_ACTION,
        oldValues: buildAuditSafeSettingsSnapshot(previousSettings),
        newValues: buildAuditSafeSettingsSnapshot(nextSettings),
        ipAddress,
      },
      dbClient,
    );

    await dbClient.query("COMMIT");

    if (
      hasPictureReplacement &&
      previousProfilePicturePath &&
      previousProfilePicturePath !== uploadedProfilePicturePath
    ) {
      await profilePictureStorageService.removeProfilePicture(
        previousProfilePicturePath,
      );
    }

    if (hasPictureRemoval && previousProfilePicturePath) {
      await profilePictureStorageService.removeProfilePicture(
        previousProfilePicturePath,
      );
    }

    return {
      settings: await attachSignedProfilePictureMetadata(nextSettings),
      user: buildSessionUser(updatedUser, roleCode),
    };
  } catch (error) {
    await dbClient.query("ROLLBACK");

    if (uploadedProfilePicturePath) {
      await profilePictureStorageService.removeProfilePicture(
        uploadedProfilePicturePath,
      );
    }
    throw error;
  } finally {
    dbClient.release();
  }
};

const getCurrentProfilePicture = async ({ userId, roleCode }) => {
  const settings = await getCurrentSettings({ userId, roleCode });

  return {
    profilePicturePath: settings.profile.profilePicturePath || "",
    profilePictureUrl: settings.profile.profilePictureUrl || "",
    profilePictureUrlExpiresAt:
      settings.profile.profilePictureUrlExpiresAt || "",
    profilePictureFileName: settings.profile.profilePictureFileName || "",
    profilePictureUpdatedAt:
      settings.profile.profilePictureUpdatedAt || "",
  };
};

const uploadCurrentProfilePicture = async ({
  userId,
  roleCode,
  fileName,
  mimeType,
  fileDataBase64,
  ipAddress = null,
}) => {
  ensureAllowedRole(roleCode);

  const dbClient = await pool.connect();
  let uploadedProfilePicturePath = "";
  let previousProfilePicturePath = "";

  try {
    await dbClient.query("BEGIN");

    const { user, snapshot } = await getValidatedUserAndSnapshot({
      userId,
      roleCode,
      dbClient,
    });
    const previousSettings = await buildRoleSettingsResponse({
      roleCode,
      user,
      snapshot,
      dbClient,
    });
    const uploadResult = await profilePictureStorageService.uploadProfilePicture({
      userId,
      fileName,
      mimeType,
      fileDataBase64,
    });
    const profilePictureUpdatedAt = new Date().toISOString();

    uploadedProfilePicturePath = uploadResult.profilePicturePath;
    previousProfilePicturePath =
      previousSettings.profile.profilePicturePath || "";

    const nextSettings = await buildRoleSettingsResponse({
      roleCode,
      user,
      snapshot: {
        ...snapshot,
        profile: {
          ...snapshot.profile,
          profilePicturePath: uploadResult.profilePicturePath,
          profilePictureFileName: uploadResult.profilePictureFileName,
          profilePictureUpdatedAt,
        },
        metadata: {
          ...snapshot.metadata,
          lastProfileUpdateAt: profilePictureUpdatedAt,
        },
      },
      dbClient,
    });

    await settingsRepository.upsertUserRoleSettings(
      {
        userId,
        roleCode,
        ...buildUserRoleSettingsPayload(nextSettings),
      },
      dbClient,
    );

    await settingsRepository.insertRoleSettingsSnapshot(
      {
        userId,
        roleCode,
        entityType: SETTINGS_ENTITY_TYPE,
        entityId: userId,
        action: previousProfilePicturePath
          ? PROFILE_PICTURE_REPLACED_AUDIT_ACTION
          : PROFILE_PICTURE_UPLOADED_AUDIT_ACTION,
        oldValues: buildAuditSafeSettingsSnapshot(previousSettings),
        newValues: buildAuditSafeSettingsSnapshot(nextSettings),
        ipAddress,
      },
      dbClient,
    );

    await dbClient.query("COMMIT");

    if (
      previousProfilePicturePath &&
      previousProfilePicturePath !== uploadedProfilePicturePath
    ) {
      await profilePictureStorageService.removeProfilePicture(
        previousProfilePicturePath,
      );
    }

    return attachSignedProfilePictureMetadata(nextSettings);
  } catch (error) {
    await dbClient.query("ROLLBACK");

    if (uploadedProfilePicturePath) {
      await profilePictureStorageService.removeProfilePicture(
        uploadedProfilePicturePath,
      );
    }

    throw error;
  } finally {
    dbClient.release();
  }
};

const removeCurrentProfilePicture = async ({
  userId,
  roleCode,
  ipAddress = null,
}) => {
  ensureAllowedRole(roleCode);

  const dbClient = await pool.connect();
  let removedProfilePicturePath = "";

  try {
    await dbClient.query("BEGIN");

    const { user, snapshot } = await getValidatedUserAndSnapshot({
      userId,
      roleCode,
      dbClient,
    });
    const previousSettings = await buildRoleSettingsResponse({
      roleCode,
      user,
      snapshot,
      dbClient,
    });

    removedProfilePicturePath =
      previousSettings.profile.profilePicturePath || "";

    const nextSettings = await buildRoleSettingsResponse({
      roleCode,
      user,
      snapshot: {
        ...snapshot,
        profile: {
          ...snapshot.profile,
          profilePicturePath: "",
          profilePictureUrl: "",
          profilePictureUrlExpiresAt: "",
          profilePictureFileName: "",
          profilePictureUpdatedAt: "",
        },
        metadata: {
          ...snapshot.metadata,
          lastProfileUpdateAt: new Date().toISOString(),
        },
      },
      dbClient,
    });

    await settingsRepository.upsertUserRoleSettings(
      {
        userId,
        roleCode,
        ...buildUserRoleSettingsPayload(nextSettings),
      },
      dbClient,
    );

    await settingsRepository.insertRoleSettingsSnapshot(
      {
        userId,
        roleCode,
        entityType: SETTINGS_ENTITY_TYPE,
        entityId: userId,
        action: PROFILE_PICTURE_REMOVED_AUDIT_ACTION,
        oldValues: buildAuditSafeSettingsSnapshot(previousSettings),
        newValues: buildAuditSafeSettingsSnapshot(nextSettings),
        ipAddress,
      },
      dbClient,
    );

    await dbClient.query("COMMIT");

    if (removedProfilePicturePath) {
      await profilePictureStorageService.removeProfilePicture(
        removedProfilePicturePath,
      );
    }

    return {
      profilePicturePath: "",
      profilePictureUrl: "",
      profilePictureUrlExpiresAt: "",
      profilePictureFileName: "",
      profilePictureUpdatedAt: "",
    };
  } catch (error) {
    await dbClient.query("ROLLBACK");
    throw error;
  } finally {
    dbClient.release();
  }
};

module.exports = {
  getCurrentSettings,
  getCurrentProfilePicture,
  uploadCurrentProfilePicture,
  removeCurrentProfilePicture,
  saveCurrentSettings,
};
