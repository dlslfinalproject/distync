const test = require("node:test");
const assert = require("node:assert/strict");

const servicePath = require.resolve("../src/services/distributionTransaction.service");
const dbPath = require.resolve("../src/config/db");
const distributionTransactionRepositoryPath = require.resolve(
  "../src/repositories/distributionTransaction.repository",
);
const disasterEventRepositoryPath = require.resolve(
  "../src/repositories/disasterEvent.repository",
);
const reliefPackTemplateRepositoryPath = require.resolve(
  "../src/repositories/reliefPackTemplate.repository",
);
const notificationServicePath = require.resolve(
  "../src/modules/notifications/notification.service",
);
const stubRepositoryPath = require.resolve("../src/repositories/stub.repository");
const settingsRepositoryPath = require.resolve("../src/repositories/settings.repository");
const inventoryItemRepositoryPath = require.resolve(
  "../src/repositories/inventoryItem.repository",
);
const automaticReliefPackClaimServicePath = require.resolve(
  "../src/services/automaticReliefPackClaim.service",
);
const systemLogPath = require.resolve("../src/utils/systemLog");
const mswdoReportExportPath = require.resolve("../src/utils/mswdoReportExport");

const withStubbedDistributionService = async (stubs, runTest) => {
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

    const distributionTransactionService = require(servicePath);
    await runTest(distributionTransactionService);
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

const createFakePool = (events) => ({
  connect: async () => ({
    query: async (sql) => {
      if (typeof sql === "string" && sql === "BEGIN") {
        events.push("BEGIN");
      }

      if (typeof sql === "string" && sql === "ROLLBACK") {
        events.push("ROLLBACK");
      }

      if (typeof sql === "string" && sql === "COMMIT") {
        events.push("COMMIT");
      }

      return { rows: [] };
    },
    release: () => events.push("RELEASE"),
  }),
});

const baseStub = {
  id: "22222222-2222-4222-8222-222222222222",
  disaster_event_id: "33333333-3333-4333-8333-333333333333",
  household_id: "44444444-4444-4444-8444-444444444444",
  stub_no: "STUB-001",
  serial_no: "SER-001",
  status: "CLAIMED",
  claimed_at: "2026-08-08T01:00:00.000Z",
  barangay_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  qr_code_value: "DISTYNC-STUB|event|household|stub|STUB-001",
};

const baseRequest = {
  stub_id: baseStub.id,
  disaster_event_id: baseStub.disaster_event_id,
  household_id: baseStub.household_id,
  claimed_by_name: "Local Claimant",
  verified_by: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  requester: {
    userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    roleCode: "BARANGAY",
    defaultBarangayId: baseStub.barangay_id,
  },
};

const createBaseStubs = ({ events, stub = baseStub, claimHandler = null }) => ({
  [dbPath]: createFakePool(events),
  [distributionTransactionRepositoryPath]: {
    getStubByIdForUpdate: async () => stub,
  },
  [disasterEventRepositoryPath]: {},
  [reliefPackTemplateRepositoryPath]: {},
  [notificationServicePath]: {
    emitSafely: async () => {},
    emitDistributionUpdate: async () => {},
    emitBatchAlerts: async () => {},
  },
  [stubRepositoryPath]: {
    getLatestDistributionTransactionByStubId: async (stubId) => ({
      id: "55555555-5555-4555-8555-555555555555",
      stub_id: stubId,
      distribution_status: "CLAIMED",
      receipt_no: "RCPT-2026-000001",
      received_at: "2026-08-08T01:00:00.000Z",
    }),
  },
  [settingsRepositoryPath]: {},
  [inventoryItemRepositoryPath]: {},
  [automaticReliefPackClaimServicePath]: {
    recordAutomaticReliefPackClaim:
      claimHandler ||
      (async () => {
        throw new Error("claim handler should not run");
      }),
  },
  [systemLogPath]: {
    logAuditSafely: async () => {},
    pickDefined: (value, keys) =>
      Object.fromEntries(keys.map((key) => [key, value?.[key]]).filter(([, item]) => item !== undefined)),
  },
  [mswdoReportExportPath]: {},
});

test("H05-02 createDistributionTransaction emits STUB_ALREADY_CLAIMED for an accepted claimed stub", async () => {
  const events = [];

  await withStubbedDistributionService(
    createBaseStubs({ events }),
    async ({ createDistributionTransaction }) => {
      await assert.rejects(
        () => createDistributionTransaction(baseRequest),
        (error) => {
          assert.equal(error.code, "STUB_ALREADY_CLAIMED");
          assert.equal(error.statusCode, 409);
          assert.equal(error.entityServerId, baseStub.id);
          assert.equal(error.serverPayload.stub.status, "CLAIMED");
          return true;
        },
      );
    },
  );

  assert.deepEqual(events, ["BEGIN", "ROLLBACK", "RELEASE"]);
});

test("H05-03 claimDistributionTransactionFromQr emits STUB_ALREADY_CLAIMED for an accepted claimed stub", async () => {
  const events = [];

  await withStubbedDistributionService(
    createBaseStubs({ events }),
    async ({ claimDistributionTransactionFromQr }) => {
      await assert.rejects(
        () => claimDistributionTransactionFromQr(baseRequest),
        (error) => {
          assert.equal(error.code, "STUB_ALREADY_CLAIMED");
          assert.equal(error.statusCode, 409);
          assert.equal(error.serverPayload.distribution_transaction.id, "55555555-5555-4555-8555-555555555555");
          return true;
        },
      );
    },
  );

  assert.deepEqual(events, ["BEGIN", "ROLLBACK", "RELEASE"]);
});

test("H05-04 non-claimed invalid stub status remains a non-conflict validation error", async () => {
  const events = [];

  await withStubbedDistributionService(
    createBaseStubs({
      events,
      stub: {
        ...baseStub,
        status: "CANCELLED",
      },
    }),
    async ({ claimDistributionTransactionFromQr }) => {
      await assert.rejects(
        () => claimDistributionTransactionFromQr(baseRequest),
        (error) => {
          assert.equal(error.code, "STUB_NOT_CLAIMABLE");
          assert.equal(error.statusCode, 400);
          assert.equal(error.message, "Stub is not claimable");
          return true;
        },
      );
    },
  );

  assert.deepEqual(events, ["BEGIN", "ROLLBACK", "RELEASE"]);
});

test("H05-05 distribution stub unique violation is normalized only for the known stub uniqueness constraint", async () => {
  const events = [];

  await withStubbedDistributionService(
    createBaseStubs({
      events,
      stub: {
        ...baseStub,
        status: "ISSUED",
      },
      claimHandler: async () => {
        const error = new Error("duplicate key value violates unique constraint");
        error.code = "23505";
        error.constraint = "distribution_transactions_stub_id_key";
        throw error;
      },
    }),
    async ({ claimDistributionTransactionFromQr }) => {
      await assert.rejects(
        () => claimDistributionTransactionFromQr(baseRequest),
        (error) => {
          assert.equal(error.code, "STUB_ALREADY_CLAIMED");
          assert.equal(error.statusCode, 409);
          assert.doesNotMatch(error.message, /23505|constraint/i);
          return true;
        },
      );
    },
  );

  assert.deepEqual(events, ["BEGIN", "ROLLBACK", "RELEASE"]);
});

test("H05-06 unrelated unique violations remain technical errors", async () => {
  const events = [];

  await withStubbedDistributionService(
    createBaseStubs({
      events,
      stub: {
        ...baseStub,
        status: "ISSUED",
      },
      claimHandler: async () => {
        const error = new Error("duplicate key value violates other unique constraint");
        error.code = "23505";
        error.constraint = "inventory_item_stock_forms_unique_packaging";
        throw error;
      },
    }),
    async ({ claimDistributionTransactionFromQr }) => {
      await assert.rejects(
        () => claimDistributionTransactionFromQr(baseRequest),
        (error) => {
          assert.equal(error.code, "23505");
          assert.equal(error.statusCode, undefined);
          assert.match(error.message, /other unique constraint/);
          return true;
        },
      );
    },
  );

  assert.deepEqual(events, ["BEGIN", "ROLLBACK", "RELEASE"]);
});
