const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const express = require("express");

const sourcePath = (...segments) =>
  path.resolve(__dirname, "..", "src", ...segments);

const paths = {
  distributionService: require.resolve(
    "../src/services/distributionTransaction.service",
  ),
  distributionRepository: require.resolve(
    "../src/repositories/distributionTransaction.repository",
  ),
  stubService: require.resolve("../src/services/stub.service"),
  stubRepository: require.resolve("../src/repositories/stub.repository"),
  db: require.resolve("../src/config/db"),
  authMiddleware: require.resolve("../src/modules/auth/auth.middleware"),
  distributionRoutes: require.resolve(
    "../src/routes/distributionTransaction.routes",
  ),
  stubRoutes: require.resolve("../src/routes/stub.routes"),
  distributionValidator: require.resolve(
    "../src/validators/distributionTransaction.validator",
  ),
  stubValidator: require.resolve("../src/validators/stub.validator"),
  systemLog: require.resolve("../src/utils/systemLog"),
  requesterScope: sourcePath("utils", "requesterScope.js"),
  disasterEventRepository: require.resolve(
    "../src/repositories/disasterEvent.repository",
  ),
  reliefPackTemplateRepository: require.resolve(
    "../src/repositories/reliefPackTemplate.repository",
  ),
  notificationService: require.resolve(
    "../src/modules/notifications/notification.service",
  ),
  settingsRepository: require.resolve(
    "../src/repositories/settings.repository",
  ),
  inventoryItemRepository: require.resolve(
    "../src/repositories/inventoryItem.repository",
  ),
  masterlistService: require.resolve("../src/services/masterlist.service"),
  automaticReliefPackClaimService: require.resolve(
    "../src/services/automaticReliefPackClaim.service",
  ),
  reliefPackAssignmentService: require.resolve(
    "../src/services/reliefPackAssignment.service",
  ),
  mswdoReportExport: require.resolve("../src/utils/mswdoReportExport"),
  inventoryBatchStatus: require.resolve("../src/utils/inventoryBatchStatus"),
  reliefPackEligibility: require.resolve(
    "../src/utils/reliefPackEligibility",
  ),
  masterlistRepository: require.resolve(
    "../src/repositories/masterlist.repository",
  ),
};

const OWN_BARANGAY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FOREIGN_BARANGAY_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const STUB_ID = "22222222-2222-4222-8222-222222222222";
const FOREIGN_STUB_ID = "33333333-3333-4333-8333-333333333333";
const EVENT_ID = "44444444-4444-4444-8444-444444444444";
const HOUSEHOLD_ID = "55555555-5555-4555-8555-555555555555";

const barangayRequester = (defaultBarangayId = OWN_BARANGAY_ID) => ({
  userId: "66666666-6666-4666-8666-666666666666",
  roleCode: "BARANGAY",
  defaultBarangayId,
});

const municipalRequester = (roleCode) => ({
  userId: "77777777-7777-4777-8777-777777777777",
  roleCode,
  defaultBarangayId: null,
});

const withStubbedModules = async (targetPath, stubs, runTest) => {
  const dependencyPaths = Object.keys(stubs);
  const originalEntries = new Map(
    dependencyPaths.map((modulePath) => [modulePath, require.cache[modulePath]]),
  );
  const originalTarget = require.cache[targetPath];

  delete require.cache[targetPath];

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

    return await runTest(require(targetPath));
  } finally {
    delete require.cache[targetPath];

    if (originalTarget) {
      require.cache[targetPath] = originalTarget;
    }

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

const emptyModule = () => ({});

const buildInventoryDetail = (barangayId = OWN_BARANGAY_ID) => ({
  base: {
    stub_id: STUB_ID,
    disaster_event_id: EVENT_ID,
    household_id: HOUSEHOLD_ID,
    stub_no: "STUB-001",
    serial_no: "SER-001",
    stub_status: "CLAIMED",
    issued_at: "2026-08-01T00:00:00.000Z",
    claimed_at: "2026-08-02T00:00:00.000Z",
    stub_updated_at: "2026-08-02T00:00:00.000Z",
    qr_code_value: "DISTYNC-STUB|event|household|stub|STUB-001",
    qr_generated_at: "2026-08-01T00:00:00.000Z",
    qr_status: "ACTIVE",
    qr_notes: null,
    event_code: "EVENT-001",
    disaster_event_title: "Test Event",
    disaster_type: "Typhoon",
    residency_status: "RESIDENT",
    family_head_first_name: "Test",
    family_head_middle_name: null,
    family_head_last_name: "Household",
    family_head_suffix: null,
    household_size: 2,
    current_stay_type: "EVAC_CENTER",
    current_address_details: null,
    contact_number: null,
    is_active: true,
    registered_at: "2026-07-01T00:00:00.000Z",
    registered_by: null,
    registered_by_name: null,
    family_head_photo_url: null,
    photo_captured_at: null,
    photo_verification_notes: null,
    barangay_id: barangayId,
    barangay_code: "BRGY-001",
    barangay_name: "Test Barangay",
  },
  members: [],
  household_sectors: [],
  member_sectors: [],
  latest_attendance: null,
  distribution_transaction: null,
});

const createDistributionServiceStubs = ({ repositoryCalls, settings = {} }) => ({
  [paths.db]: {},
  [paths.distributionRepository]: {
    getInventoryDistributionDetailByStubId: async (stubId, barangayId) => {
      repositoryCalls.push({ stubId, barangayId });

      if (stubId === FOREIGN_STUB_ID) {
        return barangayId === OWN_BARANGAY_ID
          ? null
          : buildInventoryDetail(FOREIGN_BARANGAY_ID);
      }

      if (stubId !== STUB_ID) {
        return null;
      }

      if (barangayId && barangayId !== OWN_BARANGAY_ID) {
        return null;
      }

      return buildInventoryDetail(OWN_BARANGAY_ID);
    },
  },
  [paths.disasterEventRepository]: emptyModule(),
  [paths.reliefPackTemplateRepository]: emptyModule(),
  [paths.notificationService]: emptyModule(),
  [paths.stubRepository]: emptyModule(),
  [paths.settingsRepository]: {
    getUserById: async () => settings,
  },
  [paths.inventoryItemRepository]: emptyModule(),
  [paths.masterlistService]: emptyModule(),
  [paths.automaticReliefPackClaimService]: emptyModule(),
  [paths.reliefPackAssignmentService]: emptyModule(),
  [paths.systemLog]: {
    logAuditSafely: async () => {},
    pickDefined: (value, keys) =>
      Object.fromEntries(
        keys
          .map((key) => [key, value?.[key]])
          .filter(([, item]) => item !== undefined),
      ),
  },
  [paths.mswdoReportExport]: emptyModule(),
  [paths.inventoryBatchStatus]: emptyModule(),
  [paths.reliefPackEligibility]: emptyModule(),
  [paths.requesterScope]: {
    resolveRequesterBarangayId: async (requester) =>
      requester?.defaultBarangayId || settings.default_barangay_id || null,
  },
});

test("inventory detail derives Barangay scope and returns no foreign data", async () => {
  const repositoryCalls = [];

  await withStubbedModules(
    paths.distributionService,
    createDistributionServiceStubs({ repositoryCalls }),
    async ({ getInventoryDistributionDetail }) => {
      const ownDetail = await getInventoryDistributionDetail({
        stubId: STUB_ID,
        requester: barangayRequester(),
      });
      const foreignDetail = await getInventoryDistributionDetail({
        stubId: FOREIGN_STUB_ID,
        requester: barangayRequester(),
      });
      const nonexistentDetail = await getInventoryDistributionDetail({
        stubId: "88888888-8888-4888-8888-888888888888",
        requester: barangayRequester(),
      });

      assert.equal(ownDetail.stub.id, STUB_ID);
      assert.equal(foreignDetail, null);
      assert.equal(nonexistentDetail, null);
    },
  );

  assert.deepEqual(repositoryCalls, [
    { stubId: STUB_ID, barangayId: OWN_BARANGAY_ID },
    { stubId: FOREIGN_STUB_ID, barangayId: OWN_BARANGAY_ID },
    {
      stubId: "88888888-8888-4888-8888-888888888888",
      barangayId: OWN_BARANGAY_ID,
    },
  ]);
});

test("inventory detail preserves MSWDO and MAYOR municipal access", async () => {
  for (const roleCode of ["MSWDO", "MAYOR"]) {
    const repositoryCalls = [];

    await withStubbedModules(
      paths.distributionService,
      createDistributionServiceStubs({ repositoryCalls }),
      async ({ getInventoryDistributionDetail }) => {
        const detail = await getInventoryDistributionDetail({
          stubId: FOREIGN_STUB_ID,
          requester: municipalRequester(roleCode),
        });

        assert.equal(detail.stub.id, STUB_ID);
        assert.equal(detail.barangay.id, FOREIGN_BARANGAY_ID);
      },
    );

    assert.deepEqual(repositoryCalls, [
      { stubId: FOREIGN_STUB_ID, barangayId: null },
    ]);
  }
});

const createStubServiceStubs = ({
  repositoryOverrides = {},
  qrUpdateCalls = [],
  scopedCalls = [],
  genericCalls = [],
} = {}) => {
  const baseStub = {
    id: STUB_ID,
    disaster_event_id: EVENT_ID,
    household_id: HOUSEHOLD_ID,
    stub_no: "STUB-001",
    serial_no: "SER-001",
    status: "CLAIMED",
    issued_at: "2026-08-01T00:00:00.000Z",
    claimed_at: "2026-08-02T00:00:00.000Z",
    updated_at: "2026-08-02T00:00:00.000Z",
    qr_code_value: null,
    qr_generated_at: null,
    qr_generated_by: null,
    qr_status: null,
    qr_notes: null,
    stub_sequence_no: 1,
    disaster_event_status: "ACTIVE",
    current_stay_type: "EVAC_CENTER",
    is_active: true,
    family_head_first_name: "Test",
    family_head_middle_name: null,
    family_head_last_name: "Household",
    family_head_suffix: null,
    household_size: 2,
    contact_number: null,
    barangay_id: OWN_BARANGAY_ID,
    barangay_code: "BRGY-001",
    barangay_name: "Test Barangay",
    disaster_type: "Typhoon",
    event_code: "EVENT-001",
    disaster_event_title: "Test Event",
  };

  const verificationCalls = [];
  const repository = {
    getScopedStubById: async (id, barangayId, options) => {
      scopedCalls.push({ id, barangayId, options });
      return null;
    },
    getStubById: async (id, barangayId) => {
      genericCalls.push({ id, barangayId });

      if (id !== STUB_ID) {
        return null;
      }

      if (barangayId && barangayId !== OWN_BARANGAY_ID) {
        return null;
      }

      return { ...baseStub };
    },
    getStubSearchResults: async () => [],
    getStubByQrCodeValue: async (...args) => {
      verificationCalls.push({ type: "qr", args });
      const barangayId = args[1];
      return barangayId === OWN_BARANGAY_ID || barangayId == null
        ? { ...baseStub }
        : null;
    },
    getStubByStubNoOrSerialNo: async (...args) => {
      verificationCalls.push({ type: "stub-or-serial", args });
      const barangayId = args[1];
      return barangayId === OWN_BARANGAY_ID || barangayId == null
        ? { ...baseStub }
        : null;
    },
    updateStubQrMetadata: async (id, metadata) => {
      qrUpdateCalls.push({ id, metadata });
      return {
        id,
        qr_code_value: metadata.qr_code_value,
        qr_generated_at: metadata.qr_generated_at,
        qr_generated_by: metadata.qr_generated_by,
        qr_status: metadata.qr_status,
        qr_notes: metadata.qr_notes,
      };
    },
    getHouseholdSectorsByHouseholdId: async () => [],
    getMemberSectorsByHouseholdIds: async () => [],
    getHouseholdMembersCount: async () => 0,
    getHouseholdMembersByHouseholdId: async () => [],
    getLatestAttendanceByHouseholdId: async () => null,
    getLatestDistributionTransactionByStubId: async (id) => ({
      id: "99999999-9999-4999-8999-999999999999",
      stub_id: id,
      distribution_status: "CLAIMED",
      receipt_no: "RCPT-001",
    }),
    ...repositoryOverrides,
  };

  return {
    repository,
    verificationCalls,
    [paths.masterlistRepository]: emptyModule(),
    [paths.db]: {},
    [paths.distributionRepository]: {
      getPresentUnclaimedStubQueueContext: async () => ({
        queue_position: 0,
        eligible_households_count: 0,
      }),
    },
    [paths.reliefPackTemplateRepository]: {
      getReliefPackTemplates: async () => [],
    },
    [paths.stubRepository]: repository,
    [paths.automaticReliefPackClaimService]: {
      getAvailableDonatedLooseItemsForClaimPreview: async () => [],
      getAvailableDonatedReliefPacksForClaimPreview: async () => [],
      recordAutomaticReliefPackClaim: async () => {
        throw new Error("not used by read tests");
      },
    },
    [paths.reliefPackAssignmentService]: {
      getAssignedReliefPackTemplatesForSectorIds: () => [],
    },
    [paths.mswdoReportExport]: emptyModule(),
    [paths.reliefPackEligibility]: {
      isReliefPackClaimHouseholdCurrentlyEligible: () => true,
    },
    [paths.requesterScope]: {
      resolveRequesterBarangayId: async (requester) =>
        requester?.defaultBarangayId || null,
    },
  };
};

test("stub detail scopes the detail lookup before QR metadata generation", async () => {
  const scopedCalls = [];
  const genericCalls = [];
  const qrUpdateCalls = [];

  await withStubbedModules(
    paths.stubService,
    createStubServiceStubs({
      scopedCalls,
      genericCalls,
      qrUpdateCalls,
    }),
    async ({ getStubDetails }) => {
      const ownDetail = await getStubDetails(STUB_ID, barangayRequester());
      const foreignDetail = await getStubDetails(
        STUB_ID,
        barangayRequester(FOREIGN_BARANGAY_ID),
      );

      assert.equal(ownDetail.id, STUB_ID);
      assert.equal(foreignDetail, null);
    },
  );

  assert.deepEqual(genericCalls, [
    { id: STUB_ID, barangayId: OWN_BARANGAY_ID },
    { id: STUB_ID, barangayId: FOREIGN_BARANGAY_ID },
  ]);
  assert.equal(qrUpdateCalls.length, 1);
  assert.deepEqual(scopedCalls, []);
});

test("stub detail preserves MSWDO access without applying Barangay preflight", async () => {
  const scopedCalls = [];
  const genericCalls = [];

  await withStubbedModules(
    paths.stubService,
    createStubServiceStubs({ scopedCalls, genericCalls }),
    async ({ getStubDetails }) => {
      const detail = await getStubDetails(
        STUB_ID,
        municipalRequester("MSWDO"),
      );

      assert.equal(detail.id, STUB_ID);
    },
  );

  assert.deepEqual(scopedCalls, []);
  assert.deepEqual(genericCalls, [{ id: STUB_ID, barangayId: null }]);
});

test("stub search always uses authenticated Barangay scope and preserves MSWDO filters", async () => {
  const calls = [];
  const repositoryOverrides = {
    getStubSearchResults: async (...args) => {
      calls.push(args);
      return [];
    },
  };

  await withStubbedModules(
    paths.stubService,
    createStubServiceStubs({ repositoryOverrides }),
    async ({ getSearchResults }) => {
      const commonFilters = {
        q: "STUB-001",
        disaster_event_id: EVENT_ID,
        barangay_id: null,
      };

      await getSearchResults(commonFilters, barangayRequester());
      await getSearchResults(
        { ...commonFilters, barangay_id: OWN_BARANGAY_ID },
        barangayRequester(),
      );
      await getSearchResults(
        { ...commonFilters, barangay_id: FOREIGN_BARANGAY_ID },
        barangayRequester(),
      );
      await getSearchResults(
        { ...commonFilters, barangay_id: FOREIGN_BARANGAY_ID },
        municipalRequester("MSWDO"),
      );
    },
  );

  assert.deepEqual(
    calls.map(([, eventId, barangayId]) => [eventId, barangayId]),
    [
      [EVENT_ID, OWN_BARANGAY_ID],
      [EVENT_ID, OWN_BARANGAY_ID],
      [EVENT_ID, OWN_BARANGAY_ID],
      [EVENT_ID, FOREIGN_BARANGAY_ID],
    ],
  );
});

const verificationIdentifiers = [
  {
    name: "QR",
    value: { qr_code_value: "DISTYNC-STUB|event|household|stub|STUB-001" },
  },
  { name: "stub number", value: { stub_no: "STUB-001" } },
  { name: "serial number", value: { serial_no: "SER-001" } },
];

test("stub verification scopes QR, stub-number, and serial-number lookups", async () => {
  const qrUpdateCalls = [];
  const verificationCalls = [];

  await withStubbedModules(
    paths.stubService,
    createStubServiceStubs({
      qrUpdateCalls,
      repositoryOverrides: {
        getStubByQrCodeValue: async (...args) => {
          verificationCalls.push({ type: "qr", args });
          return args[1] === OWN_BARANGAY_ID ? {
            id: STUB_ID,
            disaster_event_id: EVENT_ID,
            household_id: HOUSEHOLD_ID,
            stub_no: "STUB-001",
            serial_no: "SER-001",
            status: "CLAIMED",
            qr_code_value: "DISTYNC-STUB|event|household|stub|STUB-001",
            qr_status: "ACTIVE",
            is_active: true,
            stub_sequence_no: 1,
            family_head_first_name: "Test",
            family_head_last_name: "Household",
            household_size: 2,
          } : null;
        },
        getStubByStubNoOrSerialNo: async (...args) => {
          verificationCalls.push({ type: "stub-or-serial", args });
          return args[1] === OWN_BARANGAY_ID ? {
            id: STUB_ID,
            disaster_event_id: EVENT_ID,
            household_id: HOUSEHOLD_ID,
            stub_no: "STUB-001",
            serial_no: "SER-001",
            status: "CLAIMED",
            qr_code_value: "DISTYNC-STUB|event|household|stub|STUB-001",
            qr_status: "ACTIVE",
            is_active: true,
            stub_sequence_no: 1,
            family_head_first_name: "Test",
            family_head_last_name: "Household",
            household_size: 2,
          } : null;
        },
      },
    }),
    async ({ verifyStub }) => {
      for (const identifier of verificationIdentifiers) {
        await assert.rejects(
          () =>
            verifyStub(
              identifier.value,
              barangayRequester(FOREIGN_BARANGAY_ID),
            ),
          (error) => {
            assert.equal(error.code, "STUB_NOT_FOUND");
            assert.equal(error.statusCode, 404);
            return true;
          },
          identifier.name,
        );
      }

      for (const identifier of verificationIdentifiers) {
        const result = await verifyStub(
          identifier.value,
          barangayRequester(OWN_BARANGAY_ID),
        );
        assert.equal(result.data.is_valid, true);
      }
    },
  );

  assert.equal(qrUpdateCalls.length, 0);
  assert.equal(verificationCalls.length, verificationIdentifiers.length * 2);
  assert.deepEqual(
    verificationCalls.map(({ args }) => args[1]),
    [
      FOREIGN_BARANGAY_ID,
      FOREIGN_BARANGAY_ID,
      FOREIGN_BARANGAY_ID,
      OWN_BARANGAY_ID,
      OWN_BARANGAY_ID,
      OWN_BARANGAY_ID,
    ],
  );
});

test("stub verification preserves MSWDO municipal lookup", async () => {
  const calls = [];

  await withStubbedModules(
    paths.stubService,
    createStubServiceStubs({
      repositoryOverrides: {
        getStubByQrCodeValue: async (...args) => {
          calls.push(args);
          return {
            id: STUB_ID,
            disaster_event_id: EVENT_ID,
            household_id: HOUSEHOLD_ID,
            stub_no: "STUB-001",
            serial_no: "SER-001",
            status: "CLAIMED",
            qr_code_value: "DISTYNC-STUB|event|household|stub|STUB-001",
            qr_status: "ACTIVE",
            is_active: true,
            stub_sequence_no: 1,
            family_head_first_name: "Test",
            family_head_last_name: "Household",
            household_size: 2,
          };
        },
      },
    }),
    async ({ verifyStub }) => {
      const result = await verifyStub(
        verificationIdentifiers[0].value,
        municipalRequester("MSWDO"),
      );

      assert.equal(result.data.is_valid, true);
    },
  );

  assert.deepEqual(calls, [
    ["DISTYNC-STUB|event|household|stub|STUB-001", null],
  ]);
});

const makeAuthMiddlewareStub = (auth) => ({
  ROLE_CODES: {
    BARANGAY: "BARANGAY",
    MSWDO: "MSWDO",
    MAYOR: "MAYOR",
  },
  requireRoles: (...allowedRoles) => (req, res, next) => {
    req.auth = auth;
    req.allowedRoles = allowedRoles;
    res.setHeader("x-test-roles", allowedRoles.join(","));
    next();
  },
});

const listen = async (mountPath, router) => {
  const app = express();
  app.use(express.json());
  app.use(mountPath, router);

  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
};

const closeServer = (server) =>
  new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

test("distribution detail route forwards req.auth and keeps municipal role list", async () => {
  const auth = barangayRequester();
  let capturedArgs = null;
  let capturedAllowedRoles = null;

  const validators = {
    validateInventoryDistributionDetail: (req, _res, next) => {
      req.validatedParams = { stubId: req.params.stubId };
      next();
    },
  };

  const allDistributionValidators = [
    "validateCreateDistributionTransaction",
    "validateClaimDistributionFromQr",
    "validateGetDistributionHistory",
    "validateExportDistributionHistory",
    "validateExportInventoryDistribution",
    "validateInventoryDistributionExportOptions",
    "validateInventoryDistributionDetail",
    "validateUpdateDistributionLifecycle",
  ];
  allDistributionValidators.forEach((name) => {
    validators[name] = validators[name] || ((_req, _res, next) => next());
  });

  await withStubbedModules(
    paths.distributionRoutes,
    {
      [paths.authMiddleware]: makeAuthMiddlewareStub(auth),
      [paths.distributionService]: {
        getInventoryDistributionDetail: async (args) => {
          capturedArgs = args;
          return { stub: { id: STUB_ID } };
        },
      },
      [paths.distributionValidator]: validators,
      [paths.systemLog]: { logErrorSafely: async () => {} },
    },
    async (router) => {
      const server = await listen(
        "/api/v1/distribution-transactions",
        router,
      );

      try {
        const response = await fetch(
          "http://127.0.0.1:" +
            server.address().port +
            "/api/v1/distribution-transactions/inventory-distribution/" +
            STUB_ID,
        );
        assert.equal(response.status, 200);
        capturedAllowedRoles = response.headers.get("x-test-roles");
      } finally {
        await closeServer(server);
      }
    },
  );

  assert.deepEqual(capturedArgs, {
    stubId: STUB_ID,
    requester: auth,
  });
  assert.equal(capturedAllowedRoles, "BARANGAY,MSWDO,MAYOR");
});

test("stub routes forward req.auth without adding MAYOR to detail/search/verify", async () => {
  const auth = barangayRequester();
  const captures = {};
  const roleHeaders = [];
  const validators = {
    validateGetBarangayStubDashboard: (_req, _res, next) => next(),
    validateStubSearch: (req, _res, next) => {
      req.validatedQuery = {
        q: "STUB-001",
        disaster_event_id: null,
        barangay_id: null,
      };
      next();
    },
    validateStubId: (req, _res, next) => {
      req.validatedParams = { id: req.params.id };
      next();
    },
    validateStubVerify: (req, _res, next) => {
      req.validatedBody = req.body;
      next();
    },
    validateClaimBarangayStub: (_req, _res, next) => next(),
    validateStubHistory: (_req, _res, next) => next(),
    validateStubHistoryExport: (_req, _res, next) => next(),
  };

  await withStubbedModules(
    paths.stubRoutes,
    {
      [paths.authMiddleware]: makeAuthMiddlewareStub(auth),
      [paths.stubService]: {
        getSearchResults: async (filters, requester) => {
          captures.search = { filters, requester };
          return { data: [] };
        },
        getStubDetails: async (id, requester) => {
          captures.detail = { id, requester };
          return { id };
        },
        verifyStub: async (identifier, requester) => {
          captures.verify = { identifier, requester };
          return { data: { is_valid: true } };
        },
      },
      [paths.stubValidator]: validators,
      [paths.systemLog]: { logErrorSafely: async () => {} },
    },
    async (router) => {
      const server = await listen("/api/v1/stubs", router);

      try {
        const baseUrl = "http://127.0.0.1:" + server.address().port;
        const searchResponse = await fetch(
          baseUrl + "/api/v1/stubs/search?q=STUB-001",
        );
        const detailResponse = await fetch(
          baseUrl + "/api/v1/stubs/" + STUB_ID,
        );
        const verifyResponse = await fetch(baseUrl + "/api/v1/stubs/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            qr_code_value: "DISTYNC-STUB|event|household|stub|STUB-001",
          }),
        });

        assert.equal(searchResponse.status, 200);
        assert.equal(detailResponse.status, 200);
        assert.equal(verifyResponse.status, 200);
        roleHeaders.push(
          searchResponse.headers.get("x-test-roles"),
          detailResponse.headers.get("x-test-roles"),
          verifyResponse.headers.get("x-test-roles"),
        );
      } finally {
        await closeServer(server);
      }
    },
  );

  assert.deepEqual(captures.search.requester, auth);
  assert.deepEqual(captures.detail.requester, auth);
  assert.deepEqual(captures.verify.requester, auth);
  assert.equal(captures.detail.id, STUB_ID);
  assert.equal(captures.verify.identifier.qr_code_value.startsWith("DISTYNC-STUB|"), true);
  assert.deepEqual(captures.search.filters, {
    q: "STUB-001",
    disaster_event_id: null,
    barangay_id: null,
  });
  assert.deepEqual(roleHeaders, [
    "BARANGAY,MSWDO",
    "BARANGAY,MSWDO",
    "BARANGAY,MSWDO",
  ]);
});

test("primary repository scopes the base row before child queries", async () => {
  const calls = [];
  const baseRow = buildInventoryDetail().base;

  await withStubbedModules(
    paths.distributionRepository,
    {
      [paths.db]: {
        query: async (query, values) => {
          calls.push({ query, values });

          if (calls.length === 1) {
            return { rows: [baseRow] };
          }

          return { rows: [] };
        },
      },
    },
    async (repository) => {
      await repository.getInventoryDistributionDetailByStubId(
        STUB_ID,
        OWN_BARANGAY_ID,
      );

      assert.match(
        calls[0].query,
        /WHERE s\.id = \$1\s+AND h\.barangay_id = \$2/i,
      );
      assert.deepEqual(calls[0].values, [STUB_ID, OWN_BARANGAY_ID]);
      assert.equal(calls.length, 6);
    },
  );
});

test("primary repository stops before child queries when scoped base row is absent", async () => {
  const calls = [];

  await withStubbedModules(
    paths.distributionRepository,
    {
      [paths.db]: {
        query: async (query, values) => {
          calls.push({ query, values });
          return { rows: [] };
        },
      },
    },
    async (repository) => {
      const detail = await repository.getInventoryDistributionDetailByStubId(
        FOREIGN_STUB_ID,
        OWN_BARANGAY_ID,
      );

      assert.equal(detail, null);
      assert.equal(calls.length, 1);
      assert.match(calls[0].query, /h\.barangay_id = \$2/i);
      assert.deepEqual(calls[0].values, [FOREIGN_STUB_ID, OWN_BARANGAY_ID]);
    },
  );
});

test("stub repository scopes search and every verification identifier", async () => {
  const calls = [];

  await withStubbedModules(
    paths.stubRepository,
    {
      [paths.db]: {
        query: async (query, values) => {
          calls.push({ query, values });
          return { rows: [] };
        },
      },
    },
    async (repository) => {
      await repository.getStubById(STUB_ID, OWN_BARANGAY_ID);
      await repository.getStubSearchResults(
        "STUB-001",
        EVENT_ID,
        OWN_BARANGAY_ID,
      );
      await repository.getStubByQrCodeValue(
        "DISTYNC-STUB|event|household|stub|STUB-001",
        OWN_BARANGAY_ID,
      );
      await repository.getStubByStubNoOrSerialNo(
        { stub_no: "STUB-001" },
        OWN_BARANGAY_ID,
      );
      await repository.getStubByStubNoOrSerialNo(
        { serial_no: "SER-001" },
        OWN_BARANGAY_ID,
      );

      assert.match(calls[0].query, /h\.barangay_id = \$2/i);
      assert.deepEqual(calls[0].values, [STUB_ID, OWN_BARANGAY_ID]);
      assert.match(calls[1].query, /h\.barangay_id = \$3/i);
      assert.deepEqual(calls[1].values, [
        "%STUB-001%",
        EVENT_ID,
        OWN_BARANGAY_ID,
      ]);
      assert.match(calls[2].query, /h\.barangay_id = \$2/i);
      assert.deepEqual(calls[2].values, [
        "DISTYNC-STUB|event|household|stub|STUB-001",
        OWN_BARANGAY_ID,
      ]);
      assert.match(calls[3].query, /h\.barangay_id = \$2/i);
      assert.deepEqual(calls[3].values, ["STUB-001", OWN_BARANGAY_ID]);
      assert.match(calls[4].query, /h\.barangay_id = \$2/i);
      assert.deepEqual(calls[4].values, ["SER-001", OWN_BARANGAY_ID]);
    },
  );
});
