const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

const routesPath = require.resolve("../src/routes/mswdoReport.routes");
const authMiddlewarePath = require.resolve("../src/modules/auth/auth.middleware");
const servicePath = require.resolve("../src/services/mswdoReport.service");
const settingsRepositoryPath = require.resolve("../src/repositories/settings.repository");
const validatorPath = require.resolve("../src/validators/mswdoReport.validator");

const withStubbedMswdoReportRoute = async (
  {
    roleCode,
    defaultBarangayId = null,
    userId = "user-1",
    fetchedUser = null,
    serviceImpl,
  },
  runTest,
) => {
  const dependencyPaths = [
    authMiddlewarePath,
    servicePath,
    settingsRepositoryPath,
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
      exports: {
        ROLE_CODES: {
          MAYOR: "MAYOR",
          MSWDO: "MSWDO",
          BARANGAY: "BARANGAY",
        },
        requireRoles: (...allowedRoles) => (req, res, next) => {
          req.allowedRoles = allowedRoles;
          req.auth = {
            userId,
            roleCode,
            defaultBarangayId,
          };

          if (!allowedRoles.includes(roleCode)) {
            return res.status(403).json({ message: "Forbidden" });
          }

          next();
        },
      },
    };
    require.cache[servicePath] = {
      id: servicePath,
      filename: servicePath,
      loaded: true,
      exports: {
        getAnomalyTracking: serviceImpl,
        upsertAnomalyReview: serviceImpl,
        upsertBarangayAnomalyReview: serviceImpl,
      },
    };
    require.cache[settingsRepositoryPath] = {
      id: settingsRepositoryPath,
      filename: settingsRepositoryPath,
      loaded: true,
      exports: {
        getUserById: async () => fetchedUser,
      },
    };
    require.cache[validatorPath] = {
      id: validatorPath,
      filename: validatorPath,
      loaded: true,
      exports: {
        validateMswdoReportFilters: (req, _res, next) => {
          req.validatedQuery = {
            disaster_event_id: req.query.disaster_event_id || null,
            barangay_id: req.query.barangay_id || null,
            status: req.query.status || null,
            date_from: req.query.date_from || null,
            date_to: req.query.date_to || null,
            limit: req.query.limit ? Number(req.query.limit) : 100,
            page: req.query.page ? Number(req.query.page) : 1,
            pageSize: req.query.pageSize ? Number(req.query.pageSize) : 50,
            anomaly_type: req.query.anomaly_type || null,
            status_category: req.query.status_category || null,
            search: req.query.search || null,
            order: req.query.order || "newest",
            role_scope: req.query.role_scope || null,
          };
          next();
        },
        validateAnomalyReviewPayload: (req, _res, next) => {
          const {
            source_type,
            source_id,
            anomaly_type,
            review_status,
            resolution_reason,
          } = req.body || {};
          req.validatedBody = {
            source_type,
            source_id,
            anomaly_type,
            review_status,
            resolution_reason,
          };
          next();
        },
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
  app.use("/api/v1/mswdo-reports", router);

  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
};

const closeServer = (server) =>
  new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

test("H01-10 Barangay route ignores query barangay_id override and uses authenticated scope", async () => {
  let capturedFilters = null;

  await withStubbedMswdoReportRoute(
    {
      roleCode: "BARANGAY",
      defaultBarangayId: "barangay-a",
      serviceImpl: async (filters) => {
        capturedFilters = filters;
        return [];
      },
    },
    async (router) => {
      const server = await listen(router);

      try {
        const port = server.address().port;
        const response = await fetch(
          `http://127.0.0.1:${port}/api/v1/mswdo-reports/anomalies?barangay_id=barangay-b&limit=12`,
        );
        const payload = await response.json();

        assert.equal(response.status, 200);
        assert.deepEqual(payload.data, []);
        assert.equal(capturedFilters.barangay_id, "barangay-a");
        assert.equal(capturedFilters.role_scope, "BARANGAY");
        assert.equal(capturedFilters.limit, 12);
      } finally {
        await closeServer(server);
      }
    },
  );
});

test("M05 route returns page items plus pagination metadata", async () => {
  await withStubbedMswdoReportRoute(
    {
      roleCode: "MSWDO",
      serviceImpl: async () => ({
        items: [{ anomaly_type: "SYNC_FAILED", reference_id: "sync-1" }],
        pagination: {
          page: 2,
          pageSize: 25,
          totalItems: 26,
          totalPages: 2,
          hasPreviousPage: true,
          hasNextPage: false,
        },
      }),
    },
    async (router) => {
      const server = await listen(router);

      try {
        const port = server.address().port;
        const response = await fetch(
          `http://127.0.0.1:${port}/api/v1/mswdo-reports/anomalies?page=2&pageSize=25`,
        );
        const payload = await response.json();

        assert.equal(response.status, 200);
        assert.deepEqual(payload.data, [
          { anomaly_type: "SYNC_FAILED", reference_id: "sync-1" },
        ]);
        assert.deepEqual(payload.pagination, {
          page: 2,
          pageSize: 25,
          totalItems: 26,
          totalPages: 2,
          hasPreviousPage: true,
          hasNextPage: false,
        });
      } finally {
        await closeServer(server);
      }
    },
  );
});

test("H01-10 Barangay route falls back to the server-stored assigned barangay", async () => {
  let capturedFilters = null;

  await withStubbedMswdoReportRoute(
    {
      roleCode: "BARANGAY",
      defaultBarangayId: null,
      fetchedUser: {
        default_barangay_id: "barangay-from-user-record",
      },
      serviceImpl: async (filters) => {
        capturedFilters = filters;
        return [];
      },
    },
    async (router) => {
      const server = await listen(router);

      try {
        const port = server.address().port;
        const response = await fetch(
          `http://127.0.0.1:${port}/api/v1/mswdo-reports/anomalies?barangay_id=barangay-b`,
        );

        assert.equal(response.status, 200);
        assert.equal(capturedFilters.barangay_id, "barangay-from-user-record");
        assert.equal(capturedFilters.role_scope, "BARANGAY");
      } finally {
        await closeServer(server);
      }
    },
  );
});

test("H01-11 MSWDO route preserves explicit consolidated barangay filtering", async () => {
  let capturedFilters = null;

  await withStubbedMswdoReportRoute(
    {
      roleCode: "MSWDO",
      defaultBarangayId: "barangay-a",
      serviceImpl: async (filters) => {
        capturedFilters = filters;
        return [];
      },
    },
    async (router) => {
      const server = await listen(router);

      try {
        const port = server.address().port;
        const response = await fetch(
          `http://127.0.0.1:${port}/api/v1/mswdo-reports/anomalies?barangay_id=barangay-b`,
        );

        assert.equal(response.status, 200);
        assert.equal(capturedFilters.barangay_id, "barangay-b");
        assert.equal(capturedFilters.role_scope, "MSWDO");
      } finally {
        await closeServer(server);
      }
    },
  );
});

test("MSWDO route remains municipality-wide when no Barangay filter is selected", async () => {
  let capturedFilters = null;

  await withStubbedMswdoReportRoute(
    {
      roleCode: "MSWDO",
      defaultBarangayId: "barangay-a",
      serviceImpl: async (filters) => {
        capturedFilters = filters;
        return [];
      },
    },
    async (router) => {
      const server = await listen(router);

      try {
        const port = server.address().port;
        const response = await fetch(
          `http://127.0.0.1:${port}/api/v1/mswdo-reports/anomalies`,
        );

        assert.equal(response.status, 200);
        assert.equal(capturedFilters.barangay_id, null);
        assert.equal(capturedFilters.role_scope, "MSWDO");
      } finally {
        await closeServer(server);
      }
    },
  );
});

test("Barangay review route uses authenticated assignment instead of client barangay_id", async () => {
  let capturedPayload = null;

  await withStubbedMswdoReportRoute(
    {
      roleCode: "BARANGAY",
      defaultBarangayId: "barangay-a",
      serviceImpl: async (request) => {
        capturedPayload = request;
        return {
          id: "review-1",
          review_status: request.payload.review_status,
        };
      },
    },
    async (router) => {
      const server = await listen(router);

      try {
        const port = server.address().port;
        const response = await fetch(
          `http://127.0.0.1:${port}/api/v1/mswdo-reports/anomalies/reviews`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              barangay_id: "barangay-b",
              source_type: "ERROR_LOG",
              source_id: "error-1",
              anomaly_type: "DUPLICATE_HOUSEHOLD_REGISTRATION",
              review_status: "REFERRED",
              resolution_reason: "Forward to MSWDO.",
            }),
          },
        );
        const payload = await response.json();

        assert.equal(response.status, 200);
        assert.equal(payload.data.review_status, "REFERRED");
        assert.equal(capturedPayload.barangayId, "barangay-a");
        assert.equal(capturedPayload.payload.barangay_id, undefined);
      } finally {
        await closeServer(server);
      }
    },
  );
});

test("Barangay review route returns structured stale anomaly code", async () => {
  await withStubbedMswdoReportRoute(
    {
      roleCode: "BARANGAY",
      defaultBarangayId: "barangay-a",
      serviceImpl: async () => {
        const error = new Error(
          "This anomaly is no longer available for review. Its underlying record may have changed or it may no longer require Barangay review.",
        );
        error.statusCode = 404;
        error.code = "ANOMALY_REVIEW_UNAVAILABLE";
        throw error;
      },
    },
    async (router) => {
      const server = await listen(router);

      try {
        const port = server.address().port;
        const response = await fetch(
          `http://127.0.0.1:${port}/api/v1/mswdo-reports/anomalies/reviews`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              source_type: "ERROR_LOG",
              source_id: "stale-error-log",
              anomaly_type: "FAILED_STUB_OR_QR_VERIFICATION",
              review_status: "ISSUE_CONFIRMED",
              resolution_reason: "Reviewed from an old modal.",
            }),
          },
        );
        const payload = await response.json();

        assert.equal(response.status, 404);
        assert.equal(payload.code, "ANOMALY_REVIEW_UNAVAILABLE");
        assert.match(payload.message, /no longer available for review/);
      } finally {
        await closeServer(server);
      }
    },
  );
});

test("MSWDO review route records a consolidated result without using a default Barangay scope", async () => {
  let capturedPayload = null;

  await withStubbedMswdoReportRoute(
    {
      roleCode: "MSWDO",
      defaultBarangayId: "barangay-a",
      serviceImpl: async (request) => {
        capturedPayload = request;
        return {
          id: "review-1",
          review_status: request.payload.review_status,
        };
      },
    },
    async (router) => {
      const server = await listen(router);

      try {
        const port = server.address().port;
        const response = await fetch(
          `http://127.0.0.1:${port}/api/v1/mswdo-reports/anomalies/reviews`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              source_type: "ERROR_LOG",
              source_id: "error-1",
              anomaly_type: "DUPLICATE_HOUSEHOLD_REGISTRATION",
              review_status: "ISSUE_CONFIRMED",
              resolution_reason: "MSWDO validated the duplicate with the Barangay.",
            }),
          },
        );
        const payload = await response.json();

        assert.equal(response.status, 200);
        assert.equal(payload.data.review_status, "ISSUE_CONFIRMED");
        assert.match(payload.message, /MSWDO anomaly review saved/);
        assert.equal(capturedPayload.barangayId, null);
        assert.equal(capturedPayload.auth.roleCode, "MSWDO");
      } finally {
        await closeServer(server);
      }
    },
  );
});

test("Mayor cannot use the MSWDO and Barangay anomaly review endpoint", async () => {
  let serviceCalled = false;

  await withStubbedMswdoReportRoute(
    {
      roleCode: "MAYOR",
      serviceImpl: async () => {
        serviceCalled = true;
        return {};
      },
    },
    async (router) => {
      const server = await listen(router);

      try {
        const port = server.address().port;
        const response = await fetch(
          `http://127.0.0.1:${port}/api/v1/mswdo-reports/anomalies/reviews`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          },
        );

        assert.equal(response.status, 403);
        assert.equal(serviceCalled, false);
      } finally {
        await closeServer(server);
      }
    },
  );
});
