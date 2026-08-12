const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

const routesPath = require.resolve("../src/routes/stub.routes");
const authMiddlewarePath = require.resolve("../src/modules/auth/auth.middleware");
const servicePath = require.resolve("../src/services/stub.service");
const systemLogPath = require.resolve("../src/utils/systemLog");

const withStubbedStubRoute = async ({ auth, serviceImpl }, runTest) => {
  const dependencyPaths = [authMiddlewarePath, servicePath, systemLogPath];
  const originalEntries = new Map(
    dependencyPaths.map((modulePath) => [modulePath, require.cache[modulePath]]),
  );

  delete require.cache[routesPath];

  try {
    require.cache[authMiddlewarePath] = {
      id: authMiddlewarePath,
      filename: authMiddlewarePath,
      loaded: true,
      exports: {
        ROLE_CODES: {
          MAYOR: "MAYOR",
          MSWDO: "MSWDO",
          BARANGAY: "BARANGAY",
        },
        requireRoles: (...allowedRoles) => (req, _res, next) => {
          req.allowedRoles = allowedRoles;
          req.auth = auth;
          next();
        },
      },
    };
    require.cache[servicePath] = {
      id: servicePath,
      filename: servicePath,
      loaded: true,
      exports: serviceImpl,
    };
    require.cache[systemLogPath] = {
      id: systemLogPath,
      filename: systemLogPath,
      loaded: true,
      exports: {
        logErrorSafely: async () => {},
      },
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

const listen = async (router) => {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/stubs", router);

  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
};

const closeServer = (server) =>
  new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

const eventId = "11111111-1111-4111-8111-111111111111";
const selectedBarangayId = "22222222-2222-4222-8222-222222222222";
const craftedBarangayId = "99999999-9999-4999-8999-999999999999";
const stubId = "44444444-4444-4444-8444-444444444444";

test("DEPLOY-MSWDO-RGD-01 route passes MSWDO dashboard barangay_id without override", async () => {
  let capturedFilters = null;

  await withStubbedStubRoute(
    {
      auth: {
        userId: "mswdo-user",
        roleCode: "MSWDO",
        defaultBarangayId: null,
      },
      serviceImpl: {
        getBarangayStubDashboard: async (filters) => {
          capturedFilters = filters;
          return { data: [] };
        },
      },
    },
    async (router) => {
      const server = await listen(router);

      try {
        const response = await fetch(
          `http://127.0.0.1:${server.address().port}/api/v1/stubs/barangay-dashboard?disaster_event_id=${eventId}&barangay_id=${selectedBarangayId}`,
        );

        assert.equal(response.status, 200);
      } finally {
        await closeServer(server);
      }
    },
  );

  assert.equal(capturedFilters.user_id, null);
  assert.equal(capturedFilters.barangay_id, selectedBarangayId);
  assert.equal(capturedFilters.override_barangay_id, null);
  assert.equal(capturedFilters.qr_generated_by, "mswdo-user");
});

test("DEPLOY-MSWDO-RGD-01 route keeps Barangay dashboard scoped to auth user", async () => {
  let capturedFilters = null;

  await withStubbedStubRoute(
    {
      auth: {
        userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        roleCode: "BARANGAY",
        defaultBarangayId: "auth-barangay",
      },
      serviceImpl: {
        getBarangayStubDashboard: async (filters) => {
          capturedFilters = filters;
          return { data: [] };
        },
      },
    },
    async (router) => {
      const server = await listen(router);

      try {
        const response = await fetch(
          `http://127.0.0.1:${server.address().port}/api/v1/stubs/barangay-dashboard?user_id=${craftedBarangayId}&disaster_event_id=${eventId}&barangay_id=${selectedBarangayId}&override_barangay_id=${craftedBarangayId}`,
        );

        assert.equal(response.status, 200);
      } finally {
        await closeServer(server);
      }
    },
  );

  assert.equal(capturedFilters.user_id, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  assert.equal(capturedFilters.barangay_id, null);
  assert.equal(capturedFilters.override_barangay_id, null);
});

test("DEPLOY-MSWDO-RGD-01 route passes MSWDO claim barangay_id without adding Mayor", async () => {
  let capturedBody = null;
  let capturedAllowedRoles = null;

  await withStubbedStubRoute(
    {
      auth: {
        userId: "mswdo-user",
        roleCode: "MSWDO",
        defaultBarangayId: null,
      },
      serviceImpl: {
        claimBarangayStub: async (body) => {
          capturedBody = body;
          return { data: { id: body.id, status: "CLAIMED" } };
        },
      },
    },
    async (router) => {
      const app = express();
      app.use(express.json());
      app.use("/api/v1/stubs", (req, _res, next) => {
        const originalEnd = _res.end;
        _res.end = function patchedEnd(...args) {
          capturedAllowedRoles = req.allowedRoles;
          return originalEnd.apply(this, args);
        };
        next();
      }, router);

      const server = await new Promise((resolve) => {
        const listeningServer = app.listen(0, () => resolve(listeningServer));
      });

      try {
        const response = await fetch(
          `http://127.0.0.1:${server.address().port}/api/v1/stubs/${stubId}/claim`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ barangay_id: selectedBarangayId }),
          },
        );

        assert.equal(response.status, 200);
      } finally {
        await closeServer(server);
      }
    },
  );

  assert.deepEqual(capturedAllowedRoles, ["BARANGAY", "MSWDO"]);
  assert.equal(capturedBody.user_id, null);
  assert.equal(capturedBody.barangay_id, selectedBarangayId);
  assert.equal(capturedBody.override_barangay_id, null);
  assert.equal(capturedBody.verified_by, "mswdo-user");
});
