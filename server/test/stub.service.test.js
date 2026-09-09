const test = require("node:test");
const assert = require("node:assert/strict");

const servicePath = require.resolve("../src/services/stub.service");
const masterlistRepositoryPath = require.resolve("../src/repositories/masterlist.repository");
const disasterEventRepositoryPath = require.resolve(
  "../src/repositories/disasterEvent.repository",
);
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
  disaster_event_status: "ACTIVE",
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
  verificationStub = scopedStub,
  masterlistOverrides = {},
  disasterEventOverrides = {},
  reliefPackTemplateOverrides = {},
  automaticReliefPackClaimOverrides = {},
  stubRepositoryOverrides = {},
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
    getBarangayScopedDisasterEventById: async () => ({
      id: baseStub.disaster_event_id,
      disaster_type: "TYPHOON",
    }),
    ...masterlistOverrides,
  },
  [disasterEventRepositoryPath]: {
    getDisasterEventById: async () => ({
      id: baseStub.disaster_event_id,
      event_code: "EVENT-001",
      title: "Active Event",
      disaster_type: "TYPHOON",
      status: "ACTIVE",
    }),
    getAffectedBarangayScopeByDisasterEventId: async () => [],
    ...disasterEventOverrides,
  },
  [dbPath]: createFakePool(events),
  [distributionTransactionRepositoryPath]: {
    getStubByIdForUpdate: async () => lockedStub,
  },
  [reliefPackTemplateRepositoryPath]: {
    getReliefPackTemplates: async () => [],
    ...reliefPackTemplateOverrides,
  },
  [stubRepositoryPath]: {
    getScopedStubById: async () => scopedStub,
    getStubById: async () => scopedStub,
    getStubByQrCodeValue: async () => verificationStub,
    getStubByStubNoOrSerialNo: async () => verificationStub,
    getLatestDistributionTransactionByStubId: async (stubId) => ({
      id: "55555555-5555-4555-8555-555555555555",
      stub_id: stubId,
      distribution_status: "CLAIMED",
      receipt_no: "RCPT-2026-000001",
      received_at: "2026-08-08T01:00:00.000Z",
    }),
    getLatestAttendanceByHouseholdId: async () => null,
    getStubDashboardMetrics: async () => ({
      total_issued_stubs: 1,
      claimed_stubs: 0,
      unclaimed_stubs: 1,
      beneficiary_families: 1,
    }),
    getBarangayStubDashboardRows: async () => [],
    getHouseholdSectorsByHouseholdIds: async () => [],
    getMemberSectorsByHouseholdIds: async () => [],
    ...stubRepositoryOverrides,
  },
  [mswdoReportExportPath]: {},
  [automaticReliefPackClaimServicePath]: {
    getAvailableDonatedReliefPacksForClaimPreview: async () => [],
    getAvailableDonatedLooseItemsForClaimPreview: async () => [],
    recordAutomaticReliefPackClaim:
      claimHandler ||
      (async () => {
        throw new Error("claim handler should not run");
      }),
    ...automaticReliefPackClaimOverrides,
  },
  [reliefPackAssignmentServicePath]: {
    getAssignedReliefPackTemplatesForSectorIds: () => [],
  },
});

test("Barangay stub search stays locked to the requester's assigned barangay", async () => {
  let searchArguments = null;

  await withStubbedStubService(
    createBaseStubs({
      stubRepositoryOverrides: {
        getStubSearchResults: async (...args) => {
          searchArguments = args;
          return [];
        },
      },
    }),
    async ({ getSearchResults }) => {
      await getSearchResults(
        {
          q: "STUB-001",
          disaster_event_id: baseStub.disaster_event_id,
          barangay_id: "foreign-barangay",
        },
        {
          roleCode: "BARANGAY",
          defaultBarangayId: baseBarangayId,
        },
      );
    },
  );

  assert.equal(searchArguments[2], baseBarangayId);
});

test("Barangay stub details reject a record from another barangay", async () => {
  await withStubbedStubService(
    createBaseStubs({
      stubRepositoryOverrides: {
        getStubById: async () => ({
          ...baseStub,
          barangay_id: "foreign-barangay",
        }),
      },
    }),
    async ({ getStubDetails }) => {
      await assert.rejects(
        () =>
          getStubDetails(baseStub.id, {
            roleCode: "BARANGAY",
            defaultBarangayId: baseBarangayId,
          }),
        (error) => {
          assert.equal(error.statusCode, 403);
          assert.equal(error.code, "BARANGAY_SCOPE_FORBIDDEN");
          return true;
        },
      );
    },
  );
});

test("Barangay QR verification rejects a stub from another barangay", async () => {
  await withStubbedStubService(
    createBaseStubs({
      verificationStub: buildIssuedVerificationStub({
        barangay_id: "foreign-barangay",
      }),
    }),
    async ({ verifyStub }) => {
      await assert.rejects(
        () =>
          verifyStub({
            qr_code_value: "DISTYNC-STUB|test",
            requester: {
              roleCode: "BARANGAY",
              defaultBarangayId: baseBarangayId,
            },
          }),
        (error) => {
          assert.equal(error.statusCode, 403);
          assert.equal(error.code, "BARANGAY_SCOPE_FORBIDDEN");
          return true;
        },
      );
    },
  );
});

const withNodeEnv = async (nodeEnv, runTest) => {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;

  try {
    await runTest();
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
  }
};

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

test("DEPLOY-BRG-RGD-OFFLINE-QR claimBarangayStub rejects a cached stub from another disaster event before claiming", async () => {
  const events = [];
  let claimHandlerCalled = false;

  await withStubbedStubService(
    createBaseStubs({
      events,
      scopedStub: {
        ...baseStub,
        status: "ISSUED",
      },
      claimHandler: async () => {
        claimHandlerCalled = true;
      },
    }),
    async ({ claimBarangayStub }) => {
      await assert.rejects(
        () =>
          claimBarangayStub({
            ...baseParams,
            disaster_event_id: "55555555-5555-4555-8555-555555555555",
          }),
        (error) => {
          assert.equal(error.code, "WRONG_EVENT");
          assert.equal(error.statusCode, 400);
          assert.equal(
            error.message,
            "This stub belongs to a different disaster event. Select the correct event before scanning.",
          );
          return true;
        },
      );
    },
  );

  assert.equal(claimHandlerCalled, false);
  assert.deepEqual(events, []);
});

test("H05-09 claimBarangayStub blocks archived households before any claim processing", async () => {
  await withStubbedStubService(
    createBaseStubs({
      scopedStub: {
        ...baseStub,
        status: "ISSUED",
        is_active: false,
      },
    }),
    async ({ claimBarangayStub }) => {
      await assert.rejects(
        () => claimBarangayStub(baseParams),
        (error) => {
          assert.equal(error.code, "HOUSEHOLD_ARCHIVED");
          assert.equal(error.statusCode, 400);
          assert.equal(
            error.message,
            "This household is archived and cannot receive a new relief distribution.",
          );
          return true;
        },
      );
    },
  );
});

for (const constraint of [
  "uq_distribution_stub",
  "distribution_transactions_stub_id_key",
]) {
  test(`H05-10 claimBarangayStub normalizes ${constraint}`, async () => {
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
          error.constraint = constraint;
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
}

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

test("H05-12 verifyStub marks archived households as not claimable", async () => {
  await withStubbedStubService(
    createBaseStubs({
      verificationStub: {
        ...baseStub,
        status: "ISSUED",
        qr_code_value: "DISTYNC-STUB|test",
        is_active: false,
      },
    }),
    async ({ verifyStub }) => {
      const result = await verifyStub({
        qr_code_value: "DISTYNC-STUB|test",
      });

      assert.equal(result.data.is_claimable, false);
      assert.equal(result.data.code, "HOUSEHOLD_ARCHIVED");
      assert.equal(
        result.message,
        "This household is archived and cannot receive a new relief distribution.",
      );
    },
  );
});

const buildIssuedVerificationStub = (overrides = {}) => ({
  ...baseStub,
  status: "ISSUED",
  qr_code_value: "DISTYNC-STUB|test",
  disaster_event_status: "ACTIVE",
  current_stay_type: "EVAC_CENTER",
  is_active: true,
  ...overrides,
});

test("verifyStub makes an issued stub unclaimable after departure and claimable after return", async () => {
  let latestAttendance = {
    status: "LEFT",
    time_in: "2026-08-28T08:00:00.000Z",
    time_out: "2026-08-28T12:00:00.000Z",
  };

  await withStubbedStubService(
    createBaseStubs({
      verificationStub: buildIssuedVerificationStub(),
      stubRepositoryOverrides: {
        getLatestAttendanceByHouseholdId: async () => latestAttendance,
      },
    }),
    async ({ verifyStub }) => {
      const afterDeparture = await verifyStub({
        qr_code_value: "DISTYNC-STUB|test",
      });

      assert.equal(afterDeparture.data.is_claimable, false);
      assert.equal(
        afterDeparture.data.code,
        "HOUSEHOLD_NOT_PRESENT_IN_EVAC_CENTER",
      );

      latestAttendance = {
        status: "PRESENT",
        time_in: "2026-08-28T15:00:00.000Z",
        time_out: null,
      };

      const afterReturn = await verifyStub({
        qr_code_value: "DISTYNC-STUB|test",
      });

      assert.equal(afterReturn.data.is_claimable, true);
      assert.equal(afterReturn.data.code, null);
    },
  );
});

test("verifyStub keeps a claimed stub permanently unclaimable", async () => {
  let attendanceLookupCalled = false;

  await withStubbedStubService(
    createBaseStubs({
      verificationStub: {
        ...buildIssuedVerificationStub(),
        status: "CLAIMED",
      },
      stubRepositoryOverrides: {
        getLatestAttendanceByHouseholdId: async () => {
          attendanceLookupCalled = true;
          return {
            status: "PRESENT",
            time_in: "2026-08-28T15:00:00.000Z",
            time_out: null,
          };
        },
      },
    }),
    async ({ verifyStub }) => {
      const result = await verifyStub({
        qr_code_value: "DISTYNC-STUB|test",
      });

      assert.equal(result.data.is_claimable, false);
      assert.equal(result.data.code, "STUB_ALREADY_CLAIMED");
    },
  );

  assert.equal(attendanceLookupCalled, false);
});

test("EE-FIX-03 claimBarangayStub blocks new claims when the event is not ACTIVE", async () => {
  for (const disasterEventStatus of ["PLANNED", "CLOSED"]) {
    const events = [];
    let claimHandlerCalled = false;

    await withStubbedStubService(
      createBaseStubs({
        events,
        scopedStub: {
          ...baseStub,
          status: "ISSUED",
          disaster_event_status: "ACTIVE",
        },
        lockedStub: {
          ...baseStub,
          status: "ISSUED",
          disaster_event_status: disasterEventStatus,
        },
        claimHandler: async () => {
          claimHandlerCalled = true;
          throw new Error("claim handler should not run for inactive events");
        },
      }),
      async ({ claimBarangayStub }) => {
        await assert.rejects(
          () => claimBarangayStub(baseParams),
          (error) => {
            assert.equal(error.code, "DISASTER_EVENT_NOT_ACTIVE");
            assert.equal(error.statusCode, 400);
            assert.equal(error.entityServerId, baseStub.id);
            return true;
          },
        );
      },
    );

    assert.equal(claimHandlerCalled, false);
    assert.deepEqual(events, ["BEGIN", "ROLLBACK", "RELEASE"]);
  }
});

test("EE-FIX-03 claimBarangayStub allows ACTIVE event claims to reach domain mutation", async () => {
  const events = [];
  let claimHandlerCalled = false;

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
        disaster_event_status: "ACTIVE",
      },
      claimHandler: async () => {
        claimHandlerCalled = true;
        return {
          distributionTransaction: {
            id: "66666666-6666-4666-8666-666666666666",
            distribution_status: "CLAIMED",
          },
          updatedStub: {
            ...baseStub,
            status: "CLAIMED",
            updated_at: "2026-08-10T01:00:00.000Z",
          },
          packQuantity: 1,
          donatedReliefPacks: [],
          donatedLooseItems: [],
        };
      },
    }),
    async ({ claimBarangayStub }) => {
      const result = await claimBarangayStub(baseParams);

      assert.equal(result.data.status, "CLAIMED");
      assert.equal(
        result.data.distribution_transaction_id,
        "66666666-6666-4666-8666-666666666666",
      );
    },
  );

  assert.equal(claimHandlerCalled, true);
  assert.deepEqual(events, ["BEGIN", "COMMIT", "RELEASE"]);
});

test("DEPLOY-MSWDO-RGD-01 production MSWDO dashboard accepts barangay_id without override", async () => {
  await withNodeEnv("production", async () => {
    const selectedBarangayId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const rows = [];
    const dashboardCalls = [];

    await withStubbedStubService(
      createBaseStubs({
        masterlistOverrides: {
          getBarangayUserScopeById: async () => {
            throw new Error("MSWDO barangay_id must not require user scope");
          },
          getBarangaySummaryById: async (barangayId) => ({
            id: barangayId,
            code: "BRGY",
            name: "Selected Barangay",
            is_active: true,
          }),
          getBarangayScopedDisasterEventById: async (eventId, barangayId) => {
            dashboardCalls.push({ eventId, barangayId });
            return {
              id: eventId,
              disaster_type: "TYPHOON",
            };
          },
        },
        stubRepositoryOverrides: {
          getStubDashboardMetrics: async (eventId, barangayId) => ({
            eventId,
            barangayId,
            total_issued_stubs: 0,
            claimed_stubs: 0,
            unclaimed_stubs: 0,
            beneficiary_families: 0,
          }),
          getBarangayStubDashboardRows: async () => rows,
        },
      }),
      async ({ getBarangayStubDashboard }) => {
        const result = await getBarangayStubDashboard({
          disaster_event_id: baseStub.disaster_event_id,
          barangay_id: selectedBarangayId,
          override_barangay_id: null,
          user_id: null,
          qr_generated_by: "mswdo-user",
        });

        assert.equal(result.assigned_barangay.id, selectedBarangayId);
        assert.equal(result.assigned_barangay_id, null);
        assert.equal(result.is_dev_override, false);
        assert.equal(result.data.length, 0);
      },
    );

    assert.deepEqual(dashboardCalls, [
      {
        eventId: baseStub.disaster_event_id,
        barangayId: selectedBarangayId,
      },
    ]);
  });
});

test("DEPLOY-MSWDO-RGD-01 production override remains rejected", async () => {
  await withNodeEnv("production", async () => {
    await withStubbedStubService(
      createBaseStubs({
        masterlistOverrides: {
          getBarangayUserScopeById: async () => null,
        },
      }),
      async ({ getBarangayStubDashboard }) => {
        await assert.rejects(
          () =>
            getBarangayStubDashboard({
              disaster_event_id: baseStub.disaster_event_id,
              user_id: null,
              barangay_id: null,
              override_barangay_id: baseBarangayId,
              qr_generated_by: "mswdo-user",
            }),
          (error) => {
            assert.equal(error.code, "BARANGAY_OVERRIDE_NOT_ALLOWED");
            assert.equal(error.statusCode, 403);
            return true;
          },
        );
      },
    );
  });
});

test("DEPLOY-MSWDO-RGD-01 production override remains rejected even with barangay_id", async () => {
  await withNodeEnv("production", async () => {
    await withStubbedStubService(
      createBaseStubs({
        masterlistOverrides: {
          getBarangayUserScopeById: async () => null,
        },
      }),
      async ({ getBarangayStubDashboard }) => {
        await assert.rejects(
          () =>
            getBarangayStubDashboard({
              disaster_event_id: baseStub.disaster_event_id,
              user_id: null,
              barangay_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
              override_barangay_id: baseBarangayId,
              qr_generated_by: "mswdo-user",
            }),
          (error) => {
            assert.equal(error.code, "BARANGAY_OVERRIDE_NOT_ALLOWED");
            assert.equal(error.statusCode, 403);
            return true;
          },
        );
      },
    );
  });
});

test("DEPLOY-MSWDO-RGD-01 nonexistent barangay_id is rejected before fallback", async () => {
  await withStubbedStubService(
    createBaseStubs({
      masterlistOverrides: {
        getBarangaySummaryById: async () => null,
      },
    }),
    async ({ getBarangayStubDashboard }) => {
      await assert.rejects(
        () =>
          getBarangayStubDashboard({
            disaster_event_id: baseStub.disaster_event_id,
            user_id: null,
            barangay_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            override_barangay_id: null,
          }),
        (error) => {
          assert.equal(error.code, "INVALID_BARANGAY");
          assert.equal(error.statusCode, 400);
          return true;
        },
      );
    },
  );
});

test("DEPLOY-MSWDO-RGD-01 event and barangay mismatch preserves NO_STUB_EVENT_DATA", async () => {
  await withStubbedStubService(
    createBaseStubs({
      masterlistOverrides: {
        getBarangaySummaryById: async (barangayId) => ({
          id: barangayId,
          is_active: true,
        }),
        getBarangayScopedDisasterEventById: async () => null,
      },
    }),
    async ({ getBarangayStubDashboard }) => {
      await assert.rejects(
        () =>
          getBarangayStubDashboard({
            disaster_event_id: baseStub.disaster_event_id,
            user_id: null,
            barangay_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            override_barangay_id: null,
          }),
        (error) => {
          assert.equal(error.code, "NO_STUB_EVENT_DATA");
          assert.equal(error.statusCode, 404);
          return true;
        },
      );
    },
  );
});

test("DEPLOY-MSWDO-RGD-01 Barangay user scope takes precedence over crafted barangay_id", async () => {
  const assignedBarangayId = baseBarangayId;
  const craftedBarangayId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const seenBarangayIds = [];

  await withStubbedStubService(
    createBaseStubs({
      masterlistOverrides: {
        getBarangaySummaryById: async (barangayId) => {
          seenBarangayIds.push(barangayId);
          return {
            id: barangayId,
            code: "BRGY",
            name: "Scoped Barangay",
            is_active: true,
          };
        },
        getBarangayScopedDisasterEventById: async (_eventId, barangayId) => {
          assert.equal(barangayId, assignedBarangayId);
          return {
            id: baseStub.disaster_event_id,
            disaster_type: "TYPHOON",
          };
        },
      },
    }),
    async ({ getBarangayStubDashboard }) => {
      const result = await getBarangayStubDashboard({
        disaster_event_id: baseStub.disaster_event_id,
        user_id: baseParams.user_id,
        barangay_id: craftedBarangayId,
        override_barangay_id: craftedBarangayId,
      });

      assert.equal(result.assigned_barangay.id, assignedBarangayId);
      assert.equal(result.assigned_barangay_id, assignedBarangayId);
    },
  );

  assert.deepEqual(seenBarangayIds, [assignedBarangayId]);
});

test("DEPLOY-MSWDO-RGD-01 production MSWDO claim resolves barangay_id and reaches claim logic", async () => {
  await withNodeEnv("production", async () => {
    const selectedBarangayId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const events = [];
    let scopedLookupBarangayId = null;
    let lockedLookupCalled = false;
    let claimHandlerCalled = false;

    await withStubbedStubService(
      createBaseStubs({
        events,
        scopedStub: {
          ...baseStub,
          status: "ISSUED",
          barangay_id: selectedBarangayId,
        },
        lockedStub: {
          ...baseStub,
          status: "ISSUED",
          barangay_id: selectedBarangayId,
        },
        masterlistOverrides: {
          getBarangaySummaryById: async (barangayId) => ({
            id: barangayId,
            is_active: true,
          }),
        },
        stubRepositoryOverrides: {
          getScopedStubById: async (_stubId, barangayId) => {
            scopedLookupBarangayId = barangayId;
            return {
              ...baseStub,
              status: "ISSUED",
              barangay_id: selectedBarangayId,
            };
          },
        },
        claimHandler: async () => {
          claimHandlerCalled = true;
          return {
            distributionTransaction: {
              id: "66666666-6666-4666-8666-666666666666",
              distribution_status: "CLAIMED",
            },
            updatedStub: {
              ...baseStub,
              id: baseStub.id,
              status: "CLAIMED",
              claimed_at: "2026-08-10T01:00:00.000Z",
              updated_at: "2026-08-10T01:00:00.000Z",
            },
            packQuantity: 1,
            donatedReliefPacks: [],
            donatedLooseItems: [],
          };
        },
      }),
      async ({ claimBarangayStub }) => {
        const result = await claimBarangayStub({
          id: baseStub.id,
          user_id: null,
          barangay_id: selectedBarangayId,
          override_barangay_id: null,
          verified_by: "mswdo-user",
        });

        lockedLookupCalled = true;
        assert.equal(result.data.status, "CLAIMED");
        assert.equal(scopedLookupBarangayId, selectedBarangayId);
      },
    );

    assert.equal(lockedLookupCalled, true);
    assert.equal(claimHandlerCalled, true);
    assert.deepEqual(events, ["BEGIN", "COMMIT", "RELEASE"]);
  });
});

test("DEPLOY-MSWDO-RGD-01 cross-barangay claim remains rejected", async () => {
  const selectedBarangayId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

  await withStubbedStubService(
    createBaseStubs({
      scopedStub: null,
      masterlistOverrides: {
        getBarangaySummaryById: async (barangayId) => ({
          id: barangayId,
          is_active: true,
        }),
      },
    }),
    async ({ claimBarangayStub }) => {
      await assert.rejects(
        () =>
          claimBarangayStub({
            id: baseStub.id,
            user_id: null,
            barangay_id: selectedBarangayId,
            override_barangay_id: null,
            verified_by: "mswdo-user",
          }),
        (error) => {
          assert.equal(error.code, "STUB_NOT_FOUND");
          assert.equal(error.statusCode, 404);
          return true;
        },
      );
    },
  );
});

const buildMunicipalDashboardRow = ({
  id,
  householdId,
  barangayId,
  barangayName,
  status = "CLAIMED",
}) => ({
  id,
  disaster_event_id: baseStub.disaster_event_id,
  household_id: householdId,
  stub_no: `STUB-${id}`,
  serial_no: `SER-${id}`,
  status,
  issued_at: "2026-08-08T00:00:00.000Z",
  claimed_at: status === "CLAIMED" ? "2026-08-08T01:00:00.000Z" : null,
  qr_code_value: `DISTYNC-STUB|${id}`,
  qr_generated_at: "2026-08-08T00:00:00.000Z",
  qr_generated_by: "seed-user",
  qr_status: "ACTIVE",
  qr_notes: null,
  assigned_relief_pack_snapshots: [],
  is_active: true,
  barangay_id: barangayId,
  barangay_name: barangayName,
  family_head_first_name: "Family",
  family_head_last_name: id,
  household_size: 2,
  family_head_photo_url: null,
  photo_captured_at: null,
  photo_verification_notes: null,
  queue_time_in: "2026-08-08T00:00:00.000Z",
  latest_attendance_status: "PRESENT",
  latest_attendance_time_out: null,
  distribution_date: status === "CLAIMED" ? "2026-08-08T01:00:00.000Z" : null,
  received_at: status === "CLAIMED" ? "2026-08-08T01:00:00.000Z" : null,
  receipt_no: status === "CLAIMED" ? `RCPT-${id}` : null,
  verified_by_name: status === "CLAIMED" ? "Verifier" : null,
  unclaimed_queue_position: null,
  members_count: 2,
  stub_sequence_no: 1,
});

test("Stage 5 municipal service uses one set-wise context and returns the complete municipal contract", async () => {
  const eventId = baseStub.disaster_event_id;
  const affectedBarangays = [
    {
      mapped_barangay_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      code: "BRGY-B",
      name: "Zulu",
      is_active: true,
    },
    {
      mapped_barangay_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      code: "BRGY-A",
      name: "Alpha",
      is_active: true,
    },
    {
      mapped_barangay_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      code: "BRGY-C",
      name: "Zulu",
      is_active: true,
    },
  ];
  const rows = [
    buildMunicipalDashboardRow({
      id: "stub-a",
      householdId: "household-a",
      barangayId: affectedBarangays[1].id,
      barangayName: affectedBarangays[1].name,
    }),
    buildMunicipalDashboardRow({
      id: "stub-b",
      householdId: "household-b",
      barangayId: affectedBarangays[0].id,
      barangayName: affectedBarangays[0].name,
    }),
    buildMunicipalDashboardRow({
      id: "stub-c",
      householdId: "household-a",
      barangayId: affectedBarangays[2].id,
      barangayName: affectedBarangays[2].name,
    }),
  ];
  const calls = {
    event: 0,
    scope: 0,
    rows: 0,
    householdSectors: 0,
    memberSectors: 0,
    templates: 0,
  };

  await withStubbedStubService(
    createBaseStubs({
      disasterEventOverrides: {
        getDisasterEventById: async (requestedEventId) => {
          calls.event += 1;
          assert.equal(requestedEventId, eventId);
          return {
            id: eventId,
            event_code: "EVENT-001",
            title: "Active Event",
            disaster_type: "TYPHOON",
            status: "ACTIVE",
          };
        },
        getAffectedBarangayScopeByDisasterEventId: async (requestedEventId) => {
          calls.scope += 1;
          assert.equal(requestedEventId, eventId);
          return affectedBarangays;
        },
      },
      stubRepositoryOverrides: {
        getMunicipalStubDashboardRows: async (requestedEventId, barangayIds) => {
          calls.rows += 1;
          assert.equal(requestedEventId, eventId);
          assert.deepEqual(barangayIds, [affectedBarangays[1].id, affectedBarangays[0].id, affectedBarangays[2].id]);
          return rows;
        },
        getHouseholdSectorsByHouseholdIds: async (householdIds) => {
          calls.householdSectors += 1;
          assert.deepEqual(householdIds.sort(), ["household-a", "household-b"]);
          return [];
        },
        getMemberSectorsByHouseholdIds: async (householdIds) => {
          calls.memberSectors += 1;
          assert.deepEqual(householdIds.sort(), ["household-a", "household-b"]);
          return [];
        },
      },
      reliefPackTemplateOverrides: {
        getReliefPackTemplates: async () => {
          calls.templates += 1;
          return [];
        },
      },
    }),
    async ({ getMunicipalStubDashboard }) => {
      const result = await getMunicipalStubDashboard({
        disaster_event_id: eventId,
        requester: { roleCode: "MAYOR", userId: "mayor-user" },
        qr_generated_by: "mayor-user",
      });

      assert.equal(result.scope, "municipal");
      assert.deepEqual(result.barangay_ids, [
        affectedBarangays[1].id,
        affectedBarangays[0].id,
        affectedBarangays[2].id,
      ]);
      assert.equal(result.barangay_count, 3);
      assert.equal(result.count, rows.length);
      assert.equal(result.data.length, rows.length);
      assert.deepEqual(
        result.data.map((row) => row.id),
        rows.map((row) => row.id),
      );
      assert.deepEqual(
        result.data.map((row) => [row.barangay_id, row.barangay_name]),
        rows.map((row) => [row.barangay_id, row.barangay_name]),
      );
      assert.equal("metrics" in result, false);
      assert.equal("assigned_barangay" in result, false);
      assert.equal("pagination" in result, false);
    },
  );

  assert.deepEqual(calls, {
    event: 1,
    scope: 1,
    rows: 1,
    householdSectors: 1,
    memberSectors: 1,
    templates: 1,
  });
});

test("Stage 5 municipal service returns an authoritative empty success without the dataset query", async () => {
  let datasetQueryCalled = false;

  await withStubbedStubService(
    createBaseStubs({
      disasterEventOverrides: {
        getAffectedBarangayScopeByDisasterEventId: async () => [],
      },
      stubRepositoryOverrides: {
        getMunicipalStubDashboardRows: async () => {
          datasetQueryCalled = true;
          return [];
        },
      },
    }),
    async ({ getMunicipalStubDashboard }) => {
      const result = await getMunicipalStubDashboard({
        disaster_event_id: baseStub.disaster_event_id,
        requester: { roleCode: "MAYOR" },
      });

      assert.deepEqual(result.barangay_ids, []);
      assert.equal(result.barangay_count, 0);
      assert.equal(result.count, 0);
      assert.deepEqual(result.data, []);
    },
  );

  assert.equal(datasetQueryCalled, false);
});

test("Stage 5 municipal service fails closed for non-Mayors, inactive events, and invalid affected mappings", async () => {
  await withStubbedStubService(
    createBaseStubs({
      disasterEventOverrides: {
        getAffectedBarangayScopeByDisasterEventId: async () => [
          {
            mapped_barangay_id: baseBarangayId,
            id: baseBarangayId,
            name: "Inactive",
            is_active: false,
          },
        ],
      },
    }),
    async ({ getMunicipalStubDashboard }) => {
      await assert.rejects(
        () =>
          getMunicipalStubDashboard({
            disaster_event_id: baseStub.disaster_event_id,
            requester: { roleCode: "MSWDO" },
          }),
        (error) => {
          assert.equal(error.statusCode, 403);
          assert.equal(error.code, "MUNICIPAL_STUB_FORBIDDEN");
          return true;
        },
      );
      await assert.rejects(
        () =>
          getMunicipalStubDashboard({
            disaster_event_id: baseStub.disaster_event_id,
            requester: { roleCode: "MAYOR" },
          }),
        (error) => {
          assert.equal(error.statusCode, 409);
          assert.equal(error.code, "INVALID_EVENT_BARANGAY_SCOPE");
          return true;
        },
      );
    },
  );

  await withStubbedStubService(
    createBaseStubs({
      disasterEventOverrides: {
        getDisasterEventById: async () => ({
          id: baseStub.disaster_event_id,
          status: "CLOSED",
        }),
      },
    }),
    async ({ getMunicipalStubDashboard }) => {
      await assert.rejects(
        () =>
          getMunicipalStubDashboard({
            disaster_event_id: baseStub.disaster_event_id,
            requester: { roleCode: "MAYOR" },
          }),
        (error) => {
          assert.equal(error.statusCode, 400);
          assert.equal(error.code, "DISASTER_EVENT_NOT_ACTIVE");
          return true;
        },
      );
    },
  );
});

test("Stage 5 municipal service query categories stay bounded for K=1, K=3, and K=5", async () => {
  for (const barangayCount of [1, 3, 5]) {
    const calls = {
      event: 0,
      scope: 0,
      rows: 0,
      householdSectors: 0,
      memberSectors: 0,
      templates: 0,
    };
    const affectedBarangays = Array.from(
      { length: barangayCount },
      (_value, index) => ({
        mapped_barangay_id: `barangay-${index + 1}`,
        id: `barangay-${index + 1}`,
        name: `Barangay ${index + 1}`,
        is_active: true,
      }),
    );

    await withStubbedStubService(
      createBaseStubs({
        disasterEventOverrides: {
          getDisasterEventById: async () => {
            calls.event += 1;
            return {
              id: baseStub.disaster_event_id,
              disaster_type: "TYPHOON",
              status: "ACTIVE",
            };
          },
          getAffectedBarangayScopeByDisasterEventId: async () => {
            calls.scope += 1;
            return affectedBarangays;
          },
        },
        reliefPackTemplateOverrides: {
          getReliefPackTemplates: async () => {
            calls.templates += 1;
            return [];
          },
        },
        stubRepositoryOverrides: {
          getMunicipalStubDashboardRows: async () => {
            calls.rows += 1;
            return [];
          },
          getHouseholdSectorsByHouseholdIds: async () => {
            calls.householdSectors += 1;
            return [];
          },
          getMemberSectorsByHouseholdIds: async () => {
            calls.memberSectors += 1;
            return [];
          },
        },
      }),
      async ({ getMunicipalStubDashboard }) => {
        const result = await getMunicipalStubDashboard({
          disaster_event_id: baseStub.disaster_event_id,
          requester: { roleCode: "MAYOR" },
        });

        assert.equal(result.barangay_count, barangayCount);
        assert.equal(result.count, 0);
        assert.deepEqual(result.data, []);
      },
    );

    assert.deepEqual(calls, {
      event: 1,
      scope: 1,
      rows: 1,
      householdSectors: 1,
      memberSectors: 1,
      templates: 1,
    });
  }
});

test("Stage 5 municipal service coalesces identical donor preview contexts", async () => {
  const previewRows = [
    {
      ...buildMunicipalDashboardRow({
        id: "stub-preview-a",
        householdId: "household-preview-a",
        barangayId: baseBarangayId,
        barangayName: "Barangay Preview",
        status: "ISSUED",
      }),
      unclaimed_queue_position: 1,
    },
    {
      ...buildMunicipalDashboardRow({
        id: "stub-preview-b",
        householdId: "household-preview-b",
        barangayId: baseBarangayId,
        barangayName: "Barangay Preview",
        status: "ISSUED",
      }),
      unclaimed_queue_position: 1,
    },
  ];
  let donatedReliefPackPreviewCalls = 0;

  await withStubbedStubService(
    createBaseStubs({
      disasterEventOverrides: {
        getAffectedBarangayScopeByDisasterEventId: async () => [
          {
            mapped_barangay_id: baseBarangayId,
            id: baseBarangayId,
            name: "Barangay Preview",
            is_active: true,
          },
        ],
      },
      stubRepositoryOverrides: {
        getMunicipalStubDashboardRows: async () => previewRows,
      },
      automaticReliefPackClaimOverrides: {
        getAvailableDonatedReliefPacksForClaimPreview: async (
          eventId,
          queuePosition,
        ) => {
          donatedReliefPackPreviewCalls += 1;
          assert.equal(eventId, baseStub.disaster_event_id);
          assert.equal(queuePosition, 1);
          return [{ donation_id: "donation-1", name: "Donated Pack" }];
        },
      },
    }),
    async ({ getMunicipalStubDashboard }) => {
      const result = await getMunicipalStubDashboard({
        disaster_event_id: baseStub.disaster_event_id,
        requester: { roleCode: "MAYOR" },
      });

      assert.equal(result.data.length, 2);
      assert.equal(result.data[0].available_donated_relief_packs.length, 1);
      assert.deepEqual(result.data[1].available_donated_loose_items, []);
    },
  );

  assert.equal(donatedReliefPackPreviewCalls, 1);
});

test("Stage 5 municipal service preserves existing QR metadata and backfills each missing row once", async () => {
  const existingRow = buildMunicipalDashboardRow({
    id: "stub-existing-qr",
    householdId: "household-existing-qr",
    barangayId: baseBarangayId,
    barangayName: "Barangay QR",
  });
  const missingRow = {
    ...buildMunicipalDashboardRow({
      id: "stub-missing-qr",
      householdId: "household-missing-qr",
      barangayId: baseBarangayId,
      barangayName: "Barangay QR",
    }),
    qr_code_value: null,
    qr_generated_at: null,
    qr_generated_by: null,
    qr_status: null,
  };
  const updates = [];

  await withStubbedStubService(
    createBaseStubs({
      disasterEventOverrides: {
        getAffectedBarangayScopeByDisasterEventId: async () => [
          {
            mapped_barangay_id: baseBarangayId,
            id: baseBarangayId,
            name: "Barangay QR",
            is_active: true,
          },
        ],
      },
      stubRepositoryOverrides: {
        getMunicipalStubDashboardRows: async () => [existingRow, missingRow],
        updateStubQrMetadata: async (stubId, metadata) => {
          updates.push({ stubId, metadata });
          return {
            qr_code_value: metadata.qr_code_value,
            qr_generated_at: metadata.qr_generated_at,
            qr_generated_by: metadata.qr_generated_by,
            qr_status: metadata.qr_status,
            qr_notes: metadata.qr_notes,
          };
        },
      },
    }),
    async ({ getMunicipalStubDashboard }) => {
      const result = await getMunicipalStubDashboard({
        disaster_event_id: baseStub.disaster_event_id,
        requester: { roleCode: "MAYOR", userId: "mayor-user" },
        qr_generated_by: "mayor-user",
      });

      assert.equal(result.data[0].qr_code_value, existingRow.qr_code_value);
      assert.equal(result.data[1].qr_status, "ACTIVE");
      assert.equal(updates.length, 1);
      assert.equal(updates[0].stubId, missingRow.id);
    },
  );
});

test("Stage 5 municipal service is all-or-nothing when an enrichment stage fails", async () => {
  let rowsReturned = 0;

  await withStubbedStubService(
    createBaseStubs({
      disasterEventOverrides: {
        getAffectedBarangayScopeByDisasterEventId: async () => [
          {
            mapped_barangay_id: baseBarangayId,
            id: baseBarangayId,
            name: "Barangay Failure",
            is_active: true,
          },
        ],
      },
      stubRepositoryOverrides: {
        getMunicipalStubDashboardRows: async () => {
          rowsReturned += 1;
          return [
            buildMunicipalDashboardRow({
              id: "stub-failure",
              householdId: "household-failure",
              barangayId: baseBarangayId,
              barangayName: "Barangay Failure",
            }),
          ];
        },
        getHouseholdSectorsByHouseholdIds: async () => {
          throw new Error("sector enrichment failed");
        },
      },
    }),
    async ({ getMunicipalStubDashboard }) => {
      await assert.rejects(
        () =>
          getMunicipalStubDashboard({
            disaster_event_id: baseStub.disaster_event_id,
            requester: { roleCode: "MAYOR" },
          }),
        /sector enrichment failed/,
      );
    },
  );

  assert.equal(rowsReturned, 1);
});
