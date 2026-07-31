const pool = require("../config/db");
const { insertAuditLog } = require("./systemLog.repository");

const baseUserSelect = `
  SELECT
    id,
    email,
    first_name,
    middle_name,
    last_name,
    contact_number,
    default_barangay_id,
    is_active
  FROM users
`;

const getUserById = async (userId, dbClient = pool) => {
  const query = `
    ${baseUserSelect}
    WHERE id = $1
    LIMIT 1
  `;

  const result = await dbClient.query(query, [userId]);
  return result.rows[0] || null;
};

const updateUserProfile = async (
  userId,
  {
    firstName,
    middleName,
    lastName,
    contactNumber,
  },
  dbClient = pool,
) => {
  const query = `
    UPDATE users
    SET first_name = COALESCE($2, first_name),
        middle_name = COALESCE($3, middle_name),
        last_name = COALESCE($4, last_name),
        contact_number = $5,
        updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      email,
      first_name,
      middle_name,
      last_name,
      contact_number,
      default_barangay_id,
      is_active
  `;

  const result = await dbClient.query(query, [
    userId,
    firstName ?? null,
    middleName ?? null,
    lastName ?? null,
    contactNumber ?? null,
  ]);

  return result.rows[0] || null;
};

const getUserRoleSettings = async (
  { userId, roleCode },
  dbClient = pool,
) => {
  const query = `
    SELECT
      id,
      user_id,
      role_code,
      profile_picture_path,
      profile_picture_file_name,
      profile_picture_updated_at,
      enabled_notification_rule_codes_json,
      notification_channels_json,
      last_profile_update_at,
      last_preference_save_at,
      updated_at,
      created_at
    FROM user_role_settings
    WHERE user_id = $1
      AND role_code = $2
    LIMIT 1
  `;

  const result = await dbClient.query(query, [userId, roleCode]);
  return result.rows[0] || null;
};

const upsertUserRoleSettings = async (
  {
    userId,
    roleCode,
    profilePicturePath,
    profilePictureFileName,
    profilePictureUpdatedAt,
    enabledNotificationRuleCodesJson,
    notificationChannelsJson,
    lastProfileUpdateAt,
    lastPreferenceSaveAt,
  },
  dbClient = pool,
) => {
  const query = `
    INSERT INTO user_role_settings (
      user_id,
      role_code,
      profile_picture_path,
      profile_picture_data_url,
      profile_picture_file_name,
      profile_picture_updated_at,
      enabled_notification_rule_codes_json,
      notification_channels_json,
      last_profile_update_at,
      last_preference_save_at,
      created_at,
      updated_at
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7::jsonb,
      $8,
      $9,
      $10,
      NOW(),
      NOW()
    )
    ON CONFLICT (user_id, role_code)
    DO UPDATE
    SET profile_picture_path = EXCLUDED.profile_picture_path,
        profile_picture_data_url = EXCLUDED.profile_picture_data_url,
        profile_picture_file_name = EXCLUDED.profile_picture_file_name,
        profile_picture_updated_at = EXCLUDED.profile_picture_updated_at,
        enabled_notification_rule_codes_json =
          EXCLUDED.enabled_notification_rule_codes_json,
        notification_channels_json = EXCLUDED.notification_channels_json,
        last_profile_update_at = EXCLUDED.last_profile_update_at,
        last_preference_save_at = EXCLUDED.last_preference_save_at,
        updated_at = NOW()
    RETURNING
      id,
      user_id,
      role_code,
      profile_picture_path,
      profile_picture_file_name,
      profile_picture_updated_at,
      enabled_notification_rule_codes_json,
      notification_channels_json,
      last_profile_update_at,
      last_preference_save_at,
      updated_at,
      created_at
  `;

  const result = await dbClient.query(query, [
    userId,
    roleCode,
    profilePicturePath || null,
    null,
    profilePictureFileName || null,
    profilePictureUpdatedAt || null,
    JSON.stringify(enabledNotificationRuleCodesJson || []),
    JSON.stringify(notificationChannelsJson || {}),
    lastProfileUpdateAt || null,
    lastPreferenceSaveAt,
  ]);

  return result.rows[0] || null;
};

const insertRoleSettingsSnapshot = async (
  {
    userId,
    roleCode,
    entityType,
    entityId,
    action,
    oldValues,
    newValues,
    ipAddress,
  },
  dbClient = pool,
) => {
  return insertAuditLog(
    {
      user_id: userId,
      role_code: roleCode,
      device_id: null,
      action,
      entity_type: entityType,
      entity_id: entityId,
      old_values_json: oldValues,
      new_values_json: newValues,
      ip_address: ipAddress,
    },
    dbClient,
  );
};

module.exports = {
  getUserById,
  getUserRoleSettings,
  insertRoleSettingsSnapshot,
  upsertUserRoleSettings,
  updateUserProfile,
};
