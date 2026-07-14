const pool = require("../config/db");
const settingsRepository = require("../repositories/settings.repository");

const SETTINGS_AUDIT_ACTION = "UPSERT_ROLE_SETTINGS";
const SETTINGS_ENTITY_TYPE = "ROLE_SETTINGS";
const ALLOWED_ROLE_CODES = new Set(["BARANGAY", "MSWDO", "MAYOR"]);
const ALLOWED_EXPORT_FORMATS = new Set(["csv", "excel", "pdf"]);
const NOTIFICATION_OPTION_KEYS = [
  "disasterAlerts",
  "distributionSchedules",
  "reliefArrivalNotifications",
  "attendanceReminders",
  "systemAnnouncements",
];

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
    preferredExportFormat: "excel",
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

const buildFullNameFromUser = (user = {}) => {
  return [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
};

const sanitizeString = (value, fallbackValue = "") => {
  if (typeof value !== "string") {
    return fallbackValue;
  }

  return value.trim();
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

const sanitizePreferredExportFormat = (value) => {
  const normalizedValue = sanitizeString(value).toLowerCase();

  if (!ALLOWED_EXPORT_FORMATS.has(normalizedValue)) {
    return "excel";
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
    preferredExportFormat: sanitizePreferredExportFormat(
      settings.preferredExportFormat,
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

const buildPersistedSettingsFromRecord = (record = {}) => {
  return {
    enabledNotificationRuleCodes: sanitizeEnabledNotificationRuleCodes(
      record.enabled_notification_rule_codes_json,
    ),
    preferredExportFormat: sanitizePreferredExportFormat(
      record.preferred_export_format,
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
      contactNumber: sanitizeString(
        user?.contact_number || normalizedSnapshot.profile.contactNumber,
      ),
      emailAddress: sanitizeString(
        user?.email || normalizedSnapshot.profile.emailAddress,
      ),
      position: sanitizeString(normalizedSnapshot.profile.position),
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
    preferredExportFormat: sanitizePreferredExportFormat(
      settings.preferredExportFormat,
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

  return buildRoleSettingsResponse({
    roleCode,
    user,
    snapshot: buildPersistedSettingsFromRecord(latestSnapshot || {}),
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

    const existingRoleSettings = await settingsRepository.getUserRoleSettings(
      {
        userId,
        roleCode,
      },
      dbClient,
    );

    const previousSettings = buildRoleSettingsResponse({
      roleCode,
      user,
      snapshot: buildPersistedSettingsFromRecord(existingRoleSettings || {}),
    });

    const incomingSnapshot = buildPersistedSnapshot(settings || {});
    const mergedSnapshot = {
      ...previousSettings,
      ...incomingSnapshot,
      profile: {
        ...previousSettings.profile,
        ...incomingSnapshot.profile,
        emailAddress: user.email,
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
        contactNumber: mergedSnapshot.profile.contactNumber || null,
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
        oldValues: previousSettings,
        newValues: nextSettings,
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
