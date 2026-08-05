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
const disasterEventRepositoryPath = require.resolve(
  "../src/repositories/disasterEvent.repository",
);

const defaultDependencyStubs = {
  [disasterEventRepositoryPath]: {
    listActiveDisasterEventsForEvacuationSummary: async () => [],
    getEvacuationSummaryForWindow: async () => null,
  },
};

const withStubbedNotificationService = async (stubs, runTest) => {
  const dependencyPaths = [
    repositoryPath,
    authMiddlewarePath,
    emailServicePath,
    systemLogRepositoryPath,
    disasterEventRepositoryPath,
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
        exports: stubs[modulePath] || defaultDependencyStubs[modulePath],
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

test("flushSummaryNotifications persists grouped summaries with the SUMMARY notification type", async () => {
  const insertedNotifications = [];
  const insertedRecipients = [];
  const summaryPayload = {
    disasterEvent: {
      id: "event-1",
      eventCode: "FLD-2026-001",
      title: "Flood Monitoring",
      status: "ACTIVE",
    },
    window: {
      start: "2026-08-05T05:00:00.000Z",
      end: "2026-08-05T06:00:00.000Z",
      timezone: "Asia/Manila",
    },
    totals: {
      newHouseholds: 12,
      cumulativeHouseholds: 120,
      newEvacuees: 48,
      cumulativeEvacuees: 486,
      presentEvacuees: 320,
      departedEvacuees: 22,
    },
    barangays: [
      {
        barangayId: "barangay-1",
        barangayName: "Bilucao",
        newHouseholds: 5,
        newEvacuees: 21,
      },
      {
        barangayId: "barangay-2",
        barangayName: "Santiago",
        newHouseholds: 4,
        newEvacuees: 16,
      },
    ],
  };

  await withStubbedNotificationService(
    {
      [repositoryPath]: buildNotificationRepositoryStub({
        getDueSummaryEvents: async () => [
          {
            id: "summary-event-1",
            summary_key: "MAYOR:EVACUATION_SUMMARY_REPORT",
            rule_code: "EVACUATION_SUMMARY_REPORT",
            role_code: "MAYOR",
            disaster_event_id: "event-1",
            barangay_id: null,
            payload_json: summaryPayload,
          },
          {
            id: "summary-event-2",
            summary_key: "MAYOR:EVACUATION_SUMMARY_REPORT",
            rule_code: "EVACUATION_SUMMARY_REPORT",
            role_code: "MAYOR",
            disaster_event_id: "event-1",
            barangay_id: null,
            payload_json: summaryPayload,
          },
        ],
        getRecipientUserIdsByRoleCode: async (roleCode) =>
          roleCode === "MAYOR" ? ["mayor-user"] : [],
        getUserNotificationPreferencesByRole: async (userIds) =>
          userIds.map((userId) => ({
            user_id: userId,
            email: "mayor@example.com",
            notification_rule_preferences_json: {},
          })),
        insertNotification: async (payload) => {
          insertedNotifications.push(payload);
          return { id: "notification-summary-1" };
        },
        insertNotificationRecipients: async (notificationId, userIds) => {
          insertedRecipients.push({ notificationId, userIds });
          return [];
        },
        markSummaryEventsProcessed: async () => [],
      }),
      [authMiddlewarePath]: roleCodesStub,
      [emailServicePath]: {
        sendNotificationEmail: async () => true,
      },
      [systemLogRepositoryPath]: {
        insertAuditLog: async () => ({}),
      },
    },
    async ({ flushSummaryNotifications }) => {
      await flushSummaryNotifications();

      assert.equal(insertedNotifications.length, 1);
      assert.equal(insertedNotifications[0].type, "SUMMARY");
      assert.match(insertedNotifications[0].title, /1:00 PM to 2:00 PM/);
      assert.match(insertedNotifications[0].message, /12 newly registered households/);
      assert.match(insertedNotifications[0].message, /48 new evacuees/);
      assert.match(insertedNotifications[0].message, /Bilucao/);
      assert.doesNotMatch(insertedNotifications[0].message, /2 evacuation monitoring updates/);
      assert.deepEqual(insertedRecipients, [
        {
          notificationId: "notification-summary-1",
          userIds: ["mayor-user"],
        },
      ]);
    },
  );
});

test("getPreviousCompletedManilaHourWindow uses the prior completed Asia/Manila hour across midnight", async () => {
  await withStubbedNotificationService(
    {
      [repositoryPath]: buildNotificationRepositoryStub(),
      [authMiddlewarePath]: roleCodesStub,
      [emailServicePath]: {
        sendNotificationEmail: async () => true,
      },
      [systemLogRepositoryPath]: {
        insertAuditLog: async () => ({}),
      },
    },
    async ({ getPreviousCompletedManilaHourWindow }) => {
      const afternoonWindow = getPreviousCompletedManilaHourWindow(
        new Date("2026-08-05T06:05:00.000Z"),
      );
      assert.equal(
        afternoonWindow.windowStartedAt.toISOString(),
        "2026-08-05T05:00:00.000Z",
      );
      assert.equal(
        afternoonWindow.windowEndsAt.toISOString(),
        "2026-08-05T06:00:00.000Z",
      );

      const midnightWindow = getPreviousCompletedManilaHourWindow(
        new Date("2026-08-04T16:10:00.000Z"),
      );
      assert.equal(
        midnightWindow.windowStartedAt.toISOString(),
        "2026-08-04T15:00:00.000Z",
      );
      assert.equal(
        midnightWindow.windowEndsAt.toISOString(),
        "2026-08-04T16:00:00.000Z",
      );
      assert.equal(midnightWindow.timezone, "Asia/Manila");
    },
  );
});

test("generateDueEvacuationSummaryReports queues one Mayor summary per active event window with structured payload", async () => {
  const queuedSummaryEvents = [];

  await withStubbedNotificationService(
    {
      [repositoryPath]: buildNotificationRepositoryStub({
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
      [disasterEventRepositoryPath]: {
        listActiveDisasterEventsForEvacuationSummary: async () => [
          {
            id: "event-1",
            event_code: "FLD-2026-001",
            title: "Flood Monitoring",
            status: "ACTIVE",
          },
        ],
        getEvacuationSummaryForWindow: async ({ disasterEventId, windowStart, windowEnd }) => ({
          disasterEvent: {
            id: disasterEventId,
            eventCode: "FLD-2026-001",
            title: "Flood Monitoring",
            status: "ACTIVE",
          },
          window: {
            start: windowStart,
            end: windowEnd,
          },
          totals: {
            newHouseholds: 2,
            cumulativeHouseholds: 14,
            newEvacuees: 7,
            cumulativeEvacuees: 61,
            presentEvacuees: 49,
            departedEvacuees: 6,
          },
          attendanceActivity: {
            arrivals: 7,
            departures: 1,
          },
          barangays: [
            {
              barangayId: "barangay-1",
              barangayName: "Bilucao",
              newHouseholds: 2,
              cumulativeHouseholds: 14,
              newEvacuees: 7,
              cumulativeEvacuees: 61,
              presentEvacuees: 49,
            },
          ],
        }),
      },
    },
    async ({ generateDueEvacuationSummaryReports }) => {
      const generatedSummaryKeys = await generateDueEvacuationSummaryReports(
        new Date("2026-08-05T06:05:00.000Z"),
      );

      assert.equal(queuedSummaryEvents.length, 1);
      assert.equal(generatedSummaryKeys.length, 1);
      assert.equal(queuedSummaryEvents[0].ruleCode, "EVACUATION_SUMMARY_REPORT");
      assert.equal(queuedSummaryEvents[0].roleCode, "MAYOR");
      assert.equal(queuedSummaryEvents[0].disasterEventId, "event-1");
      assert.equal(
        queuedSummaryEvents[0].windowStartedAt,
        "2026-08-05T05:00:00.000Z",
      );
      assert.equal(
        queuedSummaryEvents[0].windowEndsAt,
        "2026-08-05T06:00:00.000Z",
      );
      assert.equal(
        queuedSummaryEvents[0].payload.window.timezone,
        "Asia/Manila",
      );
      assert.equal(queuedSummaryEvents[0].payload.totals.newHouseholds, 2);
      assert.equal(queuedSummaryEvents[0].payload.totals.newEvacuees, 7);
      assert.deepEqual(queuedSummaryEvents[0].payload.barangays, [
        {
          barangayId: "barangay-1",
          barangayName: "Bilucao",
          newHouseholds: 2,
          cumulativeHouseholds: 14,
          newEvacuees: 7,
          cumulativeEvacuees: 61,
          presentEvacuees: 49,
        },
      ]);
    },
  );
});

test("generateDueEvacuationSummaryReports suppresses empty hourly summaries with no meaningful change", async () => {
  const queuedSummaryEvents = [];

  await withStubbedNotificationService(
    {
      [repositoryPath]: buildNotificationRepositoryStub({
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
      [disasterEventRepositoryPath]: {
        listActiveDisasterEventsForEvacuationSummary: async () => [
          {
            id: "event-1",
            event_code: "FLD-2026-001",
            title: "Flood Monitoring",
            status: "ACTIVE",
          },
        ],
        getEvacuationSummaryForWindow: async ({ disasterEventId, windowStart, windowEnd }) => ({
          disasterEvent: {
            id: disasterEventId,
            eventCode: "FLD-2026-001",
            title: "Flood Monitoring",
            status: "ACTIVE",
          },
          window: {
            start: windowStart,
            end: windowEnd,
          },
          totals: {
            newHouseholds: 0,
            cumulativeHouseholds: 14,
            newEvacuees: 0,
            cumulativeEvacuees: 61,
            presentEvacuees: 49,
            departedEvacuees: 6,
          },
          attendanceActivity: {
            arrivals: 0,
            departures: 0,
          },
          barangays: [],
        }),
      },
    },
    async ({ generateDueEvacuationSummaryReports }) => {
      const generatedSummaryKeys = await generateDueEvacuationSummaryReports(
        new Date("2026-08-05T06:05:00.000Z"),
      );

      assert.deepEqual(generatedSummaryKeys, []);
      assert.deepEqual(queuedSummaryEvents, []);
    },
  );
});

test("emitDonationSummaryUpdate preserves INVENTORY payload details for notification persistence", async () => {
  const insertedNotifications = [];

  await withStubbedNotificationService(
    {
      [repositoryPath]: buildNotificationRepositoryStub({
        getNotificationRuleByCode: async (code) => ({
          code,
          is_active: true,
          target_role_code: "MAYOR",
        }),
        getNotificationPolicyRow: async (ruleCode, roleCode) => {
          if (ruleCode === "DONATION_RECEIVED" && roleCode === "MAYOR") {
            return {
              code: "DONATION_RECEIVED",
              role_code: "MAYOR",
              category_code: "RELIEF_OPERATIONS",
              category_label: "Relief Operations",
              priority: "INFORMATIONAL",
              in_app_policy: "OPTIONAL",
              email_policy: "OPTIONAL",
              delivery_mode: "IMMEDIATE",
              user_configurability: "ALL_SUPPORTED_CHANNELS",
              is_active: true,
              policy_is_active: true,
            };
          }

          return null;
        },
        getNotificationPolicyRowsByRoleCode: async (roleCode) => {
          if (roleCode !== "MAYOR") {
            return [];
          }

          return [
            {
              code: "DONATION_RECEIVED",
              role_code: "MAYOR",
              category_code: "RELIEF_OPERATIONS",
              category_label: "Relief Operations",
              priority: "INFORMATIONAL",
              in_app_policy: "OPTIONAL",
              email_policy: "OPTIONAL",
              delivery_mode: "IMMEDIATE",
              user_configurability: "ALL_SUPPORTED_CHANNELS",
              is_active: true,
              policy_is_active: true,
            },
          ];
        },
        getRecipientUserIdsByRoleCode: async (roleCode) =>
          roleCode === "MAYOR" ? ["mayor-user"] : [],
        getUserNotificationPreferencesByRole: async (userIds) =>
          userIds.map((userId) => ({
            user_id: userId,
            email: "mayor@example.com",
            notification_rule_preferences_json: {},
          })),
        insertNotification: async (payload) => {
          insertedNotifications.push(payload);
          return { id: "donation-summary-notification" };
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
    async ({ emitDonationSummaryUpdate }) => {
      await emitDonationSummaryUpdate({
        donorName: "Sample donor",
        itemCount: 3,
        disasterEventId: "event-1",
        referenceId: "donation-1",
      });

      assert.equal(insertedNotifications.length, 1);
      assert.equal(insertedNotifications[0].type, "INVENTORY");
      assert.equal(insertedNotifications[0].reference_type, "DONATION");
      assert.equal(insertedNotifications[0].reference_id, "donation-1");
      assert.match(insertedNotifications[0].message, /3 item entries/);
    },
  );
});

test("initializeNotificationInfrastructure runs immediately and schedules recurring maintenance scans", async () => {
  const originalInterval = global.setInterval;
  const originalScanInterval = process.env.NOTIFICATION_SCAN_INTERVAL_MS;
  const scheduledIntervals = [];
  const seedCalls = [];
  const dueSummaryCalls = [];

  process.env.NOTIFICATION_SCAN_INTERVAL_MS = "12345";

  try {
    global.setInterval = (handler, interval) => {
      scheduledIntervals.push({ handler, interval });
      return { interval };
    };

    await withStubbedNotificationService(
      {
        [repositoryPath]: buildNotificationRepositoryStub({
          upsertNotificationRule: async (payload) => {
            seedCalls.push(payload.code);
            return payload;
          },
          upsertNotificationRuleRolePolicy: async () => ({}),
          getBatchesForExpiryNotificationScan: async () => [],
          getFailedSyncTransactionsForNotificationScan: async () => [],
          getOpenSyncConflictsForNotificationScan: async () => [],
          getDueSummaryEvents: async () => {
            dueSummaryCalls.push(true);
            return [];
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
      async ({ initializeNotificationInfrastructure }) => {
        await initializeNotificationInfrastructure();

        assert.ok(seedCalls.length > 0);
        assert.equal(dueSummaryCalls.length, 1);
        assert.equal(scheduledIntervals.length, 1);
        assert.equal(scheduledIntervals[0].interval, 12345);
        assert.equal(typeof scheduledIntervals[0].handler, "function");
      },
    );
  } finally {
    global.setInterval = originalInterval;

    if (originalScanInterval === undefined) {
      delete process.env.NOTIFICATION_SCAN_INTERVAL_MS;
    } else {
      process.env.NOTIFICATION_SCAN_INTERVAL_MS = originalScanInterval;
    }
  }
});

test("flushSummaryNotifications respects Mayor in-app and email preferences independently", async () => {
  const insertedRecipients = [];
  const sentEmails = [];
  const insertedNotifications = [];

  await withStubbedNotificationService(
    {
      [repositoryPath]: buildNotificationRepositoryStub({
        getNotificationRuleByCode: async (code) => ({
          code,
          is_active: true,
          target_role_code: "MAYOR",
        }),
        getDueSummaryEvents: async () => [
          {
            id: "summary-event-email-and-inapp",
            summary_key: "MAYOR:EVACUATION_SUMMARY_REPORT:event-1:all:2026-08-05T00:00:00.000Z",
            rule_code: "EVACUATION_SUMMARY_REPORT",
            role_code: "MAYOR",
            disaster_event_id: "event-1",
            barangay_id: null,
          },
        ],
        getRecipientUserIdsByRoleCode: async (roleCode) =>
          roleCode === "MAYOR"
            ? ["mayor-inapp", "mayor-email", "mayor-disabled"]
            : [],
        getUserNotificationPreferencesByRole: async (userIds) =>
          userIds.map((userId) => ({
            user_id: userId,
            email: `${userId}@example.com`,
            notification_rule_preferences_json:
              userId === "mayor-inapp"
                ? {
                    EVACUATION_SUMMARY_REPORT: {
                      inApp: true,
                      email: false,
                    },
                  }
                : userId === "mayor-email"
                  ? {
                      EVACUATION_SUMMARY_REPORT: {
                        inApp: false,
                        email: true,
                      },
                    }
                  : {
                      EVACUATION_SUMMARY_REPORT: {
                        inApp: false,
                        email: false,
                      },
                    },
          })),
        insertNotification: async (payload) => {
          insertedNotifications.push(payload);
          return { id: "summary-notification-channeled" };
        },
        insertNotificationRecipients: async (notificationId, userIds) => {
          insertedRecipients.push({ notificationId, userIds });
          return [];
        },
        markSummaryEventsProcessed: async () => [],
      }),
      [authMiddlewarePath]: roleCodesStub,
      [emailServicePath]: {
        sendNotificationEmail: async (payload) => {
          sentEmails.push(payload);
          return true;
        },
      },
      [systemLogRepositoryPath]: {
        insertAuditLog: async () => ({}),
      },
    },
    async ({ flushSummaryNotifications }) => {
      await flushSummaryNotifications();

      assert.equal(insertedNotifications.length, 1);
      assert.equal(insertedNotifications[0].type, "SUMMARY");
      assert.deepEqual(insertedRecipients, [
        {
          notificationId: "summary-notification-channeled",
          userIds: ["mayor-inapp"],
        },
      ]);
      assert.equal(sentEmails.length, 1);
      assert.equal(sentEmails[0].recipientEmail, "mayor-email@example.com");
      assert.equal(sentEmails[0].notificationType, "EVACUATION_SUMMARY_REPORT");
    },
  );
});

test("flushSummaryNotifications is restart-safe when an identical Mayor evacuation summary already exists", async () => {
  let insertNotificationCalled = false;
  let insertRecipientsCalled = false;
  const processedIds = [];

  await withStubbedNotificationService(
    {
      [repositoryPath]: buildNotificationRepositoryStub({
        getNotificationRuleByCode: async (code) => ({
          code,
          is_active: true,
          target_role_code: "MAYOR",
        }),
        getDueSummaryEvents: async () => [
          {
            id: "summary-event-restart-1",
            summary_key: "MAYOR:EVACUATION_SUMMARY_REPORT:event-1:all:2026-08-05T00:00:00.000Z",
            rule_code: "EVACUATION_SUMMARY_REPORT",
            role_code: "MAYOR",
            disaster_event_id: "event-1",
            barangay_id: null,
          },
        ],
        getRecipientUserIdsByRoleCode: async (roleCode) =>
          roleCode === "MAYOR" ? ["mayor-user"] : [],
        getUserNotificationPreferencesByRole: async (userIds) =>
          userIds.map((userId) => ({
            user_id: userId,
            email: "mayor@example.com",
            notification_rule_preferences_json: {
              EVACUATION_SUMMARY_REPORT: {
                inApp: true,
                email: false,
              },
            },
          })),
        findRecentNotificationMatchForUsers: async () => ({
          id: "existing-summary-notification",
          generated_at: "2026-08-05T01:00:00.000Z",
        }),
        insertNotification: async () => {
          insertNotificationCalled = true;
          return { id: "should-not-be-created" };
        },
        insertNotificationRecipients: async () => {
          insertRecipientsCalled = true;
          return [];
        },
        markSummaryEventsProcessed: async (ids) => {
          processedIds.push(...ids);
          return ids.map((id) => ({ id }));
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
    async ({ flushSummaryNotifications }) => {
      await flushSummaryNotifications();

      assert.equal(insertNotificationCalled, false);
      assert.equal(insertRecipientsCalled, false);
      assert.deepEqual(processedIds, ["summary-event-restart-1"]);
    },
  );
});

test("automatic evacuee emitters queue barangay and MSWDO summaries, but not EVACUATION_SUMMARY_REPORT", async () => {
  const queuedSummaryEvents = [];

  await withStubbedNotificationService(
    {
      [repositoryPath]: buildNotificationRepositoryStub({
        getNotificationPolicyRow: async (ruleCode, roleCode) => {
          if (ruleCode === "HOUSEHOLD_REGISTERED" && roleCode === "BARANGAY") {
            return policyRowsByRole.BARANGAY.find(
              (row) => row.code === "HOUSEHOLD_REGISTERED",
            );
          }

          if (ruleCode === "HOUSEHOLD_REGISTERED" && roleCode === "MSWDO") {
            return {
              code: "HOUSEHOLD_REGISTERED",
              name: "New Evacuee Registration",
              role_code: "MSWDO",
              category_code: "EVACUEE_MANAGEMENT",
              category_label: "Evacuee Management",
              priority: "INFORMATIONAL",
              in_app_policy: "OPTIONAL",
              email_policy: "OPTIONAL",
              delivery_mode: "HOURLY_SUMMARY",
              user_configurability: "ALL_SUPPORTED_CHANNELS",
              is_active: true,
              policy_is_active: true,
            };
          }

          if (ruleCode === "EVACUEE_ATTENDANCE_UPDATED" && roleCode === "BARANGAY") {
            return {
              code: "EVACUEE_ATTENDANCE_UPDATED",
              name: "Evacuee Attendance Updates",
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
            };
          }

          if (ruleCode === "EVACUEE_ATTENDANCE_UPDATED" && roleCode === "MSWDO") {
            return {
              code: "EVACUEE_ATTENDANCE_UPDATED",
              name: "Evacuee Attendance Updates",
              role_code: "MSWDO",
              category_code: "EVACUEE_MANAGEMENT",
              category_label: "Evacuee Management",
              priority: "INFORMATIONAL",
              in_app_policy: "OPTIONAL",
              email_policy: "OPTIONAL",
              delivery_mode: "HOURLY_SUMMARY",
              user_configurability: "ALL_SUPPORTED_CHANNELS",
              is_active: true,
              policy_is_active: true,
            };
          }

          return null;
        },
        getNotificationPolicyRowsByRoleCode: async (roleCode) => {
          if (roleCode === "BARANGAY") {
            return [
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
                code: "EVACUEE_ATTENDANCE_UPDATED",
                name: "Evacuee Attendance Updates",
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
            ];
          }

          if (roleCode === "MSWDO") {
            return [
              {
                code: "HOUSEHOLD_REGISTERED",
                name: "New Evacuee Registration",
                role_code: "MSWDO",
                category_code: "EVACUEE_MANAGEMENT",
                category_label: "Evacuee Management",
                priority: "INFORMATIONAL",
                in_app_policy: "OPTIONAL",
                email_policy: "OPTIONAL",
                delivery_mode: "HOURLY_SUMMARY",
                user_configurability: "ALL_SUPPORTED_CHANNELS",
                is_active: true,
                policy_is_active: true,
              },
              {
                code: "EVACUEE_ATTENDANCE_UPDATED",
                name: "Evacuee Attendance Updates",
                role_code: "MSWDO",
                category_code: "EVACUEE_MANAGEMENT",
                category_label: "Evacuee Management",
                priority: "INFORMATIONAL",
                in_app_policy: "OPTIONAL",
                email_policy: "OPTIONAL",
                delivery_mode: "HOURLY_SUMMARY",
                user_configurability: "ALL_SUPPORTED_CHANNELS",
                is_active: true,
                policy_is_active: true,
              },
            ];
          }

          return [];
        },
        getRecipientUserIdsByRoleCodeAndBarangayIds: async (roleCode) =>
          roleCode === "BARANGAY" ? ["barangay-user"] : [],
        getRecipientUserIdsByRoleCode: async (roleCode) =>
          roleCode === "MSWDO" ? ["mswdo-user"] : [],
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
    async ({
      emitHouseholdRegistrationUpdate,
      emitEvacueeAttendanceUpdate,
    }) => {
      await emitHouseholdRegistrationUpdate({
        householdId: "household-1",
        barangayId: "barangay-1",
        familyHeadName: "Ana Cruz",
        action: "registered",
        requiresVerification: false,
      });

      await emitEvacueeAttendanceUpdate({
        householdId: "household-1",
        barangayId: "barangay-1",
        familyHeadName: "Ana Cruz",
        action: "status-updated",
      });

      assert.deepEqual(
        queuedSummaryEvents.map((row) => row.ruleCode),
        [
          "HOUSEHOLD_REGISTERED",
          "HOUSEHOLD_REGISTERED",
          "EVACUEE_ATTENDANCE_UPDATED",
          "EVACUEE_ATTENDANCE_UPDATED",
        ],
      );
      assert.equal(
        queuedSummaryEvents.some(
          (row) => row.ruleCode === "EVACUATION_SUMMARY_REPORT",
        ),
        false,
      );
      assert.equal(
        queuedSummaryEvents.every((row) => row.disasterEventId === null),
        true,
      );
      assert.equal(
        queuedSummaryEvents.every((row) => row.barangayId === "barangay-1"),
        true,
      );
    },
  );
});
