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
const systemLogPath = require.resolve("../src/utils/systemLog");

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

test("processSyncEntries records unsafe claimed-stub duplicates for MANUAL_REVIEW", async () => {
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
      assert.equal(conflictPayload.resolution_strategy, "MANUAL_REVIEW");
      assert.equal(conflictPayload.status, "OPEN");
      assert.equal(conflictPayload.resolved_by, null);
      assert.equal(conflictPayload.resolved_at, null);
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
