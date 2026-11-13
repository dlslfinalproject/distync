const assert = require("node:assert/strict");
const express = require("express");
const test = require("node:test");

const routesPath = require.resolve("../src/routes/inventoryBatch.routes");
const authMiddlewarePath = require.resolve(
  "../src/modules/auth/auth.middleware",
);
const servicePath = require.resolve("../src/services/inventoryBatch.service");

const ROLE_CODES = {
  BARANGAY: "BARANGAY",
  MSWDO: "MSWDO",
  MAYOR: "MAYOR",
  DONOR: "DONOR",
};

const createTestServer = async () => {
  const originalEntries = new Map(
    [routesPath, authMiddlewarePath, servicePath].map((modulePath) => [
      modulePath,
      require.cache[modulePath],
    ]),
  );
  const calls = [];

  delete require.cache[routesPath];
  require.cache[authMiddlewarePath] = {
    id: authMiddlewarePath,
    filename: authMiddlewarePath,
    loaded: true,
    exports: {
      ROLE_CODES,
      requireRoles: (...allowedRoles) => (req, res, next) => {
        const roleCode = req.headers["x-test-role"];

        if (!roleCode) {
          return res.status(401).json({ message: "Authentication required" });
        }

        if (!allowedRoles.includes(roleCode)) {
          return res.status(403).json({ message: "Forbidden" });
        }

        req.auth = { roleCode, userId: "test-user" };
        return next();
      },
    },
  };
  require.cache[servicePath] = {
    id: servicePath,
    filename: servicePath,
    loaded: true,
    exports: {
      getInventoryBatches: async (filters) => {
        calls.push(filters);
        return filters.page
          ? {
              data: [],
              pagination: {
                page: filters.page,
                pageSize: filters.pageSize,
                totalItems: filters.source_type === "LGU" ? 1 : 2,
                totalPages: 1,
                hasPreviousPage: false,
                hasNextPage: false,
              },
            }
          : [];
      },
      exportInventoryBatches: async () => ({
        contentType: "text/csv",
        filename: "inventory-batches.csv",
        buffer: Buffer.from("batch_no\n"),
      }),
    },
  };

  const app = express();
  app.use("/api/v1/inventory-batches", require(routesPath));
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const restore = () => {
    delete require.cache[routesPath];
    for (const [modulePath, originalEntry] of originalEntries) {
      if (originalEntry) {
        require.cache[modulePath] = originalEntry;
      } else {
        delete require.cache[modulePath];
      }
    }
  };

  return {
    calls,
    baseUrl: `http://127.0.0.1:${server.address().port}/api/v1/inventory-batches`,
    close: async () => {
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      restore();
    },
  };
};

test("inventory batch route preserves role scope and paginated response shape", async () => {
  const testServer = await createTestServer();

  try {
    const mayorResponse = await fetch(
      `${testServer.baseUrl}?page=1&pageSize=25&search=rice`,
      { headers: { "x-test-role": ROLE_CODES.MAYOR } },
    );
    assert.equal(mayorResponse.status, 200);
    assert.deepEqual(await mayorResponse.json(), {
      data: [],
      pagination: {
        page: 1,
        pageSize: 25,
        totalItems: 2,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false,
      },
    });
    assert.equal(testServer.calls[0].source_type, null);

    const mswdoResponse = await fetch(
      `${testServer.baseUrl}?page=1&pageSize=25&source_type=DONATED`,
      { headers: { "x-test-role": ROLE_CODES.MSWDO } },
    );
    assert.equal(mswdoResponse.status, 200);
    assert.equal((await mswdoResponse.json()).pagination.totalItems, 1);
    assert.equal(testServer.calls[1].source_type, "LGU");

    const barangayResponse = await fetch(
      `${testServer.baseUrl}?page=1&pageSize=25&source_type=DONATED`,
      { headers: { "x-test-role": ROLE_CODES.BARANGAY } },
    );
    assert.equal(barangayResponse.status, 200);
    assert.equal((await barangayResponse.json()).pagination.totalItems, 1);
    assert.equal(testServer.calls[2].source_type, "LGU");

    const legacyResponse = await fetch(testServer.baseUrl, {
      headers: { "x-test-role": ROLE_CODES.MAYOR },
    });
    assert.equal(legacyResponse.status, 200);
    assert.equal(Array.isArray(await legacyResponse.json()), true);
  } finally {
    await testServer.close();
  }
});

test("inventory batch route rejects partial pagination before service access", async () => {
  const testServer = await createTestServer();

  try {
    const response = await fetch(`${testServer.baseUrl}?page=1`, {
      headers: { "x-test-role": ROLE_CODES.MAYOR },
    });

    assert.equal(response.status, 400);
    assert.equal(testServer.calls.length, 0);
  } finally {
    await testServer.close();
  }
});
