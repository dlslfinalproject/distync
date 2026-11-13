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
const reliefPackAssignmentServicePath = require.resolve(
  "../src/services/reliefPackAssignment.service",
);
const donatedReliefPackAssignmentServicePath = require.resolve(
  "../src/services/donatedReliefPackAssignment.service",
);
const systemLogPath = require.resolve("../src/utils/systemLog");
const distributionAuditPath = require.resolve("../src/utils/distributionAudit");
const mswdoReportExportPath = require.resolve("../src/utils/mswdoReportExport");
const inventoryBatchStatusServicePath = require.resolve(
  "../src/services/inventoryBatchStatus.service",
);
const claimProofPhotoStoragePath = require.resolve(
  "../src/services/claimProofPhotoStorage.service",
);

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
    return await runTest(distributionTransactionService);
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
  qr_status: "ACTIVE",
  disaster_event_status: "ACTIVE",
};

const baseRequest = {
  stub_id: baseStub.id,
  disaster_event_id: baseStub.disaster_event_id,
  household_id: baseStub.household_id,
  qr_reference_value: baseStub.qr_code_value,
  claimed_by_name: "Local Claimant",
  verified_by: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  requester: {
    userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    roleCode: "BARANGAY",
    defaultBarangayId: baseStub.barangay_id,
  },
};

const createBaseStubs = ({
  events,
  stub = baseStub,
  claimHandler = null,
  distributionAuditOverrides = {},
  latestAttendance = {
    status: "PRESENT",
    time_out: null,
  },
  disasterEvent = {
    id: baseStub.disaster_event_id,
    status: "ACTIVE",
    disaster_type: "Typhoon",
  },
}) => ({
  [dbPath]: createFakePool(events),
  [distributionTransactionRepositoryPath]: {
    getStubByIdForUpdate: async () => stub,
    getLatestAttendanceByHouseholdId: async (...args) =>
      typeof latestAttendance === "function"
        ? latestAttendance(...args)
        : latestAttendance,
  },
  [disasterEventRepositoryPath]: {
    getDisasterEventById: async () => disasterEvent,
  },
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
  [reliefPackAssignmentServicePath]: {
    getPrimaryAssignedReliefPackTemplate: () => null,
    resolveAssignedReliefPackTemplatesForHousehold: async () => [],
  },
  [donatedReliefPackAssignmentServicePath]: {
    ensureDonatedReliefPackAssignmentsForEvent: async () => [],
    getAssignedDonatedReliefPacksByStubIds: async () => new Map(),
  },
  [systemLogPath]: {
    logAuditSafely: async () => {},
    pickDefined: (value, keys) =>
      Object.fromEntries(keys.map((key) => [key, value?.[key]]).filter(([, item]) => item !== undefined)),
  },
  [distributionAuditPath]: {
    recordDistributionAudit: async () => {},
    ...distributionAuditOverrides,
  },
  [mswdoReportExportPath]: {},
  [inventoryBatchStatusServicePath]: {
    refreshDerivedInventoryBatchStatusesForItems: async () => {},
  },
});

test("legacy createDistributionTransaction rejects claims without an operation proof", async () => {
  const events = [];

  await withStubbedDistributionService(
    createBaseStubs({ events }),
    async ({ createDistributionTransaction }) => {
      await assert.rejects(
        () => createDistributionTransaction(baseRequest),
        (error) => {
          assert.equal(error.code, "DISTRIBUTION_PROOF_REQUIRED");
          assert.equal(error.statusCode, 400);
          return true;
        },
      );
    },
  );

  assert.deepEqual(events, []);
});

test("inventory distribution details allow the assigned Barangay and reject another Barangay", async () => {
  const events = [];
  const stubs = createBaseStubs({ events });
  stubs[distributionTransactionRepositoryPath].getInventoryDistributionDetailByStubId =
    async () => ({
      base: {
        stub_id: baseStub.id,
        barangay_id: baseStub.barangay_id,
      },
      members: [],
      household_sectors: [],
      member_sectors: [],
      latest_attendance: null,
      distribution_transaction: null,
      distribution_transaction_items: [],
    });

  await withStubbedDistributionService(
    stubs,
    async ({ getInventoryDistributionDetail }) => {
      const detail = await getInventoryDistributionDetail({
        stubId: baseStub.id,
        requester: {
          roleCode: "BARANGAY",
          defaultBarangayId: baseStub.barangay_id,
        },
      });

      assert.equal(detail.barangay.id, baseStub.barangay_id);

      await assert.rejects(
        () =>
          getInventoryDistributionDetail({
            stubId: baseStub.id,
            requester: {
              roleCode: "BARANGAY",
              defaultBarangayId: "foreign-barangay",
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

test("distribution history export keeps the selected disaster event in empty-report metadata", async () => {
  const capturedExports = [];
  const stubs = createBaseStubs({ events: [] });

  stubs[distributionTransactionRepositoryPath] = {
    getDistributionHistoryExportRows: async () => [],
  };
  stubs[disasterEventRepositoryPath] = {
    getDisasterEventById: async () => ({
      event_code: "EVT-Z",
      title: "Zero Wind",
    }),
  };
  stubs[mswdoReportExportPath] = {
    formatDateTime: () => "--",
    buildExportFile: async (payload) => {
      capturedExports.push(payload);
      return payload;
    },
  };

  await withStubbedDistributionService(
    stubs,
    async ({ exportDistributionHistory }) => {
      await exportDistributionHistory({
        requester: {
          roleCode: "BARANGAY",
          defaultBarangayId: baseStub.barangay_id,
        },
        filters: {
          disaster_event_id: baseStub.disaster_event_id,
          status: "CLAIMED",
          format: "csv",
        },
      });
    },
  );

  assert.equal(capturedExports.length, 1);
  assert.equal(capturedExports[0].tableTitle, "Distribution History Records");
  assert.equal(
    capturedExports[0].metadata.find((item) => item.label === "Disaster Event").value,
    "EVT-Z - Zero Wind",
  );
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

test("offline QR distribution defers its audit until the outer sync transaction commits", async () => {
  const events = [];
  const deferredSideEffects = [];
  const auditCalls = [];
  let capturedClaim = null;
  const distributionTransaction = {
    id: "distribution-qr-1",
    distribution_status: "CLAIMED",
    distribution_date: "2026-08-08T01:00:00.000Z",
    qr_reference_value: baseStub.qr_code_value,
  };
  const stubs = createBaseStubs({
    events,
    stub: {
      ...baseStub,
      status: "ISSUED",
      disaster_event_status: "ACTIVE",
    },
    distributionAuditOverrides: {
      recordDistributionAudit: async (payload) => {
        auditCalls.push(payload);
      },
    },
    claimHandler: async (claimRequest) => {
      capturedClaim = claimRequest;
      return {
        assignedReliefPackTemplate: { id: "template-1", name: "Family Pack" },
        assignedReliefPackTemplates: [
          { id: "template-1", name: "Family Pack" },
        ],
        distributionTransaction,
        releasedItems: [],
        updatedStub: {
          ...baseStub,
          status: "CLAIMED",
          stub_no: "STUB-001",
        },
        donatedReliefPacks: [],
        packQuantity: 1,
      };
    },
  });

  await withStubbedDistributionService(
    stubs,
    async ({ claimDistributionTransactionFromQr }) => {
      const result = await claimDistributionTransactionFromQr({
        ...baseRequest,
        qr_reference_value: baseStub.qr_code_value,
        dbClient: { query: async () => ({ rows: [] }) },
        deferDomainSideEffect: (sideEffect) => {
          deferredSideEffects.push(sideEffect);
        },
      });

      assert.equal(result.distribution_transaction_id, distributionTransaction.id);
      assert.equal(capturedClaim.proofType, "QR");
      assert.equal(capturedClaim.qrReferenceValue, baseStub.qr_code_value);
      assert.equal(capturedClaim.prepareProofPhoto, undefined);
    },
  );

  assert.deepEqual(events, []);
  assert.equal(auditCalls.length, 0);
  assert.equal(deferredSideEffects.length, 1);

  await deferredSideEffects[0]();

  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0].action, "DISTRIBUTION_QR_CLAIM");
  assert.equal(auditCalls[0].distributionTransaction.id, distributionTransaction.id);
  assert.equal(auditCalls[0].actor.userId, baseRequest.requester.userId);
});

for (const constraint of [
  "uq_distribution_stub",
  "distribution_transactions_stub_id_key",
]) {
  test(`H05-05 distribution stub unique violation normalizes ${constraint}`, async () => {
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
          error.constraint = constraint;
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
}

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

test("legacy createDistributionTransaction rejects before bypassing the sync claim path", async () => {
  const events = [];
  let attendanceChecked = false;

  await withStubbedDistributionService(
    createBaseStubs({
      events,
      stub: {
        ...baseStub,
        status: "ISSUED",
        disaster_event_status: "CLOSED",
      },
      latestAttendance: async () => {
        attendanceChecked = true;
        return { status: "PRESENT", time_out: null };
      },
    }),
    async ({ createDistributionTransaction }) => {
      await assert.rejects(
        () => createDistributionTransaction(baseRequest),
        { code: "DISTRIBUTION_PROOF_REQUIRED", statusCode: 400 },
      );
    },
  );

  assert.equal(attendanceChecked, false);
  assert.deepEqual(events, []);
});

test("EE-FIX-03 claimDistributionTransactionFromQr blocks new QR claims when the event is not ACTIVE", async () => {
  for (const disasterEventStatus of ["PLANNED", "CLOSED"]) {
    const events = [];
    let claimHandlerCalled = false;

    await withStubbedDistributionService(
      createBaseStubs({
        events,
        stub: {
          ...baseStub,
          status: "ISSUED",
          disaster_event_status: disasterEventStatus,
        },
        claimHandler: async () => {
          claimHandlerCalled = true;
          throw new Error("claim handler should not run for inactive events");
        },
      }),
      async ({ claimDistributionTransactionFromQr }) => {
        await assert.rejects(
          () =>
            claimDistributionTransactionFromQr({
              ...baseRequest,
              qr_reference_value: baseStub.qr_code_value,
            }),
          (error) => {
            assert.equal(error.code, "DISASTER_EVENT_NOT_ACTIVE");
            assert.equal(error.statusCode, 400);
            return true;
          },
        );
      },
    );

    assert.equal(claimHandlerCalled, false);
    assert.deepEqual(events, ["BEGIN", "ROLLBACK", "RELEASE"]);
  }
});

test("legacy distribution writes cannot bypass proof validation before attendance checks", async () => {
  const invalidAttendanceRecords = [
    {
      status: "LEFT",
      time_in: "2026-08-28T08:00:00.000Z",
      time_out: null,
    },
    {
      status: "ARRIVED",
      time_in: "2026-08-28T08:00:00.000Z",
      time_out: null,
    },
    {
      status: "TRANSFERRED",
      time_in: "2026-08-28T08:00:00.000Z",
      time_out: null,
    },
    {
      status: "PRESENT",
      time_in: "2026-08-28T08:00:00.000Z",
      time_out: "2026-08-28T12:00:00.000Z",
    },
    null,
  ];

  for (const latestAttendance of invalidAttendanceRecords) {
    const events = [];
    let releasePlanReached = false;

    await withStubbedDistributionService(
      createBaseStubs({
        events,
        stub: {
          ...baseStub,
          status: "ISSUED",
        },
        latestAttendance,
      }),
      async ({ createDistributionTransaction }) => {
        await assert.rejects(
          () => createDistributionTransaction(baseRequest),
          (error) => {
            assert.equal(error.code, "DISTRIBUTION_PROOF_REQUIRED");
            assert.equal(error.statusCode, 400);
            releasePlanReached = true;
            return true;
          },
        );
      },
    );

    assert.equal(releasePlanReached, true);
    assert.deepEqual(events, []);
  }
});

test("legacy distribution writes reject the obsolete arbitrary item path before database work", async () => {
  const events = [];

  await withStubbedDistributionService(
    createBaseStubs({
      events,
      stub: {
        ...baseStub,
        status: "ISSUED",
        current_stay_type: "EVAC_CENTER",
      },
    }),
    async ({ createDistributionTransaction }) => {
      await assert.rejects(
        () =>
          createDistributionTransaction({
            ...baseRequest,
            items: [
              {
                inventory_batch_id: "11111111-1111-4111-8111-111111111111",
                inventory_item_id: "66666666-6666-4666-8666-666666666666",
                quantity_released: 1,
              },
            ],
          }),
        (error) => {
          assert.equal(error.statusCode, 400);
          assert.equal(error.code, "DISTRIBUTION_PROOF_REQUIRED");
          return true;
        },
      );
    },
  );

  assert.deepEqual(events, []);
});

test("legacy distribution writes reject arbitrary template claims before database work", async () => {
  const events = [];
  const assignedTemplate = {
    id: "template-assigned",
    name: "Assigned Standard Pack",
    is_active: true,
    is_additional_pack: false,
  };
  const stubs = createBaseStubs({
    events,
    stub: {
      ...baseStub,
      status: "ISSUED",
      current_stay_type: "EVAC_CENTER",
    },
  });

  stubs[reliefPackAssignmentServicePath] = {
    getPrimaryAssignedReliefPackTemplate: () => assignedTemplate,
    resolveAssignedReliefPackTemplatesForHousehold: async () => [
      assignedTemplate,
    ],
  };

  await withStubbedDistributionService(
    stubs,
    async ({ createDistributionTransaction }) => {
      await assert.rejects(
        () =>
          createDistributionTransaction({
            ...baseRequest,
            stub: undefined,
            stub_id: baseStub.id,
            relief_pack_template_id: "template-not-assigned",
            items: [],
          }),
        (error) => {
          assert.equal(error.statusCode, 400);
          assert.equal(error.code, "DISTRIBUTION_PROOF_REQUIRED");
          return true;
        },
      );
    },
  );

  assert.deepEqual(events, []);
});

test("legacy direct distribution refuses to write a proofless transaction", async () => {
  const events = [];
  await withStubbedDistributionService(
    createBaseStubs({ events }),
    async ({ createDistributionTransaction }) => {
      await assert.rejects(
        () => createDistributionTransaction(baseRequest),
        { code: "DISTRIBUTION_PROOF_REQUIRED", statusCode: 400 },
      );
    },
  );
  assert.deepEqual(events, []);
});

test("claim-proof photo retrieval scopes Barangay and permits exact Mayor and MSWDO details", async () => {
  const repositoryCalls = [];
  const signedPaths = [];
  const auditCalls = [];
  const transaction = {
    id: "distribution-photo-1",
    disaster_event_id: baseStub.disaster_event_id,
    household_id: baseStub.household_id,
    stub_id: baseStub.id,
    proof_type: "PHOTO",
    proof_photo_path: "event/barangay/claims/operations/0123456789abcdef0123456789abcdef/photo.jpg",
    proof_photo_sha256: "c".repeat(64),
    proof_photo_captured_at: "2026-09-24T03:00:00.000Z",
    received_at: "2026-09-24T03:00:04.000Z",
    distribution_date: "2026-09-24T03:00:04.000Z",
    family_head_name: "Family Head",
    stub_no: "STUB-001",
  };
  const stubs = createBaseStubs({ events: [] });
  stubs[distributionTransactionRepositoryPath].getDistributionTransactionClaimProofById =
    async (transactionId, barangayId) => {
      repositoryCalls.push({ transactionId, barangayId });
      if (barangayId && barangayId !== baseStub.barangay_id) return null;
      return transaction;
    };
  stubs[claimProofPhotoStoragePath] = {
    createSignedClaimProofPhotoUrl: async (path) => {
      signedPaths.push(path);
      return {
        url: "https://storage.example/signed-claim-proof",
        expiresAt: "2026-09-24T03:05:00.000Z",
      };
    },
  };
  stubs[distributionAuditPath].recordDistributionAudit = async (payload) => {
    auditCalls.push(payload);
  };

  await withStubbedDistributionService(stubs, async ({ getClaimProofPhoto }) => {
    const barangayPhoto = await getClaimProofPhoto({
      transactionId: transaction.id,
      requester: {
        userId: "barangay-user",
        roleCode: "BARANGAY",
        defaultBarangayId: baseStub.barangay_id,
      },
    });
    assert.equal(barangayPhoto.proof_type, "PHOTO");
    assert.equal(barangayPhoto.url, "https://storage.example/signed-claim-proof");
    assert.equal(JSON.stringify(barangayPhoto).includes(transaction.proof_photo_path), false);

    for (const roleCode of ["MSWDO", "MAYOR"]) {
      const result = await getClaimProofPhoto({
        transactionId: transaction.id,
        requester: { userId: `${roleCode.toLowerCase()}-user`, roleCode },
      });
      assert.equal(result.transaction_id, transaction.id);
    }

    assert.equal(
      await getClaimProofPhoto({
        transactionId: transaction.id,
        requester: {
          userId: "foreign-barangay-user",
          roleCode: "BARANGAY",
          defaultBarangayId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        },
      }),
      null,
    );

    await assert.rejects(
      () => getClaimProofPhoto({
        transactionId: transaction.id,
        requester: { userId: "donor-user", roleCode: "DONOR" },
      }),
      { code: "CLAIM_PROOF_PHOTO_FORBIDDEN", statusCode: 403 },
    );
  });

  assert.deepEqual(repositoryCalls.slice(0, 3), [
    { transactionId: transaction.id, barangayId: baseStub.barangay_id },
    { transactionId: transaction.id, barangayId: null },
    { transactionId: transaction.id, barangayId: null },
  ]);
  assert.equal(repositoryCalls[3].barangayId, "cccccccc-cccc-4ccc-8ccc-cccccccccccc");
  assert.equal(signedPaths.length, 3);
  assert.equal(auditCalls.length, 3);
  assert.equal(JSON.stringify(auditCalls).includes(transaction.proof_photo_path), false);
  assert.equal(JSON.stringify(auditCalls).includes("signed-claim-proof"), false);
});
