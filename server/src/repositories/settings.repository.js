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

const getBarangayById = async (barangayId, dbClient = pool) => {
  const query = `
    SELECT
      id,
      name
    FROM barangays
    WHERE id = $1
    LIMIT 1
  `;

  const result = await dbClient.query(query, [barangayId]);
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
    SET first_name = $2,
        middle_name = $3,
        last_name = $4,
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
      notification_rule_preferences_json,
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
    notificationRulePreferencesJson,
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
      profile_picture_file_name,
      profile_picture_updated_at,
      notification_rule_preferences_json,
      last_profile_update_at,
      last_preference_save_at,
      created_at,
      updated_at
    )
    VALUES (
      $1,         -- user_id
      $2,         -- role_code
      $3,         -- profile_picture_path
      $4,         -- profile_picture_file_name
      $5,         -- profile_picture_updated_at
      $6::jsonb,  -- notification_rule_preferences_json
      $7,         -- last_profile_update_at
      $8,         -- last_preference_save_at
      NOW(),
      NOW()
    )
    ON CONFLICT (user_id, role_code)
    DO UPDATE
    SET profile_picture_path = EXCLUDED.profile_picture_path,
        profile_picture_file_name = EXCLUDED.profile_picture_file_name,
        profile_picture_updated_at = EXCLUDED.profile_picture_updated_at,
        notification_rule_preferences_json =
          EXCLUDED.notification_rule_preferences_json,
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
      notification_rule_preferences_json,
      last_profile_update_at,
      last_preference_save_at,
      updated_at,
      created_at
  `;

  const result = await dbClient.query(query, [
    userId, // $1 user_id
    roleCode, // $2 role_code
    profilePicturePath || null, // $3 profile_picture_path
    profilePictureFileName || null, // $4 profile_picture_file_name
    profilePictureUpdatedAt || null, // $5 profile_picture_updated_at
    JSON.stringify(notificationRulePreferencesJson || {}), // $6 notification_rule_preferences_json
    lastProfileUpdateAt || null, // $7 last_profile_update_at
    lastPreferenceSaveAt, // $8 last_preference_save_at
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
  getBarangayById,
  getUserById,
  getUserRoleSettings,
  insertRoleSettingsSnapshot,
  upsertUserRoleSettings,
  updateUserProfile,
};
