const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

const routesPath = require.resolve("../src/routes/householdRegistration.routes");
const authMiddlewarePath = require.resolve("../src/modules/auth/auth.middleware");
const householdRegistrationServicePath = require.resolve(
  "../src/services/householdRegistration.service",
);
const syncServicePath = require.resolve("../src/services/sync.service");
const validatorPath = require.resolve(
  "../src/validators/householdRegistration.validator",
);

const withStubbedHouseholdRoute = async (
  { authMiddlewareStub, serviceStub, validatorStub, syncServiceStub = { processSyncEntries: async () => [] } },
  runTest,
) => {
  const dependencyPaths = [
    authMiddlewarePath,
    householdRegistrationServicePath,
    syncServicePath,
    validatorPath,
  ];
  const originalEntries = new Map(
    dependencyPaths.map((modulePath) => [modulePath, require.cache[modulePath]]),
  );

  delete require.cache[routesPath];

  try {
    require.cache[authMiddlewarePath] = {
      id: authMiddlewarePath,
      filename: authMiddlewarePath,
      loaded: true,
      exports: authMiddlewareStub,
    };
    require.cache[householdRegistrationServicePath] = {
      id: householdRegistrationServicePath,
      filename: householdRegistrationServicePath,
      loaded: true,
      exports: serviceStub,
    };
    require.cache[syncServicePath] = {
      id: syncServicePath,
      filename: syncServicePath,
      loaded: true,
      exports: syncServiceStub,
    };
    require.cache[validatorPath] = {
      id: validatorPath,
      filename: validatorPath,
      loaded: true,
      exports: validatorStub,
    };

    const router = require(routesPath);
    await runTest(router);
  } finally {
    delete require.cache[routesPath];

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

const buildValidatorStub = () => ({
  validateCreateHouseholdRegistration: (_req, _res, next) => next(),
  validateDuplicateRegistrationSuggestions: (_req, _res, next) => next(),
  validateDepartHousehold: (req, _res, next) => {
    req.validatedParams = { householdId: req.params.householdId };
    req.validatedBody = req.body || {};
    next();
  },
  validateGetHouseholdDetails: (_req, _res, next) => next(),
  validateUpdateHouseholdDetails: (_req, _res, next) => next(),
  validateArchiveHousehold: (_req, _res, next) => next(),
  validateRestoreHousehold: (_req, _res, next) => next(),
  validateCorrectEvacuationLog: (_req, _res, next) => next(),
});

test("HTTP register returns safe non-ACTIVE event validation failure from the shared sync ledger", async () => {
  let syncCall = null;

  await withStubbedHouseholdRoute(
    {
      authMiddlewareStub: {
        ROLE_CODES: {
          BARANGAY: "BARANGAY",
          MSWDO: "MSWDO",
          MAYOR: "MAYOR",
        },
        requireRoles: () => (req, _res, next) => {
          req.auth = {
            userId: "barangay-user-a",
            roleCode: "BARANGAY",
            defaultBarangayId: "barangay-a",
          };
          next();
        },
      },
      serviceStub: {},
      syncServiceStub: {
        processSyncEntries: async (args) => {
          syncCall = args;
          return [{
            sync_status: "FAILED",
            error_code: "DISASTER_EVENT_NOT_ACTIVE",
            status_code: 400,
            message:
              "Household registration cannot be completed because the disaster event is not active.",
          }];
        },
      },
      validatorStub: {
        ...buildValidatorStub(),
        validateCreateHouseholdRegistration: (req, _res, next) => {
          req.validatedBody = req.body || {};
          next();
        },
      },
    },
    async (router) => {
      const app = express();
      app.use(express.json());
      app.use("/api/v1/households", router);

      const server = await new Promise((resolve) => {
        const instance = app.listen(0, () => resolve(instance));
      });

      try {
        const response = await fetch(
          `http://127.0.0.1:${server.address().port}/api/v1/households/register`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "X-Client-Sync-ID": "stable-sync-id-1",
              "X-Entity-Local-ID": "local-household-1",
              "X-Client-Timestamp": "2026-09-24T10:00:00.000Z",
            },
            body: JSON.stringify({
              disaster_event_id: "event-closed",
              barangay_id: "barangay-a",
            }),
          },
        );
        const payload = await response.json();

        assert.equal(response.status, 400);
        assert.deepEqual(payload, {
          code: "DISASTER_EVENT_NOT_ACTIVE",
          message:
            "Household registration cannot be completed because the disaster event is not active.",
        });
        assert.equal(syncCall.auth.userId, "barangay-user-a");
        assert.equal(syncCall.entries[0].client_sync_id, "stable-sync-id-1");
        assert.equal(syncCall.entries[0].action_key, "HOUSEHOLD_REGISTER");
        assert.equal(syncCall.entries[0].payload.disaster_event_id, "event-closed");
      } finally {
        await new Promise((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    },
  );
});

test("HTTP re-admission forwards the archived occurrence through the shared sync ledger and resolves the accepted photo", async () => {
  let syncCall = null;
  let detailsCall = null;
  const archivedHouseholdId = "archived-household-1";

  await withStubbedHouseholdRoute(
    {
      authMiddlewareStub: {
        ROLE_CODES: {
          BARANGAY: "BARANGAY",
          MSWDO: "MSWDO",
          MAYOR: "MAYOR",
        },
        requireRoles: () => (req, _res, next) => {
          req.auth = {
            userId: "barangay-user-a",
            roleCode: "BARANGAY",
            defaultBarangayId: "barangay-a",
          };
          next();
        },
      },
      serviceStub: {
        getHouseholdDetails: async (options) => {
          detailsCall = options;
          return {
            household: {
              id: "new-household-2",
              is_active: true,
              family_head_photo_url: "https://storage.example/signed-photo",
            },
          };
        },
      },
      syncServiceStub: {
        processSyncEntries: async (args) => {
          syncCall = args;
          return [{
            sync_status: "SYNCED",
            data: {
              household: { id: "new-household-2", is_active: true },
              source_household_id: archivedHouseholdId,
              registration_operation: "CREATE_NEW_HOUSEHOLD_OCCURRENCE",
            },
          }];
        },
      },
      validatorStub: {
        ...buildValidatorStub(),
        validateCreateHouseholdRegistration: (req, _res, next) => {
          req.validatedBody = req.body || {};
          next();
        },
      },
    },
    async (router) => {
      const app = express();
      app.use(express.json());
      app.use("/api/v1/households", router);

      const server = await new Promise((resolve) => {
        const instance = app.listen(0, () => resolve(instance));
      });

      try {
        const response = await fetch(
          `http://127.0.0.1:${server.address().port}/api/v1/households/register`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "X-Client-Sync-ID": "stable-sync-id-2",
              "X-Entity-Local-ID": "local-household-2",
              "X-Client-Timestamp": "2026-09-24T10:01:00.000Z",
            },
            body: JSON.stringify({
              registration_operation: "CREATE_NEW_HOUSEHOLD_OCCURRENCE",
              re_admission_source_household_id: archivedHouseholdId,
            }),
          },
        );
        const payload = await response.json();

        assert.equal(response.status, 201);
        assert.equal(syncCall.entries[0].client_sync_id, "stable-sync-id-2");
        assert.equal(syncCall.entries[0].action_key, "HOUSEHOLD_RE_ADMISSION");
        assert.equal(
          syncCall.entries[0].payload.re_admission_source_household_id,
          archivedHouseholdId,
        );
        assert.equal(detailsCall.householdId, "new-household-2");
        assert.equal(detailsCall.requester.roleCode, "BARANGAY");
        assert.match(payload.data.household.family_head_photo_url, /signed-photo/);
        assert.equal(payload.data.source_household_id, archivedHouseholdId);
      } finally {
        await new Promise((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    },
  );
});

test("EE-FIX-02 HTTP update returns safe non-ACTIVE event validation failure from shared service", async () => {
  let serviceCall = null;

  await withStubbedHouseholdRoute(
    {
      authMiddlewareStub: {
        ROLE_CODES: {
          BARANGAY: "BARANGAY",
          MSWDO: "MSWDO",
          MAYOR: "MAYOR",
        },
        requireRoles: () => (req, _res, next) => {
          req.auth = {
            userId: "barangay-user-a",
            roleCode: "BARANGAY",
            defaultBarangayId: "barangay-a",
          };
          next();
        },
      },
      serviceStub: {
        updateHouseholdDetails: async (requestData) => {
          serviceCall = requestData;
          const error = new Error(
            "Household registration cannot be completed because the disaster event is not active.",
          );
          error.statusCode = 400;
          error.code = "DISASTER_EVENT_NOT_ACTIVE";
          throw error;
        },
      },
      validatorStub: {
        ...buildValidatorStub(),
        validateUpdateHouseholdDetails: (req, _res, next) => {
          req.validatedParams = { householdId: req.params.householdId };
          req.validatedBody = req.body || {};
          next();
        },
      },
    },
    async (router) => {
      const app = express();
      app.use(express.json());
      app.use("/api/v1/households", router);

      const server = await new Promise((resolve) => {
        const instance = app.listen(0, () => resolve(instance));
      });

      try {
        const response = await fetch(
          `http://127.0.0.1:${server.address().port}/api/v1/households/household-closed`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              disaster_event_id: "event-closed",
              barangay_id: "barangay-a",
            }),
          },
        );
        const payload = await response.json();

        assert.equal(response.status, 400);
        assert.deepEqual(payload, {
          code: "DISASTER_EVENT_NOT_ACTIVE",
          message:
            "Household registration cannot be completed because the disaster event is not active.",
        });
        assert.equal(serviceCall.householdId, "household-closed");
        assert.equal(serviceCall.requester.userId, "barangay-user-a");
        assert.equal(serviceCall.requestData.registered_by, "barangay-user-a");
      } finally {
        await new Promise((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    },
  );
});

test("HTTP update rejects direct edits to a historical household occurrence", async () => {
  let serviceCall = null;

  await withStubbedHouseholdRoute(
    {
      authMiddlewareStub: {
        ROLE_CODES: {
          BARANGAY: "BARANGAY",
          MSWDO: "MSWDO",
          MAYOR: "MAYOR",
        },
        requireRoles: () => (req, _res, next) => {
          req.auth = {
            userId: "barangay-user-a",
            roleCode: "BARANGAY",
            defaultBarangayId: "barangay-a",
          };
          next();
        },
      },
      serviceStub: {
        updateHouseholdDetails: async (requestData) => {
          serviceCall = requestData;
          const error = new Error("Archived households cannot be edited");
          error.statusCode = 400;
          error.code = "HISTORICAL_HOUSEHOLD_IMMUTABLE";
          throw error;
        },
      },
      validatorStub: {
        ...buildValidatorStub(),
        validateUpdateHouseholdDetails: (req, _res, next) => {
          req.validatedParams = { householdId: req.params.householdId };
          req.validatedBody = req.body || {};
          next();
        },
      },
    },
    async (router) => {
      const app = express();
      app.use(express.json());
      app.use("/api/v1/households", router);

      const server = await new Promise((resolve) => {
        const instance = app.listen(0, () => resolve(instance));
      });

      try {
        const response = await fetch(
          `http://127.0.0.1:${server.address().port}/api/v1/households/household-archived`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              disaster_event_id: "event-1",
              barangay_id: "barangay-a",
              contact_number: "09999999999",
            }),
          },
        );
        const payload = await response.json();

        assert.equal(response.status, 400);
        assert.deepEqual(payload, {
          code: "HISTORICAL_HOUSEHOLD_IMMUTABLE",
          message: "Archived households cannot be edited",
        });
        assert.equal(serviceCall.householdId, "household-archived");
        assert.equal(serviceCall.requester.userId, "barangay-user-a");
      } finally {
        await new Promise((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    },
  );
});

test("BRG-SC-06-H01 TEST E HTTP departure returns 403 for foreign Barangay without mutation result", async () => {
  let serviceCall = null;

  await withStubbedHouseholdRoute(
    {
      authMiddlewareStub: {
        ROLE_CODES: {
          BARANGAY: "BARANGAY",
          MSWDO: "MSWDO",
          MAYOR: "MAYOR",
        },
        requireRoles: () => (req, _res, next) => {
          req.auth = {
            userId: "barangay-user-a",
            roleCode: "BARANGAY",
            defaultBarangayId: "barangay-a",
          };
          next();
        },
      },
      serviceStub: {
        departHousehold: async (householdId, departureDetails, requester) => {
          serviceCall = { householdId, departureDetails, requester };
          const error = new Error("You do not have access to depart this household");
          error.statusCode = 403;
          throw error;
        },
      },
      validatorStub: buildValidatorStub(),
    },
    async (router) => {
      const app = express();
      app.use(express.json());
      app.use("/api/v1/households", router);

      const server = await new Promise((resolve) => {
        const instance = app.listen(0, () => resolve(instance));
      });

      try {
        const response = await fetch(
          `http://127.0.0.1:${server.address().port}/api/v1/households/household-foreign/depart`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              barangay_id: "barangay-a",
              departure_time: "2026-08-09T03:00:00.000Z",
            }),
          },
        );
        const payload = await response.json();

        assert.equal(response.status, 403);
        assert.deepEqual(payload, {
          message: "You do not have access to depart this household",
        });
        assert.equal(serviceCall.householdId, "household-foreign");
        assert.equal(serviceCall.requester.defaultBarangayId, "barangay-a");
        assert.equal(serviceCall.departureDetails.barangay_id, "barangay-a");
      } finally {
        await new Promise((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    },
  );
});
