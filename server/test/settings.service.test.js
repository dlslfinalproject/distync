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
        getUserRoleSettings: async () => ({
          id: "settings-1",
          user_id: user.id,
          role_code: "BARANGAY",
          preferred_export_format: "pdf",
          profile_picture_data_url: "",
          profile_picture_file_name: "",
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
      [notificationRepositoryPath]: {},
      [notificationServicePath]: {
        getNotificationRulesForRole: async () => [],
      },
      [profilePictureStorageServicePath]: {
        uploadProfilePicture: async () => {
          throw new Error("Unexpected profile picture upload");
        },
        removeProfilePicture: async () => {},
      },
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
      [notificationRepositoryPath]: {},
      [notificationServicePath]: {
        getNotificationRulesForRole: async () => [],
      },
      [profilePictureStorageServicePath]: {
        uploadProfilePicture: async () => {
          throw new Error("Unexpected profile picture upload");
        },
        removeProfilePicture: async () => {},
      },
    },
    async ({ saveCurrentSettings }) => {
      const result = await saveCurrentSettings({
        userId: updatedUser.id,
        roleCode: "MAYOR",
        settings: {
          preferredExportFormat: "pdf",
          enabledNotificationRuleCodes: [],
          profile: {
            fullName: "Mario Rivera",
            contactNumber: updatedUser.contact_number,
            profilePictureDataUrl: "",
            profilePictureFileName: "",
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
      assert.match(String(dbClient.statements[1]), /COMMIT/i);
    },
  );
});
