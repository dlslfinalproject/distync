const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

const routesPath = require.resolve("../src/routes/sync.routes");
const authMiddlewarePath = require.resolve("../src/modules/auth/auth.middleware");
const syncServicePath = require.resolve("../src/services/sync.service");
const validatorPath = require.resolve("../src/validators/sync.validator");

const withStubbedSyncRoute = async (
  { authMiddlewareStub, syncServiceStub, validatorStub },
  runTest,
) => {
  const dependencyPaths = [
    authMiddlewarePath,
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

test("sync status summary route returns a read-only status payload for authorized users", async () => {
  await withStubbedSyncRoute(
    {
      authMiddlewareStub: {
        ROLE_CODES: {
          BARANGAY: "BARANGAY",
          MSWDO: "MSWDO",
          MAYOR: "MAYOR",
        },
        requireRoles: () => (req, _res, next) => {
          req.auth = {
            userId: "user-2",
            roleCode: "MSWDO",
          };
          next();
        },
      },
      syncServiceStub: {
        getSyncStatusSummary: async ({ auth }) => {
          assert.equal(auth.userId, "user-2");
          return {
            conflictCount: 1,
            lastSuccessfulSyncAt: null,
            backendReachable: true,
          };
        },
      },
      validatorStub: {
        validateAuditSyncRetryRequest: (_req, _res, next) => next(),
        validateGetSyncHistory: (_req, _res, next) => next(),
        validateGetSyncConflictDetail: (_req, _res, next) => next(),
        validateResolveSyncConflict: (_req, _res, next) => next(),
        validateProcessSyncEntries: (_req, _res, next) => next(),
      },
    },
    async (router) => {
      const app = express();
      app.use(express.json());
      app.use("/api/v1/sync", router);

      const server = await new Promise((resolve) => {
        const instance = app.listen(0, () => resolve(instance));
      });

      try {
        const port = server.address().port;
        const response = await fetch(
          `http://127.0.0.1:${port}/api/v1/sync/status-summary`,
        );
        const payload = await response.json();

        assert.equal(response.status, 200);
        assert.equal(payload.message, "Sync status summary fetched successfully");
        assert.deepEqual(payload.data, {
          conflictCount: 1,
          lastSuccessfulSyncAt: null,
          backendReachable: true,
        });
      } finally {
        await new Promise((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    },
  );
});

test("SYNC-IDEMP-API-01 exposes the existing mismatch code additively on HTTP 409", async () => {
  await withStubbedSyncRoute(
    {
      authMiddlewareStub: {
        ROLE_CODES: {
          BARANGAY: "BARANGAY",
          MSWDO: "MSWDO",
          MAYOR: "MAYOR",
        },
        requireRoles: () => (req, _res, next) => {
          req.auth = { userId: "user-1", roleCode: "BARANGAY" };
          next();
        },
      },
      syncServiceStub: {
        processSyncEntries: async () => {
          const error = new Error(
            "client_sync_id was already used for a different sync request",
          );
          error.statusCode = 409;
          error.code = "IDEMPOTENCY_KEY_REUSE_MISMATCH";
          throw error;
        },
      },
      validatorStub: {
        validateAuditSyncRetryRequest: (_req, _res, next) => next(),
        validateGetSyncHistory: (_req, _res, next) => next(),
        validateGetSyncConflictDetail: (_req, _res, next) => next(),
        validateResolveSyncConflict: (_req, _res, next) => next(),
        validateProcessSyncEntries: (req, _res, next) => {
          req.validatedBody = { entries: req.body.entries };
          next();
        },
      },
    },
    async (router) => {
      const app = express();
      app.use(express.json());
      app.use("/api/v1/sync", router);

      const server = await new Promise((resolve) => {
        const instance = app.listen(0, () => resolve(instance));
      });

      try {
        const port = server.address().port;
        const response = await fetch(`http://127.0.0.1:${port}/api/v1/sync/process`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entries: [{ client_sync_id: "sync-1" }] }),
        });
        const payload = await response.json();

        assert.equal(response.status, 409);
        assert.equal(payload.code, "IDEMPOTENCY_KEY_REUSE_MISMATCH");
        assert.match(payload.message, /client_sync_id was already used/i);
        assert.equal(payload.fingerprint, undefined);
        assert.equal(payload.original_request, undefined);
      } finally {
        await new Promise((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    },
  );
});
