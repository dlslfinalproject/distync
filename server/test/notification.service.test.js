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
    {
      code: "HOUSEHOLD_REGISTERED",
      name: "New Evacuee Registration",
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
      code: "HOUSEHOLD_VERIFICATION_UPDATED",
      name: "Household Verification Updates",
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
      code: "SYNC_FAILURE",
      name: "Sync Failure",
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
  MSWDO: [
    {
      code: "DISTRIBUTION_COMPLETED",
      name: "Distribution Completed",
      role_code: "MSWDO",
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
  ],
  MAYOR: [
    {
      code: "DISTRIBUTION_COMPLETED",
      name: "Distribution Completed",
      role_code: "MAYOR",
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
      code: "EVACUATION_SUMMARY_REPORT",
      name: "Evacuation Summary Reports",
      role_code: "MAYOR",
      category_code: "DISASTER_MONITORING",
      category_label: "Disaster Monitoring",
      priority: "INFORMATIONAL",
      in_app_policy: "OPTIONAL",
      email_policy: "OPTIONAL",
      delivery_mode: "DAILY_SUMMARY",
      user_configurability: "ALL_SUPPORTED_CHANNELS",
      is_active: true,
      policy_is_active: true,
    },
    {
      code: "SYNC_FAILURE",
      name: "Sync Failure",
      role_code: "MAYOR",
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
      code: "SYNC_CONFLICT",
      name: "Synchronization Conflict Alert",
      role_code: "MAYOR",
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
  ],
};

const buildNotificationRepositoryStub = (overrides = {}) => ({
  getNotificationRuleByCode: async (code) => ({
    code,
    is_active: true,
    target_role_code:
      code === "DISTRIBUTION_COMPLETED" ? "MSWDO" : "BARANGAY",
  }),
  getNotificationPolicyRow: async (ruleCode, roleCode) =>
    (policyRowsByRole[roleCode] || []).find((row) => row.code === ruleCode) || null,
  getNotificationPolicyRowsByRoleCode: async (roleCode) =>
    policyRowsByRole[roleCode] || [],
  getUserNotificationPreferencesByRole: async () => [],
  getRecipientUserIdsByRoleCode: async () => [],
  getRecipientUserIdsByRoleCodeAndBarangayIds: async () => [],
  getRoleCodesByUserId: async () => [],
  findRecentNotificationMatchForUsers: async () => null,
  insertNotification: async () => ({ id: "notification-1" }),
  insertNotificationRecipients: async () => [],
  insertSummaryEvent: async () => ({}),
  ...overrides,
});

test("delivery keeps synchronization conflict preferences separate from sync failure", async () => {
  const legacyPreferenceRow = {
    user_id: "user-1",
    email: "barangay@example.com",
    notification_rule_preferences_json: {
      DISASTER_EVENT_UPDATE: { email: false },
      SYNC_CONFLICT: { email: false },
      HOUSEHOLD_VERIFICATION: { email: false },
    },
  };

  await withStubbedNotificationService(
    {
      [repositoryPath]: buildNotificationRepositoryStub({
        getUserNotificationPreferencesByRole: async () => [legacyPreferenceRow],
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
        ruleCode: "SYNC_CONFLICT",
      });
      const { categories, storedPreferences, source } =
        await getNotificationCategoriesForRole({
          roleCode: "BARANGAY",
          preferenceRow: legacyPreferenceRow,
        });

      const syncRule = categories
        .flatMap((category) => category.rules || [])
        .find((rule) => rule.code === "SYNC_CONFLICT");

      assert.equal(source, "modern");
      assert.deepEqual(storedPreferences.SYNC_CONFLICT, {
        email: false,
      });
      assert.deepEqual(syncRule.effectiveChannels, {
        inApp: true,
        email: false,
      });
      assert.equal(deliveryPlan.inAppEnabled, true);
      assert.equal(deliveryPlan.emailEnabled, false);
    },
  );
});

test("delivery falls back to policy defaults for canonical disaster event updates", async () => {
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
        ruleCode: "DISASTER_EVENT_UPDATED",
      });

      assert.equal(deliveryPlan.inAppEnabled, true);
      assert.equal(deliveryPlan.emailEnabled, true);
    },
  );
});

test("distribution completed notifies only MSWDO and Mayor recipients", async () => {
  const queuedSummaryEvents = [];
  const resolverCalls = [];

  await withStubbedNotificationService(
    {
      [repositoryPath]: buildNotificationRepositoryStub({
        getRecipientUserIdsByRoleCode: async (roleCode) => {
          resolverCalls.push(roleCode);

          if (roleCode === "MSWDO") {
            return ["mswdo-user"];
          }

          if (roleCode === "MAYOR") {
            return ["mayor-user"];
          }

          return [];
        },
        insertSummaryEvent: async (payload) => {
          queuedSummaryEvents.push(payload);
          return payload;
        },
      }),
      [authMiddlewarePath]: roleCodesStub,
      [emailServicePath]: {
        sendNotificationEmail: async () => true,
      },
      [systemLogRepositoryPath]: {
        insertAuditLog: async () => ({}),
      },
    },
    async ({ emitDistributionUpdate }) => {
      await emitDistributionUpdate({
        disasterEventId: "event-1",
        barangayId: "barangay-1",
        stubNo: "STUB-001",
        familyHeadName: "Ana Cruz",
        distributionTransactionId: "distribution-1",
      });

      assert.deepEqual(resolverCalls.sort(), ["MAYOR", "MSWDO"]);
      assert.deepEqual(
        queuedSummaryEvents.map((event) => event.roleCode).sort(),
        ["MAYOR", "MSWDO"],
      );
      assert.deepEqual(
        [...new Set(queuedSummaryEvents.map((event) => event.ruleCode))],
        ["DISTRIBUTION_COMPLETED"],
      );
    },
  );
});

test("sync failure notifies only Mayor recipients for Mayor-owned inventory sync events", async () => {
  const resolverCalls = [];
  const notificationPayloads = [];

  await withStubbedNotificationService(
    {
      [repositoryPath]: buildNotificationRepositoryStub({
        getRoleCodesByUserId: async (userId) =>
          userId === "mayor-user" ? ["MAYOR"] : [],
        getRecipientUserIdsByRoleCode: async (roleCode) => {
          resolverCalls.push(roleCode);
          return roleCode === "MAYOR" ? ["mayor-recipient"] : [];
        },
        getUserNotificationPreferencesByRole: async (userIds, roleCode) =>
          userIds.map((userId) => ({
            user_id: userId,
            email: "mayor@example.com",
            notification_rule_preferences_json: {},
          })),
        insertNotification: async (payload) => {
          notificationPayloads.push(payload);
          return { id: "notification-mayor-sync-failure" };
        },
      }),
      [authMiddlewarePath]: roleCodesStub,
      [emailServicePath]: {
        sendNotificationEmail: async () => true,
      },
      [systemLogRepositoryPath]: {
        insertAuditLog: async () => ({}),
      },
    },
    async ({ emitSyncTransactionFailureAlert }) => {
      await emitSyncTransactionFailureAlert({
        id: "sync-1",
        user_id: "mayor-user",
        entity_type: "INVENTORY_ITEM",
        operation_type: "UPDATE",
      });

      assert.deepEqual(resolverCalls, ["MAYOR"]);
      assert.equal(notificationPayloads.length, 1);
      assert.match(notificationPayloads[0].message, /INVENTORY_ITEM/);
    },
  );
});

test("sync conflict does not notify Mayor for Barangay-owned conflicts", async () => {
  const createdNotifications = [];

  await withStubbedNotificationService(
    {
      [repositoryPath]: buildNotificationRepositoryStub({
        getRoleCodesByUserId: async (userId) =>
          userId === "barangay-user" ? ["BARANGAY"] : [],
        getUserNotificationPreferencesByRole: async (userIds, roleCode) =>
          userIds.map((userId) => ({
            user_id: userId,
            email: "barangay@example.com",
            notification_rule_preferences_json: {},
          })),
        insertNotification: async (payload) => {
          createdNotifications.push(payload);
          return { id: "notification-barangay-conflict" };
        },
      }),
      [authMiddlewarePath]: roleCodesStub,
      [emailServicePath]: {
        sendNotificationEmail: async () => true,
      },
      [systemLogRepositoryPath]: {
        insertAuditLog: async () => ({}),
      },
    },
    async ({ emitSyncConflictAlert }) => {
      await emitSyncConflictAlert({
        id: "conflict-1",
        user_id: "barangay-user",
        entity_type: "HOUSEHOLD",
        status: "OPEN",
      });

      assert.equal(createdNotifications.length, 1);
      assert.equal(createdNotifications[0].reference_type, "SYNC_CONFLICT");
      assert.match(createdNotifications[0].message, /HOUSEHOLD/);
    },
  );
});
