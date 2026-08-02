const test = require("node:test");
const assert = require("node:assert/strict");

const servicePath = require.resolve("../src/services/settings.service");
const poolPath = require.resolve("../src/config/db");
const settingsRepositoryPath = require.resolve(
  "../src/repositories/settings.repository",
);
const notificationRepositoryPath = require.resolve(
  "../src/modules/notifications/notification.repository",
);
const notificationServicePath = require.resolve(
  "../src/modules/notifications/notification.service",
);
const profilePictureStorageServicePath = require.resolve(
  "../src/services/profilePictureStorage.service",
);

const withStubbedSettingsService = async (stubs, runTest) => {
  const dependencyPaths = [
    poolPath,
    settingsRepositoryPath,
    notificationRepositoryPath,
    notificationServicePath,
    profilePictureStorageServicePath,
  ];
  const originalEntries = new Map(
    dependencyPaths.map((modulePath) => [modulePath, require.cache[modulePath]]),
  );

  delete require.cache[servicePath];

  try {
    dependencyPaths.forEach((modulePath) => {
      require.cache[modulePath] = {
        id: modulePath,
        filename: modulePath,
        loaded: true,
        exports: stubs[modulePath],
      };
    });

    const settingsService = require(servicePath);
    await runTest(settingsService);
  } finally {
    delete require.cache[servicePath];

    dependencyPaths.forEach((modulePath) => {
      const originalEntry = originalEntries.get(modulePath);

      if (originalEntry) {
        require.cache[modulePath] = originalEntry;
      } else {
        delete require.cache[modulePath];
      }
    });
  }
};

const buildDbClient = () => {
  const statements = [];

  return {
    statements,
    async query(sql) {
      statements.push(sql);
      return { rows: [] };
    },
    release() {
      statements.push("RELEASE");
    },
  };
};

const buildProfilePictureStorageStub = (overrides = {}) => ({
  createSignedProfilePictureUrl: async () => ({
    profilePictureUrl: "",
    profilePictureUrlExpiresAt: "",
  }),
  normalizeStoragePath: (value) => String(value || "").trim(),
  removeProfilePicture: async () => true,
  uploadProfilePicture: async () => ({
    profilePicturePath: "user/default-picture.jpg",
    profilePictureFileName: "default-picture.jpg",
  }),
  ...overrides,
});

test("getCurrentSettings omits the removed export preference field", async () => {
  const user = {
    id: "user-1",
    email: "barangay@example.com",
    first_name: "Ana",
    middle_name: null,
    last_name: "Dela Cruz",
    contact_number: "+639171234567",
    default_barangay_id: null,
    is_active: true,
  };

  await withStubbedSettingsService(
    {
      [poolPath]: {},
      [settingsRepositoryPath]: {
        getUserById: async () => user,
        getBarangayById: async () => null,
        getUserRoleSettings: async () => ({
          id: "settings-1",
          user_id: user.id,
          role_code: "BARANGAY",
          profile_picture_path: "",
          profile_picture_file_name: "",
          profile_picture_updated_at: null,
          enabled_notification_rule_codes_json: [],
          notification_channels_json: {},
          last_profile_update_at: null,
          last_preference_save_at: null,
          updated_at: null,
          created_at: null,
        }),
        upsertUserRoleSettings: async () => {
          throw new Error("Unexpected sanitization write");
        },
      },
      [notificationRepositoryPath]: {
        getNotificationPolicyRowsByRoleCode: async () => [],
      },
      [notificationServicePath]: {
        getNotificationRulesForRole: async () => [],
      },
      [profilePictureStorageServicePath]: buildProfilePictureStorageStub(),
    },
    async ({ getCurrentSettings }) => {
      const settings = await getCurrentSettings({
        userId: user.id,
        roleCode: "BARANGAY",
      });

      assert.equal("preferredExportFormat" in settings, false);
      assert.equal(settings.roleCode, "BARANGAY");
      assert.equal(settings.profile.emailAddress, user.email);
      assert.equal(settings.profile.contactNumber, user.contact_number);
      assert.equal(settings.profile.profilePicturePath, "");
      assert.equal(settings.profile.profilePictureUrl, "");
    },
  );
});

test("saveCurrentSettings ignores legacy export preference input and does not persist it", async () => {
  const dbClient = buildDbClient();
  const persistedPayloads = [];
  const auditSnapshots = [];
  const updatedUser = {
    id: "user-2",
    email: "mayor@example.com",
    first_name: "Mario",
    middle_name: null,
    last_name: "Rivera",
    contact_number: "+639181112222",
    default_barangay_id: null,
    is_active: true,
  };

  await withStubbedSettingsService(
    {
      [poolPath]: {
        connect: async () => dbClient,
      },
      [settingsRepositoryPath]: {
        getUserById: async () => updatedUser,
        getBarangayById: async () => null,
        getUserRoleSettings: async () => null,
        updateUserProfile: async (_userId, changes) => ({
          ...updatedUser,
          first_name: changes.firstName,
          middle_name: changes.middleName,
          last_name: changes.lastName,
          contact_number: changes.contactNumber,
        }),
        upsertUserRoleSettings: async (payload) => {
          persistedPayloads.push(payload);
          return {
            id: "settings-2",
            user_id: payload.userId,
            role_code: payload.roleCode,
          };
        },
        insertRoleSettingsSnapshot: async (payload) => {
          auditSnapshots.push(payload);
          return payload;
        },
      },
      [notificationRepositoryPath]: {
        getNotificationPolicyRowsByRoleCode: async () => [],
      },
      [notificationServicePath]: {
        getNotificationRulesForRole: async () => [],
      },
      [profilePictureStorageServicePath]: buildProfilePictureStorageStub(),
    },
    async ({ saveCurrentSettings }) => {
      const result = await saveCurrentSettings({
        userId: updatedUser.id,
        roleCode: "MAYOR",
        settings: {
          preferredExportFormat: "pdf",
          enabledNotificationRuleCodes: [],
          profile: {
            firstName: "Mario",
            middleName: "",
            lastName: "Rivera",
            contactNumber: updatedUser.contact_number,
          },
          notificationChannels: {},
          metadata: {},
        },
        ipAddress: "127.0.0.1",
      });

      assert.equal("preferredExportFormat" in result.settings, false);
      assert.equal(persistedPayloads.length, 1);
      assert.equal("preferredExportFormat" in persistedPayloads[0], false);
      assert.equal("preferred_export_format" in persistedPayloads[0], false);
      assert.equal(
        "preferredExportFormat" in auditSnapshots[0].newValues,
        false,
      );
      assert.match(String(dbClient.statements[0]), /BEGIN/i);
      assert.ok(
        dbClient.statements.some((statement) => /COMMIT/i.test(String(statement))),
      );
    },
  );
});

test("saveCurrentSettings preserves notification preferences when the request updates only profile fields", async () => {
  const dbClient = buildDbClient();
  const persistedPayloads = [];
  const auditSnapshots = [];
  const updatedUser = {
    id: "user-2b",
    email: "barangay@example.com",
    first_name: "Mario",
    middle_name: "De Leon",
    last_name: "Rivera",
    contact_number: "+639181112222",
    default_barangay_id: null,
    is_active: true,
  };

  await withStubbedSettingsService(
    {
      [poolPath]: {
        connect: async () => dbClient,
      },
      [settingsRepositoryPath]: {
        getUserById: async () => updatedUser,
        getBarangayById: async () => null,
        getUserRoleSettings: async () => ({
          user_id: updatedUser.id,
          role_code: "BARANGAY",
          profile_picture_path: "",
          profile_picture_file_name: "",
          profile_picture_updated_at: null,
          enabled_notification_rule_codes_json: [],
          notification_channels_json: {},
          notification_rule_preferences_json: {
            DISTRIBUTION_UPDATE: {
              inApp: false,
              email: true,
            },
          },
          last_profile_update_at: "2026-08-01T08:00:00.000Z",
          last_preference_save_at: "2026-08-01T09:00:00.000Z",
        }),
        updateUserProfile: async (_userId, changes) => ({
          ...updatedUser,
          first_name: changes.firstName,
          middle_name: changes.middleName,
          last_name: changes.lastName,
          contact_number: changes.contactNumber,
        }),
        upsertUserRoleSettings: async (payload) => {
          persistedPayloads.push(payload);
          return payload;
        },
        insertRoleSettingsSnapshot: async (payload) => {
          auditSnapshots.push(payload);
          return payload;
        },
      },
      [notificationRepositoryPath]: {
        getNotificationPolicyRowsByRoleCode: async () => [],
      },
      [notificationServicePath]: {
        getNotificationRulesForRole: async () => [],
      },
      [profilePictureStorageServicePath]: buildProfilePictureStorageStub(),
    },
    async ({ saveCurrentSettings }) => {
      const result = await saveCurrentSettings({
        userId: updatedUser.id,
        roleCode: "BARANGAY",
        settings: {
          profile: {
            firstName: "Mario",
            middleName: "De Leon",
            lastName: "Rivera",
            contactNumber: updatedUser.contact_number,
          },
          metadata: {},
        },
        ipAddress: "127.0.0.1",
      });

      assert.deepEqual(persistedPayloads[0].notificationRulePreferencesJson, {
        DISTRIBUTION_UPDATE: {
          inApp: false,
          email: true,
        },
      });
      assert.equal(
        persistedPayloads[0].lastPreferenceSaveAt,
        "2026-08-01T09:00:00.000Z",
      );
      assert.deepEqual(result.settings.notificationRulePreferences, {
        DISTRIBUTION_UPDATE: {
          inApp: false,
          email: true,
        },
      });
      assert.equal(
        auditSnapshots.some(
          (snapshot) =>
            snapshot.action === "UPDATE_NOTIFICATION_PREFERENCES" ||
            snapshot.action === "RESET_NOTIFICATION_PREFERENCES",
        ),
        false,
      );
    },
  );
});

test("uploadCurrentProfilePicture stores a private path and returns signed metadata", async () => {
  const dbClient = buildDbClient();
  const persistedPayloads = [];
  const removedPaths = [];
  const user = {
    id: "user-3",
    email: "mswdo@example.com",
    first_name: "Lia",
    middle_name: null,
    last_name: "Reyes",
    contact_number: "+639191112223",
    default_barangay_id: null,
    is_active: true,
  };

  await withStubbedSettingsService(
    {
      [poolPath]: {
        connect: async () => dbClient,
      },
      [settingsRepositoryPath]: {
        getUserById: async () => user,
        getBarangayById: async () => null,
        getUserRoleSettings: async () => ({
          user_id: user.id,
          role_code: "MSWDO",
          profile_picture_path: "user-3/old-picture.jpg",
          profile_picture_file_name: "old-picture.jpg",
          profile_picture_updated_at: "2026-07-30T08:00:00.000Z",
          enabled_notification_rule_codes_json: [],
          notification_channels_json: {},
          last_profile_update_at: null,
          last_preference_save_at: null,
        }),
        upsertUserRoleSettings: async (payload) => {
          persistedPayloads.push(payload);
          return payload;
        },
        insertRoleSettingsSnapshot: async () => ({}),
      },
      [notificationRepositoryPath]: {
        getNotificationPolicyRowsByRoleCode: async () => [],
      },
      [notificationServicePath]: {
        getNotificationRulesForRole: async () => [],
      },
      [profilePictureStorageServicePath]: buildProfilePictureStorageStub({
        createSignedProfilePictureUrl: async (path) => ({
          profilePictureUrl: `https://example.supabase.co/storage/v1/object/sign/distync-profile-pictures/${path}?token=abc`,
          profilePictureUrlExpiresAt: "2026-07-31T10:10:00.000Z",
        }),
        removeProfilePicture: async (path) => {
          removedPaths.push(path);
          return true;
        },
        uploadProfilePicture: async () => ({
          profilePicturePath: "user-3/2026-07-31T10-00-00-000Z-new-picture.webp",
          profilePictureFileName: "new-picture.webp",
        }),
      }),
    },
    async ({ uploadCurrentProfilePicture }) => {
      const result = await uploadCurrentProfilePicture({
        userId: user.id,
        roleCode: "MSWDO",
        fileName: "new-picture.webp",
        mimeType: "image/webp",
        fileDataBase64: "ZmFrZQ==",
        ipAddress: "127.0.0.1",
      });

      assert.equal(
        persistedPayloads[0].profilePicturePath,
        "user-3/2026-07-31T10-00-00-000Z-new-picture.webp",
      );
      assert.equal(
        result.profile.profilePicturePath,
        "user-3/2026-07-31T10-00-00-000Z-new-picture.webp",
      );
      assert.match(result.profile.profilePictureUrl, /object\/sign/);
      assert.deepEqual(removedPaths, ["user-3/old-picture.jpg"]);
    },
  );
});

test("uploadCurrentProfilePicture removes the new object when the database write fails", async () => {
  const dbClient = buildDbClient();
  const removedPaths = [];
  const user = {
    id: "user-4",
    email: "barangay@example.com",
    first_name: "Kai",
    middle_name: null,
    last_name: "Santos",
    contact_number: "+639171234567",
    default_barangay_id: null,
    is_active: true,
  };

  await withStubbedSettingsService(
    {
      [poolPath]: {
        connect: async () => dbClient,
      },
      [settingsRepositoryPath]: {
        getUserById: async () => user,
        getBarangayById: async () => null,
        getUserRoleSettings: async () => null,
        upsertUserRoleSettings: async () => {
          throw new Error("Database write failed");
        },
        insertRoleSettingsSnapshot: async () => ({}),
      },
      [notificationRepositoryPath]: {
        getNotificationPolicyRowsByRoleCode: async () => [],
      },
      [notificationServicePath]: {
        getNotificationRulesForRole: async () => [],
      },
      [profilePictureStorageServicePath]: buildProfilePictureStorageStub({
        removeProfilePicture: async (path) => {
          removedPaths.push(path);
          return true;
        },
        uploadProfilePicture: async () => ({
          profilePicturePath: "user-4/new-picture.jpg",
          profilePictureFileName: "new-picture.jpg",
        }),
      }),
    },
    async ({ uploadCurrentProfilePicture }) => {
      await assert.rejects(
        () =>
          uploadCurrentProfilePicture({
            userId: user.id,
            roleCode: "BARANGAY",
            fileName: "new-picture.jpg",
            mimeType: "image/jpeg",
            fileDataBase64: "ZmFrZQ==",
          }),
        /Database write failed/,
      );

      assert.deepEqual(removedPaths, ["user-4/new-picture.jpg"]);
    },
  );
});

test("saveCurrentSettings persists a pending profile picture replacement and removes the previous object after commit", async () => {
  const dbClient = buildDbClient();
  const persistedPayloads = [];
  const auditSnapshots = [];
  const removedPaths = [];
  const user = {
    id: "user-5",
    email: "mayor@example.com",
    first_name: "Ina",
    middle_name: null,
    last_name: "Torres",
    contact_number: "+639181234567",
    default_barangay_id: null,
    is_active: true,
  };

  await withStubbedSettingsService(
    {
      [poolPath]: {
        connect: async () => dbClient,
      },
      [settingsRepositoryPath]: {
        getUserById: async () => user,
        getBarangayById: async () => null,
        getUserRoleSettings: async () => ({
          user_id: user.id,
          role_code: "MAYOR",
          profile_picture_path: "user-5/original-picture.jpg",
          profile_picture_file_name: "original-picture.jpg",
          profile_picture_updated_at: "2026-07-31T09:00:00.000Z",
          enabled_notification_rule_codes_json: [],
          notification_channels_json: {},
          notification_rule_preferences_json: {},
          last_profile_update_at: null,
          last_preference_save_at: null,
        }),
        updateUserProfile: async () => user,
        upsertUserRoleSettings: async (payload) => {
          persistedPayloads.push(payload);
          return payload;
        },
        insertRoleSettingsSnapshot: async (payload) => {
          auditSnapshots.push(payload);
          return payload;
        },
      },
      [notificationRepositoryPath]: {
        getNotificationPolicyRowsByRoleCode: async () => [],
      },
      [notificationServicePath]: {
        getNotificationRulesForRole: async () => [],
      },
      [profilePictureStorageServicePath]: buildProfilePictureStorageStub({
        createSignedProfilePictureUrl: async (path) => ({
          profilePictureUrl: `https://example.supabase.co/storage/v1/object/sign/distync-profile-pictures/${path}?token=next`,
          profilePictureUrlExpiresAt: "2026-08-01T11:00:00.000Z",
        }),
        uploadProfilePicture: async () => ({
          profilePicturePath: "user-5/new-picture.webp",
          profilePictureFileName: "new-picture.webp",
        }),
        removeProfilePicture: async (path) => {
          removedPaths.push(path);
          return true;
        },
      }),
    },
    async ({ saveCurrentSettings }) => {
      const result = await saveCurrentSettings({
        userId: user.id,
        roleCode: "MAYOR",
        settings: {
          profile: {
            firstName: user.first_name,
            middleName: user.middle_name,
            lastName: user.last_name,
            contactNumber: user.contact_number,
          },
          profilePicture: {
            action: "REPLACE",
            fileName: "new-picture.webp",
            mimeType: "image/webp",
            fileDataBase64: "ZmFrZQ==",
          },
          metadata: {},
        },
        ipAddress: "127.0.0.1",
      });

      assert.equal(persistedPayloads.length, 1);
      assert.equal(persistedPayloads[0].profilePicturePath, "user-5/new-picture.webp");
      assert.equal(
        persistedPayloads[0].profilePictureFileName,
        "new-picture.webp",
      );
      assert.equal(result.settings.profile.profilePicturePath, "user-5/new-picture.webp");
      assert.match(result.settings.profile.profilePictureUrl, /object\/sign/);
      assert.deepEqual(removedPaths, ["user-5/original-picture.jpg"]);
      assert.ok(
        auditSnapshots.some(
          (snapshot) => snapshot.action === "PROFILE_PICTURE_REPLACED",
        ),
      );
    },
  );
});

test("saveCurrentSettings persists a pending profile picture removal and deletes the old object after commit", async () => {
  const dbClient = buildDbClient();
  const persistedPayloads = [];
  const auditSnapshots = [];
  const removedPaths = [];
  const user = {
    id: "user-6",
    email: "barangay@example.com",
    first_name: "Mia",
    middle_name: null,
    last_name: "Santos",
    contact_number: "+639171112233",
    default_barangay_id: null,
    is_active: true,
  };

  await withStubbedSettingsService(
    {
      [poolPath]: {
        connect: async () => dbClient,
      },
      [settingsRepositoryPath]: {
        getUserById: async () => user,
        getBarangayById: async () => null,
        getUserRoleSettings: async () => ({
          user_id: user.id,
          role_code: "BARANGAY",
          profile_picture_path: "user-6/current-picture.png",
          profile_picture_file_name: "current-picture.png",
          profile_picture_updated_at: "2026-07-31T09:30:00.000Z",
          enabled_notification_rule_codes_json: [],
          notification_channels_json: {},
          notification_rule_preferences_json: {},
          last_profile_update_at: null,
          last_preference_save_at: null,
        }),
        updateUserProfile: async () => user,
        upsertUserRoleSettings: async (payload) => {
          persistedPayloads.push(payload);
          return payload;
        },
        insertRoleSettingsSnapshot: async (payload) => {
          auditSnapshots.push(payload);
          return payload;
        },
      },
      [notificationRepositoryPath]: {
        getNotificationPolicyRowsByRoleCode: async () => [],
      },
      [notificationServicePath]: {
        getNotificationRulesForRole: async () => [],
      },
      [profilePictureStorageServicePath]: buildProfilePictureStorageStub({
        removeProfilePicture: async (path) => {
          removedPaths.push(path);
          return true;
        },
      }),
    },
    async ({ saveCurrentSettings }) => {
      const result = await saveCurrentSettings({
        userId: user.id,
        roleCode: "BARANGAY",
        settings: {
          profile: {
            firstName: user.first_name,
            middleName: user.middle_name,
            lastName: user.last_name,
            contactNumber: user.contact_number,
          },
          profilePicture: {
            action: "REMOVE",
          },
          metadata: {},
        },
        ipAddress: "127.0.0.1",
      });

      assert.equal(persistedPayloads.length, 1);
      assert.equal(persistedPayloads[0].profilePicturePath, "");
      assert.equal(persistedPayloads[0].profilePictureFileName, "");
      assert.equal(result.settings.profile.profilePicturePath, "");
      assert.equal(result.settings.profile.profilePictureUrl, "");
      assert.deepEqual(removedPaths, ["user-6/current-picture.png"]);
      assert.ok(
        auditSnapshots.some(
          (snapshot) => snapshot.action === "PROFILE_PICTURE_REMOVED",
        ),
      );
    },
  );
});
