const assert = require("node:assert/strict");
const express = require("express");
const test = require("node:test");

const routesPath = require.resolve("../src/routes/disasterEvent.routes");
const authMiddlewarePath = require.resolve(
  "../src/modules/auth/auth.middleware",
);
const servicePath = require.resolve("../src/services/disasterEvent.service");

const ROLE_CODES = {
  BARANGAY: "BARANGAY",
  MSWDO: "MSWDO",
  MAYOR: "MAYOR",
  DONOR: "DONOR",
};

const withStubbedDisasterEventRoute = async ({ serviceImpl }, runTest) => {
  const dependencyPaths = [authMiddlewarePath, servicePath];
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
        ROLE_CODES,
        requireRoles: (...allowedRoles) => (req, res, next) => {
          req.allowedRoles = allowedRoles;
          const roleCode = req.headers["x-test-role"];

          if (!roleCode) {
            return res.status(401).json({
              message: "Authentication is required for this request",
            });
          }

          if (!allowedRoles.includes(roleCode)) {
            return res.status(403).json({
              message: "You do not have permission to access this resource",
            });
          }

          req.auth = { roleCode };
          return next();
        },
      },
    };
    require.cache[servicePath] = {
      id: servicePath,
      filename: servicePath,
      loaded: true,
      exports: serviceImpl,
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

const listen = async (router, capturedAllowedRoles) => {
  const app = express();
  app.use((req, _res, next) => {
    const originalEnd = _res.end;
    _res.end = function patchedEnd(...args) {
      capturedAllowedRoles.push(req.allowedRoles || null);
      return originalEnd.apply(this, args);
    };
    next();
  });
  app.use("/api/v1/disaster-events", router);

  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
};

const closeServer = (server) =>
  new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

test("active disaster event route allows supported dashboard roles", async () => {
  const capturedAllowedRoles = [];
  let serviceCalls = 0;

  await withStubbedDisasterEventRoute(
    {
      serviceImpl: {
        getActiveDisasterEvents: async () => {
          serviceCalls += 1;
          return [{ id: "event-1", status: "ACTIVE" }];
        },
      },
    },
    async (router) => {
      const server = await listen(router, capturedAllowedRoles);

      try {
        for (const roleCode of [
          ROLE_CODES.BARANGAY,
          ROLE_CODES.MSWDO,
          ROLE_CODES.MAYOR,
        ]) {
          const response = await fetch(
            `http://127.0.0.1:${server.address().port}/api/v1/disaster-events/active`,
            { headers: { "x-test-role": roleCode } },
          );

          assert.equal(response.status, 200);
          assert.deepEqual(await response.json(), [
            { id: "event-1", status: "ACTIVE" },
          ]);
        }
      } finally {
        await closeServer(server);
      }
    },
  );

  assert.equal(serviceCalls, 3);
  assert.deepEqual(capturedAllowedRoles, [
    [ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO, ROLE_CODES.MAYOR],
    [ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO, ROLE_CODES.MAYOR],
    [ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO, ROLE_CODES.MAYOR],
  ]);
});

test("active disaster event route rejects unauthenticated and unsupported callers", async () => {
  const capturedAllowedRoles = [];
  let serviceCalls = 0;

  await withStubbedDisasterEventRoute(
    {
      serviceImpl: {
        getActiveDisasterEvents: async () => {
          serviceCalls += 1;
          return [];
        },
      },
    },
    async (router) => {
      const server = await listen(router, capturedAllowedRoles);

      try {
        const unauthenticatedResponse = await fetch(
          `http://127.0.0.1:${server.address().port}/api/v1/disaster-events/active`,
        );
        const unsupportedResponse = await fetch(
          `http://127.0.0.1:${server.address().port}/api/v1/disaster-events/active`,
          { headers: { "x-test-role": ROLE_CODES.DONOR } },
        );

        assert.equal(unauthenticatedResponse.status, 401);
        assert.equal(unsupportedResponse.status, 403);
      } finally {
        await closeServer(server);
      }
    },
  );

  assert.equal(serviceCalls, 0);
  assert.deepEqual(capturedAllowedRoles, [
    [ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO, ROLE_CODES.MAYOR],
    [ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO, ROLE_CODES.MAYOR],
  ]);
});
