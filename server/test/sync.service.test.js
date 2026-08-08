const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const servicePath = require.resolve("../src/services/sync.service");
const syncRepositoryPath = require.resolve("../src/repositories/sync.repository");
const householdRegistrationRepositoryPath = require.resolve(
  "../src/repositories/householdRegistration.repository",
);
const householdRegistrationServicePath = require.resolve(
  "../src/services/householdRegistration.service",
);
const stubServicePath = require.resolve("../src/services/stub.service");
const distributionTransactionServicePath = require.resolve(
  "../src/services/distributionTransaction.service",
);
const inventoryTransactionServicePath = require.resolve(
  "../src/services/inventoryTransaction.service",
);
const inventoryItemServicePath = require.resolve("../src/services/inventoryItem.service");
const inventoryBatchServicePath = require.resolve("../src/services/inventoryBatch.service");
const supplierServicePath = require.resolve("../src/services/supplier.service");
const systemLogPath = require.resolve("../src/utils/systemLog");
const notificationServicePath = require.resolve(
  "../src/modules/notifications/notification.service",
);

const withStubbedSyncService = async (stubs, runTest) => {
  const dependencyPaths = Object.keys(stubs);
  const originalEntries = new Map(
    dependencyPaths.map((modulePath) => [modulePath, require.cache[modulePath]]),
  );

  delete require.cache[servicePath];

  try {
    dependencyPaths.forEach((modulePath) => {
      delete require.cache[modulePath];
      require.cache[modulePath] = {
        id: modulePath,
        filename: modulePath,
        loaded: true,
        exports: stubs[modulePath],
      };
    });

    const syncService = require(servicePath);
    await runTest(syncService);
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

test("getSyncStatusSummary returns unresolved conflict count and last successful sync for the current user", async () => {
  await withStubbedSyncService(
    {
      [syncRepositoryPath]: {
        countOpenSyncConflictsByUser: async ({ userId }) => {
          assert.equal(userId, "user-1");
          return 3;
        },
        getLastSuccessfulSyncAtByUser: async ({ userId }) => {
          assert.equal(userId, "user-1");
          return "2026-08-05T14:45:00.000Z";
        },
      },
    },
    async ({ getSyncStatusSummary }) => {
      const summary = await getSyncStatusSummary({
        auth: {
          userId: "user-1",
        },
      });

      assert.deepEqual(summary, {
        conflictCount: 3,
        lastSuccessfulSyncAt: "2026-08-05T14:45:00.000Z",
        backendReachable: true,
      });
    },
  );
});

const createBaseSyncRepositoryStub = (overrides = {}) => ({
  claimSyncTransaction: async (payload) => ({
    decision: "CLAIMED_NEW",
    transaction: {
      id: "sync-transaction-1",
      ...payload,
    },
  }),
  insertSyncTransaction: async () => ({
    id: "sync-transaction-1",
  }),
  updateSyncTransaction: async (id, payload) => ({
    id,
    ...payload,
  }),
  insertSyncConflict: async (payload) => ({
    id: "sync-conflict-1",
    ...payload,
  }),
  recordConflictAndUpdateSyncTransaction: async ({
    syncTransactionId,
    conflictPayload,
    transactionPayload,
  }) => ({
    syncTransaction: {
      id: syncTransactionId,
      ...transactionPayload,
    },
    conflictRecord: {
      id: "sync-conflict-1",
      ...conflictPayload,
    },
  }),
  countOpenSyncConflictsByUser: async () => 0,
  getLastSuccessfulSyncAtByUser: async () => null,
  ...overrides,
});

const baseAuth = {
  userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  roleCode: "BARANGAY",
  defaultBarangayId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
};

test("M02-04 normal conflict processes notification intent after sync transaction commit", async () => {
  const processedIntentIds = [];
  const transactionEvents = [];

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub({
        withSyncProcessingTransaction: async (callback) => {
          transactionEvents.push("BEGIN");
          const result = await callback({ id: "tx-client" });
          transactionEvents.push("COMMIT");
          return result;
        },
        recordConflictAndUpdateSyncTransaction: async ({
          syncTransactionId,
          conflictPayload,
          transactionPayload,
        }) => ({
          syncTransaction: {
            id: syncTransactionId,
            ...transactionPayload,
          },
          conflictRecord: {
            id: "sync-conflict-post-commit",
            user_id: baseAuth.userId,
            ...conflictPayload,
          },
          notificationOutboxEvent: {
            id: "outbox-post-commit",
          },
        }),
      }),
      [householdRegistrationRepositoryPath]: {
        getHouseholdSummaryById: async () => ({
          id: "33333333-3333-4333-8333-333333333333",
          family_head_first_name: "Server",
          updated_at: "2026-08-08T02:00:00.000Z",
        }),
      },
      [notificationServicePath]: {
        processNotificationOutboxEventById: async (eventId) => {
          processedIntentIds.push({
            eventId,
            afterCommit: transactionEvents.includes("COMMIT"),
          });
        },
      },
      [systemLogPath]: {
        logAuditSafely: async () => {},
        logErrorSafely: async () => {},
        pickDefined: () => ({}),
      },
    },
    async ({ processSyncEntries }) => {
      const [result] = await processSyncEntries({
        auth: baseAuth,
        entries: [
          {
            client_sync_id: "m02-conflict-post-commit",
            action_key: "HOUSEHOLD_UPDATE",
            entity_type: "HOUSEHOLD",
            entity_server_id: "33333333-3333-4333-8333-333333333333",
            client_timestamp: "2026-08-08T01:00:00.000Z",
            client_updated_at: "2026-08-08T01:00:00.000Z",
            payload: {
              family_head_first_name: "Local",
            },
          },
        ],
      });

      assert.equal(result.sync_status, "CONFLICT");
      assert.deepEqual(transactionEvents, ["BEGIN", "COMMIT"]);
      assert.deepEqual(processedIntentIds, [
        {
          eventId: "outbox-post-commit",
          afterCommit: true,
        },
      ]);
    },
  );
});

test("M02-05 genuine FAILED transition persists notification intent and processes it after commit", async () => {
  const processedIntentIds = [];

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub({
        recordSyncFailureAndNotificationIntent: async ({
          syncTransactionId,
          transactionPayload,
        }) => ({
          syncTransaction: {
            id: syncTransactionId,
            sync_status: "FAILED",
            ...transactionPayload,
          },
          notificationOutboxEvent: {
            id: "outbox-failed-sync",
          },
        }),
      }),
      [householdRegistrationServicePath]: {
        registerHousehold: async () => {
          throw new Error("validator rejected offline household");
        },
      },
      [notificationServicePath]: {
        processNotificationOutboxEventById: async (eventId) => {
          processedIntentIds.push(eventId);
        },
      },
      [systemLogPath]: {
        logAuditSafely: async () => {},
        logErrorSafely: async () => {},
        pickDefined: () => ({}),
      },
    },
    async ({ processSyncEntries }) => {
      const [result] = await processSyncEntries({
        auth: baseAuth,
        entries: [
          {
            client_sync_id: "m02-failed-sync",
            action_key: "HOUSEHOLD_REGISTER",
            entity_type: "HOUSEHOLD",
            entity_local_id: "local-m02-failed",
            client_timestamp: "2026-08-08T01:00:00.000Z",
            payload: {
              family_head_first_name: "Local",
            },
          },
        ],
      });

      assert.equal(result.sync_status, "FAILED");
      assert.deepEqual(processedIntentIds, ["outbox-failed-sync"]);
    },
  );
});

test("M02-06 post-commit notification processing failure does not change committed sync result", async () => {
  const loggedErrors = [];

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub({
        recordSyncFailureAndNotificationIntent: async ({
          syncTransactionId,
          transactionPayload,
        }) => ({
          syncTransaction: {
            id: syncTransactionId,
            sync_status: "FAILED",
            ...transactionPayload,
          },
          notificationOutboxEvent: {
            id: "outbox-processing-fails",
          },
        }),
      }),
      [householdRegistrationServicePath]: {
        registerHousehold: async () => {
          throw new Error("business validation failed");
        },
      },
      [notificationServicePath]: {
        processNotificationOutboxEventById: async () => {
          throw new Error("notification processor unavailable");
        },
      },
      [systemLogPath]: {
        logAuditSafely: async () => {},
        logErrorSafely: async (entry) => {
          loggedErrors.push(entry);
        },
        pickDefined: () => ({}),
      },
    },
    async ({ processSyncEntries }) => {
      const [result] = await processSyncEntries({
        auth: baseAuth,
        entries: [
          {
            client_sync_id: "m02-post-commit-failure",
            action_key: "HOUSEHOLD_REGISTER",
            entity_type: "HOUSEHOLD",
            entity_local_id: "local-m02-post-commit-failure",
            client_timestamp: "2026-08-08T01:00:00.000Z",
            payload: {
              family_head_first_name: "Local",
            },
          },
        ],
      });

      assert.equal(result.sync_status, "FAILED");
      assert.match(result.message, /business validation failed/);
      assert.equal(
        loggedErrors.some(
          (entry) =>
            entry.errorCode === "SYNC_NOTIFICATION_OUTBOX_PROCESSING_FAILED",
        ),
        true,
      );
    },
  );
});

test("M02-18 H-05 duplicate QR claim conflict carries SYNC_CONFLICT notification intent", async () => {
  const processedIntentIds = [];

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub({
        recordConflictAndUpdateSyncTransaction: async ({
          syncTransactionId,
          conflictPayload,
          transactionPayload,
        }) => ({
          syncTransaction: {
            id: syncTransactionId,
            ...transactionPayload,
          },
          conflictRecord: {
            id: "sync-conflict-h05-m02",
            ...conflictPayload,
          },
          notificationOutboxEvent: {
            id: "outbox-h05-conflict",
          },
        }),
      }),
      [distributionTransactionServicePath]: {
        claimDistributionTransactionFromQr: async () => {
          const error = new Error("Stub was already claimed.");
          error.code = "STUB_ALREADY_CLAIMED";
          error.entityServerId = "distribution-server-h05";
          error.serverPayload = { id: "distribution-server-h05" };
          throw error;
        },
      },
      [notificationServicePath]: {
        processNotificationOutboxEventById: async (eventId) => {
          processedIntentIds.push(eventId);
        },
      },
      [systemLogPath]: {
        logAuditSafely: async () => {},
        logErrorSafely: async () => {},
        pickDefined: () => ({}),
      },
    },
    async ({ processSyncEntries }) => {
      const [result] = await processSyncEntries({
        auth: baseAuth,
        entries: [
          {
            client_sync_id: "m02-h05-duplicate-claim",
            action_key: "DISTRIBUTION_QR_CLAIM",
            entity_type: "DISTRIBUTION_TRANSACTION",
            entity_server_id: null,
            client_timestamp: "2026-08-08T01:00:00.000Z",
            payload: {
              stub_id: "stub-h05",
              disaster_event_id: "event-h05",
              household_id: "household-h05",
            },
          },
        ],
      });

      assert.equal(result.sync_status, "CONFLICT");
      assert.equal(result.conflict.resolution_strategy, "FIRST_ACCEPTED");
      assert.deepEqual(processedIntentIds, ["outbox-h05-conflict"]);
    },
  );
});

test("processSyncEntries returns a terminal SYNCED replay without rerunning the handler", async () => {
  let handlerCalls = 0;

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub({
        claimSyncTransaction: async () => ({
          decision: "REPLAY_TERMINAL",
          transaction: {
            id: "sync-transaction-replay",
            client_sync_id: "client-replay-1",
            entity_server_id: "11111111-1111-4111-8111-111111111111",
            sync_status: "SYNCED",
            error_message: null,
          },
          conflictRecord: null,
        }),
      }),
      [householdRegistrationServicePath]: {
        registerHousehold: async () => {
          handlerCalls += 1;
          throw new Error("handler must not run for terminal replay");
        },
      },
      [systemLogPath]: {
        logAuditSafely: async () => {},
        logErrorSafely: async () => {},
        pickDefined: () => ({}),
      },
    },
    async ({ processSyncEntries }) => {
      const [result] = await processSyncEntries({
        auth: baseAuth,
        entries: [
          {
            client_sync_id: "client-replay-1",
            action_key: "HOUSEHOLD_REGISTER",
            entity_type: "HOUSEHOLD",
            entity_local_id: "local-household-replay",
            client_timestamp: "2026-08-08T01:00:00.000Z",
            payload: {
              family_head_first_name: "Local",
            },
          },
        ],
      });

      assert.equal(handlerCalls, 0);
      assert.equal(result.sync_status, "SYNCED");
      assert.equal(result.sync_transaction_id, "sync-transaction-replay");
      assert.equal(result.data.id, "11111111-1111-4111-8111-111111111111");
      assert.equal(result.replayed, true);
    },
  );
});

test("processSyncEntries returns an existing CONFLICT replay without writing another conflict", async () => {
  let conflictWrites = 0;

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub({
        claimSyncTransaction: async () => ({
          decision: "REPLAY_TERMINAL",
          transaction: {
            id: "sync-transaction-conflict",
            client_sync_id: "client-conflict-1",
            entity_server_id: "22222222-2222-4222-8222-222222222222",
            sync_status: "CONFLICT",
            error_message: "Duplicate offline action was ignored",
          },
          conflictRecord: {
            id: "sync-conflict-existing",
            sync_transaction_id: "sync-transaction-conflict",
            resolution_strategy: "FIRST_ACCEPTED",
          },
        }),
        recordConflictAndUpdateSyncTransaction: async () => {
          conflictWrites += 1;
          throw new Error("conflict must not be written for replay");
        },
      }),
      [householdRegistrationServicePath]: {
        registerHousehold: async () => {
          throw new Error("handler must not run for conflict replay");
        },
      },
      [systemLogPath]: {
        logAuditSafely: async () => {},
        logErrorSafely: async () => {},
        pickDefined: () => ({}),
      },
    },
    async ({ processSyncEntries }) => {
      const [result] = await processSyncEntries({
        auth: baseAuth,
        entries: [
          {
            client_sync_id: "client-conflict-1",
            action_key: "HOUSEHOLD_REGISTER",
            entity_type: "HOUSEHOLD",
            entity_local_id: "local-household-conflict",
            client_timestamp: "2026-08-08T01:00:00.000Z",
            payload: {
              family_head_first_name: "Local",
            },
          },
        ],
      });

      assert.equal(conflictWrites, 0);
      assert.equal(result.sync_status, "CONFLICT");
      assert.equal(result.conflict.id, "sync-conflict-existing");
      assert.equal(result.replayed, true);
    },
  );
});

test("processSyncEntries returns PENDING for duplicate in-progress same-key submission", async () => {
  let handlerCalls = 0;

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub({
        claimSyncTransaction: async () => ({
          decision: "IN_PROGRESS",
          transaction: {
            id: "sync-transaction-pending",
            client_sync_id: "client-pending-1",
            entity_server_id: null,
            sync_status: "PENDING",
            error_message: null,
          },
        }),
      }),
      [householdRegistrationServicePath]: {
        registerHousehold: async () => {
          handlerCalls += 1;
        },
      },
      [systemLogPath]: {
        logAuditSafely: async () => {},
        logErrorSafely: async () => {},
        pickDefined: () => ({}),
      },
    },
    async ({ processSyncEntries }) => {
      const [result] = await processSyncEntries({
        auth: baseAuth,
        entries: [
          {
            client_sync_id: "client-pending-1",
            action_key: "HOUSEHOLD_REGISTER",
            entity_type: "HOUSEHOLD",
            entity_local_id: "local-household-pending",
            client_timestamp: "2026-08-08T01:00:00.000Z",
            payload: {
              family_head_first_name: "Local",
            },
          },
        ],
      });

      assert.equal(handlerCalls, 0);
      assert.equal(result.sync_status, "PENDING");
      assert.equal(result.sync_transaction_id, "sync-transaction-pending");
      assert.equal(result.replayed, true);
    },
  );
});

test("processSyncEntries rejects same client_sync_id reused for a changed request", async () => {
  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub({
        claimSyncTransaction: async () => ({
          decision: "REUSE_MISMATCH",
          transaction: {
            id: "sync-transaction-mismatch",
          },
        }),
      }),
      [systemLogPath]: {
        logAuditSafely: async () => {},
        logErrorSafely: async () => {},
        pickDefined: () => ({}),
      },
    },
    async ({ processSyncEntries }) => {
      await assert.rejects(
        () =>
          processSyncEntries({
            auth: baseAuth,
            entries: [
              {
                client_sync_id: "client-mismatch-1",
                action_key: "HOUSEHOLD_REGISTER",
                entity_type: "HOUSEHOLD",
                entity_local_id: "local-household-mismatch",
                client_timestamp: "2026-08-08T01:00:00.000Z",
                payload: {
                  family_head_first_name: "Changed",
                },
              },
            ],
          }),
        (error) => {
          assert.equal(error.code, "IDEMPOTENCY_KEY_REUSE_MISMATCH");
          assert.equal(error.statusCode, 409);
          return true;
        },
      );
    },
  );
});

test("processSyncEntries retries a FAILED row using the existing sync transaction", async () => {
  let handlerCalls = 0;

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub({
        claimSyncTransaction: async () => ({
          decision: "CLAIMED_RETRY",
          transaction: {
            id: "sync-transaction-retry",
          },
        }),
        updateSyncTransaction: async (id, payload) => ({
          id,
          ...payload,
        }),
      }),
      [householdRegistrationServicePath]: {
        registerHousehold: async () => {
          handlerCalls += 1;
          return {
            household: {
              id: "33333333-3333-4333-8333-333333333333",
            },
          };
        },
      },
      [systemLogPath]: {
        logAuditSafely: async () => {},
        logErrorSafely: async () => {},
        pickDefined: () => ({}),
      },
    },
    async ({ processSyncEntries }) => {
      const [result] = await processSyncEntries({
        auth: baseAuth,
        entries: [
          {
            client_sync_id: "client-retry-1",
            action_key: "HOUSEHOLD_REGISTER",
            entity_type: "HOUSEHOLD",
            entity_local_id: "local-household-retry",
            client_timestamp: "2026-08-08T01:00:00.000Z",
            payload: {
              family_head_first_name: "Local",
            },
          },
        ],
      });

      assert.equal(handlerCalls, 1);
      assert.equal(result.sync_transaction_id, "sync-transaction-retry");
      assert.equal(result.sync_status, "SYNCED");
    },
  );
});

test("processSyncEntries rolls back post-business bookkeeping failures instead of committing FAILED", async () => {
  const loggedErrors = [];
  const txEvents = [];
  let handlerCalls = 0;

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub({
        withSyncProcessingTransaction: async (callback) => {
          txEvents.push("BEGIN");
          try {
            const result = await callback({ query: async () => ({ rows: [] }) });
            txEvents.push("COMMIT");
            return result;
          } catch (error) {
            txEvents.push("ROLLBACK");
            throw error;
          }
        },
        updateSyncTransaction: async () => {
          throw new Error("database unavailable after effect");
        },
      }),
      [householdRegistrationServicePath]: {
        registerHousehold: async () => {
          handlerCalls += 1;
          return {
            household: {
              id: "44444444-4444-4444-8444-444444444444",
            },
          };
        },
      },
      [systemLogPath]: {
        logAuditSafely: async () => {},
        logErrorSafely: async (entry) => {
          loggedErrors.push(entry);
        },
        pickDefined: () => ({}),
      },
    },
    async ({ processSyncEntries }) => {
      await assert.rejects(
        () =>
          processSyncEntries({
            auth: baseAuth,
            entries: [
              {
                client_sync_id: "client-post-effect-1",
                action_key: "HOUSEHOLD_REGISTER",
                entity_type: "HOUSEHOLD",
                entity_local_id: "local-household-post-effect",
                client_timestamp: "2026-08-08T01:00:00.000Z",
                payload: {
                  family_head_first_name: "Local",
                },
              },
            ],
          }),
        /database unavailable after effect/,
      );

      assert.deepEqual(txEvents, ["BEGIN", "ROLLBACK"]);
      assert.equal(handlerCalls, 1);
      assert.equal(loggedErrors[0].errorCode, "SYNC_POST_EFFECT_BOOKKEEPING_FAILED");
    },
  );
});

test("H03F-01/H03F-03/H03F-04 covered handlers roll back when terminal sync update fails after business SQL", async () => {
  const cases = [
    {
      id: "H03F-01",
      actionKey: "HOUSEHOLD_REGISTER",
      entityType: "HOUSEHOLD",
      servicePath: householdRegistrationServicePath,
      serviceStub: {
        registerHousehold: async () => ({
          household: { id: "11111111-1111-4111-8111-111111111111" },
        }),
      },
      auth: baseAuth,
    },
    {
      id: "H03F-03",
      actionKey: "INVENTORY_TRANSACTION_CREATE",
      entityType: "INVENTORY_TRANSACTION",
      servicePath: inventoryTransactionServicePath,
      serviceStub: {
        createInventoryTransaction: async () => ({
          transaction_id: "22222222-2222-4222-8222-222222222222",
          new_quantity_available: 150,
        }),
      },
      auth: {
        ...baseAuth,
        roleCode: "MAYOR",
        defaultBarangayId: null,
      },
    },
    {
      id: "H03F-04",
      actionKey: "DISTRIBUTION_CREATE",
      entityType: "DISTRIBUTION_TRANSACTION",
      servicePath: distributionTransactionServicePath,
      serviceStub: {
        createDistributionTransaction: async () => ({
          distribution_transaction_id: "33333333-3333-4333-8333-333333333333",
          stub: { id: "44444444-4444-4444-8444-444444444444", status: "CLAIMED" },
          items: [{ inventory_item_id: "55555555-5555-4555-8555-555555555555" }],
        }),
      },
      auth: baseAuth,
    },
  ];

  for (const faultCase of cases) {
    const txEvents = [];
    let handlerCalls = 0;
    let failedStatusWrites = 0;

    const serviceStub = Object.fromEntries(
      Object.entries(faultCase.serviceStub).map(([methodName, handler]) => [
        methodName,
        async (...args) => {
          handlerCalls += 1;
          return handler(...args);
        },
      ]),
    );

    await withStubbedSyncService(
      {
        [syncRepositoryPath]: createBaseSyncRepositoryStub({
          withSyncProcessingTransaction: async (callback) => {
            txEvents.push("BEGIN");
            try {
              const result = await callback({ query: async () => ({ rows: [] }) });
              txEvents.push("COMMIT");
              return result;
            } catch (error) {
              txEvents.push("ROLLBACK");
              throw error;
            }
          },
          updateSyncTransaction: async (_id, payload) => {
            if (payload.sync_status === "FAILED") {
              failedStatusWrites += 1;
            }

            throw new Error(`${faultCase.id} forced terminal failure`);
          },
        }),
        [faultCase.servicePath]: serviceStub,
        [systemLogPath]: {
          logAuditSafely: async () => {},
          logErrorSafely: async () => {},
          pickDefined: () => ({}),
        },
      },
      async ({ processSyncEntries }) => {
        await assert.rejects(
          () =>
            processSyncEntries({
              auth: faultCase.auth,
              entries: [
                {
                  client_sync_id: `${faultCase.id.toLowerCase()}-rollback`,
                  action_key: faultCase.actionKey,
                  entity_type: faultCase.entityType,
                  entity_local_id: `${faultCase.id.toLowerCase()}-local`,
                  client_timestamp: "2026-08-08T01:00:00.000Z",
                  payload: {},
                },
              ],
            }),
          new RegExp(`${faultCase.id} forced terminal failure`),
        );
      },
    );

    assert.equal(handlerCalls, 1);
    assert.equal(failedStatusWrites, 0);
    assert.deepEqual(txEvents, ["BEGIN", "ROLLBACK"]);
  }
});

test("H03F-02 same client_sync_id retry after rollback can claim one logical row and commit once", async () => {
  const txEvents = [];
  const claimIds = [];
  let handlerCalls = 0;
  let terminalWrites = 0;

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub({
        withSyncProcessingTransaction: async (callback) => {
          txEvents.push("BEGIN");
          const result = await callback({ query: async () => ({ rows: [] }) });
          txEvents.push("COMMIT");
          return result;
        },
        claimSyncTransaction: async () => {
          claimIds.push("sync-household-retry");
          return {
            decision: "CLAIMED_NEW",
            transaction: {
              id: "sync-household-retry",
            },
          };
        },
        updateSyncTransaction: async (id, payload) => {
          terminalWrites += 1;
          return {
            id,
            ...payload,
          };
        },
      }),
      [householdRegistrationServicePath]: {
        registerHousehold: async () => {
          handlerCalls += 1;
          return {
            household: { id: "88888888-8888-4888-8888-888888888888" },
          };
        },
      },
      [systemLogPath]: {
        logAuditSafely: async () => {},
        logErrorSafely: async () => {},
        pickDefined: () => ({}),
      },
    },
    async ({ processSyncEntries }) => {
      const [result] = await processSyncEntries({
        auth: baseAuth,
        entries: [
          {
            client_sync_id: "h03f-02-household-retry",
            action_key: "HOUSEHOLD_REGISTER",
            entity_type: "HOUSEHOLD",
            entity_local_id: "local-household-retry",
            client_timestamp: "2026-08-08T01:00:00.000Z",
            payload: {},
          },
        ],
      });

      assert.equal(result.sync_status, "SYNCED");
      assert.equal(result.sync_transaction_id, "sync-household-retry");
    },
  );

  assert.deepEqual(claimIds, ["sync-household-retry"]);
  assert.equal(handlerCalls, 1);
  assert.equal(terminalWrites, 1);
  assert.deepEqual(txEvents, ["BEGIN", "COMMIT"]);
});

test("H03F-05 rolls back local-newer conflict when conflict persistence fails after business update", async () => {
  const txEvents = [];
  let updateCalled = false;
  let failedStatusWrites = 0;

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub({
        withSyncProcessingTransaction: async (callback) => {
          txEvents.push("BEGIN");
          try {
            const result = await callback({ query: async () => ({ rows: [] }) });
            txEvents.push("COMMIT");
            return result;
          } catch (error) {
            txEvents.push("ROLLBACK");
            throw error;
          }
        },
        recordConflictAndUpdateSyncTransaction: async () => {
          throw new Error("conflict persistence unavailable after update");
        },
        updateSyncTransaction: async (id, payload) => {
          if (payload.sync_status === "FAILED") {
            failedStatusWrites += 1;
          }

          return {
            id,
            ...payload,
          };
        },
      }),
      [householdRegistrationRepositoryPath]: {
        getHouseholdSummaryById: async () => ({
          id: "66666666-6666-4666-8666-666666666666",
          family_head_first_name: "Server",
          updated_at: "2026-08-08T01:00:00.000Z",
        }),
      },
      [householdRegistrationServicePath]: {
        updateHouseholdDetails: async (_payload) => {
          updateCalled = true;
          return {
            id: "66666666-6666-4666-8666-666666666666",
            family_head_first_name: "Local",
            updated_at: "2026-08-08T02:00:00.000Z",
          };
        },
      },
      [systemLogPath]: {
        logAuditSafely: async () => {},
        logErrorSafely: async () => {},
        pickDefined: () => ({}),
      },
    },
    async ({ processSyncEntries }) => {
      await assert.rejects(
        () =>
          processSyncEntries({
            auth: baseAuth,
            entries: [
              {
                client_sync_id: "h03f-05-local-newer",
                action_key: "HOUSEHOLD_UPDATE",
                entity_type: "HOUSEHOLD",
                entity_server_id: "66666666-6666-4666-8666-666666666666",
                client_timestamp: "2026-08-08T02:00:00.000Z",
                client_updated_at: "2026-08-08T02:00:00.000Z",
                payload: {
                  family_head_first_name: "Local",
                },
              },
            ],
          }),
        /Sync conflict could not be recorded safely/,
      );

      assert.equal(updateCalled, true);
      assert.equal(failedStatusWrites, 0);
      assert.deepEqual(txEvents, ["BEGIN", "ROLLBACK"]);
    },
  );
});

test("H03F-06 response-loss replay returns stored terminal result without handler rerun", async () => {
  let handlerCalls = 0;

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub({
        claimSyncTransaction: async () => ({
          decision: "REPLAY_TERMINAL",
          transaction: {
            id: "sync-response-loss",
            client_sync_id: "h03f-06-response-loss",
            entity_server_id: "77777777-7777-4777-8777-777777777777",
            sync_status: "SYNCED",
            error_message: null,
            processing_protocol_version: 2,
          },
          conflictRecord: null,
        }),
      }),
      [householdRegistrationServicePath]: {
        registerHousehold: async () => {
          handlerCalls += 1;
          throw new Error("handler must not run on terminal replay");
        },
      },
      [systemLogPath]: {
        logAuditSafely: async () => {},
        logErrorSafely: async () => {},
        pickDefined: () => ({}),
      },
    },
    async ({ processSyncEntries }) => {
      const [result] = await processSyncEntries({
        auth: baseAuth,
        entries: [
          {
            client_sync_id: "h03f-06-response-loss",
            action_key: "HOUSEHOLD_REGISTER",
            entity_type: "HOUSEHOLD",
            entity_local_id: "local-response-loss",
            client_timestamp: "2026-08-08T01:00:00.000Z",
            payload: {
              family_head_first_name: "Local",
            },
          },
        ],
      });

      assert.equal(handlerCalls, 0);
      assert.equal(result.sync_status, "SYNCED");
      assert.equal(result.replayed, true);
      assert.equal(result.sync_transaction_id, "sync-response-loss");
    },
  );
});

test("processSyncEntries records duplicate accepted-server conflicts with FIRST_ACCEPTED", async () => {
  const captured = {};

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub({
        recordConflictAndUpdateSyncTransaction: async (payload) => {
          captured.transactionPayload = payload.transactionPayload;
          captured.conflictPayload = payload.conflictPayload;

          return {
            syncTransaction: {
              id: payload.syncTransactionId,
              ...payload.transactionPayload,
            },
            conflictRecord: {
              id: "conflict-first-accepted",
              ...payload.conflictPayload,
            },
          };
        },
      }),
      [householdRegistrationServicePath]: {
        registerHousehold: async () => {
          const error = new Error("Household is already registered.");
          error.code = "DUPLICATE_HOUSEHOLD_REGISTRATION";
          error.entityServerId = "11111111-1111-4111-8111-111111111111";
          error.serverPayload = {
            id: "11111111-1111-4111-8111-111111111111",
            family_head_first_name: "Server",
          };
          throw error;
        },
      },
      [systemLogPath]: {
        logAuditSafely: async () => {},
        logErrorSafely: async () => {},
        pickDefined: () => ({}),
      },
    },
    async ({ processSyncEntries }) => {
      const [result] = await processSyncEntries({
        auth: baseAuth,
        entries: [
          {
            client_sync_id: "client-1",
            action_key: "HOUSEHOLD_REGISTER",
            entity_type: "HOUSEHOLD",
            entity_local_id: "local-household-1",
            entity_server_id: null,
            device_id: null,
            client_timestamp: "2026-08-08T01:00:00.000Z",
            payload: {
              family_head_first_name: "Local",
            },
          },
        ],
      });

      assert.equal(result.sync_status, "CONFLICT");
      assert.equal(result.conflict.id, "conflict-first-accepted");
      assert.equal(captured.conflictPayload.resolution_strategy, "FIRST_ACCEPTED");
      assert.equal(captured.conflictPayload.resolved_payload_json.winner, "SERVER");
      assert.equal(captured.conflictPayload.local_payload_json.family_head_first_name, "Local");
      assert.equal(captured.conflictPayload.server_payload_json.family_head_first_name, "Server");
      assert.equal(captured.transactionPayload.sync_status, "CONFLICT");
    },
  );
});

test("H05-01 processSyncEntries records claimed-stub duplicates with FIRST_ACCEPTED", async () => {
  let conflictPayload;

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub({
        recordConflictAndUpdateSyncTransaction: async (payload) => {
          conflictPayload = payload.conflictPayload;

          return {
            syncTransaction: {
              id: payload.syncTransactionId,
              ...payload.transactionPayload,
            },
            conflictRecord: {
              id: "conflict-manual-review",
              ...payload.conflictPayload,
            },
          };
        },
      }),
      [stubServicePath]: {
        claimBarangayStub: async () => {
          const error = new Error("Stub already claimed.");
          error.code = "STUB_ALREADY_CLAIMED";
          error.entityServerId = "22222222-2222-4222-8222-222222222222";
          error.serverPayload = {
            id: "22222222-2222-4222-8222-222222222222",
            status: "CLAIMED",
          };
          throw error;
        },
      },
      [systemLogPath]: {
        logAuditSafely: async () => {},
        logErrorSafely: async () => {},
        pickDefined: () => ({}),
      },
    },
    async ({ processSyncEntries }) => {
      const [result] = await processSyncEntries({
        auth: baseAuth,
        entries: [
          {
            client_sync_id: "client-2",
            action_key: "STUB_CLAIM",
            entity_type: "STUB",
            entity_server_id: "22222222-2222-4222-8222-222222222222",
            client_timestamp: "2026-08-08T01:00:00.000Z",
            payload: {
              stub_id: "22222222-2222-4222-8222-222222222222",
              claimed_by_name: "Local Claimant",
            },
          },
        ],
      });

      assert.equal(result.sync_status, "CONFLICT");
      assert.equal(conflictPayload.resolution_strategy, "FIRST_ACCEPTED");
      assert.equal(conflictPayload.status, "RESOLVED");
      assert.equal(conflictPayload.resolved_by, baseAuth.userId);
      assert.ok(conflictPayload.resolved_at);
      assert.equal(conflictPayload.resolved_payload_json.winner, "SERVER");
    },
  );
});

test("H05-13 different client_sync_id QR duplicate claim becomes CONFLICT with FIRST_ACCEPTED", async () => {
  let conflictPayload;
  let handlerCalls = 0;

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub({
        claimSyncTransaction: async (payload) => ({
          decision: "CLAIMED_NEW",
          transaction: {
            id: `sync-${payload.client_sync_id}`,
            ...payload,
          },
        }),
        recordConflictAndUpdateSyncTransaction: async (payload) => {
          conflictPayload = payload.conflictPayload;

          return {
            syncTransaction: {
              id: payload.syncTransactionId,
              ...payload.transactionPayload,
            },
            conflictRecord: {
              id: "conflict-h05-13",
              ...payload.conflictPayload,
            },
          };
        },
      }),
      [distributionTransactionServicePath]: {
        claimDistributionTransactionFromQr: async ({ dbClient: _dbClient, ...payload }) => {
          handlerCalls += 1;

          if (handlerCalls === 1) {
            return {
              distribution_transaction_id: "dist-first",
              stub: {
                id: "stub-h05",
                status: "CLAIMED",
              },
            };
          }

          const error = new Error("This stub has already been used for distribution");
          error.code = "STUB_ALREADY_CLAIMED";
          error.statusCode = 409;
          error.entityServerId = "stub-h05";
          error.serverPayload = {
            stub: {
              id: "stub-h05",
              status: "CLAIMED",
            },
            distribution_transaction: {
              id: "dist-first",
              stub_id: "stub-h05",
            },
          };
          throw error;
        },
      },
      [systemLogPath]: {
        logAuditSafely: async () => {},
        logErrorSafely: async () => {},
        pickDefined: () => ({}),
      },
    },
    async ({ processSyncEntries }) => {
      const results = await processSyncEntries({
        auth: baseAuth,
        entries: [
          {
            client_sync_id: "h05-a",
            action_key: "DISTRIBUTION_QR_CLAIM",
            entity_type: "DISTRIBUTION_TRANSACTION",
            entity_server_id: null,
            client_timestamp: "2026-08-08T01:00:00.000Z",
            payload: {
              stub_id: "stub-h05",
              disaster_event_id: "event-h05",
              household_id: "household-h05",
              claimed_by_name: "Local A",
            },
          },
          {
            client_sync_id: "h05-b",
            action_key: "DISTRIBUTION_QR_CLAIM",
            entity_type: "DISTRIBUTION_TRANSACTION",
            entity_server_id: null,
            client_timestamp: "2026-08-08T01:01:00.000Z",
            payload: {
              stub_id: "stub-h05",
              disaster_event_id: "event-h05",
              household_id: "household-h05",
              claimed_by_name: "Local B",
            },
          },
        ],
      });

      assert.equal(results[0].sync_status, "SYNCED");
      assert.equal(results[1].sync_status, "CONFLICT");
      assert.equal(conflictPayload.conflict_type, "STUB_ALREADY_CLAIMED");
      assert.equal(conflictPayload.resolution_strategy, "FIRST_ACCEPTED");
      assert.equal(conflictPayload.status, "RESOLVED");
      assert.equal(conflictPayload.resolved_payload_json.winner, "SERVER");
      assert.equal(handlerCalls, 2);
    },
  );
});

test("H05-09 generic 409 without canonical duplicate code remains FAILED", async () => {
  let conflictWrites = 0;
  const updates = [];

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub({
        recordConflictAndUpdateSyncTransaction: async () => {
          conflictWrites += 1;
          throw new Error("generic 409 must not be persisted as conflict");
        },
        updateSyncTransaction: async (id, payload) => {
          updates.push({ id, payload });
          return {
            id,
            ...payload,
          };
        },
      }),
      [distributionTransactionServicePath]: {
        createDistributionTransaction: async () => {
          const error = new Error("Distribution action is already complete.");
          error.statusCode = 409;
          throw error;
        },
      },
      [systemLogPath]: {
        logAuditSafely: async () => {},
        logErrorSafely: async () => {},
        pickDefined: () => ({}),
      },
    },
    async ({ processSyncEntries }) => {
      const [result] = await processSyncEntries({
        auth: baseAuth,
        entries: [
          {
            client_sync_id: "h05-generic-409",
            action_key: "DISTRIBUTION_CREATE",
            entity_type: "DISTRIBUTION_TRANSACTION",
            entity_server_id: null,
            client_timestamp: "2026-08-08T01:00:00.000Z",
            payload: {
              stub_id: "stub-h05",
            },
          },
        ],
      });

      assert.equal(result.sync_status, "FAILED");
      assert.equal(result.conflict, null);
      assert.equal(conflictWrites, 0);
      assert.equal(updates.at(-1).payload.sync_status, "FAILED");
    },
  );
});

test("processSyncEntries does not return successful CONFLICT when duplicate conflict persistence fails", async () => {
  const updates = [];
  const loggedErrors = [];

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub({
        recordConflictAndUpdateSyncTransaction: async () => {
          throw new Error("violates check constraint sync_conflicts_resolution_strategy_check");
        },
        updateSyncTransaction: async (id, payload) => {
          updates.push({ id, payload });
          return {
            id,
            ...payload,
          };
        },
      }),
      [householdRegistrationServicePath]: {
        registerHousehold: async () => {
          const error = new Error("Household is already registered.");
          error.code = "DUPLICATE_HOUSEHOLD_REGISTRATION";
          error.serverPayload = { family_head_first_name: "Server" };
          throw error;
        },
      },
      [systemLogPath]: {
        logAuditSafely: async () => {},
        logErrorSafely: async (entry) => {
          loggedErrors.push(entry);
        },
        pickDefined: () => ({}),
      },
    },
    async ({ processSyncEntries }) => {
      const [result] = await processSyncEntries({
        auth: baseAuth,
        entries: [
          {
            client_sync_id: "client-3",
            action_key: "HOUSEHOLD_REGISTER",
            entity_type: "HOUSEHOLD",
            entity_local_id: "local-household-3",
            client_timestamp: "2026-08-08T01:00:00.000Z",
            payload: {
              family_head_first_name: "Local",
            },
          },
        ],
      });

      assert.equal(result.sync_status, "FAILED");
      assert.equal(result.conflict, null);
      assert.equal(result.error_code, "SYNC_CONFLICT_PERSISTENCE_FAILED");
      assert.match(result.message, /could not be recorded safely/i);
      assert.doesNotMatch(result.message, /constraint/i);
      assert.equal(updates.at(-1).payload.sync_status, "FAILED");
      assert.equal(loggedErrors[0].errorCode, "SYNC_DUPLICATE_CONFLICT_RECORD_FAILED");
    },
  );
});

test("processSyncEntries marks timestamp conflict persistence failures as failed instead of CONFLICT null", async () => {
  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub({
        recordConflictAndUpdateSyncTransaction: async () => {
          throw new Error("database unavailable");
        },
      }),
      [householdRegistrationRepositoryPath]: {
        getHouseholdSummaryById: async () => ({
          id: "33333333-3333-4333-8333-333333333333",
          family_head_first_name: "Server",
          updated_at: "2026-08-08T02:00:00.000Z",
        }),
      },
      [householdRegistrationServicePath]: {
        updateHouseholdDetails: async () => {
          throw new Error("Local change should not be applied");
        },
      },
      [systemLogPath]: {
        logAuditSafely: async () => {},
        logErrorSafely: async () => {},
        pickDefined: () => ({}),
      },
    },
    async ({ processSyncEntries }) => {
      const [result] = await processSyncEntries({
        auth: baseAuth,
        entries: [
          {
            client_sync_id: "client-4",
            action_key: "HOUSEHOLD_UPDATE",
            entity_type: "HOUSEHOLD",
            entity_server_id: "33333333-3333-4333-8333-333333333333",
            client_timestamp: "2026-08-08T01:00:00.000Z",
            client_updated_at: "2026-08-08T01:00:00.000Z",
            payload: {
              family_head_first_name: "Local",
            },
          },
        ],
      });

      assert.equal(result.sync_status, "FAILED");
      assert.equal(result.conflict, null);
      assert.equal(result.error_code, "SYNC_CONFLICT_PERSISTENCE_FAILED");
      assert.match(result.message, /could not be recorded safely/i);
      assert.doesNotMatch(result.message, /database unavailable/i);
    },
  );
});

test("processSyncEntries records LATEST_TIMESTAMP only after a newer local update succeeds", async () => {
  let conflictPayload;
  let updateCalled = false;

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub({
        recordConflictAndUpdateSyncTransaction: async (payload) => {
          conflictPayload = payload.conflictPayload;

          return {
            syncTransaction: {
              id: payload.syncTransactionId,
              ...payload.transactionPayload,
            },
            conflictRecord: {
              id: "conflict-latest-valid",
              ...payload.conflictPayload,
            },
          };
        },
      }),
      [householdRegistrationRepositoryPath]: {
        getHouseholdSummaryById: async () => ({
          id: "44444444-4444-4444-8444-444444444444",
          family_head_first_name: "Server",
          updated_at: "2026-08-08T01:00:00.000Z",
        }),
      },
      [householdRegistrationServicePath]: {
        updateHouseholdDetails: async () => {
          updateCalled = true;
          return {
            id: "44444444-4444-4444-8444-444444444444",
            family_head_first_name: "Local",
            updated_at: "2026-08-08T02:00:00.000Z",
          };
        },
      },
      [systemLogPath]: {
        logAuditSafely: async () => {},
        logErrorSafely: async () => {},
        pickDefined: () => ({}),
      },
    },
    async ({ processSyncEntries }) => {
      const [result] = await processSyncEntries({
        auth: baseAuth,
        entries: [
          {
            client_sync_id: "client-5",
            action_key: "HOUSEHOLD_UPDATE",
            entity_type: "HOUSEHOLD",
            entity_server_id: "44444444-4444-4444-8444-444444444444",
            client_timestamp: "2026-08-08T02:00:00.000Z",
            client_updated_at: "2026-08-08T02:00:00.000Z",
            payload: {
              family_head_first_name: "Local",
            },
          },
        ],
      });

      assert.equal(updateCalled, true);
      assert.equal(result.sync_status, "CONFLICT");
      assert.equal(result.conflict.id, "conflict-latest-valid");
      assert.equal(conflictPayload.resolution_strategy, "LATEST_TIMESTAMP");
      assert.equal(conflictPayload.resolved_payload_json.winner, "LOCAL");
      assert.equal(
        conflictPayload.resolved_payload_json.authoritative_payload.family_head_first_name,
        "Local",
      );
    },
  );
});

test("processSyncEntries does not record LATEST_TIMESTAMP when newer local update validation fails", async () => {
  let recordConflictCalls = 0;

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub({
        recordConflictAndUpdateSyncTransaction: async () => {
          recordConflictCalls += 1;
          throw new Error("Conflict should not be recorded");
        },
      }),
      [householdRegistrationRepositoryPath]: {
        getHouseholdSummaryById: async () => ({
          id: "55555555-5555-4555-8555-555555555555",
          family_head_first_name: "Server",
          updated_at: "2026-08-08T01:00:00.000Z",
        }),
      },
      [householdRegistrationServicePath]: {
        updateHouseholdDetails: async () => {
          const error = new Error("Invalid household update.");
          error.statusCode = 400;
          throw error;
        },
      },
      [systemLogPath]: {
        logAuditSafely: async () => {},
        logErrorSafely: async () => {},
        pickDefined: () => ({}),
      },
    },
    async ({ processSyncEntries }) => {
      const [result] = await processSyncEntries({
        auth: baseAuth,
        entries: [
          {
            client_sync_id: "client-6",
            action_key: "HOUSEHOLD_UPDATE",
            entity_type: "HOUSEHOLD",
            entity_server_id: "55555555-5555-4555-8555-555555555555",
            client_timestamp: "2026-08-08T02:00:00.000Z",
            client_updated_at: "2026-08-08T02:00:00.000Z",
            payload: {
              family_head_first_name: "",
            },
          },
        ],
      });

      assert.equal(result.sync_status, "FAILED");
      assert.equal(result.conflict, null);
      assert.equal(recordConflictCalls, 0);
    },
  );
});

test("sync conflict strategy migration and schema use the canonical H-02 vocabulary", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const migrationSql = fs.readFileSync(
    path.join(
      repoRoot,
      "database/migrations/2026-08-08_align_sync_conflict_resolution_strategy.sql",
    ),
    "utf8",
  );
  const schemaSql = fs.readFileSync(
    path.join(repoRoot, "database/schema/distync_schema.sql"),
    "utf8",
  );

  for (const strategy of [
    "FIRST_ACCEPTED",
    "LATEST_TIMESTAMP",
    "MANUAL_REVIEW",
    "MERGED",
  ]) {
    assert.match(migrationSql, new RegExp(`'${strategy}'`));
    assert.match(schemaSql, new RegExp(`'${strategy}'`));
  }

  assert.match(migrationSql, /MANUAL_REVIEW_REQUIRED[\s\S]*MANUAL_REVIEW/);
  assert.match(migrationSql, /EARLIEST_TIMESTAMP[\s\S]*FIRST_ACCEPTED/);
  assert.doesNotMatch(
    schemaSql,
    /MANUAL_REVIEW_REQUIRED|EARLIEST_TIMESTAMP/,
  );
});
