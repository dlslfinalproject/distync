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
    assert.equal("enabled_notification_rule_codes_json" in reloadedRow, false);
    assert.equal("notification_channels_json" in reloadedRow, false);
    assert.deepEqual(reloadedRow.notification_rule_preferences_json, {
      NOTIFY_1: { inApp: true },
    });
  } finally {
    await dbClient.query("ROLLBACK");
    dbClient.release();
  }
});

test("upsertUserRoleSettings updates an existing row without overwriting preserved legacy columns", async () => {
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
          '{"SYNC_CONFLICT":{"email":false}}'::jsonb,
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
    assert.equal("enabled_notification_rule_codes_json" in reloadedRow, false);
    assert.equal("notification_channels_json" in reloadedRow, false);
    assert.deepEqual(reloadedRow.notification_rule_preferences_json, {
      CHANNEL_A: { email: false },
    });
  } finally {
    await dbClient.query("ROLLBACK");
    dbClient.release();
  }
});

test("upsertUserRoleSettings reuses the same user-role row across first and second saves", async () => {
  const dbClient = await pool.connect();

  try {
    await dbClient.query("BEGIN");
    const userId = await createTempUser(dbClient);

    const insertedRow = await upsertUserRoleSettings(
      {
        userId,
        roleCode: "MSWDO",
        profilePicturePath: null,
        profilePictureFileName: null,
        profilePictureUpdatedAt: null,
        notificationRulePreferencesJson: {
          DISASTER_EVENT_UPDATED: {
            inApp: true,
          },
        },
        lastProfileUpdateAt: null,
        lastPreferenceSaveAt: "2026-08-02T12:00:00.000Z",
      },
      dbClient,
    );

    const updatedRow = await upsertUserRoleSettings(
      {
        userId,
        roleCode: "MSWDO",
        profilePicturePath: null,
        profilePictureFileName: null,
        profilePictureUpdatedAt: null,
        notificationRulePreferencesJson: {
          DISASTER_EVENT_UPDATED: {
            inApp: false,
          },
        },
        lastProfileUpdateAt: null,
        lastPreferenceSaveAt: "2026-08-02T12:05:00.000Z",
      },
      dbClient,
    );

    const duplicateCheck = await dbClient.query(
      `
        SELECT COUNT(*)::integer AS row_count
        FROM user_role_settings
        WHERE user_id = $1
          AND role_code = 'MSWDO'
      `,
      [userId],
    );

    assert.equal(insertedRow.user_id, userId);
    assert.equal(updatedRow.user_id, userId);
    assert.equal(duplicateCheck.rows[0].row_count, 1);
    assert.deepEqual(
      (
        await getUserRoleSettings(
          { userId, roleCode: "MSWDO" },
          dbClient,
        )
      ).notification_rule_preferences_json,
      {
        DISASTER_EVENT_UPDATED: {
          inApp: false,
        },
      },
    );
  } finally {
    await dbClient.query("ROLLBACK");
    dbClient.release();
  }
});
