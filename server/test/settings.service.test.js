const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildPreferenceCategories,
  mergeCanonicalPolicyRows,
  resolveEffectiveNotificationPreferences,
  sanitizeNotificationRulePreferences,
} = require("../src/modules/notifications/notificationPreferenceUtils");
const {
  getSettingsVisibleRuleCodesForRole,
  isVisibleInSettings,
} = require("../src/modules/notifications/notificationPolicy");

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
const systemLogRepositoryPath = require.resolve(
  "../src/repositories/systemLog.repository",
);

const withStubbedSettingsService = async (stubs, runTest) => {
  const dependencyPaths = [
    poolPath,
    settingsRepositoryPath,
    notificationRepositoryPath,
    notificationServicePath,
    profilePictureStorageServicePath,
    systemLogRepositoryPath,
  ];
  const originalEntries = new Map(
    dependencyPaths.map((modulePath) => [modulePath, require.cache[modulePath]]),
  );

  delete require.cache[servicePath];

  try {
    dependencyPaths.forEach((modulePath) => {
      if (!Object.prototype.hasOwnProperty.call(stubs, modulePath)) {
        return;
      }

      const exports =
        modulePath === notificationServicePath
          ? {
              getNotificationPreferenceCatalogForRole: async ({
                roleCode,
                preferenceRow = null,
                storedPreferences = null,
                dbClient = null,
                enforceAvailability = true,
              } = {}) => {
                const notificationRepositoryStub =
                  stubs[notificationRepositoryPath];
                const policyRows =
                  await notificationRepositoryStub.getNotificationPolicyRowsByRoleCode(
                    roleCode,
                    dbClient,
                  );
                const canonicalPolicyRows = mergeCanonicalPolicyRows({
                  roleCode,
                  policyRows,
                });

                if (
                  enforceAvailability &&
                  getSettingsVisibleRuleCodesForRole(roleCode).length > 0 &&
                  canonicalPolicyRows.length === 0
                ) {
                  const error = new Error(
                    "Notification preferences are temporarily unavailable. Please try again.",
                  );
                  error.statusCode = 503;
                  error.code = "NOTIFICATION_POLICY_UNAVAILABLE";
                  throw error;
                }

                const resolvedPreferences = resolveEffectiveNotificationPreferences({
                  roleCode,
                  policyRows,
                  modernPreferences:
                    storedPreferences ??
                    sanitizeNotificationRulePreferences(
                      preferenceRow?.notification_rule_preferences_json,
                    ),
                });

                return {
                  notificationRulePreferences:
                    resolvedPreferences.normalizedPreferences,
                  effectiveNotificationChannels:
                    resolvedPreferences.effectiveChannels,
                  categories: buildPreferenceCategories({
                    roleCode,
                    policyRows,
                    storedPreferences:
                      resolvedPreferences.normalizedPreferences,
                  }),
                  rules: canonicalPolicyRows
                    .map((row) => ({
                      id: row.id,
                      code: row.code,
                      name: row.name,
                      trigger_type: row.trigger_type,
                      target_role_code: row.target_role_code,
                      is_active:
                        row.is_active !== false &&
                        row.policy_is_active !== false,
                      categoryCode: row.category_code,
                      categoryLabel: row.category_label,
                      priority: row.priority,
                      inAppPolicy: row.in_app_policy,
                      emailPolicy: row.email_policy,
                      deliveryMode: row.delivery_mode,
                      userConfigurability: row.user_configurability,
                      created_at: row.created_at,
                    }))
                    .filter((row) => isVisibleInSettings(row.code, roleCode)),
                  source: "modern",
                };
              },
              ...stubs[modulePath],
            }
          : stubs[modulePath];

      require.cache[modulePath] = {
        id: modulePath,
        filename: modulePath,
        loaded: true,
        exports,
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
          notification_rule_preferences_json: {},
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
        getNotificationPolicyRowsByRoleCode: async () => [
          {
            code: "DISASTER_EVENT_UPDATED",
            name: "Disaster Event Updates",
            role_code: "BARANGAY",
            category_code: "DISASTER_COORDINATION",
            category_label: "Disaster Coordination",
            priority: "CRITICAL",
            in_app_policy: "MANDATORY",
            email_policy: "DEFAULT_ON",
            delivery_mode: "IMMEDIATE",
            user_configurability: "EMAIL_ONLY",
            is_active: true,
            policy_is_active: true,
          },
        ],
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

test("getCurrentSettings fails safely when notification policy rows are unavailable for a supported role", async () => {
  const user = {
    id: "user-config-missing",
    email: "barangay-config@example.com",
    first_name: "Ari",
    middle_name: null,
    last_name: "Flores",
    contact_number: "+639171234566",
    default_barangay_id: null,
    is_active: true,
  };

  await withStubbedSettingsService(
    {
      [poolPath]: {},
      [settingsRepositoryPath]: {
        getUserById: async () => user,
        getBarangayById: async () => null,
        getUserRoleSettings: async () => null,
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
      await assert.rejects(
        () =>
          getCurrentSettings({
            userId: user.id,
            roleCode: "BARANGAY",
          }),
        (error) => {
          assert.equal(error.statusCode, 503);
          assert.match(
            error.message,
            /Notification preferences are temporarily unavailable/i,
          );
          return true;
        },
      );
    },
  );
});

test("getCurrentSettings uses policy defaults for an existing row with empty modern preferences", async () => {
  const user = {
    id: "user-empty",
    email: "barangay-empty@example.com",
    first_name: "Lara",
    middle_name: null,
    last_name: "Santos",
    contact_number: "+639171234560",
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
          user_id: user.id,
          role_code: "BARANGAY",
          profile_picture_path: "",
          profile_picture_file_name: "",
          profile_picture_updated_at: null,
          notification_rule_preferences_json: {},
          last_profile_update_at: null,
          last_preference_save_at: "2026-08-01T09:00:00.000Z",
        }),
        upsertUserRoleSettings: async () => {
          throw new Error("Unexpected GET write");
        },
      },
      [notificationRepositoryPath]: {
        getNotificationPolicyRowsByRoleCode: async () => [
          {
            code: "DISASTER_EVENT_UPDATE",
            name: "Disaster Event Update",
            category_code: "DISASTER_COORDINATION",
            category_label: "Disaster Coordination",
            priority: "CRITICAL",
            in_app_policy: "MANDATORY",
            email_policy: "DEFAULT_ON",
            delivery_mode: "IMMEDIATE",
            user_configurability: "EMAIL_ONLY",
          },
          {
            code: "HOUSEHOLD_REGISTERED",
            name: "Household Registration Update",
            category_code: "EVACUEE_MANAGEMENT",
            category_label: "Evacuee Management",
            priority: "INFORMATIONAL",
            in_app_policy: "OPTIONAL",
            email_policy: "UNAVAILABLE",
            delivery_mode: "HOURLY_SUMMARY",
            user_configurability: "ALL_SUPPORTED_CHANNELS",
          },
          {
            code: "HOUSEHOLD_VERIFICATION",
            name: "Household Verification Update",
            category_code: "EVACUEE_MANAGEMENT",
            category_label: "Evacuee Management",
            priority: "WARNING",
            in_app_policy: "MANDATORY",
            email_policy: "OPTIONAL",
            delivery_mode: "IMMEDIATE",
            user_configurability: "EMAIL_ONLY",
          },
          {
            code: "SYNC_FAILURE",
            name: "Sync Failure",
            category_code: "SYSTEM_OPERATIONS",
            category_label: "System Operations",
            priority: "CRITICAL",
            in_app_policy: "MANDATORY",
            email_policy: "DEFAULT_ON",
            delivery_mode: "IMMEDIATE",
            user_configurability: "EMAIL_ONLY",
          },
          {
            code: "SYNC_CONFLICT",
            name: "Synchronization Conflict Alert",
            category_code: "SYSTEM_OPERATIONS",
            category_label: "System Operations",
            priority: "CRITICAL",
            in_app_policy: "MANDATORY",
            email_policy: "DEFAULT_ON",
            delivery_mode: "IMMEDIATE",
            user_configurability: "EMAIL_ONLY",
          },
        ],
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

      assert.deepEqual(settings.notificationRulePreferences, {});
      assert.deepEqual(settings.effectiveNotificationChannels, {
        DISASTER_EVENT_UPDATED: { inApp: true, email: true },
        HOUSEHOLD_REGISTERED: { inApp: true, email: false },
        HOUSEHOLD_VERIFICATION_UPDATED: { inApp: true, email: false },
        SYNC_FAILURE: { inApp: true, email: true },
        SYNC_CONFLICT: { inApp: true, email: true },
      });
      assert.equal(
        settings.categories
          .flatMap((category) => category.rules || [])
          .find((rule) => rule.code === "HOUSEHOLD_REGISTERED")
          ?.effectiveChannels?.inApp,
        true,
      );
      assert.equal("legacyPreferenceSource" in settings, false);
    },
  );
});

test("getCurrentSettings uses policy defaults when no settings row exists", async () => {
  const user = {
    id: "user-missing",
    email: "mswdo-missing@example.com",
    first_name: "Mira",
    middle_name: null,
    last_name: "Reyes",
    contact_number: "+639171234561",
    default_barangay_id: null,
    is_active: true,
  };

  await withStubbedSettingsService(
    {
      [poolPath]: {},
      [settingsRepositoryPath]: {
        getUserById: async () => user,
        getBarangayById: async () => null,
        getUserRoleSettings: async () => null,
        upsertUserRoleSettings: async () => {
          throw new Error("Unexpected GET write");
        },
      },
      [notificationRepositoryPath]: {
        getNotificationPolicyRowsByRoleCode: async () => [
          {
            code: "DISASTER_EVENT_CREATED",
            name: "Newly Created Disaster Event",
            category_code: "DISASTER_MANAGEMENT",
            category_label: "Disaster Management",
            priority: "WARNING",
            in_app_policy: "MANDATORY",
            email_policy: "DEFAULT_ON",
            delivery_mode: "IMMEDIATE",
            user_configurability: "EMAIL_ONLY",
          },
          {
            code: "EVACUEE_ATTENDANCE_UPDATE",
            name: "Evacuee Attendance Update",
            category_code: "EVACUEE_MANAGEMENT",
            category_label: "Evacuee Management",
            priority: "INFORMATIONAL",
            in_app_policy: "OPTIONAL",
            email_policy: "OPTIONAL",
            delivery_mode: "HOURLY_SUMMARY",
            user_configurability: "ALL_SUPPORTED_CHANNELS",
          },
        ],
      },
      [notificationServicePath]: {
        getNotificationRulesForRole: async () => [],
      },
      [profilePictureStorageServicePath]: buildProfilePictureStorageStub(),
    },
    async ({ getCurrentSettings }) => {
      const settings = await getCurrentSettings({
        userId: user.id,
        roleCode: "MSWDO",
      });

      assert.deepEqual(settings.notificationRulePreferences, {});
      assert.deepEqual(settings.effectiveNotificationChannels.DISASTER_EVENT_CREATED, {
        inApp: true,
        email: true,
      });
      assert.deepEqual(settings.effectiveNotificationChannels.EVACUEE_ATTENDANCE_UPDATED, {
        inApp: true,
        email: false,
      });
    },
  );
});

test("getCurrentSettings loads populated modern preferences without legacy fallback", async () => {
  const user = {
    id: "user-mixed",
    email: "barangay-mixed@example.com",
    first_name: "Nina",
    middle_name: null,
    last_name: "Torres",
    contact_number: "+639171234562",
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
          user_id: user.id,
          role_code: "BARANGAY",
          profile_picture_path: "",
          profile_picture_file_name: "",
          profile_picture_updated_at: null,
          notification_rule_preferences_json: {
            HOUSEHOLD_REGISTERED: {
              inApp: false,
            },
          },
          last_profile_update_at: null,
          last_preference_save_at: "2026-08-02T08:00:00.000Z",
        }),
      },
      [notificationRepositoryPath]: {
        getNotificationPolicyRowsByRoleCode: async () => [
          {
            code: "HOUSEHOLD_REGISTERED",
            name: "Household Registration Update",
            category_code: "EVACUEE_MANAGEMENT",
            category_label: "Evacuee Management",
            priority: "INFORMATIONAL",
            in_app_policy: "OPTIONAL",
            email_policy: "UNAVAILABLE",
            delivery_mode: "HOURLY_SUMMARY",
            user_configurability: "ALL_SUPPORTED_CHANNELS",
          },
        ],
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

      assert.deepEqual(settings.notificationRulePreferences, {
        HOUSEHOLD_REGISTERED: {
          inApp: false,
        },
      });
      assert.deepEqual(settings.effectiveNotificationChannels.HOUSEHOLD_REGISTERED, {
        inApp: false,
        email: false,
      });
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
        "enabledNotificationRuleCodesJson" in persistedPayloads[0],
        false,
      );
      assert.equal(
        "notificationChannelsJson" in persistedPayloads[0],
        false,
      );
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
            DISASTER_EVENT_UPDATE: {
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
        DISASTER_EVENT_UPDATED: {
          inApp: false,
          email: true,
        },
      });
      assert.equal(
        "enabledNotificationRuleCodesJson" in persistedPayloads[0],
        false,
      );
      assert.equal(
        "notificationChannelsJson" in persistedPayloads[0],
        false,
      );
      assert.equal(
        persistedPayloads[0].lastPreferenceSaveAt,
        "2026-08-01T09:00:00.000Z",
      );
      assert.deepEqual(result.settings.notificationRulePreferences, {
        DISASTER_EVENT_UPDATED: {
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

test("getCurrentSettings deduplicates legacy and canonical policy rows into one Barangay output", async () => {
  const user = {
    id: "user-duplicate-barangay",
    email: "barangay-duplicate@example.com",
    first_name: "Lea",
    middle_name: null,
    last_name: "Cruz",
    contact_number: "+639171234500",
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
          user_id: user.id,
          role_code: "BARANGAY",
          profile_picture_path: "",
          profile_picture_file_name: "",
          profile_picture_updated_at: null,
          notification_rule_preferences_json: {
            DISASTER_EVENT_UPDATE: { email: true },
            DISASTER_EVENT_UPDATED: { email: false },
            SYNC_CONFLICT: { email: false },
          },
          last_profile_update_at: null,
          last_preference_save_at: "2026-08-03T08:00:00.000Z",
        }),
      },
      [notificationRepositoryPath]: {
        getNotificationPolicyRowsByRoleCode: async () => [
          {
            code: "DISASTER_EVENT_UPDATE",
            name: "Disaster Event Update",
            category_code: "DISASTER_COORDINATION",
            category_label: "Disaster Coordination",
            priority: "CRITICAL",
            in_app_policy: "MANDATORY",
            email_policy: "DEFAULT_ON",
            delivery_mode: "IMMEDIATE",
            user_configurability: "EMAIL_ONLY",
          },
          {
            code: "DISASTER_EVENT_UPDATED",
            name: "Disaster Event Updates",
            category_code: "DISASTER_COORDINATION",
            category_label: "Disaster Coordination",
            priority: "CRITICAL",
            in_app_policy: "MANDATORY",
            email_policy: "DEFAULT_ON",
            delivery_mode: "IMMEDIATE",
            user_configurability: "EMAIL_ONLY",
          },
          {
            code: "HOUSEHOLD_REGISTERED",
            name: "New Evacuee Registration",
            category_code: "EVACUEE_MANAGEMENT",
            category_label: "Evacuee Management",
            priority: "INFORMATIONAL",
            in_app_policy: "OPTIONAL",
            email_policy: "UNAVAILABLE",
            delivery_mode: "HOURLY_SUMMARY",
            user_configurability: "ALL_SUPPORTED_CHANNELS",
          },
          {
            code: "EVACUEE_ATTENDANCE_UPDATE",
            name: "Evacuee Attendance Update",
            category_code: "EVACUEE_MANAGEMENT",
            category_label: "Evacuee Management",
            priority: "INFORMATIONAL",
            in_app_policy: "OPTIONAL",
            email_policy: "UNAVAILABLE",
            delivery_mode: "HOURLY_SUMMARY",
            user_configurability: "ALL_SUPPORTED_CHANNELS",
          },
          {
            code: "HOUSEHOLD_VERIFICATION_UPDATED",
            name: "Household Verification Updates",
            category_code: "EVACUEE_MANAGEMENT",
            category_label: "Evacuee Management",
            priority: "WARNING",
            in_app_policy: "MANDATORY",
            email_policy: "OPTIONAL",
            delivery_mode: "IMMEDIATE",
            user_configurability: "EMAIL_ONLY",
          },
          {
            code: "SYNC_FAILURE",
            name: "Sync Failure",
            category_code: "SYSTEM_OPERATIONS",
            category_label: "System Operations",
            priority: "CRITICAL",
            in_app_policy: "MANDATORY",
            email_policy: "DEFAULT_ON",
            delivery_mode: "IMMEDIATE",
            user_configurability: "EMAIL_ONLY",
          },
          {
            code: "SYNC_CONFLICT",
            name: "Synchronization Conflict Alert",
            category_code: "SYSTEM_OPERATIONS",
            category_label: "System Operations",
            priority: "CRITICAL",
            in_app_policy: "MANDATORY",
            email_policy: "DEFAULT_ON",
            delivery_mode: "IMMEDIATE",
            user_configurability: "EMAIL_ONLY",
          },
          {
            code: "SYSTEM_ANOMALY",
            name: "System Anomaly Alert",
            category_code: "SYSTEM_OPERATIONS",
            category_label: "System Operations",
            priority: "CRITICAL",
            in_app_policy: "MANDATORY",
            email_policy: "DEFAULT_ON",
            delivery_mode: "IMMEDIATE",
            user_configurability: "EMAIL_ONLY",
            is_active: false,
            policy_is_active: false,
          },
          {
            code: "SYSTEM_ALERT",
            name: "System Alerts",
            category_code: "SYSTEM_OPERATIONS",
            category_label: "System Operations",
            priority: "CRITICAL",
            in_app_policy: "MANDATORY",
            email_policy: "DEFAULT_ON",
            delivery_mode: "IMMEDIATE",
            user_configurability: "EMAIL_ONLY",
            is_active: false,
            policy_is_active: false,
          },
        ],
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

      const categorySummary = settings.categories.map((category) => ({
        label: category.label,
        codes: (category.rules || []).map((rule) => rule.code),
      }));

      assert.deepEqual(settings.notificationRulePreferences, {
        DISASTER_EVENT_UPDATED: { email: true },
        SYNC_CONFLICT: { email: false },
      });
      assert.deepEqual(categorySummary, [
        {
          label: "Disaster Coordination",
          codes: ["DISASTER_EVENT_UPDATED"],
        },
        {
          label: "Evacuee Management",
          codes: [
            "HOUSEHOLD_REGISTERED",
            "EVACUEE_ATTENDANCE_UPDATED",
            "HOUSEHOLD_VERIFICATION_UPDATED",
          ],
        },
        {
          label: "System Operations",
          codes: ["SYNC_FAILURE", "SYNC_CONFLICT"],
        },
      ]);
    },
  );
});

test("getCurrentSettings returns the reorganized Mayor notification categories in the required order", async () => {
  const user = {
    id: "user-mayor-categories",
    email: "mayor-categories@example.com",
    first_name: "Mara",
    middle_name: null,
    last_name: "Lopez",
    contact_number: "+639171234588",
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
          user_id: user.id,
          role_code: "MAYOR",
          profile_picture_path: "",
          profile_picture_file_name: "",
          profile_picture_updated_at: null,
          notification_rule_preferences_json: {},
          last_profile_update_at: null,
          last_preference_save_at: "2026-08-04T09:00:00.000Z",
        }),
      },
      [notificationRepositoryPath]: {
        getNotificationPolicyRowsByRoleCode: async (roleCode) => {
          if (roleCode !== "MAYOR") {
            return [];
          }

          return [
            {
              code: "DISASTER_EVENT_UPDATED",
              name: "Disaster Event Updates",
              category_code: "DISASTER_MONITORING",
              category_label: "Disaster Monitoring",
              priority: "CRITICAL",
              in_app_policy: "MANDATORY",
              email_policy: "DEFAULT_ON",
              delivery_mode: "IMMEDIATE",
              user_configurability: "EMAIL_ONLY",
            },
            {
              code: "EVACUATION_SUMMARY_REPORT",
              name: "Evacuation Summary Reports",
              category_code: "DISASTER_MONITORING",
              category_label: "Disaster Monitoring",
              priority: "INFORMATIONAL",
              in_app_policy: "OPTIONAL",
              email_policy: "OPTIONAL",
              delivery_mode: "HOURLY_SUMMARY",
              user_configurability: "ALL_SUPPORTED_CHANNELS",
            },
            {
              code: "DISTRIBUTION_COMPLETED",
              name: "Distribution Completed",
              category_code: "RELIEF_OPERATIONS",
              category_label: "Relief Operations",
              priority: "INFORMATIONAL",
              in_app_policy: "OPTIONAL",
              email_policy: "OPTIONAL",
              delivery_mode: "HOURLY_SUMMARY",
              user_configurability: "ALL_SUPPORTED_CHANNELS",
            },
            {
              code: "DONATION_RECEIVED",
              name: "Donation Received",
              category_code: "RELIEF_OPERATIONS",
              category_label: "Relief Operations",
              priority: "INFORMATIONAL",
              in_app_policy: "OPTIONAL",
              email_policy: "OPTIONAL",
              delivery_mode: "IMMEDIATE",
              user_configurability: "ALL_SUPPORTED_CHANNELS",
            },
            {
              code: "LOW_STOCK",
              name: "Low Stock Alert",
              category_code: "INVENTORY_MONITORING",
              category_label: "Inventory Monitoring",
              priority: "WARNING",
              in_app_policy: "MANDATORY",
              email_policy: "OPTIONAL",
              delivery_mode: "THRESHOLD",
              user_configurability: "EMAIL_ONLY",
            },
            {
              code: "CRITICAL_INVENTORY_SHORTAGE",
              name: "Critical Inventory Shortage",
              category_code: "INVENTORY_MONITORING",
              category_label: "Inventory Monitoring",
              priority: "CRITICAL",
              in_app_policy: "MANDATORY",
              email_policy: "DEFAULT_ON",
              delivery_mode: "THRESHOLD",
              user_configurability: "EMAIL_ONLY",
            },
            {
              code: "NEAR_EXPIRY_STOCK",
              name: "Near Expiry Stock Alert",
              category_code: "INVENTORY_MONITORING",
              category_label: "Inventory Monitoring",
              priority: "WARNING",
              in_app_policy: "MANDATORY",
              email_policy: "OPTIONAL",
              delivery_mode: "THRESHOLD",
              user_configurability: "EMAIL_ONLY",
            },
            {
              code: "EXPIRED_STOCK",
              name: "Expired Stock Alert",
              category_code: "INVENTORY_MONITORING",
              category_label: "Inventory Monitoring",
              priority: "CRITICAL",
              in_app_policy: "MANDATORY",
              email_policy: "DEFAULT_ON",
              delivery_mode: "IMMEDIATE",
              user_configurability: "EMAIL_ONLY",
            },
            {
              code: "INVENTORY_INCIDENT",
              name: "Inventory Incident Alert",
              category_code: "INVENTORY_MONITORING",
              category_label: "Inventory Monitoring",
              priority: "CRITICAL",
              in_app_policy: "MANDATORY",
              email_policy: "DEFAULT_ON",
              delivery_mode: "IMMEDIATE",
              user_configurability: "EMAIL_ONLY",
            },
            {
              code: "SYNC_FAILURE",
              name: "Sync Failure",
              category_code: "SYSTEM_MONITORING",
              category_label: "System Monitoring",
              priority: "CRITICAL",
              in_app_policy: "MANDATORY",
              email_policy: "DEFAULT_ON",
              delivery_mode: "IMMEDIATE",
              user_configurability: "EMAIL_ONLY",
            },
            {
              code: "SYNC_CONFLICT",
              name: "Synchronization Conflict Alert",
              category_code: "SYSTEM_MONITORING",
              category_label: "System Monitoring",
              priority: "CRITICAL",
              in_app_policy: "MANDATORY",
              email_policy: "DEFAULT_ON",
              delivery_mode: "IMMEDIATE",
              user_configurability: "EMAIL_ONLY",
            },
            {
              code: "DONATION_STOCK_ANOMALY",
              name: "Donation Anomaly",
              category_code: "SYSTEM_MONITORING",
              category_label: "System Monitoring",
              priority: "CRITICAL",
              in_app_policy: "MANDATORY",
              email_policy: "DEFAULT_ON",
              delivery_mode: "IMMEDIATE",
              user_configurability: "EMAIL_ONLY",
            },
            {
              code: "SYSTEM_ALERT",
              name: "System Alerts",
              category_code: "SYSTEM_MONITORING",
              category_label: "System Monitoring",
              priority: "CRITICAL",
              in_app_policy: "MANDATORY",
              email_policy: "DEFAULT_ON",
              delivery_mode: "IMMEDIATE",
              user_configurability: "EMAIL_ONLY",
              is_active: true,
              policy_is_active: true,
            },
            {
              code: "OPERATIONAL_ANOMALY",
              name: "Operational Anomaly Alerts",
              category_code: "SYSTEM_MONITORING",
              category_label: "System Monitoring",
              priority: "CRITICAL",
              in_app_policy: "MANDATORY",
              email_policy: "DEFAULT_ON",
              delivery_mode: "IMMEDIATE",
              user_configurability: "EMAIL_ONLY",
              is_active: true,
              policy_is_active: true,
            },
          ];
        },
      },
      [notificationServicePath]: {
        getNotificationRulesForRole: async () => [],
      },
      [profilePictureStorageServicePath]: buildProfilePictureStorageStub(),
    },
    async ({ getCurrentSettings }) => {
      const settings = await getCurrentSettings({
        userId: user.id,
        roleCode: "MAYOR",
      });

      const categorySummary = settings.categories.map((category) => ({
        label: category.label,
        count: (category.rules || []).length,
        codes: (category.rules || []).map((rule) => rule.code),
      }));

      assert.deepEqual(categorySummary, [
        {
          label: "Disaster Monitoring",
          count: 2,
          codes: ["DISASTER_EVENT_UPDATED", "EVACUATION_SUMMARY_REPORT"],
        },
        {
          label: "Relief Operations",
          count: 2,
          codes: ["DISTRIBUTION_COMPLETED", "DONATION_RECEIVED"],
        },
        {
          label: "Inventory Monitoring",
          count: 5,
          codes: [
            "LOW_STOCK",
            "CRITICAL_INVENTORY_SHORTAGE",
            "NEAR_EXPIRY_STOCK",
            "EXPIRED_STOCK",
            "INVENTORY_INCIDENT",
          ],
        },
        {
          label: "System Monitoring",
          count: 5,
          codes: [
            "SYNC_FAILURE",
            "SYNC_CONFLICT",
            "DONATION_STOCK_ANOMALY",
            "SYSTEM_ALERT",
            "OPERATIONAL_ANOMALY",
          ],
        },
      ]);
      assert.equal(
        categorySummary.reduce((total, category) => total + category.count, 0),
        14,
      );
    },
  );
});

test("getCurrentSettings shows SYSTEM_ALERT but keeps SYSTEM_ANOMALY hidden to avoid duplicate system alert switches", async () => {
  const user = {
    id: "user-system-alert",
    email: "barangay-system@example.com",
    first_name: "Nora",
    middle_name: null,
    last_name: "Diaz",
    contact_number: "+639171234599",
    default_barangay_id: null,
    is_active: true,
  };

  await withStubbedSettingsService(
    {
      [poolPath]: {},
      [settingsRepositoryPath]: {
        getUserById: async () => user,
        getBarangayById: async () => null,
        getUserRoleSettings: async () => null,
      },
      [notificationRepositoryPath]: {
        getNotificationPolicyRowsByRoleCode: async () => [
          {
            code: "SYSTEM_ALERT",
            name: "System Alerts",
            role_code: "BARANGAY",
            category_code: "SYSTEM_OPERATIONS",
            category_label: "System Operations",
            priority: "CRITICAL",
            in_app_policy: "MANDATORY",
            email_policy: "DEFAULT_ON",
            delivery_mode: "IMMEDIATE",
            user_configurability: "EMAIL_ONLY",
            is_active: true,
            policy_is_active: true,
          },
          {
            code: "SYSTEM_ANOMALY",
            name: "System Anomaly Alert",
            role_code: "BARANGAY",
            category_code: "SYSTEM_OPERATIONS",
            category_label: "System Operations",
            priority: "CRITICAL",
            in_app_policy: "MANDATORY",
            email_policy: "DEFAULT_ON",
            delivery_mode: "IMMEDIATE",
            user_configurability: "EMAIL_ONLY",
            is_active: false,
            policy_is_active: false,
          },
        ],
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

      const ruleCodes = settings.categories.flatMap((category) =>
        (category.rules || []).map((rule) => rule.code),
      );

      assert.deepEqual(ruleCodes, ["SYSTEM_ALERT"]);
    },
  );
});

test("saveCurrentSettings writes PROFILE_UPDATED only when profile fields actually change", async () => {
  const dbClient = buildDbClient();
  const auditEntries = [];
  const user = {
    id: "user-profile-audit",
    email: "barangay-audit@example.com",
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
        getUserById: async () => user,
        getBarangayById: async () => null,
        getUserRoleSettings: async () => null,
        updateUserProfile: async (_userId, changes) => ({
          ...user,
          first_name: changes.firstName,
          middle_name: changes.middleName,
          last_name: changes.lastName,
          contact_number: changes.contactNumber,
        }),
        upsertUserRoleSettings: async (payload) => payload,
        insertRoleSettingsSnapshot: async (payload) => payload,
      },
      [notificationRepositoryPath]: {
        getNotificationPolicyRowsByRoleCode: async () => [],
      },
      [notificationServicePath]: {
        getNotificationRulesForRole: async () => [],
      },
      [profilePictureStorageServicePath]: buildProfilePictureStorageStub(),
      [systemLogRepositoryPath]: {
        insertAuditLog: async (payload) => {
          auditEntries.push(payload);
          return payload;
        },
      },
    },
    async ({ saveCurrentSettings }) => {
      await saveCurrentSettings({
        userId: user.id,
        roleCode: "BARANGAY",
        settings: {
          profile: {
            firstName: "Mario",
            middleName: "De Leon",
            lastName: "Rivera-Santos",
            contactNumber: "+639181112222",
          },
          metadata: {},
        },
        ipAddress: "127.0.0.1",
      });

      const profileAuditEntries = auditEntries.filter(
        (entry) => entry.action === "PROFILE_UPDATED",
      );

      assert.equal(profileAuditEntries.length, 1);
      assert.deepEqual(profileAuditEntries[0].new_values_json.changedFields, [
        "lastName",
      ]);
    },
  );
});

test("saveCurrentSettings does not write PROFILE_UPDATED for notification-only updates", async () => {
  const dbClient = buildDbClient();
  const auditEntries = [];
  const user = {
    id: "user-notification-audit",
    email: "mswdo-audit@example.com",
    first_name: "Lina",
    middle_name: null,
    last_name: "Cruz",
    contact_number: "+639191112233",
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
          profile_picture_path: "",
          profile_picture_file_name: "",
          profile_picture_updated_at: null,
          notification_rule_preferences_json: {
            DISASTER_EVENT_UPDATE: {
              email: false,
            },
          },
          last_profile_update_at: "2026-08-01T08:00:00.000Z",
          last_preference_save_at: "2026-08-01T09:00:00.000Z",
        }),
        updateUserProfile: async () => {
          throw new Error("Profile should not be updated");
        },
        upsertUserRoleSettings: async (payload) => payload,
        insertRoleSettingsSnapshot: async (payload) => payload,
      },
      [notificationRepositoryPath]: {
        getNotificationPolicyRowsByRoleCode: async () => [
          {
            code: "DISASTER_EVENT_UPDATED",
            name: "Disaster Event Updates",
            category_code: "DISASTER_MANAGEMENT",
            category_label: "Disaster Management",
            priority: "CRITICAL",
            in_app_policy: "MANDATORY",
            email_policy: "DEFAULT_ON",
            delivery_mode: "IMMEDIATE",
            user_configurability: "EMAIL_ONLY",
          },
        ],
      },
      [notificationServicePath]: {
        getNotificationRulesForRole: async () => [],
      },
      [profilePictureStorageServicePath]: buildProfilePictureStorageStub(),
      [systemLogRepositoryPath]: {
        insertAuditLog: async (payload) => {
          auditEntries.push(payload);
          return payload;
        },
      },
    },
    async ({ saveCurrentSettings }) => {
      await saveCurrentSettings({
        userId: user.id,
        roleCode: "MSWDO",
        settings: {
          notificationRulePreferences: {
            DISASTER_EVENT_UPDATE: {
              email: true,
            },
          },
          metadata: {},
        },
        ipAddress: "127.0.0.1",
      });

      assert.equal(
        auditEntries.some((entry) => entry.action === "PROFILE_UPDATED"),
        false,
      );
      assert.equal(
        auditEntries.some(
          (entry) =>
            entry.action === "UPDATE_NOTIFICATION_PREFERENCES" ||
            entry.action === "RESET_NOTIFICATION_PREFERENCES",
        ),
        true,
      );
    },
  );
});

test("saveCurrentSettings does not write PROFILE_UPDATED for unchanged profile submissions", async () => {
  const dbClient = buildDbClient();
  const auditEntries = [];
  const user = {
    id: "user-noop-profile",
    email: "mayor-noop@example.com",
    first_name: "Ramon",
    middle_name: "Lopez",
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
        updateUserProfile: async (_userId, changes) => ({
          ...user,
          first_name: changes.firstName,
          middle_name: changes.middleName,
          last_name: changes.lastName,
          contact_number: changes.contactNumber,
        }),
        upsertUserRoleSettings: async (payload) => payload,
        insertRoleSettingsSnapshot: async (payload) => payload,
      },
      [notificationRepositoryPath]: {
        getNotificationPolicyRowsByRoleCode: async () => [],
      },
      [notificationServicePath]: {
        getNotificationRulesForRole: async () => [],
      },
      [profilePictureStorageServicePath]: buildProfilePictureStorageStub(),
      [systemLogRepositoryPath]: {
        insertAuditLog: async (payload) => {
          auditEntries.push(payload);
          return payload;
        },
      },
    },
    async ({ saveCurrentSettings }) => {
      const result = await saveCurrentSettings({
        userId: user.id,
        roleCode: "MAYOR",
        settings: {
          profile: {
            firstName: "Ramon",
            middleName: "Lopez",
            lastName: "Santos",
            contactNumber: "+639171234567",
          },
          metadata: {},
        },
        ipAddress: "127.0.0.1",
      });

      assert.equal(result.settings.profile.firstName, "Ramon");
      assert.equal(result.settings.profile.lastName, "Santos");
      assert.equal(
        auditEntries.some((entry) => entry.action === "PROFILE_UPDATED"),
        false,
      );
    },
  );
});

test("saveCurrentSettings writes separate profile and notification audit entries for combined updates", async () => {
  const dbClient = buildDbClient();
  const auditEntries = [];
  const user = {
    id: "user-combined-audit",
    email: "barangay-combined@example.com",
    first_name: "Ana",
    middle_name: null,
    last_name: "Cruz",
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
          profile_picture_path: "",
          profile_picture_file_name: "",
          profile_picture_updated_at: null,
          notification_rule_preferences_json: {
            HOUSEHOLD_REGISTERED: {
              inApp: true,
            },
          },
          last_profile_update_at: "2026-08-01T08:00:00.000Z",
          last_preference_save_at: "2026-08-01T09:00:00.000Z",
        }),
        updateUserProfile: async (_userId, changes) => ({
          ...user,
          first_name: changes.firstName,
          middle_name: changes.middleName,
          last_name: changes.lastName,
          contact_number: changes.contactNumber,
        }),
        upsertUserRoleSettings: async (payload) => payload,
        insertRoleSettingsSnapshot: async (payload) => payload,
      },
      [notificationRepositoryPath]: {
        getNotificationPolicyRowsByRoleCode: async () => [
          {
            code: "HOUSEHOLD_REGISTERED",
            name: "Household Registration Update",
            category_code: "EVACUEE_MANAGEMENT",
            category_label: "Evacuee Management",
            priority: "INFORMATIONAL",
            in_app_policy: "OPTIONAL",
            email_policy: "UNAVAILABLE",
            delivery_mode: "HOURLY_SUMMARY",
            user_configurability: "ALL_SUPPORTED_CHANNELS",
          },
        ],
      },
      [notificationServicePath]: {
        getNotificationRulesForRole: async () => [],
      },
      [profilePictureStorageServicePath]: buildProfilePictureStorageStub(),
      [systemLogRepositoryPath]: {
        insertAuditLog: async (payload) => {
          auditEntries.push(payload);
          return payload;
        },
      },
    },
    async ({ saveCurrentSettings }) => {
      await saveCurrentSettings({
        userId: user.id,
        roleCode: "BARANGAY",
        settings: {
          profile: {
            firstName: "Ana Marie",
            middleName: "",
            lastName: "Cruz",
            contactNumber: "+639171112233",
          },
          notificationRulePreferences: {
            HOUSEHOLD_REGISTERED: {
              inApp: false,
            },
          },
          metadata: {},
        },
        ipAddress: "127.0.0.1",
      });

      assert.equal(
        auditEntries.some((entry) => entry.action === "PROFILE_UPDATED"),
        true,
      );
      assert.equal(
        auditEntries.some(
          (entry) => entry.action === "UPDATE_NOTIFICATION_PREFERENCES",
        ),
        true,
      );
    },
  );
});

test("saveCurrentSettings rejects unknown notification rules", async () => {
  const dbClient = buildDbClient();
  const user = {
    id: "user-unknown",
    email: "mayor-unknown@example.com",
    first_name: "Rina",
    middle_name: null,
    last_name: "Santos",
    contact_number: "+639171234563",
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
      await assert.rejects(
        () =>
          saveCurrentSettings({
            userId: user.id,
            roleCode: "MAYOR",
            settings: {
              notificationRulePreferences: {
                UNKNOWN_RULE: {
                  email: true,
                },
              },
              metadata: {},
            },
          }),
        /not available for your role/i,
      );
    },
  );
});

test("saveCurrentSettings rejects mandatory notification tampering", async () => {
  const dbClient = buildDbClient();
  const user = {
    id: "user-mandatory",
    email: "barangay-mandatory@example.com",
    first_name: "Tina",
    middle_name: null,
    last_name: "Reyes",
    contact_number: "+639171234564",
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
      },
      [notificationRepositoryPath]: {
        getNotificationPolicyRowsByRoleCode: async () => [
          {
            code: "SYNC_CONFLICT",
            name: "Synchronization Conflict Alert",
            in_app_policy: "MANDATORY",
            email_policy: "DEFAULT_ON",
            user_configurability: "EMAIL_ONLY",
          },
        ],
      },
      [notificationServicePath]: {
        getNotificationRulesForRole: async () => [],
      },
      [profilePictureStorageServicePath]: buildProfilePictureStorageStub(),
    },
    async ({ saveCurrentSettings }) => {
      await assert.rejects(
        () =>
          saveCurrentSettings({
            userId: user.id,
            roleCode: "BARANGAY",
            settings: {
              notificationRulePreferences: {
                SYNC_CONFLICT: {
                  inApp: false,
                },
              },
              metadata: {},
            },
          }),
        /must remain enabled/i,
      );
    },
  );
});

test("saveCurrentSettings rejects unsupported email enablement", async () => {
  const dbClient = buildDbClient();
  const user = {
    id: "user-email",
    email: "barangay-email@example.com",
    first_name: "Una",
    middle_name: null,
    last_name: "Garcia",
    contact_number: "+639171234565",
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
      },
      [notificationRepositoryPath]: {
        getNotificationPolicyRowsByRoleCode: async () => [
          {
            code: "HOUSEHOLD_REGISTERED",
            name: "Household Registration Update",
            in_app_policy: "OPTIONAL",
            email_policy: "UNAVAILABLE",
            user_configurability: "ALL_SUPPORTED_CHANNELS",
          },
        ],
      },
      [notificationServicePath]: {
        getNotificationRulesForRole: async () => [],
      },
      [profilePictureStorageServicePath]: buildProfilePictureStorageStub(),
    },
    async ({ saveCurrentSettings }) => {
      await assert.rejects(
        () =>
          saveCurrentSettings({
            userId: user.id,
            roleCode: "BARANGAY",
            settings: {
              notificationRulePreferences: {
                HOUSEHOLD_REGISTERED: {
                  email: true,
                },
              },
              metadata: {},
            },
          }),
        /does not support email delivery/i,
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
      assert.equal(
        "enabledNotificationRuleCodesJson" in persistedPayloads[0],
        false,
      );
      assert.equal(
        "notificationChannelsJson" in persistedPayloads[0],
        false,
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
      assert.equal(
        "enabledNotificationRuleCodesJson" in persistedPayloads[0],
        false,
      );
      assert.equal(
        "notificationChannelsJson" in persistedPayloads[0],
        false,
      );
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
