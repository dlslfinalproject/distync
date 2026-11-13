const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

const routePath = require.resolve("../src/routes/inventoryTransaction.routes");
const servicePath = require.resolve("../src/services/inventoryTransaction.service");
const authMiddlewarePath = require.resolve("../src/modules/auth/auth.middleware");

const withStubbedInventoryTransactionRoutes = async (stubs, runTest) => {
  const dependencyPaths = [servicePath, authMiddlewarePath];
  const originalEntries = new Map(
    dependencyPaths.map((modulePath) => [modulePath, require.cache[modulePath]]),
  );

  delete require.cache[routePath];

  try {
    dependencyPaths.forEach((modulePath) => {
      require.cache[modulePath] = {
        id: modulePath,
        filename: modulePath,
        loaded: true,
        exports: stubs[modulePath] || {},
      };
    });

    const app = express();
    app.use(express.json());
    app.use("/inventory-transactions", require(routePath));

    await runTest(app);
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

const requestJson = async (app, { method, path, body }) => {
  const server = app.listen(0);

  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();

    return {
      status: response.status,
      data,
    };
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
};

test("EE-FIX-04 direct inventory POST returns safe lifecycle business validation error", async () => {
  await withStubbedInventoryTransactionRoutes(
    {
      [authMiddlewarePath]: {
        ROLE_CODES: {
          MAYOR: "MAYOR",
        },
        requireRoles: () => (req, _res, next) => {
          req.auth = {
            userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            roleCode: "MAYOR",
          };
          next();
        },
      },
      [servicePath]: {
        createInventoryTransaction: async (payload) => {
          assert.equal(payload.performed_by, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
          assert.equal(payload.disaster_event_id, "11111111-1111-4111-8111-111111111111");
          assert.equal(payload.transaction_type, "OUTFLOW");
          assert.equal(payload.inventoryTransactionReferenceNo, "ITR-2026-000126");

          const error = new Error(
            "Inventory outflow cannot be completed because the disaster event is not active.",
          );
          error.code = "DISASTER_EVENT_NOT_ACTIVE";
          error.statusCode = 400;
          throw error;
        },
      },
    },
    async (app) => {
      const response = await requestJson(app, {
        method: "POST",
        path: "/inventory-transactions",
        body: {
          disaster_event_id: "11111111-1111-4111-8111-111111111111",
          inventory_batch_id: "22222222-2222-4222-8222-222222222222",
          transaction_type: "OUTFLOW",
          quantity: 1,
          inventoryTransactionReferenceNo: "ITR-2026-000126",
        },
      });

      assert.equal(response.status, 400);
      assert.deepEqual(response.data, {
        message:
          "Inventory outflow cannot be completed because the disaster event is not active.",
      });
    },
  );
});
