const test = require("node:test");
const assert = require("node:assert/strict");

const servicePath = require.resolve("../src/modules/notifications/notification.service");
const repositoryPath = require.resolve(
  "../src/modules/notifications/notification.repository",
);
const authMiddlewarePath = require.resolve(
  "../src/modules/auth/auth.middleware",
);
const emailServicePath = require.resolve("../src/modules/email/email.service");
const systemLogRepositoryPath = require.resolve(
  "../src/repositories/systemLog.repository",
);

const withStubbedNotificationService = async (stubs, runTest) => {
  const dependencyPaths = [
    repositoryPath,
    authMiddlewarePath,
    emailServicePath,
    systemLogRepositoryPath,
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

    const notificationService = require(servicePath);
    await runTest(notificationService);
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

const roleCodesStub = {
  ROLE_CODES: {
    BARANGAY: "BARANGAY",
    MSWDO: "MSWDO",
    MAYOR: "MAYOR",
  },
};

const policyRowsByRole = {
  BARANGAY: [
    {
      code: "DISASTER_EVENT_UPDATE",
      name: "Disaster Event Update",
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
    {
      code: "DISTRIBUTION_UPDATE",
      name: "Distribution Update",
      role_code: "BARANGAY",
      category_code: "RELIEF_OPERATIONS",
      category_label: "Relief Operations",
      priority: "INFORMATIONAL",
      in_app_policy: "OPTIONAL",
      email_policy: "OPTIONAL",
      delivery_mode: "HOURLY_SUMMARY",
      user_configurability: "ALL_SUPPORTED_CHANNELS",
      is_active: true,
      policy_is_active: true,
    },
    {
      code: "HOUSEHOLD_REGISTERED",
      name: "Household Registration Update",
      role_code: "BARANGAY",
      category_code: "EVACUEE_MANAGEMENT",
      category_label: "Evacuee Management",
      priority: "INFORMATIONAL",
      in_app_policy: "OPTIONAL",
      email_policy: "UNAVAILABLE",
      delivery_mode: "HOURLY_SUMMARY",
      user_configurability: "ALL_SUPPORTED_CHANNELS",
      is_active: true,
      policy_is_active: true,
    },
    {
      code: "HOUSEHOLD_VERIFICATION",
      name: "Household Verification Update",
      role_code: "BARANGAY",
      category_code: "EVACUEE_MANAGEMENT",
      category_label: "Evacuee Management",
      priority: "WARNING",
      in_app_policy: "MANDATORY",
      email_policy: "OPTIONAL",
      delivery_mode: "IMMEDIATE",
      user_configurability: "EMAIL_ONLY",
      is_active: true,
      policy_is_active: true,
    },
    {
      code: "SYNC_CONFLICT",
      name: "Synchronization Conflict Alert",
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
  ],
};

const buildNotificationRepositoryStub = (overrides = {}) => ({
  getNotificationPolicyRow: async (ruleCode, roleCode) =>
    (policyRowsByRole[roleCode] || []).find((row) => row.code === ruleCode) || null,
  getNotificationPolicyRowsByRoleCode: async (roleCode) =>
    policyRowsByRole[roleCode] || [],
  getUserNotificationPreferencesByRole: async () => [],
  ...overrides,
});

test("delivery uses modern-only preferences for the approved backfilled Barangay row", async () => {
  const modernPreferenceRow = {
    user_id: "user-1",
    email: "barangay@example.com",
    notification_rule_preferences_json: {
      SYNC_CONFLICT: { email: false },
      SYSTEM_ANOMALY: { email: false },
      DISTRIBUTION_UPDATE: { email: false, inApp: false },
      HOUSEHOLD_REGISTERED: { inApp: true },
      DISASTER_EVENT_UPDATE: { email: false },
      HOUSEHOLD_VERIFICATION: { email: false },
      EVACUEE_ATTENDANCE_UPDATE: { inApp: true },
    },
  };

  await withStubbedNotificationService(
    {
      [repositoryPath]: buildNotificationRepositoryStub({
        getUserNotificationPreferencesByRole: async () => [modernPreferenceRow],
      }),
      [authMiddlewarePath]: roleCodesStub,
      [emailServicePath]: {
        sendNotificationEmail: async () => true,
      },
      [systemLogRepositoryPath]: {
        insertAuditLog: async () => ({}),
      },
    },
    async ({ buildRecipientDeliveryPlan, getNotificationCategoriesForRole }) => {
      const [deliveryPlan] = await buildRecipientDeliveryPlan({
        userIds: ["user-1"],
        roleCode: "BARANGAY",
        ruleCode: "DISTRIBUTION_UPDATE",
      });
      const { categories, storedPreferences, source } =
        await getNotificationCategoriesForRole({
          roleCode: "BARANGAY",
          preferenceRow: modernPreferenceRow,
        });

      const distributionRule = categories
        .flatMap((category) => category.rules || [])
        .find((rule) => rule.code === "DISTRIBUTION_UPDATE");

      assert.equal(source, "modern");
      assert.deepEqual(storedPreferences.DISTRIBUTION_UPDATE, {
        email: false,
        inApp: false,
      });
      assert.deepEqual(distributionRule.effectiveChannels, {
        inApp: false,
        email: false,
      });
      assert.equal(deliveryPlan.inAppEnabled, false);
      assert.equal(deliveryPlan.emailEnabled, false);
    },
  );
});

test("delivery falls back to policy defaults for users with an empty settings row", async () => {
  await withStubbedNotificationService(
    {
      [repositoryPath]: buildNotificationRepositoryStub({
        getUserNotificationPreferencesByRole: async () => [
          {
            user_id: "user-2",
            email: "barangay2@example.com",
            notification_rule_preferences_json: {},
          },
        ],
      }),
      [authMiddlewarePath]: roleCodesStub,
      [emailServicePath]: {
        sendNotificationEmail: async () => true,
      },
      [systemLogRepositoryPath]: {
        insertAuditLog: async () => ({}),
      },
    },
    async ({ buildRecipientDeliveryPlan }) => {
      const [deliveryPlan] = await buildRecipientDeliveryPlan({
        userIds: ["user-2"],
        roleCode: "BARANGAY",
        ruleCode: "DISASTER_EVENT_UPDATE",
      });

      assert.equal(deliveryPlan.inAppEnabled, true);
      assert.equal(deliveryPlan.emailEnabled, true);
    },
  );
});

test("delivery falls back to policy defaults when no settings row exists", async () => {
  await withStubbedNotificationService(
    {
      [repositoryPath]: buildNotificationRepositoryStub({
        getUserNotificationPreferencesByRole: async () => [
          {
            user_id: "user-3",
            email: "barangay3@example.com",
            notification_rule_preferences_json: null,
          },
        ],
      }),
      [authMiddlewarePath]: roleCodesStub,
      [emailServicePath]: {
        sendNotificationEmail: async () => true,
      },
      [systemLogRepositoryPath]: {
        insertAuditLog: async () => ({}),
      },
    },
    async ({ buildRecipientDeliveryPlan }) => {
      const [deliveryPlan] = await buildRecipientDeliveryPlan({
        userIds: ["user-3"],
        roleCode: "BARANGAY",
        ruleCode: "HOUSEHOLD_VERIFICATION",
      });

      assert.equal(deliveryPlan.inAppEnabled, true);
      assert.equal(deliveryPlan.emailEnabled, false);
    },
  );
});
