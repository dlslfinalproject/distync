const test = require("node:test");
const assert = require("node:assert/strict");

const servicePath = require.resolve("../src/services/stub.service");
const masterlistRepositoryPath = require.resolve("../src/repositories/masterlist.repository");
const dbPath = require.resolve("../src/config/db");
const distributionTransactionRepositoryPath = require.resolve(
  "../src/repositories/distributionTransaction.repository",
);
const reliefPackTemplateRepositoryPath = require.resolve(
  "../src/repositories/reliefPackTemplate.repository",
);
const stubRepositoryPath = require.resolve("../src/repositories/stub.repository");
const mswdoReportExportPath = require.resolve("../src/utils/mswdoReportExport");
const automaticReliefPackClaimServicePath = require.resolve(
  "../src/services/automaticReliefPackClaim.service",
);
const reliefPackAssignmentServicePath = require.resolve(
  "../src/services/reliefPackAssignment.service",
);

const withStubbedStubService = async (stubs, runTest) => {
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

    const stubService = require(servicePath);
    await runTest(stubService);
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
      if (sql === "BEGIN" || sql === "ROLLBACK" || sql === "COMMIT") {
        events.push(sql);
      }

      return { rows: [] };
    },
    release: () => events.push("RELEASE"),
  }),
});

const baseBarangayId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const baseStub = {
  id: "22222222-2222-4222-8222-222222222222",
  disaster_event_id: "33333333-3333-4333-8333-333333333333",
  household_id: "44444444-4444-4444-8444-444444444444",
  stub_no: "STUB-001",
  serial_no: "SER-001",
  status: "CLAIMED",
  claimed_at: "2026-08-08T01:00:00.000Z",
  barangay_id: baseBarangayId,
};

const baseParams = {
  id: baseStub.id,
  user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  verified_by: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
};

const createBaseStubs = ({
  events = [],
  scopedStub = baseStub,
  lockedStub = scopedStub,
  claimHandler = null,
}) => ({
  [masterlistRepositoryPath]: {
    BARANGAY_ROLE_CODE: "BARANGAY",
    getBarangayUserScopeById: async () => ({
      role_code: "BARANGAY",
      default_barangay_id: baseBarangayId,
    }),
    getBarangaySummaryById: async () => ({
      id: baseBarangayId,
      is_active: true,
    }),
  },
  [dbPath]: createFakePool(events),
  [distributionTransactionRepositoryPath]: {
    getStubByIdForUpdate: async () => lockedStub,
  },
  [reliefPackTemplateRepositoryPath]: {},
  [stubRepositoryPath]: {
    getScopedStubById: async () => scopedStub,
    getLatestDistributionTransactionByStubId: async (stubId) => ({
      id: "55555555-5555-4555-8555-555555555555",
      stub_id: stubId,
      distribution_status: "CLAIMED",
      receipt_no: "RCPT-2026-000001",
      received_at: "2026-08-08T01:00:00.000Z",
    }),
  },
  [mswdoReportExportPath]: {},
  [automaticReliefPackClaimServicePath]: {
    recordAutomaticReliefPackClaim:
      claimHandler ||
      (async () => {
        throw new Error("claim handler should not run");
      }),
  },
  [reliefPackAssignmentServicePath]: {
    getAssignedReliefPackTemplatesForSectorIds: () => [],
  },
});

test("H05-07 claimBarangayStub emits STUB_ALREADY_CLAIMED only for claimed stubs", async () => {
  await withStubbedStubService(
    createBaseStubs({ scopedStub: baseStub }),
    async ({ claimBarangayStub }) => {
      await assert.rejects(
        () => claimBarangayStub(baseParams),
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
});

test("H05-08 claimBarangayStub keeps cancelled stubs as non-conflict validation errors", async () => {
  await withStubbedStubService(
    createBaseStubs({
      scopedStub: {
        ...baseStub,
        status: "CANCELLED",
      },
    }),
    async ({ claimBarangayStub }) => {
      await assert.rejects(
        () => claimBarangayStub(baseParams),
        (error) => {
          assert.equal(error.code, "STUB_NOT_CLAIMABLE");
          assert.equal(error.statusCode, 400);
          return true;
        },
      );
    },
  );
});

test("H05-10 claimBarangayStub normalizes only the known distribution stub unique violation", async () => {
  const events = [];

  await withStubbedStubService(
    createBaseStubs({
      events,
      scopedStub: {
        ...baseStub,
        status: "ISSUED",
      },
      lockedStub: {
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
    async ({ claimBarangayStub }) => {
      await assert.rejects(
        () => claimBarangayStub(baseParams),
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

test("H05-11 claimBarangayStub leaves unrelated unique violations technical", async () => {
  const events = [];

  await withStubbedStubService(
    createBaseStubs({
      events,
      scopedStub: {
        ...baseStub,
        status: "ISSUED",
      },
      lockedStub: {
        ...baseStub,
        status: "ISSUED",
      },
      claimHandler: async () => {
        const error = new Error("duplicate key value violates other unique constraint");
        error.code = "23505";
        error.constraint = "unrelated_unique_constraint";
        throw error;
      },
    }),
    async ({ claimBarangayStub }) => {
      await assert.rejects(
        () => claimBarangayStub(baseParams),
        (error) => {
          assert.equal(error.code, "23505");
          assert.equal(error.statusCode, undefined);
          return true;
        },
      );
    },
  );

  assert.deepEqual(events, ["BEGIN", "ROLLBACK", "RELEASE"]);
});
