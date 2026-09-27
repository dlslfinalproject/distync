const assert = require("node:assert/strict");
const Module = require("node:module");
const test = require("node:test");

const routesPath = require.resolve("../src/routes/masterlist.routes");
const eventId = "123e4567-e89b-42d3-a456-426614174000";
const missingEventId = "123e4567-e89b-42d3-a456-426614174001";
const barangayId = "123e4567-e89b-42d3-a456-426614174002";
const dashboardPayload = {
  disaster_event: { id: eventId, status: "ACTIVE" },
  filters: { disaster_event_id: eventId, barangay_id: null },
  barangay_heatmap: [{ barangay_id: barangayId, barangay_code: "BAGONG_POOK" }],
};

const loadDashboardRoute = (service) => {
  const registeredRoutes = new Map();
  const router = {
    get(routePath, ...handlers) {
      registeredRoutes.set(routePath, handlers);
      return this;
    },
  };
  const authMiddleware = {
    ROLE_CODES: { BARANGAY: "BARANGAY", MSWDO: "MSWDO", MAYOR: "MAYOR" },
    requireAuthentication(req, res, next) {
      const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
      if (!token) {
        res.status(401).json({ message: "Authentication is required for this request" });
        return;
      }
      req.auth = { userId: "test-user", roleCode: token };
      next();
    },
    requireRoles: (...allowedRoles) => (req, res, next) => {
      if (!allowedRoles.includes(req.auth.roleCode)) {
        res.status(403).json({ message: "You do not have permission to access this resource" });
        return;
      }
      next();
    },
  };
  const originalLoad = Module._load;
  delete require.cache[routesPath];
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === "express") return { Router: () => router };
    if (request === "../modules/auth/auth.middleware") return authMiddleware;
    if (request === "../services/masterlist.service") return service;
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    require(routesPath);
  } finally {
    Module._load = originalLoad;
    delete require.cache[routesPath];
  }

  return registeredRoutes.get("/mswdo-dashboard");
};

const invokeRoute = async (handlers, { query = {}, authorization = "" } = {}) => {
  const req = { query, headers: { authorization } };
  const res = {
    statusCode: 200,
    body: null,
    ended: false,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      this.ended = true;
      return this;
    },
  };

  for (const handler of handlers) {
    if (res.ended) break;
    if (handler.length >= 3) {
      await new Promise((resolve, reject) => {
        const next = (error) => (error ? reject(error) : resolve());
        const returned = handler(req, res, next);
        if (returned && typeof returned.then === "function") {
          returned.then(resolve, reject);
        }
        if (res.ended) resolve();
      });
    } else {
      await handler(req, res);
    }
  }

  return res;
};

test("MSWDO dashboard route preserves authentication, validation, and 404 behavior", async () => {
  let serviceCalls = 0;
  const route = loadDashboardRoute({
    getMswdoMasterlistDashboard: async (filters) => {
      serviceCalls += 1;
      if (filters.disaster_event_id === missingEventId) {
        const error = new Error("Disaster event not found");
        error.statusCode = 404;
        throw error;
      }
      return dashboardPayload;
    },
  });

  const unauthenticated = await invokeRoute(route, {
    query: { disaster_event_id: eventId },
  });
  assert.equal(unauthenticated.statusCode, 401);

  const nonMswdo = await invokeRoute(route, {
    query: { disaster_event_id: eventId },
    authorization: "Bearer BARANGAY",
  });
  assert.equal(nonMswdo.statusCode, 403);

  const invalidEvent = await invokeRoute(route, {
    query: { disaster_event_id: "not-a-uuid" },
    authorization: "Bearer MSWDO",
  });
  assert.equal(invalidEvent.statusCode, 400);

  const invalidBarangay = await invokeRoute(route, {
    query: { disaster_event_id: eventId, barangay_id: "not-a-uuid" },
    authorization: "Bearer MSWDO",
  });
  assert.equal(invalidBarangay.statusCode, 400);

  const missingEvent = await invokeRoute(route, {
    query: { disaster_event_id: missingEventId },
    authorization: "Bearer MSWDO",
  });
  assert.equal(missingEvent.statusCode, 404);
  assert.deepEqual(missingEvent.body, { message: "Disaster event not found" });

  const success = await invokeRoute(route, {
    query: { disaster_event_id: eventId },
    authorization: "Bearer MSWDO",
  });
  assert.equal(success.statusCode, 200);
  assert.deepEqual(success.body, dashboardPayload);
  assert.equal(serviceCalls, 2);
});
