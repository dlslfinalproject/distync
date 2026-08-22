const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

const distributionRoutesPath = require.resolve("../src/routes/distributionTransaction.routes");
const householdRegistrationRoutesPath = require.resolve(
  "../src/routes/householdRegistration.routes",
);
const stubRoutesPath = require.resolve("../src/routes/stub.routes");
const authMiddlewarePath = require.resolve("../src/modules/auth/auth.middleware");
const distributionServicePath = require.resolve("../src/services/distributionTransaction.service");
const householdRegistrationServicePath = require.resolve(
  "../src/services/householdRegistration.service",
);
const stubServicePath = require.resolve("../src/services/stub.service");
const distributionValidatorPath = require.resolve("../src/validators/distributionTransaction.validator");
const householdRegistrationValidatorPath = require.resolve(
  "../src/validators/householdRegistration.validator",
);
const stubValidatorPath = require.resolve("../src/validators/stub.validator");
const systemLogPath = require.resolve("../src/utils/systemLog");

const baseAuth = {
  userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  roleCode: "BARANGAY",
  defaultBarangayId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
};

const withStubbedModules = async (routePath, stubs, runTest) => {
  const dependencyPaths = Object.keys(stubs);
  const originalEntries = new Map(
    dependencyPaths.map((modulePath) => [modulePath, require.cache[modulePath]]),
  );

  delete require.cache[routePath];

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

    const router = require(routePath);
    await runTest(router);
  } finally {
    delete require.cache[routePath];

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

const listen = async (pathPrefix, router) => {
  const app = express();
  app.use(express.json());
  app.use(pathPrefix, router);

  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
};

const closeServer = (server) =>
  new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

const authStub = {
  ROLE_CODES: {
    MAYOR: "MAYOR",
    MSWDO: "MSWDO",
    BARANGAY: "BARANGAY",
  },
  requireRoles: () => (req, _res, next) => {
    req.auth = baseAuth;
    next();
  },
};

test("ANOMSRC-06 direct duplicate QR claim writes one structured error-log source", async () => {
  const loggedErrors = [];
  const stubId = "22222222-2222-4222-8222-222222222222";

  await withStubbedModules(
    distributionRoutesPath,
    {
      [authMiddlewarePath]: authStub,
      [distributionServicePath]: {
        claimDistributionTransactionFromQr: async () => {
          const error = new Error("This stub has already been used for distribution");
          error.code = "STUB_ALREADY_CLAIMED";
          error.statusCode = 409;
          error.entityServerId = stubId;
          error.serverPayload = {
            stub: { id: stubId, status: "CLAIMED" },
          };
          throw error;
        },
      },
      [distributionValidatorPath]: {
        validateClaimDistributionFromQr: (req, _res, next) => {
          req.validatedBody = req.body;
          next();
        },
        validateCreateDistributionTransaction: (_req, _res, next) => next(),
        validateInventoryDistributionExportOptions: (_req, _res, next) => next(),
        validateExportInventoryDistribution: (_req, _res, next) => next(),
        validateInventoryDistributionDetail: (_req, _res, next) => next(),
        validateGetDistributionHistory: (_req, _res, next) => next(),
        validateExportDistributionHistory: (_req, _res, next) => next(),
        validateUpdateDistributionLifecycle: (_req, _res, next) => next(),
      },
      [systemLogPath]: {
        logErrorSafely: async (entry) => loggedErrors.push(entry),
      },
    },
    async (router) => {
      const server = await listen("/api/v1/distribution-transactions", router);

      try {
        const port = server.address().port;
        const response = await fetch(
          `http://127.0.0.1:${port}/api/v1/distribution-transactions/claim-from-qr`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              stub_id: stubId,
              disaster_event_id: "33333333-3333-4333-8333-333333333333",
              household_id: "44444444-4444-4444-8444-444444444444",
              qr_reference_value: "DISTYNC-STUB|event|household|stub|STUB-001",
            }),
          },
        );
        const payload = await response.json();

        assert.equal(response.status, 409);
        assert.equal(payload.code, "STUB_ALREADY_CLAIMED");
      } finally {
        await closeServer(server);
      }
    },
  );

  assert.equal(loggedErrors.length, 1);
  assert.equal(loggedErrors[0].moduleName, "distribution");
  assert.equal(loggedErrors[0].errorCode, "STUB_ALREADY_CLAIMED");
  assert.equal(loggedErrors[0].referenceType, "STUB");
  assert.equal(loggedErrors[0].referenceId, stubId);
  assert.equal(loggedErrors[0].context.action, "DIRECT_DUPLICATE_CLAIM_ATTEMPT");
});

test("MSWDO-ANOM-I04 direct duplicate household registration writes one durable error-log source", async () => {
  const loggedErrors = [];
  const householdId = "44444444-4444-4444-8444-444444444444";

  await withStubbedModules(
    householdRegistrationRoutesPath,
    {
      [authMiddlewarePath]: authStub,
      [householdRegistrationServicePath]: {
        getDuplicateRegistrationSuggestions: async () => ({}),
        registerHousehold: async () => {
          const error = new Error(
            "Possible duplicate evacuee registration detected. Review the matched household before registering again.",
          );
          error.code = "DUPLICATE_HOUSEHOLD_REGISTRATION";
          error.statusCode = 409;
          error.entityServerId = householdId;
          error.serverPayload = {
            household_id: householdId,
            matched_as: "FAMILY_HEAD",
            matched_relationship_to_head: null,
            match_confidence: "HIGH",
            family_head_name: "Server Existing",
          };
          throw error;
        },
      },
      [householdRegistrationValidatorPath]: {
        validateCreateHouseholdRegistration: (req, _res, next) => {
          req.validatedBody = req.body;
          next();
        },
        validateDuplicateRegistrationSuggestions: (_req, _res, next) => next(),
        validateDepartHousehold: (_req, _res, next) => next(),
        validateGetHouseholdDetails: (_req, _res, next) => next(),
        validateUpdateHouseholdDetails: (_req, _res, next) => next(),
        validateArchiveHousehold: (_req, _res, next) => next(),
        validateRestoreHousehold: (_req, _res, next) => next(),
        validateCorrectEvacuationLog: (_req, _res, next) => next(),
      },
      [systemLogPath]: {
        logErrorSafely: async (entry) => loggedErrors.push(entry),
      },
    },
    async (router) => {
      const server = await listen("/api/v1/households", router);

      try {
        const port = server.address().port;
        const response = await fetch(
          `http://127.0.0.1:${port}/api/v1/households/register`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              disaster_event_id: "33333333-3333-4333-8333-333333333333",
              barangay_id: baseAuth.defaultBarangayId,
              family_head: {
                first_name: "Server",
                last_name: "Existing",
              },
              members: [
                {
                  first_name: "Private",
                  last_name: "Member",
                },
              ],
              family_head_photo_url: "data:image/png;base64,private",
            }),
          },
        );
        const payload = await response.json();

        assert.equal(response.status, 409);
        assert.equal(payload.code, "DUPLICATE_HOUSEHOLD_REGISTRATION");
      } finally {
        await closeServer(server);
      }
    },
  );

  assert.equal(loggedErrors.length, 1);
  assert.equal(loggedErrors[0].moduleName, "household-registration");
  assert.equal(loggedErrors[0].errorCode, "DUPLICATE_HOUSEHOLD_REGISTRATION");
  assert.equal(loggedErrors[0].severity, "WARNING");
  assert.equal(loggedErrors[0].referenceType, "HOUSEHOLD");
  assert.equal(loggedErrors[0].referenceId, householdId);
  assert.equal(
    loggedErrors[0].context.action,
    "DIRECT_DUPLICATE_HOUSEHOLD_REGISTRATION",
  );
  assert.equal(loggedErrors[0].context.disaster_event_id, "33333333-3333-4333-8333-333333333333");
  assert.equal(loggedErrors[0].context.barangay_id, baseAuth.defaultBarangayId);
  assert.equal(loggedErrors[0].context.match_confidence, "HIGH");
  assert.doesNotMatch(JSON.stringify(loggedErrors[0]), /data:image|Private|Member/);
});

test("ANOMSRC-07 direct stub verification failure writes one structured source", async () => {
  const loggedErrors = [];
  const stubId = "22222222-2222-4222-8222-222222222222";

  await withStubbedModules(
    stubRoutesPath,
    {
      [authMiddlewarePath]: authStub,
      [stubServicePath]: {
        verifyStub: async () => ({
          message: "QR code is inactive",
          data: {
            is_valid: true,
            is_claimable: false,
            code: "QR_INACTIVE",
            details: { stubNumber: "STUB#1" },
            stub: { id: stubId },
          },
        }),
      },
      [stubValidatorPath]: {
        validateGetBarangayStubDashboard: (_req, _res, next) => next(),
        validateStubSearch: (_req, _res, next) => next(),
        validateStubId: (_req, _res, next) => next(),
        validateStubVerify: (req, _res, next) => {
          req.validatedBody = req.body;
          next();
        },
        validateClaimBarangayStub: (_req, _res, next) => next(),
        validateStubHistory: (_req, _res, next) => next(),
        validateStubHistoryExport: (_req, _res, next) => next(),
      },
      [systemLogPath]: {
        logErrorSafely: async (entry) => loggedErrors.push(entry),
      },
    },
    async (router) => {
      const server = await listen("/api/v1/stubs", router);

      try {
        const port = server.address().port;
        const response = await fetch(
          `http://127.0.0.1:${port}/api/v1/stubs/verify`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              qr_code_value: "DISTYNC-STUB|event|household|stub|STUB-001",
              disaster_event_id: "33333333-3333-4333-8333-333333333333",
            }),
          },
        );
        const payload = await response.json();

        assert.equal(response.status, 200);
        assert.equal(payload.data.code, "QR_INACTIVE");
      } finally {
        await closeServer(server);
      }
    },
  );

  assert.equal(loggedErrors.length, 1);
  assert.equal(loggedErrors[0].moduleName, "stubs");
  assert.equal(loggedErrors[0].errorCode, "QR_INACTIVE");
  assert.equal(loggedErrors[0].referenceType, "STUB");
  assert.equal(loggedErrors[0].referenceId, stubId);
  assert.equal(
    loggedErrors[0].context.action,
    "DIRECT_STUB_OR_QR_VERIFICATION_FAILURE",
  );
  assert.equal(
    loggedErrors[0].context.disaster_event_id,
    "33333333-3333-4333-8333-333333333333",
  );
});

test("ANOMSRC-09 direct barangay stub claim duplicate writes one structured source", async () => {
  const loggedErrors = [];
  const stubId = "22222222-2222-4222-8222-222222222222";

  await withStubbedModules(
    stubRoutesPath,
    {
      [authMiddlewarePath]: authStub,
      [stubServicePath]: {
        claimBarangayStub: async () => {
          const error = new Error("Only unclaimed stubs can be marked as claimed.");
          error.code = "STUB_ALREADY_CLAIMED";
          error.statusCode = 409;
          error.entityServerId = stubId;
          error.serverPayload = {
            stub: { id: stubId, status: "CLAIMED" },
          };
          throw error;
        },
      },
      [stubValidatorPath]: {
        validateGetBarangayStubDashboard: (_req, _res, next) => next(),
        validateStubSearch: (_req, _res, next) => next(),
        validateStubId: (_req, _res, next) => next(),
        validateStubVerify: (_req, _res, next) => next(),
        validateClaimBarangayStub: (req, _res, next) => {
          req.validatedParams = { id: req.params.id };
          req.validatedBody = req.body;
          next();
        },
        validateStubHistory: (_req, _res, next) => next(),
        validateStubHistoryExport: (_req, _res, next) => next(),
      },
      [systemLogPath]: {
        logErrorSafely: async (entry) => loggedErrors.push(entry),
      },
    },
    async (router) => {
      const server = await listen("/api/v1/stubs", router);

      try {
        const port = server.address().port;
        const response = await fetch(
          `http://127.0.0.1:${port}/api/v1/stubs/${stubId}/claim`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          },
        );
        const payload = await response.json();

        assert.equal(response.status, 409);
        assert.equal(payload.code, "STUB_ALREADY_CLAIMED");
      } finally {
        await closeServer(server);
      }
    },
  );

  assert.equal(loggedErrors.length, 1);
  assert.equal(loggedErrors[0].moduleName, "stubs");
  assert.equal(loggedErrors[0].errorCode, "STUB_ALREADY_CLAIMED");
  assert.equal(loggedErrors[0].referenceType, "STUB");
  assert.equal(loggedErrors[0].referenceId, stubId);
  assert.equal(loggedErrors[0].context.action, "DIRECT_DUPLICATE_CLAIM_ATTEMPT");
});

test("ANOMSRC-10 stub verification of an already claimed stub is not logged as a duplicate claim", async () => {
  const loggedErrors = [];

  await withStubbedModules(
    stubRoutesPath,
    {
      [authMiddlewarePath]: authStub,
      [stubServicePath]: {
        verifyStub: async () => ({
          message: "Stub already claimed",
          data: {
            is_valid: true,
            is_claimable: false,
            code: "STUB_ALREADY_CLAIMED",
            details: { stubNumber: "STUB#1" },
            stub: { id: "22222222-2222-4222-8222-222222222222" },
          },
        }),
      },
      [stubValidatorPath]: {
        validateGetBarangayStubDashboard: (_req, _res, next) => next(),
        validateStubSearch: (_req, _res, next) => next(),
        validateStubId: (_req, _res, next) => next(),
        validateStubVerify: (req, _res, next) => {
          req.validatedBody = req.body;
          next();
        },
        validateClaimBarangayStub: (_req, _res, next) => next(),
        validateStubHistory: (_req, _res, next) => next(),
        validateStubHistoryExport: (_req, _res, next) => next(),
      },
      [systemLogPath]: {
        logErrorSafely: async (entry) => loggedErrors.push(entry),
      },
    },
    async (router) => {
      const server = await listen("/api/v1/stubs", router);

      try {
        const port = server.address().port;
        const response = await fetch(
          `http://127.0.0.1:${port}/api/v1/stubs/verify`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              qr_code_value: "DISTYNC-STUB|event|household|stub|STUB-001",
            }),
          },
        );
        const payload = await response.json();

        assert.equal(response.status, 200);
        assert.equal(payload.data.code, "STUB_ALREADY_CLAIMED");
      } finally {
        await closeServer(server);
      }
    },
  );

  assert.equal(loggedErrors.length, 0);
});
