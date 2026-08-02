const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const pool = require("../src/config/db");
const {
  getUserRoleSettings,
  upsertUserRoleSettings,
} = require("../src/repositories/settings.repository");

const createTempUser = async (dbClient) => {
  const email = `settings-repo-${crypto.randomUUID()}@distync.local`;
  const result = await dbClient.query(
    `
      INSERT INTO users (
        email,
        first_name,
        last_name,
        is_active,
        created_at,
        updated_at
      )
      VALUES ($1, 'Settings', 'Repository', TRUE, NOW(), NOW())
      RETURNING id
    `,
    [email],
  );

  return result.rows[0].id;
};

test("upsertUserRoleSettings inserts a new row against PostgreSQL without the removed Base64 column", async () => {
  const dbClient = await pool.connect();

  try {
    await dbClient.query("BEGIN");
    const userId = await createTempUser(dbClient);

    const persistedRow = await upsertUserRoleSettings(
      {
        userId,
        roleCode: "MAYOR",
        profilePicturePath: `${userId}/insert-picture.png`,
        profilePictureFileName: "insert-picture.png",
        profilePictureUpdatedAt: "2026-08-02T10:00:00.000Z",
        enabledNotificationRuleCodesJson: ["NOTIFY-1"],
        notificationChannelsJson: { NOTIFY_1: { inApp: true } },
        notificationRulePreferencesJson: { NOTIFY_1: { inApp: true } },
        lastProfileUpdateAt: "2026-08-02T10:00:00.000Z",
        lastPreferenceSaveAt: "2026-08-02T10:00:00.000Z",
      },
      dbClient,
    );

    const reloadedRow = await getUserRoleSettings(
      { userId, roleCode: "MAYOR" },
      dbClient,
    );

    assert.equal(persistedRow.user_id, userId);
    assert.equal(reloadedRow.profile_picture_path, `${userId}/insert-picture.png`);
    assert.equal(reloadedRow.profile_picture_file_name, "insert-picture.png");
    assert.deepEqual(reloadedRow.notification_rule_preferences_json, {
      NOTIFY_1: { inApp: true },
    });
  } finally {
    await dbClient.query("ROLLBACK");
    dbClient.release();
  }
});

test("upsertUserRoleSettings updates an existing row against PostgreSQL with the correct parameter order", async () => {
  const dbClient = await pool.connect();

  try {
    await dbClient.query("BEGIN");
    const userId = await createTempUser(dbClient);

    await dbClient.query(
      `
        INSERT INTO user_role_settings (
          user_id,
          role_code,
          profile_picture_path,
          profile_picture_file_name,
          profile_picture_updated_at,
          enabled_notification_rule_codes_json,
          notification_channels_json,
          notification_rule_preferences_json,
          last_profile_update_at,
          last_preference_save_at,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          'BARANGAY',
          'old/path.jpg',
          'old-path.jpg',
          NOW(),
          '[]'::jsonb,
          '{}'::jsonb,
          '{}'::jsonb,
          NOW(),
          NOW(),
          NOW(),
          NOW()
        )
      `,
      [userId],
    );

    await upsertUserRoleSettings(
      {
        userId,
        roleCode: "BARANGAY",
        profilePicturePath: `${userId}/updated-picture.webp`,
        profilePictureFileName: "updated-picture.webp",
        profilePictureUpdatedAt: "2026-08-02T11:00:00.000Z",
        enabledNotificationRuleCodesJson: [],
        notificationChannelsJson: { CHANNEL_A: { email: false } },
        notificationRulePreferencesJson: { CHANNEL_A: { email: false } },
        lastProfileUpdateAt: "2026-08-02T11:00:00.000Z",
        lastPreferenceSaveAt: "2026-08-02T11:00:00.000Z",
      },
      dbClient,
    );

    const reloadedRow = await getUserRoleSettings(
      { userId, roleCode: "BARANGAY" },
      dbClient,
    );

    assert.equal(
      reloadedRow.profile_picture_path,
      `${userId}/updated-picture.webp`,
    );
    assert.equal(
      reloadedRow.profile_picture_file_name,
      "updated-picture.webp",
    );
    assert.deepEqual(reloadedRow.notification_channels_json, {
      CHANNEL_A: { email: false },
    });
  } finally {
    await dbClient.query("ROLLBACK");
    dbClient.release();
  }
});
