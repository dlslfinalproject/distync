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
const inventoryTransactionRepositoryPath = require.resolve(
  "../src/repositories/inventoryTransaction.repository",
);
const inventoryItemServicePath = require.resolve("../src/services/inventoryItem.service");
const inventoryBatchServicePath = require.resolve("../src/services/inventoryBatch.service");
const supplierServicePath = require.resolve("../src/services/supplier.service");
const systemLogPath = require.resolve("../src/utils/systemLog");
const systemLogRepositoryPath = require.resolve(
  "../src/repositories/systemLog.repository",
);
const notificationServicePath = require.resolve(
  "../src/modules/notifications/notification.service",
);
const inventoryStateBasisPath = require.resolve("../src/utils/inventoryStateBasis");

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

const buildValidHouseholdRegisterSyncPayload = (overrides = {}) => ({
  disaster_event_id: "11111111-1111-4111-8111-111111111111",
  barangay_id: baseAuth.defaultBarangayId,
  residency_status: "RESIDENT",
  evacuation_center_id: "22222222-2222-4222-8222-222222222222",
  family_head: {
    first_name: "Ana",
    middle_name: null,
    last_name: "Dela Cruz",
    suffix: null,
    sex: "FEMALE",
    age_value: 34,
    age_unit: "YEARS",
    sector_ids: [],
  },
  current_stay_type: "EVAC_CENTER",
  household_size: 2,
  contact_number: " 09171234567 ",
  current_address_details: " Poblacion, Malvar ",
  family_head_photo_url: " data:image/jpeg;base64,ZmFrZQ== ",
  photo_verification_notes: " Verified offline ",
  privacy_acknowledgment: {
    consent_status: "ACKNOWLEDGED",
    notice_version: "2026-07-30-v2",
    acknowledged_at: "2026-08-08T00:45:00.000Z",
    acknowledged_by_name: " Ana Dela Cruz ",
    representative_relationship: null,
    device_id: null,
    is_offline_encoded: true,
    sync_status: "PENDING",
  },
  members: [
    {
      id: null,
      first_name: "Marco",
      middle_name: null,
      last_name: "Dela Cruz",
      suffix: null,
      sex: "MALE",
      age_value: 12,
      age_unit: "YEARS",
      relationship_to_head: "SON",
      sector_ids: [],
    },
  ],
  household_sector_ids: [],
  ...overrides,
});

test("HOUSEHOLD_RE_ADMISSION sync creates a new occurrence instead of updating the archived source", async () => {
  let registrationArguments = null;

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub(),
      [householdRegistrationServicePath]: {
        registerHousehold: async (...args) => {
          registrationArguments = args;
          return {
            household: {
              id: "99999999-9999-4999-8999-999999999999",
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
            client_sync_id: "re-admission-create-1",
            action_key: "HOUSEHOLD_RE_ADMISSION",
            entity_type: "HOUSEHOLD",
            entity_local_id: "local-re-admission-1",
            entity_server_id: null,
            client_timestamp: "2026-08-25T01:00:00.000Z",
            payload: buildValidHouseholdRegisterSyncPayload({
              registration_operation: "CREATE_NEW_HOUSEHOLD_OCCURRENCE",
              re_admission_source_household_id:
                "88888888-8888-4888-8888-888888888888",
            }),
          },
        ],
      });

      assert.equal(result.sync_status, "SYNCED");
      assert.equal(registrationArguments[0].registration_operation, "CREATE_NEW_HOUSEHOLD_OCCURRENCE");
      assert.equal(
        registrationArguments[0].re_admission_source_household_id,
        "88888888-8888-4888-8888-888888888888",
      );
      assert.equal(registrationArguments[1].operation, "RE_ADMISSION");
      assert.equal(
        registrationArguments[1].sourceHouseholdId,
        "88888888-8888-4888-8888-888888888888",
      );
    },
  );
});

test("BRG-SC-03 TEST A rejects foreign Barangay HOUSEHOLD_UPDATE before conflict evidence is stored", async () => {
  const foreignHousehold = {
    id: "11111111-1111-4111-8111-111111111111",
    barangay_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    family_head_first_name: "Foreign",
    contact_number: "09170000000",
    household_size: 6,
    updated_at: "2026-08-08T02:00:00.000Z",
  };
  let conflictCalls = 0;
  let updateCalled = false;
  let failedTransactionPayload = null;

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub({
        recordConflictAndUpdateSyncTransaction: async ({ conflictPayload }) => {
          conflictCalls += 1;
          assert.notDeepEqual(conflictPayload.server_payload_json, foreignHousehold);
          throw new Error("Unauthorized household must not become conflict evidence");
        },
        updateSyncTransaction: async (id, payload) => {
          if (payload.sync_status === "FAILED") {
            failedTransactionPayload = payload;
          }

          return {
            id,
            ...payload,
          };
        },
      }),
      [householdRegistrationServicePath]: {
        getAuthorizedHouseholdSummaryForUpdate: async ({ requester }) => {
          assert.equal(requester.roleCode, "BARANGAY");
          assert.equal(requester.defaultBarangayId, baseAuth.defaultBarangayId);
          const error = new Error("You do not have access to update this household");
          error.statusCode = 403;
          throw error;
        },
        updateHouseholdDetails: async () => {
          updateCalled = true;
          throw new Error("Foreign household update must not execute");
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
            client_sync_id: "brg-sc-03-foreign-older",
            action_key: "HOUSEHOLD_UPDATE",
            entity_type: "HOUSEHOLD",
            entity_server_id: foreignHousehold.id,
            client_timestamp: "2026-08-08T01:00:00.000Z",
            client_updated_at: "2026-08-08T01:00:00.000Z",
            payload: {
              barangay_id: baseAuth.defaultBarangayId,
              family_head_first_name: "Local",
            },
          },
        ],
      });

      assert.equal(result.sync_status, "FAILED");
      assert.equal(result.conflict, null);
      assert.equal(result.data, null);
      assert.equal(result.message, "You do not have access to update this household");
      assert.equal(conflictCalls, 0);
      assert.equal(updateCalled, false);
      assert.equal(failedTransactionPayload.sync_status, "FAILED");
      assert.doesNotMatch(JSON.stringify(result), /Foreign|09170000000|household_size/);
    },
  );
});

test("BRG-SC-03 TEST B preserves same-Barangay older timestamp conflict handling", async () => {
  let conflictPayload = null;
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
              id: "brg-sc-03-same-barangay-conflict",
              ...payload.conflictPayload,
            },
          };
        },
      }),
      [householdRegistrationServicePath]: {
        getAuthorizedHouseholdSummaryForUpdate: async () => ({
          id: "22222222-2222-4222-8222-222222222222",
          barangay_id: baseAuth.defaultBarangayId,
          family_head_first_name: "Server",
          updated_at: "2026-08-08T02:00:00.000Z",
        }),
        updateHouseholdDetails: async () => {
          updateCalled = true;
          throw new Error("Server-newer conflict should keep server copy");
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
            client_sync_id: "brg-sc-03-same-older",
            action_key: "HOUSEHOLD_UPDATE",
            entity_type: "HOUSEHOLD",
            entity_server_id: "22222222-2222-4222-8222-222222222222",
            client_timestamp: "2026-08-08T01:00:00.000Z",
            client_updated_at: "2026-08-08T01:00:00.000Z",
            payload: {
              family_head_first_name: "Local",
            },
          },
        ],
      });

      assert.equal(result.sync_status, "CONFLICT");
      assert.equal(result.conflict.id, "brg-sc-03-same-barangay-conflict");
      assert.equal(result.data.family_head_first_name, "Server");
      assert.equal(conflictPayload.server_payload_json.family_head_first_name, "Server");
      assert.equal(conflictPayload.resolved_payload_json.winner, "SERVER");
      assert.equal(updateCalled, false);
    },
  );
});

test("BRG-SC-03 TEST C preserves same-Barangay non-conflicting HOUSEHOLD_UPDATE", async () => {
  let conflictCalls = 0;
  let updateCalled = false;

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub({
        recordConflictAndUpdateSyncTransaction: async () => {
          conflictCalls += 1;
          throw new Error("Non-conflicting update should not create conflict");
        },
      }),
      [householdRegistrationServicePath]: {
        getAuthorizedHouseholdSummaryForUpdate: async () => ({
          id: "33333333-3333-4333-8333-333333333333",
          barangay_id: baseAuth.defaultBarangayId,
          family_head_first_name: "Server",
          updated_at: "2026-08-08T01:00:00.000Z",
        }),
        updateHouseholdDetails: async () => {
          updateCalled = true;
          return {
            id: "33333333-3333-4333-8333-333333333333",
            family_head_first_name: "Local",
            updated_at: "2026-08-08T01:00:00.000Z",
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
            client_sync_id: "brg-sc-03-same-valid",
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

      assert.equal(result.sync_status, "SYNCED");
      assert.equal(result.data.family_head_first_name, "Local");
      assert.equal(updateCalled, true);
      assert.equal(conflictCalls, 0);
    },
  );
});

test("BRG-SC-03 TEST D rejects foreign Barangay HOUSEHOLD_UPDATE without mutation on non-conflicting timestamp", async () => {
  let conflictCalls = 0;
  let updateCalled = false;

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub({
        recordConflictAndUpdateSyncTransaction: async () => {
          conflictCalls += 1;
          throw new Error("Unauthorized update should not create conflict");
        },
      }),
      [householdRegistrationServicePath]: {
        getAuthorizedHouseholdSummaryForUpdate: async () => {
          const error = new Error("You do not have access to update this household");
          error.statusCode = 403;
          throw error;
        },
        updateHouseholdDetails: async () => {
          updateCalled = true;
          throw new Error("Foreign household update must not execute");
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
            client_sync_id: "brg-sc-03-foreign-non-conflict",
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

      assert.equal(result.sync_status, "FAILED");
      assert.equal(result.conflict, null);
      assert.equal(result.data, null);
      assert.equal(conflictCalls, 0);
      assert.equal(updateCalled, false);
    },
  );
});

test("HOUSEHOLD_UPDATE sync preserves archived-occurrence rejection without conflict application", async () => {
  let conflictCalls = 0;
  let updateCalled = false;
  let failedTransactionPayload = null;

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub({
        recordConflictAndUpdateSyncTransaction: async () => {
          conflictCalls += 1;
          throw new Error("Archived household rejection must not become conflict evidence");
        },
        updateSyncTransaction: async (id, payload) => {
          if (payload.sync_status === "FAILED") {
            failedTransactionPayload = payload;
          }

          return { id, ...payload };
        },
      }),
      [householdRegistrationServicePath]: {
        getAuthorizedHouseholdSummaryForUpdate: async () => ({
          id: "archived-household-sync",
          disaster_event_id: "event-1",
          disaster_event_status: "ACTIVE",
          barangay_id: baseAuth.defaultBarangayId,
          current_stay_type: "EVAC_CENTER",
          is_active: false,
          updated_at: "2026-08-08T01:00:00.000Z",
        }),
        updateHouseholdDetails: async () => {
          updateCalled = true;
          const error = new Error("Archived households cannot be edited");
          error.statusCode = 400;
          error.code = "HISTORICAL_HOUSEHOLD_IMMUTABLE";
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
            client_sync_id: "archived-household-sync-update",
            action_key: "HOUSEHOLD_UPDATE",
            entity_type: "HOUSEHOLD",
            entity_server_id: "archived-household-sync",
            client_timestamp: "2026-08-08T01:00:00.000Z",
            client_updated_at: "2026-08-08T01:00:00.000Z",
            payload: {
              disaster_event_id: "event-1",
              barangay_id: baseAuth.defaultBarangayId,
              contact_number: "09999999999",
            },
          },
        ],
      });

      assert.equal(result.sync_status, "FAILED");
      assert.equal(result.conflict, null);
      assert.equal(result.data, null);
      assert.equal(result.error_code, "HISTORICAL_HOUSEHOLD_IMMUTABLE");
      assert.equal(result.message, "Archived households cannot be edited");
      assert.equal(updateCalled, true);
      assert.equal(conflictCalls, 0);
      assert.equal(failedTransactionPayload.sync_status, "FAILED");
      assert.equal(
        failedTransactionPayload.error_message,
        "Archived households cannot be edited",
      );
    },
  );
});

test("BRG-SC-03 TEST F preserves MSWDO HOUSEHOLD_UPDATE access", async () => {
  let updateCalled = false;

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub(),
      [householdRegistrationServicePath]: {
        getAuthorizedHouseholdSummaryForUpdate: async ({ requester }) => {
          assert.equal(requester.roleCode, "MSWDO");
          return {
            id: "55555555-5555-4555-8555-555555555555",
            barangay_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            family_head_first_name: "Server",
            updated_at: "2026-08-08T01:00:00.000Z",
          };
        },
        updateHouseholdDetails: async () => {
          updateCalled = true;
          return {
            id: "55555555-5555-4555-8555-555555555555",
            family_head_first_name: "MSWDO Local",
            updated_at: "2026-08-08T01:00:00.000Z",
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
        auth: {
          ...baseAuth,
          roleCode: "MSWDO",
          defaultBarangayId: null,
        },
        entries: [
          {
            client_sync_id: "brg-sc-03-mswdo-valid",
            action_key: "HOUSEHOLD_UPDATE",
            entity_type: "HOUSEHOLD",
            entity_server_id: "55555555-5555-4555-8555-555555555555",
            client_timestamp: "2026-08-08T01:00:00.000Z",
            client_updated_at: "2026-08-08T01:00:00.000Z",
            payload: {
              family_head_first_name: "MSWDO Local",
            },
          },
        ],
      });

      assert.equal(result.sync_status, "SYNCED");
      assert.equal(result.data.family_head_first_name, "MSWDO Local");
      assert.equal(updateCalled, true);
    },
  );
});

test("BRG-SC-06-H01 TEST F foreign Barangay HOUSEHOLD_DEPART sync fails without conflict evidence", async () => {
  let conflictCalls = 0;
  let departCall = null;
  let failedTransactionPayload = null;

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub({
        recordConflictAndUpdateSyncTransaction: async () => {
          conflictCalls += 1;
          throw new Error("Unauthorized departure must not become a conflict");
        },
        updateSyncTransaction: async (id, payload) => {
          if (payload.sync_status === "FAILED") {
            failedTransactionPayload = payload;
          }

          return {
            id,
            ...payload,
          };
        },
      }),
      [householdRegistrationServicePath]: {
        departHousehold: async (
          entityServerId,
          departureDetails,
          requester,
        ) => {
          departCall = { entityServerId, departureDetails, requester };
          const error = new Error("You do not have access to depart this household");
          error.statusCode = 403;
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
            client_sync_id: "brg-sc-06-h01-foreign-depart",
            action_key: "HOUSEHOLD_DEPART",
            entity_type: "HOUSEHOLD",
            entity_server_id: "66666666-6666-4666-8666-666666666666",
            client_timestamp: "2026-08-09T03:00:00.000Z",
            payload: {
              barangay_id: baseAuth.defaultBarangayId,
              departure_time: "2026-08-09T03:00:00.000Z",
            },
          },
        ],
      });

      assert.equal(result.sync_status, "FAILED");
      assert.equal(result.conflict, null);
      assert.equal(result.data, null);
      assert.equal(result.message, "You do not have access to depart this household");
      assert.equal(conflictCalls, 0);
      assert.equal(departCall.requester.roleCode, "BARANGAY");
      assert.equal(departCall.requester.defaultBarangayId, baseAuth.defaultBarangayId);
      assert.equal(departCall.departureDetails.allow_duplicate_departure_resolution, true);
      assert.equal(failedTransactionPayload.sync_status, "FAILED");
      assert.doesNotMatch(JSON.stringify(result), /time_out|serverPayload|FIRST_ACCEPTED/);
    },
  );
});

test("BRG-SC-06-H01 TEST G same-Barangay HOUSEHOLD_DEPART sync remains SYNCED", async () => {
  let departCall = null;
  let conflictCalls = 0;

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub({
        recordConflictAndUpdateSyncTransaction: async () => {
          conflictCalls += 1;
          throw new Error("Successful departure should not create conflict");
        },
      }),
      [householdRegistrationServicePath]: {
        departHousehold: async (
          entityServerId,
          departureDetails,
          requester,
        ) => {
          departCall = { entityServerId, departureDetails, requester };
          return {
            household_id: entityServerId,
            affected_logs_count: 1,
            archived_members_count: 2,
            latest_departure_time: departureDetails.departure_time,
            status: "ARCHIVED",
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
            client_sync_id: "brg-sc-06-h01-same-depart",
            action_key: "HOUSEHOLD_DEPART",
            entity_type: "HOUSEHOLD",
            entity_server_id: "77777777-7777-4777-8777-777777777777",
            client_timestamp: "2026-08-09T03:00:00.000Z",
            payload: {
              departure_time: "2026-08-09T03:00:00.000Z",
            },
          },
        ],
      });

      assert.equal(result.sync_status, "SYNCED");
      assert.equal(result.data.status, "ARCHIVED");
      assert.equal(result.conflict, null);
      assert.equal(conflictCalls, 0);
      assert.equal(departCall.requester.defaultBarangayId, baseAuth.defaultBarangayId);
    },
  );
});

test("BRG-SC-06-H01 TEST H MSWDO HOUSEHOLD_DEPART sync access remains broad", async () => {
  let requesterRole = null;

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub(),
      [householdRegistrationServicePath]: {
        departHousehold: async (
          entityServerId,
          _departureDetails,
          requester,
        ) => {
          requesterRole = requester.roleCode;
          return {
            household_id: entityServerId,
            affected_logs_count: 1,
            archived_members_count: 1,
            status: "ARCHIVED",
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
        auth: {
          ...baseAuth,
          roleCode: "MSWDO",
          defaultBarangayId: null,
        },
        entries: [
          {
            client_sync_id: "brg-sc-06-h01-mswdo-depart",
            action_key: "HOUSEHOLD_DEPART",
            entity_type: "HOUSEHOLD",
            entity_server_id: "88888888-8888-4888-8888-888888888888",
            client_timestamp: "2026-08-09T03:00:00.000Z",
            payload: {
              departure_time: "2026-08-09T03:00:00.000Z",
            },
          },
        ],
      });

      assert.equal(result.sync_status, "SYNCED");
      assert.equal(result.conflict, null);
      assert.equal(requesterRole, "MSWDO");
    },
  );
});

test("BRG-SC-06-H02 HOUSEHOLD_DEPART duplicate records resolved FIRST_ACCEPTED without reporting SYNCED", async () => {
  let departCall = null;
  let conflictPayload = null;
  let transactionPayload = null;

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub({
        recordConflictAndUpdateSyncTransaction: async (payload) => {
          transactionPayload = payload.transactionPayload;
          conflictPayload = payload.conflictPayload;

          return {
            syncTransaction: {
              id: payload.syncTransactionId,
              ...payload.transactionPayload,
            },
            conflictRecord: {
              id: "conflict-household-depart-first-accepted",
              ...payload.conflictPayload,
            },
          };
        },
      }),
      [householdRegistrationServicePath]: {
        departHousehold: async (
          entityServerId,
          departureDetails,
          requester,
        ) => {
          departCall = { entityServerId, departureDetails, requester };
          const error = new Error(
            "Duplicate household departure detected. Accepted server departure time was kept.",
          );
          error.statusCode = 409;
          error.code = "DUPLICATE_HOUSEHOLD_DEPARTURE";
          error.entityServerId = entityServerId;
          error.serverPayload = {
            id: "accepted-log-1",
            household_id: entityServerId,
            status: "LEFT",
            time_in: "2026-08-09T01:00:00.000Z",
            time_out: "2026-08-09T03:00:00.000Z",
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
            client_sync_id: "brg-sc-06-h02-earlier-depart",
            action_key: "HOUSEHOLD_DEPART",
            entity_type: "HOUSEHOLD",
            entity_server_id: "99999999-9999-4999-8999-999999999999",
            client_timestamp: "2026-08-09T02:30:00.000Z",
            payload: {
              departure_time: "2026-08-09T02:30:00.000Z",
            },
          },
        ],
      });

      assert.equal(result.sync_status, "CONFLICT");
      assert.equal(result.conflict.id, "conflict-household-depart-first-accepted");
      assert.equal(result.conflict.conflict_type, "DUPLICATE_HOUSEHOLD_DEPARTURE");
      assert.equal(result.conflict.resolution_strategy, "FIRST_ACCEPTED");
      assert.equal(result.conflict.status, "RESOLVED");
      assert.equal(result.conflict.resolved_payload_json.winner, "SERVER");
      assert.equal(
        result.conflict.server_payload_json.time_out,
        "2026-08-09T03:00:00.000Z",
      );
      assert.equal(transactionPayload.sync_status, "CONFLICT");
      assert.equal(departCall.departureDetails.allow_duplicate_departure_resolution, true);
      assert.equal(departCall.requester.defaultBarangayId, baseAuth.defaultBarangayId);
      assert.equal(conflictPayload.local_payload_json.departure_time, "2026-08-09T02:30:00.000Z");
    },
  );
});

test("INV-M-01 insufficient stock with trusted stale basis becomes OPEN manual-review conflict", async () => {
  const previousSecret = process.env.INVENTORY_STATE_BASIS_SECRET;
  process.env.INVENTORY_STATE_BASIS_SECRET = "unit-test-inventory-state-basis-secret";
  delete require.cache[inventoryStateBasisPath];
  const { createInventoryStateBasis } = require(inventoryStateBasisPath);
  const basis = createInventoryStateBasis(
    {
      id: "11111111-1111-4111-8111-111111111111",
      inventory_item_id: "22222222-2222-4222-8222-222222222222",
      stock_version: 1,
      quantity_available: 10,
      status: "AVAILABLE",
      expiration_date: null,
    },
    "2026-08-09T01:00:00.000Z",
  );
  const recordedConflicts = [];
  const processedOutbox = [];

  try {
    await withStubbedSyncService(
      {
        [syncRepositoryPath]: createBaseSyncRepositoryStub({
          withSyncProcessingTransaction: async (callback) => callback({ id: "tx-client" }),
          recordConflictAndUpdateSyncTransaction: async ({
            syncTransactionId,
            conflictPayload,
            transactionPayload,
          }) => {
            recordedConflicts.push({ conflictPayload, transactionPayload });
            return {
              syncTransaction: {
                id: syncTransactionId,
                ...transactionPayload,
              },
              conflictRecord: {
                id: "sync-conflict-inv-m01",
                ...conflictPayload,
              },
              notificationOutboxEvent: {
                id: "outbox-inv-m01",
              },
            };
          },
        }),
        [inventoryTransactionServicePath]: {
          createInventoryTransaction: async () => {
            const error = new Error(
              "Insufficient quantity_available for batch BATCH-1",
            );
            error.statusCode = 400;
            throw error;
          },
        },
        [inventoryTransactionRepositoryPath]: {
          getInventoryBatchByIdForUpdate: async () => ({
            id: "11111111-1111-4111-8111-111111111111",
            inventory_item_id: "22222222-2222-4222-8222-222222222222",
            stock_version: 2,
            quantity_available: 4,
            status: "LOW_STOCK",
            expiration_date: null,
          }),
        },
        [notificationServicePath]: {
          processNotificationOutboxEventById: async (eventId) => {
            processedOutbox.push(eventId);
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
          auth: {
            ...baseAuth,
            roleCode: "MAYOR",
          },
          entries: [
            {
              client_sync_id: "inv-m01-state-drift",
              action_key: "INVENTORY_TRANSACTION_CREATE",
              entity_type: "INVENTORY_TRANSACTION",
              entity_local_id: "local-inv-m01",
              entity_server_id: null,
              client_timestamp: "2026-08-09T01:05:00.000Z",
              payload: {
                inventory_batch_id: "11111111-1111-4111-8111-111111111111",
                transaction_type: "OUTFLOW",
                quantity: 8,
                inventoryTransactionReferenceNo: "ITR-2026-000555",
                inventoryStateBasis: basis,
              },
            },
          ],
        });

        assert.equal(result.sync_status, "CONFLICT");
        assert.equal(result.conflict.conflict_type, "INVENTORY_STOCK_STATE_DRIFT");
        assert.equal(result.conflict.resolution_strategy, "MANUAL_REVIEW");
        assert.equal(result.conflict.status, "OPEN");
        assert.equal(result.conflict.resolved_by, null);
        assert.equal(result.conflict.resolved_at, null);
        assert.equal(result.conflict.resolved_payload_json, null);
        assert.equal(recordedConflicts[0].transactionPayload.entity_server_id, null);
        assert.equal(recordedConflicts[0].conflictPayload.entity_server_id, null);
        assert.deepEqual(processedOutbox, ["outbox-inv-m01"]);
      },
    );
  } finally {
    if (previousSecret === undefined) {
      delete process.env.INVENTORY_STATE_BASIS_SECRET;
    } else {
      process.env.INVENTORY_STATE_BASIS_SECRET = previousSecret;
    }
    delete require.cache[inventoryStateBasisPath];
  }
});

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
      [householdRegistrationServicePath]: {
        getAuthorizedHouseholdSummaryForUpdate: async () => ({
          id: "33333333-3333-4333-8333-333333333333",
          barangay_id: baseAuth.defaultBarangayId,
          family_head_first_name: "Server",
          updated_at: "2026-08-08T02:00:00.000Z",
        }),
        updateHouseholdDetails: async () => {
          throw new Error("Server-newer conflict should not execute update");
        },
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
  let registerHouseholdCalls = 0;

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
          registerHouseholdCalls += 1;
          throw new Error("missing-photo sync must not reach business mutation");
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
            payload: buildValidHouseholdRegisterSyncPayload({
              family_head_photo_url: " ",
            }),
          },
        ],
      });

      assert.equal(result.sync_status, "FAILED");
      assert.match(result.message, /Family head photo is required/i);
      assert.equal(result.conflict, null);
      assert.equal(registerHouseholdCalls, 0);
      assert.deepEqual(processedIntentIds, ["outbox-failed-sync"]);
    },
  );
});

test("EE-FIX-01 HOUSEHOLD_REGISTER non-ACTIVE event business failure becomes FAILED, not CONFLICT", async () => {
  let conflictCalls = 0;
  let failedTransactionPayload = null;

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub({
        recordConflictAndUpdateSyncTransaction: async () => {
          conflictCalls += 1;
          throw new Error("non-ACTIVE registration must not create conflict");
        },
        updateSyncTransaction: async (id, payload) => {
          if (payload.sync_status === "FAILED") {
            failedTransactionPayload = payload;
          }

          return {
            id,
            ...payload,
          };
        },
      }),
      [householdRegistrationServicePath]: {
        registerHousehold: async () => {
          const error = new Error(
            "Household registration cannot be completed because the disaster event is not active.",
          );
          error.statusCode = 400;
          error.code = "DISASTER_EVENT_NOT_ACTIVE";
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
            client_sync_id: "ee-fix-01-non-active-register",
            action_key: "HOUSEHOLD_REGISTER",
            entity_type: "HOUSEHOLD",
            entity_local_id: "local-ee-fix-01",
            client_timestamp: "2026-08-08T01:00:00.000Z",
            payload: buildValidHouseholdRegisterSyncPayload(),
          },
        ],
      });

      assert.equal(result.sync_status, "FAILED");
      assert.equal(result.conflict, null);
      assert.equal(result.data, null);
      assert.match(result.message, /disaster event is not active/i);
      assert.equal(conflictCalls, 0);
      assert.equal(
        failedTransactionPayload.error_message,
        "Household registration cannot be completed because the disaster event is not active.",
      );
    },
  );
});

test("EE-FIX-02 HOUSEHOLD_UPDATE non-ACTIVE events fail before LATEST_TIMESTAMP conflict handling", async () => {
  const cases = [
    {
      label: "closed-client-newer",
      disaster_event_status: "CLOSED",
      serverUpdatedAt: "2026-08-08T01:00:00.000Z",
      clientUpdatedAt: "2026-08-08T02:00:00.000Z",
      current_stay_type: "EVAC_CENTER",
      is_active: true,
    },
    {
      label: "closed-server-newer",
      disaster_event_status: "CLOSED",
      serverUpdatedAt: "2026-08-08T03:00:00.000Z",
      clientUpdatedAt: "2026-08-08T02:00:00.000Z",
      current_stay_type: "EVAC_CENTER",
      is_active: true,
    },
    {
      label: "closed-equal",
      disaster_event_status: "CLOSED",
      serverUpdatedAt: "2026-08-08T02:00:00.000Z",
      clientUpdatedAt: "2026-08-08T02:00:00.000Z",
      current_stay_type: "EVAC_CENTER",
      is_active: true,
    },
    {
      label: "closed-non-admitted-resident",
      disaster_event_status: "CLOSED",
      serverUpdatedAt: "2026-08-08T01:00:00.000Z",
      clientUpdatedAt: "2026-08-08T02:00:00.000Z",
      current_stay_type: "RELATIVES",
      residency_status: "RESIDENT",
      is_active: false,
    },
    {
      label: "planned",
      disaster_event_status: "PLANNED",
      serverUpdatedAt: "2026-08-08T01:00:00.000Z",
      clientUpdatedAt: "2026-08-08T02:00:00.000Z",
      current_stay_type: "EVAC_CENTER",
      is_active: true,
    },
    {
      label: "archived",
      disaster_event_status: "ARCHIVED",
      serverUpdatedAt: "2026-08-08T01:00:00.000Z",
      clientUpdatedAt: "2026-08-08T02:00:00.000Z",
      current_stay_type: "EVAC_CENTER",
      is_active: true,
    },
  ];

  for (const currentCase of cases) {
    let conflictCalls = 0;
    let updateCalled = false;
    let failedTransactionPayload = null;

    await withStubbedSyncService(
      {
        [syncRepositoryPath]: createBaseSyncRepositoryStub({
          recordConflictAndUpdateSyncTransaction: async () => {
            conflictCalls += 1;
            throw new Error("non-ACTIVE HOUSEHOLD_UPDATE must not create conflict");
          },
          updateSyncTransaction: async (id, payload) => {
            if (payload.sync_status === "FAILED") {
              failedTransactionPayload = payload;
            }

            return {
              id,
              ...payload,
            };
          },
        }),
        [householdRegistrationServicePath]: {
          getAuthorizedHouseholdSummaryForUpdate: async () => ({
            id: `household-${currentCase.label}`,
            disaster_event_id: "event-1",
            disaster_event_status: currentCase.disaster_event_status,
            barangay_id: baseAuth.defaultBarangayId,
            residency_status: currentCase.residency_status || "RESIDENT",
            current_stay_type: currentCase.current_stay_type,
            is_active: currentCase.is_active,
            family_head_first_name: "Server",
            updated_at: currentCase.serverUpdatedAt,
          }),
          updateHouseholdDetails: async () => {
            updateCalled = true;
            throw new Error("non-ACTIVE HOUSEHOLD_UPDATE must not mutate");
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
              client_sync_id: `ee-fix-02-${currentCase.label}`,
              action_key: "HOUSEHOLD_UPDATE",
              entity_type: "HOUSEHOLD",
              entity_server_id: `household-${currentCase.label}`,
              client_timestamp: currentCase.clientUpdatedAt,
              client_updated_at: currentCase.clientUpdatedAt,
              payload: {
                disaster_event_id: "event-1",
                barangay_id: baseAuth.defaultBarangayId,
                family_head_first_name: "Local",
              },
            },
          ],
        });

        assert.equal(result.sync_status, "FAILED", currentCase.label);
        assert.equal(result.conflict, null, currentCase.label);
        assert.equal(result.data, null, currentCase.label);
        assert.match(result.message, /disaster event is not active/i);
        assert.equal(conflictCalls, 0, currentCase.label);
        assert.equal(updateCalled, false, currentCase.label);
        assert.equal(failedTransactionPayload.sync_status, "FAILED");
        assert.equal(
          failedTransactionPayload.error_message,
          "Household registration cannot be completed because the disaster event is not active.",
        );
      },
    );
  }
});

test("EE-FIX-02 foreign Barangay CLOSED HOUSEHOLD_UPDATE remains authorization failure without lifecycle evidence", async () => {
  let conflictCalls = 0;
  let updateCalled = false;

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub({
        recordConflictAndUpdateSyncTransaction: async () => {
          conflictCalls += 1;
          throw new Error("foreign non-ACTIVE household must not create conflict");
        },
      }),
      [householdRegistrationServicePath]: {
        getAuthorizedHouseholdSummaryForUpdate: async () => {
          const error = new Error("You do not have access to update this household");
          error.statusCode = 403;
          throw error;
        },
        updateHouseholdDetails: async () => {
          updateCalled = true;
          throw new Error("foreign non-ACTIVE household must not mutate");
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
            client_sync_id: "ee-fix-02-foreign-closed",
            action_key: "HOUSEHOLD_UPDATE",
            entity_type: "HOUSEHOLD",
            entity_server_id: "foreign-closed-household",
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
      assert.equal(result.data, null);
      assert.equal(result.message, "You do not have access to update this household");
      assert.doesNotMatch(JSON.stringify(result), /DISASTER_EVENT_NOT_ACTIVE|CLOSED|Foreign/);
      assert.equal(conflictCalls, 0);
      assert.equal(updateCalled, false);
    },
  );
});

test("EE-FIX-02 same-ID HOUSEHOLD_UPDATE replay after closure returns terminal result without lifecycle recheck", async () => {
  let authorizationLookupCalled = false;
  let updateCalled = false;

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub({
        claimSyncTransaction: async () => ({
          decision: "REPLAY_TERMINAL",
          transaction: {
            id: "sync-replay-after-close",
            sync_status: "SYNCED",
            entity_server_id: "household-replay",
            error_message: null,
          },
          conflictRecord: null,
        }),
      }),
      [householdRegistrationServicePath]: {
        getAuthorizedHouseholdSummaryForUpdate: async () => {
          authorizationLookupCalled = true;
          throw new Error("terminal replay must not reauthorize or recheck lifecycle");
        },
        updateHouseholdDetails: async () => {
          updateCalled = true;
          throw new Error("terminal replay must not mutate");
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
            client_sync_id: "ee-fix-02-replay-after-close",
            action_key: "HOUSEHOLD_UPDATE",
            entity_type: "HOUSEHOLD",
            entity_server_id: "household-replay",
            client_timestamp: "2026-08-08T01:00:00.000Z",
            client_updated_at: "2026-08-08T01:00:00.000Z",
            payload: {
              family_head_first_name: "Previously Accepted",
            },
          },
        ],
      });

      assert.equal(result.sync_status, "SYNCED");
      assert.equal(result.replayed, true);
      assert.equal(result.conflict, null);
      assert.equal(authorizationLookupCalled, false);
      assert.equal(updateCalled, false);
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
            payload: buildValidHouseholdRegisterSyncPayload(),
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

test("INV-M-02 successful offline inventory sync runs domain audit and alerts after commit", async () => {
  const transactionEvents = [];
  const domainSideEffects = [];

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub({
        withSyncProcessingTransaction: async (callback) => {
          transactionEvents.push("BEGIN");
          const result = await callback({ id: "tx-client" });
          transactionEvents.push("COMMIT");
          return result;
        },
      }),
      [inventoryTransactionServicePath]: {
        createInventoryTransaction: async (payload) => {
          assert.equal(payload.performed_by, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
          assert.equal(payload.auditActor.userId, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
          assert.equal(payload.auditActor.roleCode, "MAYOR");
          assert.equal(payload.auditActor.deviceId, "99999999-9999-4999-8999-999999999999");
          assert.equal(payload.syncTransactionId, "sync-transaction-1");
          assert.equal(typeof payload.deferDomainSideEffect, "function");

          payload.deferDomainSideEffect(async () => {
            domainSideEffects.push({
              afterCommit: transactionEvents.includes("COMMIT"),
              actor: payload.auditActor,
            });
          });

          return {
            transaction_id: "22222222-2222-4222-8222-222222222222",
            inventory_transaction_reference_no: "ITR-2026-000777",
            inventory_batch_id: "11111111-1111-4111-8111-111111111111",
            transaction_type: "OUTFLOW",
            quantity: 2,
            new_quantity_available: 8,
            new_batch_status: "LOW_STOCK",
          };
        },
      },
      [notificationServicePath]: {
        processNotificationOutboxEventById: async () => {
          throw new Error("No sync notification outbox event expected");
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
        auth: {
          ...baseAuth,
          roleCode: "MAYOR",
          defaultBarangayId: null,
        },
        entries: [
          {
            client_sync_id: "inv-m02-success",
            action_key: "INVENTORY_TRANSACTION_CREATE",
            entity_type: "INVENTORY_TRANSACTION",
            entity_local_id: "local-inv-m02",
            entity_server_id: null,
            device_id: "99999999-9999-4999-8999-999999999999",
            client_timestamp: "2026-08-08T01:00:00.000Z",
            payload: {
              inventory_batch_id: "11111111-1111-4111-8111-111111111111",
              transaction_type: "OUTFLOW",
              quantity: 2,
              inventoryTransactionReferenceNo: "ITR-2026-000777",
            },
          },
        ],
      });

      assert.equal(result.sync_status, "SYNCED");
      assert.deepEqual(transactionEvents, ["BEGIN", "COMMIT"]);
      assert.deepEqual(domainSideEffects, [
        {
          afterCommit: true,
          actor: {
            userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            roleCode: "MAYOR",
            deviceId: "99999999-9999-4999-8999-999999999999",
          },
        },
      ]);
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
            payload: buildValidHouseholdRegisterSyncPayload(),
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
                payload: buildValidHouseholdRegisterSyncPayload(),
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
                  payload:
                    faultCase.actionKey === "HOUSEHOLD_REGISTER"
                      ? buildValidHouseholdRegisterSyncPayload()
                      : {},
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
            payload: buildValidHouseholdRegisterSyncPayload(),
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
        getAuthorizedHouseholdSummaryForUpdate: async () => ({
          id: "66666666-6666-4666-8666-666666666666",
          barangay_id: baseAuth.defaultBarangayId,
          family_head_first_name: "Server",
          updated_at: "2026-08-08T01:00:00.000Z",
        }),
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

test("OQ-ERR-01 rolls back to the savepoint before recording the first sync failure", async () => {
  const statements = [];
  let transactionAborted = false;
  let failureMessage = null;
  const rootError = new Error(
    "duplicate key value violates unique constraint household_identity_unique",
  );

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub({
        withSyncProcessingTransaction: async (callback) => {
          const dbClient = {
            query: async (query) => {
              statements.push(query);

              if (query === "INSERT household") {
                transactionAborted = true;
                throw rootError;
              }

              if (transactionAborted && !String(query).startsWith("ROLLBACK TO SAVEPOINT")) {
                throw new Error("current transaction is aborted");
              }

              if (String(query).startsWith("ROLLBACK TO SAVEPOINT")) {
                transactionAborted = false;
              }

              return { rows: [] };
            },
          };

          const result = await callback(dbClient);
          statements.push("COMMIT");
          return result;
        },
        recordSyncFailureAndNotificationIntent: async ({
          syncTransactionId,
          transactionPayload,
          dbClient,
        }) => {
          await dbClient.query("UPDATE sync failure");
          failureMessage = transactionPayload.error_message;
          return {
            syncTransaction: {
              id: syncTransactionId,
              sync_status: "FAILED",
              ...transactionPayload,
            },
            notificationOutboxEvent: null,
          };
        },
      }),
      [householdRegistrationServicePath]: {
        registerHousehold: async ({ dbClient }) => dbClient.query("INSERT household"),
      },
      [notificationServicePath]: {
        processNotificationOutboxEventById: async () => {},
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
            client_sync_id: "oq-root-error-01",
            action_key: "HOUSEHOLD_REGISTER",
            entity_type: "HOUSEHOLD",
            entity_local_id: "oq-root-error-local",
            client_timestamp: "2026-08-08T01:00:00.000Z",
            payload: buildValidHouseholdRegisterSyncPayload(),
          },
        ],
      });

      assert.equal(result.sync_status, "FAILED");
      assert.equal(failureMessage, rootError.message);
      assert.match(
        statements.find((statement) => /SAVEPOINT sync_business_action/.test(statement)),
        /^SAVEPOINT sync_business_action$/,
      );
      assert.match(
        statements.find((statement) => /ROLLBACK TO SAVEPOINT sync_business_action/.test(statement)),
        /^ROLLBACK TO SAVEPOINT sync_business_action$/,
      );
      assert.equal(statements.at(-1), "COMMIT");
      assert.doesNotMatch(statements.join("\n"), /current transaction is aborted/);
      assert.doesNotMatch(result.message, /current transaction is aborted/);
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
            payload: buildValidHouseholdRegisterSyncPayload(),
          },
        ],
      });

      assert.equal(result.sync_status, "CONFLICT");
      assert.equal(result.conflict.id, "conflict-first-accepted");
      assert.equal(captured.conflictPayload.resolution_strategy, "FIRST_ACCEPTED");
      assert.equal(captured.conflictPayload.resolved_payload_json.winner, "SERVER");
      assert.equal(captured.conflictPayload.local_payload_json.family_head.first_name, "Ana");
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

test("EE-FIX-03 STUB_CLAIM lifecycle failure becomes FAILED without FIRST_ACCEPTED conflict", async () => {
  let conflictCalls = 0;
  let failurePayload = null;

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub({
        recordConflictAndUpdateSyncTransaction: async () => {
          conflictCalls += 1;
          throw new Error("lifecycle failure must not create a conflict");
        },
        updateSyncTransaction: async (id, payload) => {
          if (payload.sync_status === "FAILED") {
            failurePayload = payload;
          }

          return {
            id,
            ...payload,
          };
        },
      }),
      [stubServicePath]: {
        claimBarangayStub: async () => {
          const error = new Error(
            "Relief claim cannot be completed because the disaster event is not active.",
          );
          error.code = "DISASTER_EVENT_NOT_ACTIVE";
          error.statusCode = 400;
          error.entityServerId = "22222222-2222-4222-8222-222222222222";
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
            client_sync_id: "ee-fix-03-closed-stub",
            action_key: "STUB_CLAIM",
            entity_type: "STUB",
            entity_server_id: "22222222-2222-4222-8222-222222222222",
            client_timestamp: "2026-08-08T01:00:00.000Z",
            payload: {
              stub_id: "22222222-2222-4222-8222-222222222222",
            },
          },
        ],
      });

      assert.equal(result.sync_status, "FAILED");
      assert.equal(result.conflict, null);
      assert.equal(result.data, null);
      assert.equal(conflictCalls, 0);
      assert.equal(failurePayload.sync_status, "FAILED");
      assert.equal(failurePayload.entity_server_id, "22222222-2222-4222-8222-222222222222");
    },
  );
});

test("EE-FIX-03 same-ID STUB_CLAIM terminal replay bypasses lifecycle handler", async () => {
  let handlerCalls = 0;

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub({
        claimSyncTransaction: async () => ({
          decision: "REPLAY_TERMINAL",
          transaction: {
            id: "sync-terminal-stub-claim",
            sync_status: "SYNCED",
            entity_server_id: "22222222-2222-4222-8222-222222222222",
            error_message: null,
          },
          conflictRecord: null,
        }),
      }),
      [stubServicePath]: {
        claimBarangayStub: async () => {
          handlerCalls += 1;
          throw new Error("terminal replay must not run handler");
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
            client_sync_id: "ee-fix-03-replay-stub",
            action_key: "STUB_CLAIM",
            entity_type: "STUB",
            entity_server_id: "22222222-2222-4222-8222-222222222222",
            client_timestamp: "2026-08-08T01:00:00.000Z",
            payload: {
              stub_id: "22222222-2222-4222-8222-222222222222",
            },
          },
        ],
      });

      assert.equal(result.sync_status, "SYNCED");
      assert.equal(result.replayed, true);
      assert.equal(handlerCalls, 0);
    },
  );
});

test("DEPLOY-MSWDO-RGD-01 MSWDO STUB_CLAIM sync forwards barangay_id without override", async () => {
  let capturedClaimParams = null;

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub(),
      [stubServicePath]: {
        claimBarangayStub: async (params) => {
          capturedClaimParams = params;
          return {
            data: {
              id: params.id,
              status: "CLAIMED",
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
        auth: {
          ...baseAuth,
          roleCode: "MSWDO",
          defaultBarangayId: null,
        },
        entries: [
          {
            client_sync_id: "deploy-mswdo-rgd-01-stub-claim",
            action_key: "STUB_CLAIM",
            entity_type: "STUB",
            entity_server_id: "22222222-2222-4222-8222-222222222222",
            client_timestamp: "2026-08-08T01:00:00.000Z",
            payload: {
              barangay_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            },
          },
        ],
      });

      assert.equal(result.sync_status, "SYNCED");
    },
  );

  assert.equal(capturedClaimParams.user_id, null);
  assert.equal(
    capturedClaimParams.barangay_id,
    "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  );
  assert.equal(capturedClaimParams.override_barangay_id, null);
  assert.equal(capturedClaimParams.verified_by, baseAuth.userId);
});

test("BRG-SC-10-H01 Test A keeps same-stub STUB_CLAIM processing in received order despite inverted client_timestamp", async () => {
  const callOrder = [];
  let conflictPayload;

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
              id: "conflict-h01-a",
              ...payload.conflictPayload,
            },
          };
        },
      }),
      [stubServicePath]: {
        claimBarangayStub: async ({ id, claimed_at }) => {
          callOrder.push({ id, claimed_at });

          if (callOrder.length === 1) {
            return {
              id,
              status: "CLAIMED",
              claimed_at,
              winner: "input-later-timestamp",
            };
          }

          const error = new Error("Only unclaimed stubs can be marked as claimed.");
          error.code = "STUB_ALREADY_CLAIMED";
          error.statusCode = 409;
          error.entityServerId = id;
          error.serverPayload = {
            stub: {
              id,
              status: "CLAIMED",
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
            client_sync_id: "h01-stub-later",
            action_key: "STUB_CLAIM",
            entity_type: "STUB",
            entity_server_id: "stub-h01",
            client_timestamp: "2026-08-08T05:00:00.000Z",
            payload: {
              stub_id: "stub-h01",
              claimed_by_name: "Later Timestamp",
            },
          },
          {
            client_sync_id: "h01-stub-earlier",
            action_key: "STUB_CLAIM",
            entity_type: "STUB",
            entity_server_id: "stub-h01",
            client_timestamp: "2026-08-08T01:00:00.000Z",
            payload: {
              stub_id: "stub-h01",
              claimed_by_name: "Earlier Timestamp",
            },
          },
        ],
      });

      assert.deepEqual(
        callOrder.map((call) => call.claimed_at),
        ["2026-08-08T05:00:00.000Z", "2026-08-08T01:00:00.000Z"],
      );
      assert.equal(results[0].client_sync_id, "h01-stub-later");
      assert.equal(results[0].sync_status, "SYNCED");
      assert.equal(results[0].data.winner, "input-later-timestamp");
      assert.equal(results[1].client_sync_id, "h01-stub-earlier");
      assert.equal(results[1].sync_status, "CONFLICT");
      assert.equal(conflictPayload.conflict_type, "STUB_ALREADY_CLAIMED");
      assert.equal(conflictPayload.resolution_strategy, "FIRST_ACCEPTED");
    },
  );
});

test("BRG-SC-10-H01 Test B keeps reverse same-stub STUB_CLAIM input order without timestamp priority", async () => {
  const callOrder = [];

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
      }),
      [stubServicePath]: {
        claimBarangayStub: async ({ id, claimed_at }) => {
          callOrder.push(claimed_at);

          if (callOrder.length === 1) {
            return {
              id,
              status: "CLAIMED",
              claimed_at,
            };
          }

          const error = new Error("Only unclaimed stubs can be marked as claimed.");
          error.code = "STUB_ALREADY_CLAIMED";
          error.statusCode = 409;
          error.entityServerId = id;
          error.serverPayload = {
            stub: {
              id,
              status: "CLAIMED",
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
            client_sync_id: "h01-stub-earlier-first",
            action_key: "STUB_CLAIM",
            entity_type: "STUB",
            entity_server_id: "stub-h01-reverse",
            client_timestamp: "2026-08-08T01:00:00.000Z",
            payload: {
              stub_id: "stub-h01-reverse",
            },
          },
          {
            client_sync_id: "h01-stub-later-second",
            action_key: "STUB_CLAIM",
            entity_type: "STUB",
            entity_server_id: "stub-h01-reverse",
            client_timestamp: "2026-08-08T05:00:00.000Z",
            payload: {
              stub_id: "stub-h01-reverse",
            },
          },
        ],
      });

      assert.deepEqual(callOrder, [
        "2026-08-08T01:00:00.000Z",
        "2026-08-08T05:00:00.000Z",
      ]);
      assert.equal(results[0].client_sync_id, "h01-stub-earlier-first");
      assert.equal(results[0].sync_status, "SYNCED");
      assert.equal(results[1].client_sync_id, "h01-stub-later-second");
      assert.equal(results[1].sync_status, "CONFLICT");
      assert.equal(results[1].conflict.resolution_strategy, "FIRST_ACCEPTED");
    },
  );
});

test("BRG-SC-10-H01 Test C far-past critical timestamp cannot jump ahead in one batch", async () => {
  const callOrder = [];

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
      }),
      [stubServicePath]: {
        claimBarangayStub: async ({ id, claimed_at }) => {
          callOrder.push(claimed_at);

          if (callOrder.length === 1) {
            return {
              id,
              status: "CLAIMED",
              claimed_at,
            };
          }

          const error = new Error("Only unclaimed stubs can be marked as claimed.");
          error.code = "STUB_ALREADY_CLAIMED";
          error.entityServerId = id;
          error.serverPayload = {
            stub: {
              id,
              status: "CLAIMED",
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
            client_sync_id: "h01-normal-clock",
            action_key: "STUB_CLAIM",
            entity_type: "STUB",
            entity_server_id: "stub-h01-skew",
            client_timestamp: "2026-08-08T01:00:00.000Z",
            payload: {
              stub_id: "stub-h01-skew",
            },
          },
          {
            client_sync_id: "h01-far-past-clock",
            action_key: "STUB_CLAIM",
            entity_type: "STUB",
            entity_server_id: "stub-h01-skew",
            client_timestamp: "1970-01-01T00:00:00.000Z",
            payload: {
              stub_id: "stub-h01-skew",
            },
          },
        ],
      });

      assert.deepEqual(callOrder, [
        "2026-08-08T01:00:00.000Z",
        "1970-01-01T00:00:00.000Z",
      ]);
      assert.equal(results[0].client_sync_id, "h01-normal-clock");
      assert.equal(results[0].sync_status, "SYNCED");
      assert.equal(results[1].client_sync_id, "h01-far-past-clock");
      assert.equal(results[1].sync_status, "CONFLICT");
    },
  );
});

test("BRG-SC-10-H01 Test D keeps STUB_CLAIM and DISTRIBUTION_CREATE cross-action ordering in received order", async () => {
  const callOrder = [];

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
      }),
      [stubServicePath]: {
        claimBarangayStub: async ({ id }) => {
          callOrder.push("STUB_CLAIM");
          return {
            id,
            status: "CLAIMED",
          };
        },
      },
      [distributionTransactionServicePath]: {
        createDistributionTransaction: async ({ stub_id }) => {
          callOrder.push("DISTRIBUTION_CREATE");
          const error = new Error("This stub has already been used for distribution");
          error.code = "STUB_ALREADY_CLAIMED";
          error.statusCode = 409;
          error.entityServerId = stub_id;
          error.serverPayload = {
            stub: {
              id: stub_id,
              status: "CLAIMED",
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
            client_sync_id: "h01-cross-stub",
            action_key: "STUB_CLAIM",
            entity_type: "STUB",
            entity_server_id: "stub-h01-cross",
            client_timestamp: "2026-08-08T05:00:00.000Z",
            payload: {
              stub_id: "stub-h01-cross",
            },
          },
          {
            client_sync_id: "h01-cross-distribution",
            action_key: "DISTRIBUTION_CREATE",
            entity_type: "DISTRIBUTION_TRANSACTION",
            entity_server_id: null,
            client_timestamp: "2026-08-08T01:00:00.000Z",
            payload: {
              stub_id: "stub-h01-cross",
              disaster_event_id: "event-h01-cross",
              household_id: "household-h01-cross",
            },
          },
        ],
      });

      assert.deepEqual(callOrder, ["STUB_CLAIM", "DISTRIBUTION_CREATE"]);
      assert.equal(results[0].client_sync_id, "h01-cross-stub");
      assert.equal(results[0].sync_status, "SYNCED");
      assert.equal(results[1].client_sync_id, "h01-cross-distribution");
      assert.equal(results[1].sync_status, "CONFLICT");
      assert.equal(results[1].conflict.resolution_strategy, "FIRST_ACCEPTED");
    },
  );
});

test("BRG-SC-10-H01-V01-A keeps reverse DISTRIBUTION_CREATE then STUB_CLAIM order despite inverted timestamps", async () => {
  const callOrder = [];
  let stubConsumed = false;
  const conflictPayloads = [];

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
          conflictPayloads.push(payload.conflictPayload);

          return {
            syncTransaction: {
              id: payload.syncTransactionId,
              ...payload.transactionPayload,
            },
            conflictRecord: {
              id: `conflict-${payload.syncTransactionId}`,
              ...payload.conflictPayload,
            },
          };
        },
      }),
      [stubServicePath]: {
        claimBarangayStub: async ({ id, claimed_at }) => {
          callOrder.push({
            action: "STUB_CLAIM",
            client_timestamp: claimed_at,
            stub_id: id,
          });

          if (stubConsumed) {
            const error = new Error("Only unclaimed stubs can be marked as claimed.");
            error.code = "STUB_ALREADY_CLAIMED";
            error.statusCode = 409;
            error.entityServerId = id;
            error.serverPayload = {
              stub: {
                id,
                status: "CLAIMED",
              },
            };
            throw error;
          }

          stubConsumed = true;
          return {
            id,
            status: "CLAIMED",
            claimed_at,
          };
        },
      },
      [distributionTransactionServicePath]: {
        createDistributionTransaction: async ({ stub_id }) => {
          callOrder.push({
            action: "DISTRIBUTION_CREATE",
            client_timestamp: "2026-08-10T20:00:00.000Z",
            stub_id,
          });

          if (stubConsumed) {
            const error = new Error("This stub has already been used for distribution");
            error.code = "STUB_ALREADY_CLAIMED";
            error.statusCode = 409;
            error.entityServerId = stub_id;
            error.serverPayload = {
              stub: {
                id: stub_id,
                status: "CLAIMED",
              },
            };
            throw error;
          }

          stubConsumed = true;
          return {
            id: "distribution-h01-v01-a",
            stub_id,
            status: "RELEASED",
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
      const results = await processSyncEntries({
        auth: baseAuth,
        entries: [
          {
            client_sync_id: "h01-v01-a-distribution-first",
            action_key: "DISTRIBUTION_CREATE",
            entity_type: "DISTRIBUTION_TRANSACTION",
            entity_server_id: null,
            client_timestamp: "2026-08-10T20:00:00.000Z",
            payload: {
              stub_id: "stub-h01-v01-a",
              disaster_event_id: "event-h01-v01-a",
              household_id: "household-h01-v01-a",
            },
          },
          {
            client_sync_id: "h01-v01-a-stub-second",
            action_key: "STUB_CLAIM",
            entity_type: "STUB",
            entity_server_id: "stub-h01-v01-a",
            client_timestamp: "2026-08-10T02:00:00.000Z",
            payload: {
              stub_id: "stub-h01-v01-a",
            },
          },
        ],
      });

      assert.deepEqual(
        callOrder.map((call) => call.action),
        ["DISTRIBUTION_CREATE", "STUB_CLAIM"],
      );
      assert.deepEqual(
        callOrder.map((call) => call.stub_id),
        ["stub-h01-v01-a", "stub-h01-v01-a"],
      );
      assert.equal(results.length, 2);
      assert.equal(results[0].client_sync_id, "h01-v01-a-distribution-first");
      assert.equal(results[0].sync_status, "SYNCED");
      assert.equal(results[1].client_sync_id, "h01-v01-a-stub-second");
      assert.equal(results[1].sync_status, "CONFLICT");
      assert.equal(results[1].conflict.resolution_strategy, "FIRST_ACCEPTED");
      assert.deepEqual(
        conflictPayloads.map((payload) => payload.resolution_strategy),
        ["FIRST_ACCEPTED"],
      );
    },
  );
});

test("BRG-SC-10-H01 Test F invalid first critical entry does not reserve FIRST_ACCEPTED winner", async () => {
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
      }),
      [stubServicePath]: {
        claimBarangayStub: async ({ id }) => {
          handlerCalls += 1;

          if (handlerCalls === 1) {
            const error = new Error("Stub not found for this barangay");
            error.statusCode = 404;
            error.code = "STUB_NOT_FOUND";
            throw error;
          }

          return {
            id,
            status: "CLAIMED",
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
      const results = await processSyncEntries({
        auth: baseAuth,
        entries: [
          {
            client_sync_id: "h01-invalid-first",
            action_key: "STUB_CLAIM",
            entity_type: "STUB",
            entity_server_id: "stub-h01-invalid-first",
            client_timestamp: "2026-08-08T05:00:00.000Z",
            payload: {
              stub_id: "stub-h01-invalid-first",
            },
          },
          {
            client_sync_id: "h01-valid-second",
            action_key: "STUB_CLAIM",
            entity_type: "STUB",
            entity_server_id: "stub-h01-valid-second",
            client_timestamp: "2026-08-08T01:00:00.000Z",
            payload: {
              stub_id: "stub-h01-valid-second",
            },
          },
        ],
      });

      assert.equal(results[0].client_sync_id, "h01-invalid-first");
      assert.equal(results[0].sync_status, "FAILED");
      assert.equal(results[1].client_sync_id, "h01-valid-second");
      assert.equal(results[1].sync_status, "SYNCED");
      assert.equal(handlerCalls, 2);
    },
  );
});

test("ITR duplicate with different client_sync_id becomes resolved FIRST_ACCEPTED conflict", async () => {
  let conflictPayload;
  let transactionPayload;

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub({
        recordConflictAndUpdateSyncTransaction: async (payload) => {
          conflictPayload = payload.conflictPayload;
          transactionPayload = payload.transactionPayload;

          return {
            syncTransaction: {
              id: payload.syncTransactionId,
              ...payload.transactionPayload,
            },
            conflictRecord: {
              id: "conflict-itr",
              ...payload.conflictPayload,
            },
          };
        },
      }),
      [inventoryTransactionServicePath]: {
        createInventoryTransaction: async () => {
          const error = new Error(
            "This Inventory Transaction Reference No. has already been recorded. Check the written inventory transaction before trying again.",
          );
          error.code = "DUPLICATE_INVENTORY_TRANSACTION_REFERENCE_NO";
          error.statusCode = 409;
          error.entityServerId = "33333333-3333-4333-8333-333333333333";
          error.serverPayload = {
            id: "33333333-3333-4333-8333-333333333333",
            inventory_transaction_reference_no: "ITR-2026-000123",
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
        auth: {
          ...baseAuth,
          roleCode: "MAYOR",
        },
        entries: [
          {
            client_sync_id: "itr-b",
            action_key: "INVENTORY_TRANSACTION_CREATE",
            entity_type: "INVENTORY_TRANSACTION",
            entity_server_id: null,
            client_timestamp: "2026-08-08T01:00:00.000Z",
            payload: {
              inventory_batch_id: "11111111-1111-4111-8111-111111111111",
              transaction_type: "OUTFLOW",
              quantity: 1,
              inventoryTransactionReferenceNo: "ITR-2026-000123",
            },
          },
        ],
      });

      assert.equal(result.sync_status, "CONFLICT");
      assert.equal(transactionPayload.sync_status, "CONFLICT");
      assert.equal(
        transactionPayload.entity_server_id,
        "33333333-3333-4333-8333-333333333333",
      );
      assert.equal(
        conflictPayload.conflict_type,
        "DUPLICATE_INVENTORY_TRANSACTION_REFERENCE_NO",
      );
      assert.equal(conflictPayload.resolution_strategy, "FIRST_ACCEPTED");
      assert.equal(conflictPayload.status, "RESOLVED");
      assert.equal(conflictPayload.resolved_by, null);
      assert.equal(conflictPayload.resolved_payload_json.winner, "SERVER");
    },
  );
});

test("EE-FIX-04 INVENTORY_TRANSACTION_CREATE lifecycle failure is FAILED without conflict", async () => {
  let transactionPayload;
  let serviceCalls = 0;

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub({
        updateSyncTransaction: async (id, payload) => {
          transactionPayload = payload;
          return {
            id,
            ...payload,
          };
        },
      }),
      [inventoryTransactionServicePath]: {
        createInventoryTransaction: async (payload) => {
          serviceCalls += 1;
          assert.equal(payload.transaction_type, "OUTFLOW");
          assert.equal(payload.disaster_event_id, "event-closed");
          assert.equal(payload.inventoryTransactionReferenceNo, "ITR-2026-000124");
          const error = new Error(
            "Inventory outflow cannot be completed because the disaster event is not active.",
          );
          error.code = "DISASTER_EVENT_NOT_ACTIVE";
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
        auth: {
          ...baseAuth,
          roleCode: "MAYOR",
        },
        entries: [
          {
            client_sync_id: "itr-closed-unique",
            action_key: "INVENTORY_TRANSACTION_CREATE",
            entity_type: "INVENTORY_TRANSACTION",
            entity_server_id: null,
            client_timestamp: "2026-08-08T01:00:00.000Z",
            payload: {
              disaster_event_id: "event-closed",
              inventory_batch_id: "11111111-1111-4111-8111-111111111111",
              transaction_type: "OUTFLOW",
              quantity: 1,
              inventoryTransactionReferenceNo: "ITR-2026-000124",
              client_event_status: "ACTIVE",
            },
          },
        ],
      });

      assert.equal(serviceCalls, 1);
      assert.equal(result.sync_status, "FAILED");
      assert.equal(result.conflict, null);
      assert.match(result.message, /disaster event is not active/);
      assert.equal(transactionPayload.sync_status, "FAILED");
      assert.equal(transactionPayload.entity_server_id, null);
    },
  );
});

test("EE-FIX-04 same-ID accepted inventory replay after closure does not rerun service or change ITR", async () => {
  let serviceCalls = 0;
  let updateCalls = 0;

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub({
        claimSyncTransaction: async () => ({
          decision: "REPLAY_TERMINAL",
          transaction: {
            id: "sync-inventory-replay",
            client_sync_id: "itr-replay",
            entity_server_id: "tx-accepted",
            sync_status: "SYNCED",
            error_message: null,
          },
          conflictRecord: null,
        }),
        updateSyncTransaction: async () => {
          updateCalls += 1;
          throw new Error("terminal replay must not update sync transaction");
        },
      }),
      [inventoryTransactionServicePath]: {
        createInventoryTransaction: async () => {
          serviceCalls += 1;
          throw new Error("terminal replay must not rerun inventory service");
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
        auth: {
          ...baseAuth,
          roleCode: "MAYOR",
        },
        entries: [
          {
            client_sync_id: "itr-replay",
            action_key: "INVENTORY_TRANSACTION_CREATE",
            entity_type: "INVENTORY_TRANSACTION",
            entity_server_id: null,
            client_timestamp: "2026-08-08T01:00:00.000Z",
            payload: {
              disaster_event_id: "event-now-closed",
              inventory_batch_id: "11111111-1111-4111-8111-111111111111",
              transaction_type: "OUTFLOW",
              quantity: 1,
              inventoryTransactionReferenceNo: "ITR-2026-000125",
            },
          },
        ],
      });

      assert.equal(result.sync_status, "SYNCED");
      assert.equal(result.replayed, true);
      assert.equal(result.data.id, "tx-accepted");
      assert.equal(serviceCalls, 0);
      assert.equal(updateCalls, 0);
    },
  );
});

test("INVENTORY_BATCH_CREATE duplicate becomes resolved FIRST_ACCEPTED conflict", async () => {
  let conflictPayload;
  let transactionPayload;

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub({
        recordConflictAndUpdateSyncTransaction: async (payload) => {
          conflictPayload = payload.conflictPayload;
          transactionPayload = payload.transactionPayload;

          return {
            syncTransaction: {
              id: payload.syncTransactionId,
              ...payload.transactionPayload,
            },
            conflictRecord: {
              id: "conflict-inventory-batch",
              ...payload.conflictPayload,
            },
          };
        },
      }),
      [inventoryBatchServicePath]: {
        createInventoryBatch: async () => {
          const error = new Error(
            "This batch number already exists for the selected inventory item.",
          );
          error.code = "DUPLICATE_INVENTORY_BATCH";
          error.statusCode = 409;
          error.entityServerId = "44444444-4444-4444-8444-444444444444";
          error.serverPayload = {
            id: "44444444-4444-4444-8444-444444444444",
            inventory_item_id: "11111111-1111-4111-8111-111111111111",
            batch_no: "LOT-A",
            quantity_received: 10,
            quantity_available: 10,
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
        auth: {
          ...baseAuth,
          roleCode: "MAYOR",
        },
        entries: [
          {
            client_sync_id: "batch-duplicate-b",
            action_key: "INVENTORY_BATCH_CREATE",
            entity_type: "INVENTORY_BATCH",
            entity_server_id: null,
            client_timestamp: "2026-08-08T01:00:00.000Z",
            payload: {
              inventory_item_id: "11111111-1111-4111-8111-111111111111",
              batch_no: "LOT-A",
              source_type: "LGU",
              quantity_received: 20,
            },
          },
        ],
      });

      assert.equal(result.sync_status, "CONFLICT");
      assert.equal(transactionPayload.sync_status, "CONFLICT");
      assert.equal(
        transactionPayload.entity_server_id,
        "44444444-4444-4444-8444-444444444444",
      );
      assert.equal(conflictPayload.conflict_type, "DUPLICATE_INVENTORY_BATCH");
      assert.equal(conflictPayload.entity_server_id, "44444444-4444-4444-8444-444444444444");
      assert.equal(conflictPayload.resolution_strategy, "FIRST_ACCEPTED");
      assert.equal(conflictPayload.status, "RESOLVED");
      assert.equal(conflictPayload.resolved_by, null);
      assert.equal(conflictPayload.local_payload_json.quantity_received, 20);
      assert.equal(conflictPayload.server_payload_json.quantity_available, 10);
      assert.equal(conflictPayload.resolved_payload_json.winner, "SERVER");
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
            payload: buildValidHouseholdRegisterSyncPayload(),
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
      [householdRegistrationServicePath]: {
        getAuthorizedHouseholdSummaryForUpdate: async () => ({
          id: "33333333-3333-4333-8333-333333333333",
          barangay_id: baseAuth.defaultBarangayId,
          family_head_first_name: "Server",
          updated_at: "2026-08-08T02:00:00.000Z",
        }),
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
      [householdRegistrationServicePath]: {
        getAuthorizedHouseholdSummaryForUpdate: async () => ({
          id: "44444444-4444-4444-8444-444444444444",
          barangay_id: baseAuth.defaultBarangayId,
          family_head_first_name: "Server",
          updated_at: "2026-08-08T01:00:00.000Z",
        }),
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
      [householdRegistrationServicePath]: {
        getAuthorizedHouseholdSummaryForUpdate: async () => ({
          id: "55555555-5555-4555-8555-555555555555",
          barangay_id: baseAuth.defaultBarangayId,
          family_head_first_name: "Server",
          updated_at: "2026-08-08T01:00:00.000Z",
        }),
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

test("BRG-SC-10-H01 Test G HOUSEHOLD_UPDATE older then newer preserves latest valid authoritative state", async () => {
  const conflictWinners = [];
  let authoritativeHousehold = {
    id: "66666666-6666-4666-8666-666666666666",
    barangay_id: baseAuth.defaultBarangayId,
    family_head_first_name: "Server",
    updated_at: "2026-08-08T01:30:00.000Z",
  };

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
          conflictWinners.push(payload.conflictPayload.resolved_payload_json.winner);

          return {
            syncTransaction: {
              id: payload.syncTransactionId,
              ...payload.transactionPayload,
            },
            conflictRecord: {
              id: `conflict-${payload.syncTransactionId}`,
              ...payload.conflictPayload,
            },
          };
        },
      }),
      [householdRegistrationServicePath]: {
        getAuthorizedHouseholdSummaryForUpdate: async () => authoritativeHousehold,
        updateHouseholdDetails: async ({ requestData }) => {
          authoritativeHousehold = {
            ...authoritativeHousehold,
            ...requestData,
            updated_at: requestData.client_updated_at || "2026-08-08T02:00:00.000Z",
          };
          return authoritativeHousehold;
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
            client_sync_id: "h01-household-older",
            action_key: "HOUSEHOLD_UPDATE",
            entity_type: "HOUSEHOLD",
            entity_server_id: authoritativeHousehold.id,
            client_timestamp: "2026-08-08T01:00:00.000Z",
            client_updated_at: "2026-08-08T01:00:00.000Z",
            payload: {
              family_head_first_name: "Older Local",
              client_updated_at: "2026-08-08T01:00:00.000Z",
            },
          },
          {
            client_sync_id: "h01-household-newer",
            action_key: "HOUSEHOLD_UPDATE",
            entity_type: "HOUSEHOLD",
            entity_server_id: authoritativeHousehold.id,
            client_timestamp: "2026-08-08T02:00:00.000Z",
            client_updated_at: "2026-08-08T02:00:00.000Z",
            payload: {
              family_head_first_name: "Newer Local",
              client_updated_at: "2026-08-08T02:00:00.000Z",
            },
          },
        ],
      });

      assert.deepEqual(
        results.map((result) => result.client_sync_id),
        ["h01-household-older", "h01-household-newer"],
      );
      assert.deepEqual(conflictWinners, ["SERVER", "LOCAL"]);
      assert.equal(authoritativeHousehold.family_head_first_name, "Newer Local");
      assert.equal(authoritativeHousehold.updated_at, "2026-08-08T02:00:00.000Z");
    },
  );
});

test("BRG-SC-10-H01 Test H HOUSEHOLD_UPDATE newer then older still preserves latest valid authoritative state", async () => {
  const conflictWinners = [];
  let authoritativeHousehold = {
    id: "77777777-7777-4777-8777-777777777777",
    barangay_id: baseAuth.defaultBarangayId,
    family_head_first_name: "Server",
    updated_at: "2026-08-08T01:30:00.000Z",
  };

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
          conflictWinners.push(payload.conflictPayload.resolved_payload_json.winner);

          return {
            syncTransaction: {
              id: payload.syncTransactionId,
              ...payload.transactionPayload,
            },
            conflictRecord: {
              id: `conflict-${payload.syncTransactionId}`,
              ...payload.conflictPayload,
            },
          };
        },
      }),
      [householdRegistrationServicePath]: {
        getAuthorizedHouseholdSummaryForUpdate: async () => authoritativeHousehold,
        updateHouseholdDetails: async ({ requestData }) => {
          authoritativeHousehold = {
            ...authoritativeHousehold,
            ...requestData,
            updated_at: requestData.client_updated_at,
          };
          return authoritativeHousehold;
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
            client_sync_id: "h01-household-newer-first",
            action_key: "HOUSEHOLD_UPDATE",
            entity_type: "HOUSEHOLD",
            entity_server_id: authoritativeHousehold.id,
            client_timestamp: "2026-08-08T02:00:00.000Z",
            client_updated_at: "2026-08-08T02:00:00.000Z",
            payload: {
              family_head_first_name: "Newer First",
              client_updated_at: "2026-08-08T02:00:00.000Z",
            },
          },
          {
            client_sync_id: "h01-household-older-second",
            action_key: "HOUSEHOLD_UPDATE",
            entity_type: "HOUSEHOLD",
            entity_server_id: authoritativeHousehold.id,
            client_timestamp: "2026-08-08T01:00:00.000Z",
            client_updated_at: "2026-08-08T01:00:00.000Z",
            payload: {
              family_head_first_name: "Older Second",
              client_updated_at: "2026-08-08T01:00:00.000Z",
            },
          },
        ],
      });

      assert.deepEqual(
        results.map((result) => result.client_sync_id),
        ["h01-household-newer-first", "h01-household-older-second"],
      );
      assert.deepEqual(conflictWinners, ["LOCAL", "SERVER"]);
      assert.equal(authoritativeHousehold.family_head_first_name, "Newer First");
      assert.equal(authoritativeHousehold.updated_at, "2026-08-08T02:00:00.000Z");
    },
  );
});

test("BRG-SC-10-H01 Test I invalid newer HOUSEHOLD_UPDATE does not override latest valid state", async () => {
  const conflictWinners = [];
  let authoritativeHousehold = {
    id: "88888888-8888-4888-8888-888888888888",
    barangay_id: baseAuth.defaultBarangayId,
    family_head_first_name: "Server",
    updated_at: "2026-08-08T01:00:00.000Z",
  };

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
          conflictWinners.push(payload.conflictPayload.resolved_payload_json.winner);

          return {
            syncTransaction: {
              id: payload.syncTransactionId,
              ...payload.transactionPayload,
            },
            conflictRecord: {
              id: `conflict-${payload.syncTransactionId}`,
              ...payload.conflictPayload,
            },
          };
        },
      }),
      [householdRegistrationServicePath]: {
        getAuthorizedHouseholdSummaryForUpdate: async () => authoritativeHousehold,
        updateHouseholdDetails: async ({ requestData }) => {
          if (!requestData.family_head_first_name) {
            const error = new Error("Invalid household update.");
            error.statusCode = 400;
            throw error;
          }

          authoritativeHousehold = {
            ...authoritativeHousehold,
            ...requestData,
            updated_at: requestData.client_updated_at,
          };
          return authoritativeHousehold;
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
            client_sync_id: "h01-household-invalid-newer",
            action_key: "HOUSEHOLD_UPDATE",
            entity_type: "HOUSEHOLD",
            entity_server_id: authoritativeHousehold.id,
            client_timestamp: "2026-08-08T03:00:00.000Z",
            client_updated_at: "2026-08-08T03:00:00.000Z",
            payload: {
              family_head_first_name: "",
              client_updated_at: "2026-08-08T03:00:00.000Z",
            },
          },
          {
            client_sync_id: "h01-household-valid-older",
            action_key: "HOUSEHOLD_UPDATE",
            entity_type: "HOUSEHOLD",
            entity_server_id: authoritativeHousehold.id,
            client_timestamp: "2026-08-08T02:00:00.000Z",
            client_updated_at: "2026-08-08T02:00:00.000Z",
            payload: {
              family_head_first_name: "Valid Older",
              client_updated_at: "2026-08-08T02:00:00.000Z",
            },
          },
        ],
      });

      assert.equal(results[0].client_sync_id, "h01-household-invalid-newer");
      assert.equal(results[0].sync_status, "FAILED");
      assert.equal(results[1].client_sync_id, "h01-household-valid-older");
      assert.equal(results[1].sync_status, "CONFLICT");
      assert.deepEqual(conflictWinners, ["LOCAL"]);
      assert.equal(authoritativeHousehold.family_head_first_name, "Valid Older");
      assert.equal(authoritativeHousehold.updated_at, "2026-08-08T02:00:00.000Z");
    },
  );
});

test("BRG-SC-10-H01-V01-B preserves one mixed critical and noncritical batch without global timestamp sorting", async () => {
  const processingOrder = [];
  const actionOrder = [];
  const claimOrder = [];
  const conflictWinners = [];
  let householdLookupCount = 0;
  let stubConsumed = false;
  let authoritativeHousehold = {
    id: "99999999-9999-4999-8999-999999999999",
    barangay_id: baseAuth.defaultBarangayId,
    family_head_first_name: "Server",
    updated_at: "2026-08-10T14:00:00.000Z",
  };

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: createBaseSyncRepositoryStub({
        claimSyncTransaction: async (payload) => {
          claimOrder.push(payload.client_sync_id);
          actionOrder.push(payload.payload_json.action_key);

          return {
            decision: "CLAIMED_NEW",
            transaction: {
              id: `sync-${payload.client_sync_id}`,
              ...payload,
            },
          };
        },
        recordConflictAndUpdateSyncTransaction: async (payload) => {
          conflictWinners.push(payload.conflictPayload.resolved_payload_json.winner);

          return {
            syncTransaction: {
              id: payload.syncTransactionId,
              ...payload.transactionPayload,
            },
            conflictRecord: {
              id: `conflict-${payload.syncTransactionId}`,
              ...payload.conflictPayload,
            },
          };
        },
      }),
      [householdRegistrationServicePath]: {
        getAuthorizedHouseholdSummaryForUpdate: async () => {
          householdLookupCount += 1;
          processingOrder.push(`HOUSEHOLD_UPDATE_${householdLookupCount}`);
          return authoritativeHousehold;
        },
        updateHouseholdDetails: async ({ requestData }) => {
          authoritativeHousehold = {
            ...authoritativeHousehold,
            ...requestData,
            updated_at: requestData.client_updated_at,
          };
          return authoritativeHousehold;
        },
      },
      [stubServicePath]: {
        claimBarangayStub: async ({ id, claimed_at }) => {
          processingOrder.push("STUB_CLAIM");

          if (stubConsumed) {
            const error = new Error("Only unclaimed stubs can be marked as claimed.");
            error.code = "STUB_ALREADY_CLAIMED";
            error.statusCode = 409;
            error.entityServerId = id;
            error.serverPayload = {
              stub: {
                id,
                status: "CLAIMED",
              },
            };
            throw error;
          }

          stubConsumed = true;
          return {
            id,
            status: "CLAIMED",
            claimed_at,
          };
        },
      },
      [distributionTransactionServicePath]: {
        createDistributionTransaction: async ({ stub_id }) => {
          processingOrder.push("DISTRIBUTION_CREATE");

          if (stubConsumed) {
            const error = new Error("This stub has already been used for distribution");
            error.code = "STUB_ALREADY_CLAIMED";
            error.statusCode = 409;
            error.entityServerId = stub_id;
            error.serverPayload = {
              stub: {
                id: stub_id,
                status: "CLAIMED",
              },
            };
            throw error;
          }

          stubConsumed = true;
          return {
            id: "distribution-h01-v01-b",
            stub_id,
            status: "RELEASED",
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
      const results = await processSyncEntries({
        auth: baseAuth,
        entries: [
          {
            client_sync_id: "h01-v01-b-household-older-a",
            action_key: "HOUSEHOLD_UPDATE",
            entity_type: "HOUSEHOLD",
            entity_server_id: authoritativeHousehold.id,
            client_timestamp: "2026-08-10T12:00:00.000Z",
            client_updated_at: "2026-08-10T12:00:00.000Z",
            payload: {
              family_head_first_name: "HOUSEHOLD_UPDATE_A",
              client_updated_at: "2026-08-10T12:00:00.000Z",
            },
          },
          {
            client_sync_id: "h01-v01-b-stub-claim",
            action_key: "STUB_CLAIM",
            entity_type: "STUB",
            entity_server_id: "stub-h01-v01-b",
            client_timestamp: "2026-08-10T20:00:00.000Z",
            payload: {
              stub_id: "stub-h01-v01-b",
            },
          },
          {
            client_sync_id: "h01-v01-b-household-newer-b",
            action_key: "HOUSEHOLD_UPDATE",
            entity_type: "HOUSEHOLD",
            entity_server_id: authoritativeHousehold.id,
            client_timestamp: "2026-08-10T16:00:00.000Z",
            client_updated_at: "2026-08-10T16:00:00.000Z",
            payload: {
              family_head_first_name: "HOUSEHOLD_UPDATE_B",
              client_updated_at: "2026-08-10T16:00:00.000Z",
            },
          },
          {
            client_sync_id: "h01-v01-b-distribution",
            action_key: "DISTRIBUTION_CREATE",
            entity_type: "DISTRIBUTION_TRANSACTION",
            entity_server_id: null,
            client_timestamp: "2026-08-10T01:00:00.000Z",
            payload: {
              stub_id: "stub-h01-v01-b",
              disaster_event_id: "event-h01-v01-b",
              household_id: authoritativeHousehold.id,
            },
          },
        ],
      });

      assert.deepEqual(processingOrder, [
        "HOUSEHOLD_UPDATE_1",
        "STUB_CLAIM",
        "HOUSEHOLD_UPDATE_2",
        "DISTRIBUTION_CREATE",
      ]);
      assert.deepEqual(actionOrder, [
        "HOUSEHOLD_UPDATE",
        "STUB_CLAIM",
        "HOUSEHOLD_UPDATE",
        "DISTRIBUTION_CREATE",
      ]);
      assert.deepEqual(claimOrder, [
        "h01-v01-b-household-older-a",
        "h01-v01-b-stub-claim",
        "h01-v01-b-household-newer-b",
        "h01-v01-b-distribution",
      ]);
      assert.deepEqual(
        results.map((result) => result.client_sync_id),
        [
          "h01-v01-b-household-older-a",
          "h01-v01-b-stub-claim",
          "h01-v01-b-household-newer-b",
          "h01-v01-b-distribution",
        ],
      );
      assert.deepEqual(
        results.map((result) => result.sync_status),
        ["CONFLICT", "SYNCED", "CONFLICT", "CONFLICT"],
      );
      assert.deepEqual(conflictWinners, ["SERVER", "LOCAL", "SERVER"]);
      assert.equal(authoritativeHousehold.family_head_first_name, "HOUSEHOLD_UPDATE_B");
      assert.equal(authoritativeHousehold.updated_at, "2026-08-10T16:00:00.000Z");
      assert.equal(results.length, 4);
      assert.equal(new Set(processingOrder).size, 4);
      assert.equal(results[0].conflict.resolution_strategy, "LATEST_TIMESTAMP");
      assert.equal(results[2].conflict.resolution_strategy, "LATEST_TIMESTAMP");
      assert.equal(results[3].conflict.resolution_strategy, "FIRST_ACCEPTED");
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

test("M04-01 stock drift detail exposes only Mayor MARK_REVIEWED and KEEP_SERVER actions", async () => {
  await withStubbedSyncService(
    {
      [syncRepositoryPath]: {
        getSyncConflictById: async ({ id }) => ({
          id,
          sync_transaction_id: "sync-1",
          user_id: "mayor-1",
          entity_type: "INVENTORY_TRANSACTION",
          entity_server_id: null,
          conflict_type: "INVENTORY_STOCK_STATE_DRIFT",
          local_payload_json: { payload: { quantity: 10 } },
          server_payload_json: { quantityAvailable: 4, stockVersion: 2 },
          resolution_strategy: "MANUAL_REVIEW",
          resolved_payload_json: null,
          resolved_by: null,
          resolved_at: null,
          status: "OPEN",
          sync_status: "CONFLICT",
          operation_type: "INVENTORY_ADJUSTMENT",
        }),
      },
      [systemLogPath]: {
        logAuditSafely: async () => {},
        logErrorSafely: async () => {},
        pickDefined: (payload, keys) =>
          keys.reduce((summary, key) => {
            if (payload?.[key] !== undefined) summary[key] = payload[key];
            return summary;
          }, {}),
      },
      [systemLogRepositoryPath]: {
        insertAuditLog: async () => ({}),
      },
    },
    async ({ getSyncConflictDetail }) => {
      const detail = await getSyncConflictDetail({
        auth: {
          userId: "mayor-1",
          roleCode: "MAYOR",
        },
        conflictId: "conflict-stock-drift",
      });

      assert.deepEqual(detail.availableResolutionActions, [
        "MARK_REVIEWED",
        "KEEP_SERVER",
      ]);
    },
  );
});

test("BRG-SC-04B peer Mayor discovers eligible stock-drift conflict without foreign history", async () => {
  const ownedConflict = {
    id: "owned-conflict",
    user_id: "mayor-b",
    entity_type: "INVENTORY_TRANSACTION",
    conflict_type: "INVENTORY_STOCK_STATE_DRIFT",
    resolution_strategy: "MANUAL_REVIEW",
    status: "OPEN",
    created_at: "2026-08-09T01:00:00.000Z",
  };
  const peerConflict = {
    id: "peer-conflict",
    user_id: "mayor-a",
    entity_type: "INVENTORY_TRANSACTION",
    conflict_type: "INVENTORY_STOCK_STATE_DRIFT",
    resolution_strategy: "MANUAL_REVIEW",
    status: "OPEN",
    created_at: "2026-08-09T02:00:00.000Z",
  };
  const duplicateOwnedReviewable = {
    ...ownedConflict,
    created_at: "2026-08-09T03:00:00.000Z",
  };

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: {
        getSyncTransactionsByUser: async ({ userId }) => {
          assert.equal(userId, "mayor-b");
          return [{ id: "mayor-b-own-transaction", user_id: "mayor-b" }];
        },
        getSyncConflictsByUser: async ({ userId }) => {
          assert.equal(userId, "mayor-b");
          return [ownedConflict];
        },
        getReviewableManualInventoryConflicts: async () => [
          peerConflict,
          duplicateOwnedReviewable,
        ],
      },
    },
    async ({ getSyncHistory }) => {
      const history = await getSyncHistory({
        auth: {
          userId: "mayor-b",
          roleCode: "MAYOR",
        },
        syncStatus: null,
        conflictStatus: null,
        limit: 100,
      });

      assert.deepEqual(
        history.transactions.map((transaction) => transaction.id),
        ["mayor-b-own-transaction"],
      );
      assert.deepEqual(
        history.conflicts.map((conflict) => conflict.id),
        ["peer-conflict", "owned-conflict"],
      );
      assert.deepEqual(history.conflicts[0].availableResolutionActions, [
        "MARK_REVIEWED",
        "KEEP_SERVER",
      ]);
    },
  );
});

test("BRG-SC-04B non-Mayor history excludes peer review workload", async () => {
  let reviewableQueryCalled = false;

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: {
        getSyncTransactionsByUser: async ({ userId }) => {
          assert.equal(userId, "barangay-b");
          return [];
        },
        getSyncConflictsByUser: async ({ userId }) => {
          assert.equal(userId, "barangay-b");
          return [];
        },
        getReviewableManualInventoryConflicts: async () => {
          reviewableQueryCalled = true;
          return [];
        },
      },
    },
    async ({ getSyncHistory }) => {
      const history = await getSyncHistory({
        auth: {
          userId: "barangay-b",
          roleCode: "BARANGAY",
        },
        syncStatus: null,
        conflictStatus: null,
        limit: 100,
      });

      assert.deepEqual(history.conflicts, []);
      assert.equal(reviewableQueryCalled, false);
    },
  );
});

test("BRG-SC-EVENT-01 getSyncHistory enriches event IDs with scoped titles in one batch", async () => {
  let eventLookupCalls = 0;

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: {
        getSyncTransactionsByUser: async ({ userId }) => {
          assert.equal(userId, "barangay-b");
          return [
            {
              id: "sync-event-1",
              payload_json: {
                action_key: "HOUSEHOLD_REGISTER",
                payload: {
                  disaster_event_id: "11111111-1111-4111-8111-111111111111",
                },
              },
            },
            {
              id: "sync-event-2",
              payload_json: {
                action_key: "DISTRIBUTION_CREATE",
                payload: {
                  disaster_event_id: "11111111-1111-4111-8111-111111111111",
                },
              },
            },
          ];
        },
        getSyncConflictsByUser: async () => [],
        getDisasterEventTitlesByIds: async ({
          eventIds,
          roleCode,
          defaultBarangayId,
        }) => {
          eventLookupCalls += 1;
          assert.deepEqual(eventIds, [
            "11111111-1111-4111-8111-111111111111",
            "11111111-1111-4111-8111-111111111111",
          ]);
          assert.equal(roleCode, "BARANGAY");
          assert.equal(defaultBarangayId, "barangay-1");
          return {
            "11111111-1111-4111-8111-111111111111": "Typhoon Response Maymay",
          };
        },
      },
    },
    async ({ getSyncHistory }) => {
      const history = await getSyncHistory({
        auth: {
          userId: "barangay-b",
          roleCode: "BARANGAY",
          defaultBarangayId: "barangay-1",
        },
        syncStatus: null,
        conflictStatus: null,
        limit: 50,
      });

      assert.equal(eventLookupCalls, 1);
      assert.equal(
        history.transactions[0].sync_history_disaster_event_title,
        "Typhoon Response Maymay",
      );
      assert.equal(
        history.transactions[1].sync_history_disaster_event_title,
        "Typhoon Response Maymay",
      );
    },
  );
});

test("BRG-SC-EVENT-02 unresolved or deleted event IDs do not fail or expose title fields", async () => {
  await withStubbedSyncService(
    {
      [syncRepositoryPath]: {
        getSyncTransactionsByUser: async () => [
          {
            id: "sync-missing-event",
            payload_json: {
              action_key: "HOUSEHOLD_REGISTER",
              payload: {
                disaster_event_id: "22222222-2222-4222-8222-222222222222",
              },
            },
          },
          {
            id: "sync-legacy-no-event",
            payload_json: {
              action_key: "HOUSEHOLD_DEPART",
              payload: {
                remarks: "Legacy row",
              },
            },
          },
        ],
        getSyncConflictsByUser: async () => [],
        getDisasterEventTitlesByIds: async () => ({}),
      },
    },
    async ({ getSyncHistory }) => {
      const history = await getSyncHistory({
        auth: {
          userId: "barangay-b",
          roleCode: "BARANGAY",
          defaultBarangayId: "barangay-1",
        },
        syncStatus: null,
        conflictStatus: null,
        limit: 50,
      });

      assert.equal(
        Object.prototype.hasOwnProperty.call(
          history.transactions[0],
          "sync_history_disaster_event_title",
        ),
        false,
      );
      assert.equal(
        Object.prototype.hasOwnProperty.call(
          history.transactions[1],
          "sync_history_disaster_event_title",
        ),
        false,
      );
    },
  );
});

test("BRG-SC-04B peer Mayor Needs Review count includes eligible conflict once", async () => {
  await withStubbedSyncService(
    {
      [syncRepositoryPath]: {
        countOpenSyncConflictsByUser: async ({ userId }) => {
          assert.equal(userId, "mayor-b");
          return 1;
        },
        countOpenReviewableManualInventoryConflicts: async ({ userId }) => {
          assert.equal(userId, "mayor-b");
          return 2;
        },
        getLastSuccessfulSyncAtByUser: async ({ userId }) => {
          assert.equal(userId, "mayor-b");
          return null;
        },
      },
    },
    async ({ getSyncStatusSummary }) => {
      const summary = await getSyncStatusSummary({
        auth: {
          userId: "mayor-b",
          roleCode: "MAYOR",
        },
      });

      assert.equal(summary.conflictCount, 3);
    },
  );
});

test("BRG-SC-04B peer Mayor can view eligible conflict detail but not automatic foreign conflict", async () => {
  const conflictsById = {
    "peer-stock-drift": {
      id: "peer-stock-drift",
      sync_transaction_id: "sync-1",
      user_id: "mayor-a",
      entity_type: "INVENTORY_TRANSACTION",
      entity_server_id: null,
      conflict_type: "INVENTORY_STOCK_STATE_DRIFT",
      local_payload_json: { payload: { quantity: 10 } },
      server_payload_json: { quantityAvailable: 4, stockVersion: 2 },
      resolution_strategy: "MANUAL_REVIEW",
      resolved_payload_json: null,
      resolved_by: null,
      resolved_at: null,
      status: "OPEN",
      sync_status: "CONFLICT",
      operation_type: "INVENTORY_ADJUSTMENT",
    },
    "foreign-automatic": {
      id: "foreign-automatic",
      sync_transaction_id: "sync-2",
      user_id: "mayor-a",
      entity_type: "INVENTORY_TRANSACTION",
      entity_server_id: null,
      conflict_type: "DUPLICATE_INVENTORY_BATCH",
      local_payload_json: {},
      server_payload_json: {},
      resolution_strategy: "FIRST_ACCEPTED",
      resolved_payload_json: { winner: "SERVER" },
      resolved_by: null,
      resolved_at: "2026-08-09T03:00:00.000Z",
      status: "RESOLVED",
      sync_status: "CONFLICT",
      operation_type: "CREATE",
    },
  };

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: {
        getSyncConflictById: async ({ id }) => conflictsById[id] || null,
      },
      [systemLogPath]: {
        logAuditSafely: async () => {},
        logErrorSafely: async () => {},
        pickDefined: () => ({}),
      },
      [systemLogRepositoryPath]: {
        insertAuditLog: async () => ({}),
      },
    },
    async ({ getSyncConflictDetail }) => {
      const detail = await getSyncConflictDetail({
        auth: {
          userId: "mayor-b",
          roleCode: "MAYOR",
        },
        conflictId: "peer-stock-drift",
      });

      assert.equal(detail.id, "peer-stock-drift");
      assert.deepEqual(detail.availableResolutionActions, [
        "MARK_REVIEWED",
        "KEEP_SERVER",
      ]);

      await assert.rejects(
        () =>
          getSyncConflictDetail({
            auth: {
              userId: "mayor-b",
              roleCode: "MAYOR",
            },
            conflictId: "foreign-automatic",
          }),
        /Sync conflict not found/,
      );
    },
  );
});

test("BRG-SC-04B Barangay and MSWDO cannot view eligible peer stock-drift detail", async () => {
  const conflict = {
    id: "peer-stock-drift",
    sync_transaction_id: "sync-1",
    user_id: "mayor-a",
    entity_type: "INVENTORY_TRANSACTION",
    entity_server_id: null,
    conflict_type: "INVENTORY_STOCK_STATE_DRIFT",
    local_payload_json: { payload: { quantity: 10 } },
    server_payload_json: { quantityAvailable: 4, stockVersion: 2 },
    resolution_strategy: "MANUAL_REVIEW",
    resolved_payload_json: null,
    resolved_by: null,
    resolved_at: null,
    status: "OPEN",
    sync_status: "CONFLICT",
    operation_type: "INVENTORY_ADJUSTMENT",
  };

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: {
        getSyncConflictById: async () => conflict,
      },
      [systemLogPath]: {
        logAuditSafely: async () => {},
        logErrorSafely: async () => {},
        pickDefined: () => ({}),
      },
      [systemLogRepositoryPath]: {
        insertAuditLog: async () => ({}),
      },
    },
    async ({ getSyncConflictDetail }) => {
      for (const roleCode of ["BARANGAY", "MSWDO"]) {
        await assert.rejects(
          () =>
            getSyncConflictDetail({
              auth: {
                userId: `${roleCode.toLowerCase()}-user`,
                roleCode,
              },
              conflictId: "peer-stock-drift",
            }),
          /Sync conflict not found/,
        );
      }
    },
  );
});

test("M04-02 KEEP_SERVER resolves stock drift without changing original sync status", async () => {
  const auditRows = [];
  const outboxEvents = [];
  const processedEvents = [];
  const baseConflict = {
    id: "conflict-stock-drift",
    sync_transaction_id: "sync-1",
    user_id: "origin-user",
    entity_type: "INVENTORY_TRANSACTION",
    entity_server_id: null,
    conflict_type: "INVENTORY_STOCK_STATE_DRIFT",
    local_payload_json: { payload: { quantity: 10 } },
    server_payload_json: { quantityAvailable: 4, stockVersion: 2 },
    resolution_strategy: "MANUAL_REVIEW",
    resolution_action: null,
    resolution_reason: null,
    resolved_payload_json: null,
    resolved_by: null,
    resolved_at: null,
    status: "OPEN",
    sync_status: "CONFLICT",
    operation_type: "INVENTORY_ADJUSTMENT",
  };

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: {
        withSyncProcessingTransaction: async (callback) => callback({}),
        lockSyncConflictById: async () => baseConflict,
        markSyncConflictResolved: async (payload) => ({
          ...baseConflict,
          status: "RESOLVED",
          resolution_action: payload.resolutionAction,
          resolution_reason: payload.resolutionReason,
          resolved_payload_json: payload.resolvedPayloadJson,
          resolved_by: payload.resolvedBy,
          resolved_at: "2026-08-09T05:00:00.000Z",
        }),
      },
      [notificationServicePath]: {
        ensureSyncNotificationIntent: async (payload) => {
          outboxEvents.push(payload);
          return { id: "outbox-resolution-1" };
        },
        processNotificationOutboxEventById: async (eventId) => {
          processedEvents.push(eventId);
        },
      },
      [systemLogPath]: {
        logAuditSafely: async () => {},
        logErrorSafely: async () => {},
        pickDefined: () => ({}),
      },
      [systemLogRepositoryPath]: {
        insertAuditLog: async (payload) => {
          auditRows.push(payload);
          return payload;
        },
      },
    },
    async ({ resolveSyncConflict }) => {
      const resolved = await resolveSyncConflict({
        auth: {
          userId: "mayor-1",
          roleCode: "MAYOR",
        },
        conflictId: "conflict-stock-drift",
        action: "KEEP_SERVER",
        reason: "Server inventory stock is authoritative.",
      });

      assert.equal(resolved.status, "RESOLVED");
      assert.equal(resolved.sync_status, "CONFLICT");
      assert.equal(resolved.resolution_action, "KEEP_SERVER");
      assert.equal(resolved.resolved_by, "mayor-1");
      assert.equal(resolved.user_id, "origin-user");
      assert.equal(outboxEvents[0].eventType, "SYNC_CONFLICT_RESOLVED");
      assert.deepEqual(processedEvents, ["outbox-resolution-1"]);
      assert.equal(auditRows[0].action, "SYNC_CONFLICT_RESOLUTION");
    },
  );
});

test("BRG-SC-04B APPLY_LOCAL remains rejected for eligible stock-drift conflict", async () => {
  const baseConflict = {
    id: "conflict-stock-drift",
    sync_transaction_id: "sync-1",
    user_id: "origin-user",
    entity_type: "INVENTORY_TRANSACTION",
    entity_server_id: null,
    conflict_type: "INVENTORY_STOCK_STATE_DRIFT",
    local_payload_json: { payload: { quantity: 10 } },
    server_payload_json: { quantityAvailable: 4, stockVersion: 2 },
    resolution_strategy: "MANUAL_REVIEW",
    resolution_action: null,
    resolution_reason: null,
    resolved_payload_json: null,
    resolved_by: null,
    resolved_at: null,
    status: "OPEN",
    sync_status: "CONFLICT",
    operation_type: "INVENTORY_ADJUSTMENT",
  };

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: {
        withSyncProcessingTransaction: async (callback) => callback({}),
        lockSyncConflictById: async () => baseConflict,
        markSyncConflictResolved: async () => {
          throw new Error("APPLY_LOCAL must not persist resolution");
        },
      },
      [systemLogPath]: {
        logAuditSafely: async () => {},
        logErrorSafely: async () => {},
        pickDefined: () => ({}),
      },
      [systemLogRepositoryPath]: {
        insertAuditLog: async () => ({}),
      },
    },
    async ({ resolveSyncConflict }) => {
      await assert.rejects(
        () =>
          resolveSyncConflict({
            auth: {
              userId: "mayor-2",
              roleCode: "MAYOR",
            },
            conflictId: "conflict-stock-drift",
            action: "APPLY_LOCAL",
            reason: "Force local",
          }),
        /not allowed/,
      );
    },
  );
});

test("M04-03 FIRST_ACCEPTED resolved conflicts expose no actions and cannot be resolved again", async () => {
  const firstAcceptedConflict = {
    id: "conflict-first-accepted",
    sync_transaction_id: "sync-1",
    user_id: "origin-user",
    entity_type: "STUB",
    entity_server_id: "stub-1",
    conflict_type: "STUB_ALREADY_CLAIMED",
    local_payload_json: {},
    server_payload_json: {},
    resolution_strategy: "FIRST_ACCEPTED",
    resolved_payload_json: { winner: "SERVER" },
    resolved_by: null,
    resolved_at: "2026-08-09T04:00:00.000Z",
    status: "RESOLVED",
    sync_status: "CONFLICT",
    operation_type: "CLAIM",
  };

  await withStubbedSyncService(
    {
      [syncRepositoryPath]: {
        getSyncConflictById: async () => firstAcceptedConflict,
        withSyncProcessingTransaction: async (callback) => callback({}),
        lockSyncConflictById: async () => firstAcceptedConflict,
      },
      [systemLogPath]: {
        logAuditSafely: async () => {},
        logErrorSafely: async () => {},
        pickDefined: () => ({}),
      },
      [systemLogRepositoryPath]: {
        insertAuditLog: async () => ({}),
      },
    },
    async ({ getSyncConflictDetail, resolveSyncConflict }) => {
      const detail = await getSyncConflictDetail({
        auth: {
          userId: "origin-user",
          roleCode: "BARANGAY",
        },
        conflictId: "conflict-first-accepted",
      });

      assert.deepEqual(detail.availableResolutionActions, []);

      await assert.rejects(
        () =>
          resolveSyncConflict({
            auth: {
              userId: "origin-user",
              roleCode: "BARANGAY",
            },
            conflictId: "conflict-first-accepted",
            action: "MARK_REVIEWED",
            reason: null,
          }),
        /already been resolved/,
      );
    },
  );
});
