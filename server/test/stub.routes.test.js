const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

const routesPath = require.resolve("../src/routes/stub.routes");
const authMiddlewarePath = require.resolve("../src/modules/auth/auth.middleware");
const servicePath = require.resolve("../src/services/stub.service");
const syncServicePath = require.resolve("../src/services/sync.service");
const systemLogPath = require.resolve("../src/utils/systemLog");

const withStubbedStubRoute = async ({ auth, serviceImpl, syncImpl }, runTest) => {
  const dependencyPaths = [
    authMiddlewarePath,
    servicePath,
    syncServicePath,
    systemLogPath,
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
      exports: {
        ROLE_CODES: {
          MAYOR: "MAYOR",
          MSWDO: "MSWDO",
          BARANGAY: "BARANGAY",
        },
        requireRoles: (...allowedRoles) => (req, _res, next) => {
          req.allowedRoles = allowedRoles;
          req.auth = auth;
          if (!auth) {
            return _res.status(401).json({
              message: "Authentication is required for this request",
            });
          }
          if (!allowedRoles.includes(auth.roleCode)) {
            return _res.status(403).json({
              message: "You do not have permission to access this resource",
            });
          }
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
    require.cache[syncServicePath] = {
      id: syncServicePath,
      filename: syncServicePath,
      loaded: true,
      exports: syncImpl || { processSyncEntries: async () => [] },
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

test("Stage 5 municipal route allows Mayor and MSWDO and passes requester context to the service", async () => {
  let capturedQuery = null;
  let capturedRequester = null;
  let capturedAllowedRoles = null;

  await withStubbedStubRoute(
    {
      auth: {
        userId: "mayor-user",
        roleCode: "MAYOR",
        defaultBarangayId: null,
      },
      serviceImpl: {
        getMunicipalStubDashboard: async (filters) => {
          capturedQuery = filters.disaster_event_id;
          capturedRequester = filters.requester;
          return {
            scope: "municipal",
            disaster_event: { id: eventId, status: "ACTIVE" },
            barangay_ids: [],
            barangay_count: 0,
            count: 0,
            data: [],
          };
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
          `http://127.0.0.1:${server.address().port}/api/v1/stubs/municipal-dashboard?disaster_event_id=${eventId}`,
        );

        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), {
          scope: "municipal",
          disaster_event: { id: eventId, status: "ACTIVE" },
          barangay_ids: [],
          barangay_count: 0,
          count: 0,
          data: [],
        });
      } finally {
        await closeServer(server);
      }
    },
  );

  assert.deepEqual(capturedAllowedRoles, ["MAYOR", "MSWDO"]);
  assert.equal(capturedQuery, eventId);
  assert.equal(capturedRequester.roleCode, "MAYOR");
});

test("Mayor can retrieve an authorized family-head photo on demand with no-store headers", async () => {
  let serviceCall = null;
  await withStubbedStubRoute(
    {
      auth: { userId: "mayor-user", roleCode: "MAYOR", defaultBarangayId: null },
      serviceImpl: {
        getStubFamilyHeadPhoto: async (id, requester) => {
          serviceCall = { id, requester };
          return {
            url: "https://storage.example/signed-photo",
            expiresAt: "2026-09-24T10:05:00.000Z",
            available: true,
          };
        },
      },
    },
    async (router) => {
      const server = await listen(router);
      try {
        const response = await fetch(
          `http://127.0.0.1:${server.address().port}/api/v1/stubs/${stubId}/family-head-photo`,
        );
        assert.equal(response.status, 200);
        assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
        assert.deepEqual(await response.json(), {
          data: {
            url: "https://storage.example/signed-photo",
            expiresAt: "2026-09-24T10:05:00.000Z",
            available: true,
          },
        });
      } finally {
        await closeServer(server);
      }
    },
  );

  assert.equal(serviceCall.id, stubId);
  assert.equal(serviceCall.requester.roleCode, "MAYOR");
});

for (const deniedRole of ["DONOR", "NGO", "PUBLIC"]) {
  test(`family-head photo route denies ${deniedRole}`, async () => {
    let serviceCalled = false;
    await withStubbedStubRoute(
      {
        auth: { userId: "external-user", roleCode: deniedRole },
        serviceImpl: {
          getStubFamilyHeadPhoto: async () => {
            serviceCalled = true;
            throw new Error("service must not run for denied roles");
          },
        },
      },
      async (router) => {
        const server = await listen(router);
        try {
          const response = await fetch(
            `http://127.0.0.1:${server.address().port}/api/v1/stubs/${stubId}/family-head-photo`,
          );
          assert.equal(response.status, 403);
        } finally {
          await closeServer(server);
        }
      },
    );
    assert.equal(serviceCalled, false);
  });
}

for (const deniedRole of ["BARANGAY", "DONOR"]) {
  test(`Stage 5 municipal route denies ${deniedRole}`, async () => {
    await withStubbedStubRoute(
      {
        auth: { userId: "denied-user", roleCode: deniedRole },
        serviceImpl: {
          getMunicipalStubDashboard: async () => {
            throw new Error("service must not run for denied roles");
          },
        },
      },
      async (router) => {
        const server = await listen(router);

        try {
          const response = await fetch(
            `http://127.0.0.1:${server.address().port}/api/v1/stubs/municipal-dashboard?disaster_event_id=${eventId}`,
          );

          assert.equal(response.status, 403);
        } finally {
          await closeServer(server);
        }
      },
    );
  });
}

test("Stage 5 municipal route denies unauthenticated access", async () => {
  await withStubbedStubRoute(
    {
      auth: null,
      serviceImpl: {
        getMunicipalStubDashboard: async () => {
          throw new Error("service must not run for unauthenticated users");
        },
      },
    },
    async (router) => {
      const server = await listen(router);

      try {
        const response = await fetch(
          `http://127.0.0.1:${server.address().port}/api/v1/stubs/municipal-dashboard?disaster_event_id=${eventId}`,
        );

        assert.equal(response.status, 401);
      } finally {
        await closeServer(server);
      }
    },
  );
});

test("Stage 5 municipal route rejects missing, malformed, and unsupported query parameters", async () => {
  await withStubbedStubRoute(
    {
      auth: { userId: "mayor-user", roleCode: "MAYOR" },
      serviceImpl: {
        getMunicipalStubDashboard: async () => {
          throw new Error("service must not run for invalid queries");
        },
      },
    },
    async (router) => {
      const server = await listen(router);

      try {
        for (const query of [
          "",
          "disaster_event_id=not-a-uuid",
          `disaster_event_id=${eventId}&barangay_id=${selectedBarangayId}`,
        ]) {
          const response = await fetch(
            `http://127.0.0.1:${server.address().port}/api/v1/stubs/municipal-dashboard?${query}`,
          );

          assert.equal(response.status, 400);
        }
      } finally {
        await closeServer(server);
      }
    },
  );
});

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

test("MSWDO Photo claim keeps its barangay scope in the shared STUB_CLAIM route", async () => {
  let capturedEntry = null;
  let capturedAllowedRoles = null;

  await withStubbedStubRoute(
    {
      auth: {
        userId: "mswdo-user",
        roleCode: "MSWDO",
        defaultBarangayId: null,
      },
      serviceImpl: {
        claimBarangayStub: async () => {
          throw new Error("direct service claims must not be used");
        },
      },
      syncImpl: {
        processSyncEntries: async ({ entries }) => {
          capturedEntry = entries[0];
          return [{
            client_sync_id: entries[0].client_sync_id,
            sync_status: "SYNCED",
            data: { id: stubId, status: "CLAIMED" },
          }];
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
            body: JSON.stringify({
              barangay_id: selectedBarangayId,
              disaster_event_id: eventId,
              proof_type: "PHOTO",
              proof_photo_data_url: "data:image/jpeg;base64,dGVzdA==",
              proof_photo_captured_at: "2026-09-24T03:00:00.000Z",
              client_sync_id: "33333333-3333-4333-8333-333333333333",
            }),
          },
        );

        assert.equal(response.status, 200);
      } finally {
        await closeServer(server);
      }
    },
  );

  assert.deepEqual(capturedAllowedRoles, ["BARANGAY", "MSWDO"]);
  assert.equal(capturedEntry.action_key, "STUB_CLAIM");
  assert.equal(capturedEntry.entity_server_id, stubId);
  assert.equal(capturedEntry.payload.user_id, null);
  assert.equal(capturedEntry.payload.barangay_id, selectedBarangayId);
  assert.equal(capturedEntry.payload.override_barangay_id, null);
  assert.equal(capturedEntry.payload.proof_type, "PHOTO");
  assert.equal(capturedEntry.payload.proof_photo_data_url, "data:image/jpeg;base64,dGVzdA==");
});

test("Mayor remains unauthorized to submit a Photo Proof Stub claim", async () => {
  let syncCalled = false;

  await withStubbedStubRoute(
    {
      auth: {
        userId: "mayor-user",
        roleCode: "MAYOR",
        defaultBarangayId: null,
      },
      serviceImpl: {},
      syncImpl: {
        processSyncEntries: async () => {
          syncCalled = true;
          return [];
        },
      },
    },
    async (router) => {
      const server = await listen(router);

      try {
        const response = await fetch(
          `http://127.0.0.1:${server.address().port}/api/v1/stubs/${stubId}/claim`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              proof_type: "PHOTO",
              proof_photo_data_url: "data:image/jpeg;base64,dGVzdA==",
              client_sync_id: "33333333-3333-4333-8333-333333333333",
            }),
          },
        );

        assert.equal(response.status, 403);
      } finally {
        await closeServer(server);
      }
    },
  );

  assert.equal(syncCalled, false);
});

for (const role of ["BARANGAY", "MSWDO"]) {
  test(`relief claim validation preserves the shared 400 contract for ${role}`, async () => {
    const claimError = new Error(
      "Insufficient stock to release Rice.",
    );
    claimError.statusCode = 400;
    claimError.code = "INSUFFICIENT_RELIEF_PACK_STOCK";

    await withStubbedStubRoute(
      {
        auth: {
          userId: `${role.toLowerCase()}-user`,
          roleCode: role,
          defaultBarangayId: role === "BARANGAY" ? selectedBarangayId : null,
        },
        serviceImpl: {
          claimBarangayStub: async () => {
            throw new Error("direct service claims must not be used");
          },
        },
        syncImpl: {
          processSyncEntries: async ({ entries }) => [{
            client_sync_id: entries[0].client_sync_id,
            sync_status: "FAILED",
            error_code: claimError.code,
            status_code: claimError.statusCode,
            message: claimError.message,
          }],
        },
      },
      async (router) => {
        const server = await listen(router);

        try {
          const response = await fetch(
            `http://127.0.0.1:${server.address().port}/api/v1/stubs/${stubId}/claim`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(
                role === "MSWDO"
                  ? {
                      barangay_id: selectedBarangayId,
                      disaster_event_id: eventId,
                      proof_type: "QR",
                      qr_reference_value: "DISTYNC-STUB|event|household|stub|STUB-001",
                      client_sync_id: "33333333-3333-4333-8333-333333333333",
                    }
                  : {
                      user_id: stubId,
                      disaster_event_id: eventId,
                      proof_type: "QR",
                      qr_reference_value: "DISTYNC-STUB|event|household|stub|STUB-001",
                      client_sync_id: "33333333-3333-4333-8333-333333333333",
                    },
              ),
            },
          );

          assert.equal(response.status, 400);
          const payload = await response.json();
          assert.equal(payload.success, false);
          assert.equal(payload.code, "INSUFFICIENT_RELIEF_PACK_STOCK");
          assert.equal(payload.error, "INSUFFICIENT_RELIEF_PACK_STOCK");
          assert.equal(payload.message, "Insufficient stock to release Rice.");
          assert.equal(payload.details, null);
          assert.equal(payload.data.sync_status, "FAILED");
        } finally {
          await closeServer(server);
        }
      },
    );
  });
}
