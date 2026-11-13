const test = require("node:test");
const assert = require("node:assert/strict");

const {
  upsertUserRoleSettings,
  updateUserProfile,
} = require("../src/repositories/settings.repository");

test("updateUserProfile clears middle_name when middleName is null", async () => {
  const capturedQueries = [];
  const dbClient = {
    async query(sql, params) {
      capturedQueries.push({ sql, params });
      return {
        rows: [
          {
            id: "user-1",
            email: "user@example.com",
            first_name: "Jane Allyson",
            middle_name: null,
            last_name: "Paray",
            contact_number: "+639952071990",
            default_barangay_id: null,
            is_active: true,
          },
        ],
      };
    },
  };

  const result = await updateUserProfile(
    "user-1",
    {
      firstName: "Jane Allyson",
      middleName: null,
      lastName: "Paray",
      contactNumber: "+639952071990",
    },
    dbClient,
  );

  assert.equal(result.middle_name, null);
  assert.equal(capturedQueries.length, 1);
  assert.match(capturedQueries[0].sql, /middle_name = \$3/i);
  assert.doesNotMatch(capturedQueries[0].sql, /middle_name = COALESCE\(\$3, middle_name\)/i);
  assert.equal(capturedQueries[0].params[2], null);
});

test("upsertUserRoleSettings persists profile_picture_path without the removed Base64 column", async () => {
  const capturedQueries = [];
  const dbClient = {
    async query(sql, params) {
      capturedQueries.push({ sql, params });
      return {
        rows: [
          {
            id: "settings-1",
            user_id: "user-1",
            role_code: "BARANGAY",
            profile_picture_path: "user-1/avatar.webp",
          },
        ],
      };
    },
  };

  await upsertUserRoleSettings(
    {
      userId: "user-1",
      roleCode: "BARANGAY",
      profilePicturePath: "user-1/avatar.webp",
      profilePictureFileName: "avatar.webp",
      profilePictureUpdatedAt: "2026-08-02T08:00:00.000Z",
      notificationRulePreferencesJson: {},
      lastProfileUpdateAt: "2026-08-02T08:00:00.000Z",
      lastPreferenceSaveAt: "2026-08-02T08:00:00.000Z",
    },
    dbClient,
  );

  assert.equal(capturedQueries.length, 1);
  assert.doesNotMatch(
    capturedQueries[0].sql,
    /profile_picture_data_url/i,
  );
  assert.doesNotMatch(
    capturedQueries[0].sql.split("RETURNING")[0],
    /enabled_notification_rule_codes_json|notification_channels_json/i,
  );
  assert.doesNotMatch(capturedQueries[0].sql, /\$9\b/);
  assert.equal(capturedQueries[0].params[2], "user-1/avatar.webp");
  assert.equal(capturedQueries[0].params[3], "avatar.webp");
  assert.equal(capturedQueries[0].params.length, 8);
});
