const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

const routesPath = require.resolve("../src/routes/householdRegistration.routes");
const authMiddlewarePath = require.resolve("../src/modules/auth/auth.middleware");
const householdRegistrationServicePath = require.resolve(
  "../src/services/householdRegistration.service",
);
const validatorPath = require.resolve(
  "../src/validators/householdRegistration.validator",
);

const withStubbedHouseholdRoute = async (
  { authMiddlewareStub, serviceStub, validatorStub },
  runTest,
) => {
  const dependencyPaths = [
    authMiddlewarePath,
    householdRegistrationServicePath,
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

test("EE-FIX-01 HTTP register returns safe non-ACTIVE event validation failure from shared service", async () => {
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
        registerHousehold: async (requestData) => {
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
        assert.equal(serviceCall.registered_by, "barangay-user-a");
        assert.equal(serviceCall.disaster_event_id, "event-closed");
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
