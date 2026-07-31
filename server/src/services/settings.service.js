const pool = require("../config/db");
const settingsRepository = require("../repositories/settings.repository");
const notificationRepository = require("../modules/notifications/notification.repository");
const notificationService = require("../modules/notifications/notification.service");
const profilePictureStorageService = require("./profilePictureStorage.service");

const SETTINGS_AUDIT_ACTION = "UPSERT_ROLE_SETTINGS";
const SETTINGS_ENTITY_TYPE = "ROLE_SETTINGS";
const ALLOWED_ROLE_CODES = new Set(["BARANGAY", "MSWDO", "MAYOR"]);
const ROLE_POSITION_LABELS = {
  BARANGAY: "Barangay Official",
  MSWDO: "MSWDO Personnel",
  MAYOR: "Office of the Mayor",
};
const NOTIFICATION_OPTION_KEYS = [
  "disasterAlerts",
  "distributionSchedules",
  "reliefArrivalNotifications",
  "attendanceReminders",
  "systemAnnouncements",
];
const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHILIPPINE_CONTACT_NUMBER_PATTERN = /^\+639\d{9}$/;

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const createDefaultNotificationChannels = () => {
  return NOTIFICATION_OPTION_KEYS.reduce((current, key) => {
    current[key] = {
      inApp: true,
      email: false,
    };
    return current;
  }, {});
};

const createDefaultRoleSettings = () => {
  return {
    enabledNotificationRuleCodes: [],
    profile: {
      fullName: "",
      position: "",
      contactNumber: "",
      emailAddress: "",
      profilePictureDataUrl: "",
      profilePictureFileName: "",
    },
    notificationChannels: createDefaultNotificationChannels(),
    metadata: {
      lastProfileUpdateAt: "",
      lastPreferenceSaveAt: "",
    },
  };
};

const getRolePositionLabel = (roleCode) => {
  return ROLE_POSITION_LABELS[roleCode] || "";
};

const buildFullNameFromUser = (user = {}) => {
  return [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
};

const sanitizeString = (value, fallbackValue = "") => {
  if (typeof value !== "string") {
    return fallbackValue;
  }

  return value.trim();
};

const normalizeEmailAddress = (value) => sanitizeString(value);

const normalizePhilippineContactNumber = (value = "") => {
  const rawValue = sanitizeString(value);

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

const sanitizeNotificationChannels = (value = {}) => {
  const defaults = createDefaultNotificationChannels();

  return NOTIFICATION_OPTION_KEYS.reduce((current, key) => {
    current[key] = {
      inApp:
        typeof value?.[key]?.inApp === "boolean"
          ? value[key].inApp
          : defaults[key].inApp,
      email:
        typeof value?.[key]?.email === "boolean"
          ? value[key].email
          : defaults[key].email,
    };
    return current;
  }, {});
};

const sanitizeEnabledNotificationRuleCodes = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean),
    ),
  );
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

const normalizeTimestampValue = (value) => {
  if (!value) {
    return "";
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  }

  const parsedValue = new Date(value);
  return Number.isNaN(parsedValue.getTime()) ? "" : parsedValue.toISOString();
};

const parseTimestampValue = (value) => {
  const normalizedValue = sanitizeString(value);

  if (!normalizedValue) {
    return null;
  }

  const parsedValue = new Date(normalizedValue);

  if (Number.isNaN(parsedValue.getTime())) {
    return null;
  }

  return parsedValue.toISOString();
};

const buildPersistedSnapshot = (settings = {}) => {
  const defaults = createDefaultRoleSettings();

  return {
    enabledNotificationRuleCodes: sanitizeEnabledNotificationRuleCodes(
      settings.enabledNotificationRuleCodes,
    ),
    profile: {
      ...defaults.profile,
      fullName: sanitizeString(settings?.profile?.fullName),
      position: sanitizeString(settings?.profile?.position),
      contactNumber: sanitizeString(settings?.profile?.contactNumber),
      emailAddress: sanitizeString(settings?.profile?.emailAddress),
      profilePictureDataUrl: sanitizeString(
        settings?.profile?.profilePictureDataUrl,
      ),
      profilePictureFileName: sanitizeString(
        settings?.profile?.profilePictureFileName,
      ),
    },
    notificationChannels: sanitizeNotificationChannels(
      settings.notificationChannels,
    ),
    metadata: {
      lastProfileUpdateAt: sanitizeString(settings?.metadata?.lastProfileUpdateAt),
      lastPreferenceSaveAt: sanitizeString(
        settings?.metadata?.lastPreferenceSaveAt,
      ),
    },
  };
};

const buildEditableSettingsSnapshot = (settings = {}) => {
  const profile = isPlainObject(settings.profile) ? settings.profile : {};
  const metadata = isPlainObject(settings.metadata) ? settings.metadata : {};

  return {
    enabledNotificationRuleCodes: sanitizeEnabledNotificationRuleCodes(
      settings.enabledNotificationRuleCodes,
    ),
    profile: {
      fullName: sanitizeString(profile.fullName),
      contactNumber: sanitizeString(profile.contactNumber),
      profilePictureDataUrl: sanitizeString(profile.profilePictureDataUrl),
      profilePictureFileName: sanitizeString(profile.profilePictureFileName),
    },
    notificationChannels: sanitizeNotificationChannels(
      settings.notificationChannels,
    ),
    metadata: {
      lastProfileUpdateAt: sanitizeString(metadata.lastProfileUpdateAt),
      lastPreferenceSaveAt: sanitizeString(metadata.lastPreferenceSaveAt),
    },
  };
};

const buildPersistedSettingsFromRecord = (record = {}) => {
  return {
    enabledNotificationRuleCodes: sanitizeEnabledNotificationRuleCodes(
      record.enabled_notification_rule_codes_json,
    ),
    profile: {
      fullName: "",
      position: "",
      contactNumber: "",
      emailAddress: "",
      profilePictureDataUrl: sanitizeString(record.profile_picture_data_url),
      profilePictureFileName: sanitizeString(record.profile_picture_file_name),
    },
    notificationChannels: sanitizeNotificationChannels(
      record.notification_channels_json,
    ),
    metadata: {
      lastProfileUpdateAt: normalizeTimestampValue(record.last_profile_update_at),
      lastPreferenceSaveAt: normalizeTimestampValue(
        record.last_preference_save_at,
      ),
    },
  };
};

const buildRoleSettingsResponse = ({
  roleCode,
  user,
  snapshot,
}) => {
  const defaults = createDefaultRoleSettings();
  const normalizedSnapshot = buildPersistedSnapshot(snapshot || {});
  const profileFullName =
    normalizedSnapshot.profile.fullName || buildFullNameFromUser(user);

  return {
    ...defaults,
    ...normalizedSnapshot,
    profile: {
      ...defaults.profile,
      ...normalizedSnapshot.profile,
      fullName: profileFullName,
      position:
        getRolePositionLabel(roleCode) || normalizedSnapshot.profile.position,
      contactNumber: sanitizeString(
        user?.contact_number || normalizedSnapshot.profile.contactNumber,
      ),
      emailAddress: sanitizeString(
        user?.email || normalizedSnapshot.profile.emailAddress,
      ),
    },
    notificationChannels: sanitizeNotificationChannels(
      normalizedSnapshot.notificationChannels,
    ),
    metadata: {
      ...defaults.metadata,
      ...normalizedSnapshot.metadata,
    },
    roleCode,
  };
};

const buildUserRoleSettingsPayload = (settings = {}) => {
  return {
    profilePictureDataUrl: sanitizeString(settings?.profile?.profilePictureDataUrl),
    profilePictureFileName: sanitizeString(settings?.profile?.profilePictureFileName),
    enabledNotificationRuleCodesJson: sanitizeEnabledNotificationRuleCodes(
      settings.enabledNotificationRuleCodes,
    ),
    notificationChannelsJson: sanitizeNotificationChannels(
      settings.notificationChannels,
    ),
    lastProfileUpdateAt: parseTimestampValue(settings?.metadata?.lastProfileUpdateAt),
    lastPreferenceSaveAt:
      parseTimestampValue(settings?.metadata?.lastPreferenceSaveAt) ||
      new Date().toISOString(),
  };
};

const splitFullNameForUserColumns = (fullName, user) => {
  const tokens = sanitizeString(fullName)
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length < 2) {
    return {
      firstName: user.first_name,
      middleName: user.middle_name,
      lastName: user.last_name,
    };
  }

  return {
    firstName: tokens[0],
    middleName: user.middle_name,
    lastName: tokens.slice(1).join(" "),
  };
};

const resolveProfilePictureReference = async ({
  userId,
  roleCode,
  previousProfilePictureReference,
  nextProfilePictureReference,
  nextProfilePictureFileName,
}) => {
  const normalizedPreviousReference = sanitizeString(previousProfilePictureReference);
  const normalizedNextReference = sanitizeString(nextProfilePictureReference);
  const normalizedNextFileName = sanitizeString(nextProfilePictureFileName);

  if (!normalizedNextReference) {
    if (normalizedPreviousReference) {
      await profilePictureStorageService.removeProfilePicture(
        normalizedPreviousReference,
      );
    }

    return {
      profilePictureReference: "",
      profilePictureFileName: "",
    };
  }

  if (normalizedNextReference.startsWith("data:image/")) {
    const uploadResult = await profilePictureStorageService.uploadProfilePicture({
      userId,
      roleCode,
      profilePictureDataUrl: normalizedNextReference,
      fileName: normalizedNextFileName,
    });

    if (
      normalizedPreviousReference &&
      normalizedPreviousReference !== uploadResult.profilePictureReference
    ) {
      await profilePictureStorageService.removeProfilePicture(
        normalizedPreviousReference,
      );
    }

    return {
      profilePictureReference: uploadResult.profilePictureReference,
      profilePictureFileName: uploadResult.profilePictureFileName,
    };
  }

  return {
    profilePictureReference: normalizedNextReference,
    profilePictureFileName: normalizedNextFileName,
  };
};

const validateEnabledNotificationRuleCodesForRole = async ({
  roleCode,
  enabledNotificationRuleCodes,
  dbClient,
}) => {
  const allowedRuleCodeSet = await getAllowedNotificationRuleCodesForRole({
    roleCode,
    dbClient,
  });
  const invalidRuleCodes = sanitizeEnabledNotificationRuleCodes(
    enabledNotificationRuleCodes,
  ).filter((code) => !allowedRuleCodeSet.has(code));

  if (invalidRuleCodes.length > 0) {
    const error = new Error(
      invalidRuleCodes.length === 1
        ? `Notification rule ${invalidRuleCodes[0]} is not available for your role.`
        : "One or more notification rules are not available for your role.",
    );
    error.statusCode = 400;
    throw error;
  }
};

const getAllowedNotificationRuleCodesForRole = async ({
  roleCode,
  dbClient,
}) => {
  const allowedRules = await notificationService.getNotificationRulesForRole(
    roleCode,
    dbClient,
  );

  return new Set(
    allowedRules
      .map((rule) => (typeof rule.code === "string" ? rule.code.trim() : ""))
      .filter(Boolean),
  );
};

const sanitizeEnabledNotificationRuleCodesForRole = async ({
  roleCode,
  enabledNotificationRuleCodes,
  dbClient,
}) => {
  const allowedRuleCodeSet = await getAllowedNotificationRuleCodesForRole({
    roleCode,
    dbClient,
  });
  const normalizedRuleCodes = sanitizeEnabledNotificationRuleCodes(
    enabledNotificationRuleCodes,
  );
  const cleanedRuleCodes = normalizedRuleCodes.filter((code) =>
    allowedRuleCodeSet.has(code),
  );

  return {
    cleanedRuleCodes,
    changed: cleanedRuleCodes.length !== normalizedRuleCodes.length,
  };
};

const sanitizeStoredSettingsSnapshotForRole = async ({
  userId,
  roleCode,
  snapshot,
  dbClient,
}) => {
  const normalizedSnapshot = buildPersistedSnapshot(snapshot || {});
  const { cleanedRuleCodes, changed } =
    await sanitizeEnabledNotificationRuleCodesForRole({
      roleCode,
      enabledNotificationRuleCodes: normalizedSnapshot.enabledNotificationRuleCodes,
      dbClient,
    });

  const cleanedSnapshot = {
    ...normalizedSnapshot,
    enabledNotificationRuleCodes: cleanedRuleCodes,
  };

  if (changed && userId) {
    await settingsRepository.upsertUserRoleSettings(
      {
        userId,
        roleCode,
        ...buildUserRoleSettingsPayload(cleanedSnapshot),
      },
      dbClient,
    );
  }

  return cleanedSnapshot;
};

const buildAuditSafeSettingsSnapshot = (settings = {}) => {
  const normalizedSettings = buildPersistedSnapshot(settings);
  const hasProfilePicture = Boolean(
    normalizedSettings.profile.profilePictureDataUrl,
  );

  return {
    ...normalizedSettings,
    profile: {
      ...normalizedSettings.profile,
      profilePictureDataUrl: hasProfilePicture
        ? "[stored in profile picture storage]"
        : "",
    },
  };
};

const buildSessionUser = (user, roleCode) => {
  return {
    id: user.id,
    email: user.email,
    first_name: user.first_name,
    middle_name: user.middle_name || null,
    last_name: user.last_name,
    contact_number: user.contact_number || null,
    role: roleCode,
    default_barangay_id: user.default_barangay_id || null,
    is_active: user.is_active,
  };
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

const getCurrentSettings = async ({ userId, roleCode }) => {
  ensureAllowedRole(roleCode);

  const [user, latestSnapshot] = await Promise.all([
    settingsRepository.getUserById(userId),
    settingsRepository.getUserRoleSettings({
      userId,
      roleCode,
    }),
  ]);

  ensureUserExists(user);
  ensureUserIsActive(user);

  const cleanedSnapshot = await sanitizeStoredSettingsSnapshotForRole({
    userId,
    roleCode,
    snapshot: buildPersistedSettingsFromRecord(latestSnapshot || {}),
  });

  return buildRoleSettingsResponse({
    roleCode,
    user,
    snapshot: cleanedSnapshot,
  });
};

const saveCurrentSettings = async ({
  userId,
  roleCode,
  settings,
  ipAddress = null,
}) => {
  ensureAllowedRole(roleCode);

  const dbClient = await pool.connect();

  try {
    await dbClient.query("BEGIN");

    const user = await settingsRepository.getUserById(userId, dbClient);
    ensureUserExists(user);
    ensureUserIsActive(user);

    const existingRoleSettings = await settingsRepository.getUserRoleSettings(
      {
        userId,
        roleCode,
      },
      dbClient,
    );

    const cleanedExistingSnapshot = await sanitizeStoredSettingsSnapshotForRole({
      userId,
      roleCode,
      snapshot: buildPersistedSettingsFromRecord(existingRoleSettings || {}),
      dbClient,
    });

    const previousSettings = buildRoleSettingsResponse({
      roleCode,
      user,
      snapshot: cleanedExistingSnapshot,
    });

    const incomingSnapshot = buildEditableSettingsSnapshot(settings || {});
    const normalizedContactNumber = validateContactNumberOrThrow(
      incomingSnapshot.profile.contactNumber || user.contact_number || "",
    );
    const lockedEmailAddress = validateEmailAddressOrThrow(user.email);

    await validateEnabledNotificationRuleCodesForRole({
      roleCode,
      enabledNotificationRuleCodes: incomingSnapshot.enabledNotificationRuleCodes,
      dbClient,
    });
    const resolvedProfilePicture = await resolveProfilePictureReference({
      userId,
      roleCode,
      previousProfilePictureReference:
        previousSettings.profile.profilePictureDataUrl,
      nextProfilePictureReference: incomingSnapshot.profile.profilePictureDataUrl,
      nextProfilePictureFileName: incomingSnapshot.profile.profilePictureFileName,
    });

    const mergedSnapshot = {
      ...previousSettings,
      ...incomingSnapshot,
      profile: {
        ...previousSettings.profile,
        ...incomingSnapshot.profile,
        position: getRolePositionLabel(roleCode),
        contactNumber: normalizedContactNumber,
        emailAddress: lockedEmailAddress,
        profilePictureDataUrl: resolvedProfilePicture.profilePictureReference,
        profilePictureFileName: resolvedProfilePicture.profilePictureFileName,
      },
      notificationChannels: sanitizeNotificationChannels(
        incomingSnapshot.notificationChannels,
      ),
      metadata: {
        ...previousSettings.metadata,
        ...incomingSnapshot.metadata,
      },
    };

    const nameColumns = splitFullNameForUserColumns(
      mergedSnapshot.profile.fullName,
      user,
    );

    const updatedUser = await settingsRepository.updateUserProfile(
      userId,
      {
        firstName: nameColumns.firstName,
        middleName: nameColumns.middleName,
        lastName: nameColumns.lastName,
        contactNumber: normalizedContactNumber || null,
      },
      dbClient,
    );

    const nextSettings = buildRoleSettingsResponse({
      roleCode,
      user: updatedUser,
      snapshot: {
        ...mergedSnapshot,
        metadata: {
          ...mergedSnapshot.metadata,
          lastPreferenceSaveAt: new Date().toISOString(),
        },
      },
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
        action: SETTINGS_AUDIT_ACTION,
        oldValues: buildAuditSafeSettingsSnapshot(previousSettings),
        newValues: buildAuditSafeSettingsSnapshot(nextSettings),
        ipAddress,
      },
      dbClient,
    );

    await dbClient.query("COMMIT");

    return {
      settings: nextSettings,
      user: buildSessionUser(updatedUser, roleCode),
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
  saveCurrentSettings,
};
