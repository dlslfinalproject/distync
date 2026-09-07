const assert = require("node:assert/strict");
const express = require("express");
const test = require("node:test");

const routesPath = require.resolve("../src/routes/reliefPackTemplate.routes");
const authMiddlewarePath = require.resolve("../src/modules/auth/auth.middleware");
const servicePath = require.resolve("../src/services/reliefPackTemplate.service");

const EVENT_A = "11111111-1111-4111-8111-111111111111";
const EVENT_B = "22222222-2222-4222-8222-222222222222";
const TEMPLATE_ID = "33333333-3333-4333-8333-333333333333";
const BARANGAY_ID = "44444444-4444-4444-8444-444444444444";

const withStubbedReliefPackTemplateRoute = async (
  { serviceImpl },
  runTest,
) => {
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
        ROLE_CODES: {
          MAYOR: "MAYOR",
          MSWDO: "MSWDO",
          BARANGAY: "BARANGAY",
        },
        requireRoles: (...allowedRoles) => (req, res, next) => {
          req.allowedRoles = allowedRoles;

          if (!req.auth) {
            return res.status(401).json({ message: "Authentication required" });
          }

          if (!allowedRoles.includes(req.auth.roleCode)) {
            return res.status(403).json({ message: "Forbidden" });
          }

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

const listen = async (router) => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.auth = req.headers["x-test-role"]
      ? { roleCode: req.headers["x-test-role"] }
      : null;
    next();
  });
  app.use("/api/v1/relief-pack-templates", router);

  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
};

const closeServer = (server) =>
  new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

const demandRows = [
  {
    template_id: TEMPLATE_ID,
    disaster_event_id: EVENT_A,
    barangay_id: BARANGAY_ID,
    barangay_name: "Barangay One",
    families_count: 2,
    packs_needed: 3,
  },
];

test("relief pack demand endpoint authenticates and authorizes existing feature roles", async () => {
  let capturedFilters = null;
  let serviceCalls = 0;

  await withStubbedReliefPackTemplateRoute(
    {
      serviceImpl: {
        getReliefPackTemplateDemand: async (filters) => {
          serviceCalls += 1;
          capturedFilters = filters;
          return demandRows;
        },
      },
    },
    async (router) => {
      const server = await listen(router);

      try {
        const response = await fetch(
          `http://127.0.0.1:${server.address().port}/api/v1/relief-pack-templates/demand?disaster_event_ids=${encodeURIComponent(`${EVENT_A}, ${EVENT_B},${EVENT_A}`)}`,
          { headers: { "x-test-role": "MSWDO" } },
        );
        const payload = await response.json();

        assert.equal(response.status, 200);
        assert.deepEqual(payload, {
          filters: { disaster_event_ids: [EVENT_A, EVENT_B] },
          data: demandRows,
        });
      } finally {
        await closeServer(server);
      }
    },
  );

  assert.equal(serviceCalls, 1);
  assert.deepEqual(capturedFilters, {
    disaster_event_ids: [EVENT_A, EVENT_B],
  });
});

test("relief pack demand endpoint rejects unauthenticated and unauthorized callers", async () => {
  let serviceCalls = 0;

  await withStubbedReliefPackTemplateRoute(
    {
      serviceImpl: {
        getReliefPackTemplateDemand: async () => {
          serviceCalls += 1;
          return demandRows;
        },
      },
    },
    async (router) => {
      const server = await listen(router);

      try {
        const unauthenticatedResponse = await fetch(
          `http://127.0.0.1:${server.address().port}/api/v1/relief-pack-templates/demand?disaster_event_ids=${EVENT_A}`,
        );

        assert.equal(unauthenticatedResponse.status, 401);
      } finally {
        await closeServer(server);
      }
    },
  );

  await withStubbedReliefPackTemplateRoute(
    {
      serviceImpl: {
        getReliefPackTemplateDemand: async () => {
          serviceCalls += 1;
          return demandRows;
        },
      },
    },
    async (router) => {
      const server = await listen(router);

      try {
        const unauthorizedResponse = await fetch(
          `http://127.0.0.1:${server.address().port}/api/v1/relief-pack-templates/demand?disaster_event_ids=${EVENT_A}`,
          { headers: { "x-test-role": "INVENTORY" } },
        );

        assert.equal(unauthorizedResponse.status, 403);
      } finally {
        await closeServer(server);
      }
    },
  );

  assert.equal(serviceCalls, 0);
});

test("relief pack demand endpoint validates a bounded UUID event list", async () => {
  let serviceCalls = 0;

  await withStubbedReliefPackTemplateRoute(
    {
      serviceImpl: {
        getReliefPackTemplateDemand: async () => {
          serviceCalls += 1;
          return demandRows;
        },
      },
    },
    async (router) => {
      const server = await listen(router);

      try {
        const response = await fetch(
          `http://127.0.0.1:${server.address().port}/api/v1/relief-pack-templates/demand?disaster_event_ids=${encodeURIComponent(`${EVENT_A},not-a-uuid`)}`,
          { headers: { "x-test-role": "BARANGAY" } },
        );
        const payload = await response.json();

        assert.equal(response.status, 400);
        assert.equal(
          payload.message,
          "disaster_event_ids must contain valid UUID values",
        );
      } finally {
        await closeServer(server);
      }
    },
  );

  assert.equal(serviceCalls, 0);
});
