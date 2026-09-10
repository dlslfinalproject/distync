import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test, { after, before } from "node:test";
import { createServer } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, "..");

let viteServer;
let fetchInventoryItems;
let fetchInventoryItemsFromBatchService;
let fetchInventoryItemsFromReliefPackService;
let fetchInventoryBatches;
let fetchInventoryBatchesPage;
let fetchInventoryBatchesFromTransactionService;
let fetchInventoryTransactions;

const flushMicrotasks = async () => {
  await new Promise((resolve) => setImmediate(resolve));
};

const createJsonResponse = (payload, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  json: async () => payload,
});

before(async () => {
  viteServer = await createServer({
    root: clientRoot,
    configFile: false,
    appType: "custom",
    logLevel: "error",
  });

  ({ fetchInventoryItems } = await viteServer.ssrLoadModule(
    "/src/features/inventory-items/inventoryItemService.js?inventory-read-test",
  ));
  ({ fetchInventoryItems: fetchInventoryItemsFromBatchService } =
    await viteServer.ssrLoadModule(
      "/src/features/inventory-batches/inventoryBatchService.js?inventory-read-batch-test",
    ));
  ({ fetchInventoryItems: fetchInventoryItemsFromReliefPackService } =
    await viteServer.ssrLoadModule(
      "/src/features/relief-pack-templates/reliefPackTemplateService.js?inventory-read-relief-pack-test",
    ));
  ({ fetchInventoryBatches, fetchInventoryBatchesPage } = await viteServer.ssrLoadModule(
    "/src/features/inventory-batches/inventoryBatchService.js?inventory-read-test",
  ));
  ({ fetchInventoryBatches: fetchInventoryBatchesFromTransactionService } =
    await viteServer.ssrLoadModule(
      "/src/features/inventory-transactions/inventoryTransactionService.js?inventory-read-transaction-test",
    ));
  ({ fetchInventoryTransactions } = await viteServer.ssrLoadModule(
    "/src/features/inventory-transactions/inventoryTransactionService.js?inventory-read-test",
  ));
});

after(async () => {
  await viteServer?.close();
});

test("identical item reads share one underlying request and canonicalize filter order", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  let releaseResponse;
  const responseReady = new Promise((resolve) => {
    releaseResponse = resolve;
  });

  globalThis.fetch = async (url) => {
    calls.push(String(url));
    await responseReady;
    return createJsonResponse([{ id: "item-1" }]);
  };

  try {
    const first = fetchInventoryItems({
      status: "AVAILABLE",
      search: " rice ",
    });
    const second = fetchInventoryItems({
      search: "rice",
      status: "AVAILABLE",
    });

    await flushMicrotasks();
    assert.equal(calls.length, 1);
    assert.equal(calls[0], "http://localhost:5000/api/v1/inventory-items?search=rice&status=AVAILABLE");

    releaseResponse();
    const [firstResult, secondResult] = await Promise.all([first, second]);
    assert.deepEqual(firstResult, [{ id: "item-1" }]);
    assert.deepEqual(secondResult, firstResult);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("different item request scopes remain independent", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return createJsonResponse([]);
  };

  try {
    await Promise.all([
      fetchInventoryItems({ search: "rice" }),
      fetchInventoryItems({ search: "beans" }),
    ]);

    assert.equal(calls.length, 2);
    assert.notEqual(calls[0], calls[1]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("failed item reads are removed so the next identical request retries", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) {
      throw new Error("synthetic inventory read failure");
    }

    return createJsonResponse([]);
  };

  try {
    await assert.rejects(
      fetchInventoryItems({ search: "retry" }),
      /synthetic inventory read failure/,
    );
    await fetchInventoryItems({ search: "retry" });
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("identical batch reads share one underlying request", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return createJsonResponse([]);
  };

  try {
    await Promise.all([
      fetchInventoryBatches({ source_type: "DONATED" }),
      fetchInventoryBatches({ source_type: "DONATED" }),
    ]);
    assert.equal(calls.length, 1);
    assert.equal(calls[0], "http://localhost:5000/api/v1/inventory-batches?source_type=DONATED");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("identical paginated batch reads share one request while legacy reads stay arrays", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  let releaseResponse;
  const responseReady = new Promise((resolve) => {
    releaseResponse = resolve;
  });
  const paginatedPayload = {
    data: [{ id: "batch-1" }],
    pagination: {
      page: 1,
      pageSize: 25,
      totalItems: 26,
      totalPages: 2,
      hasPreviousPage: false,
      hasNextPage: true,
    },
  };

  globalThis.fetch = async (url) => {
    calls.push(String(url));
    await responseReady;
    return createJsonResponse(paginatedPayload);
  };

  try {
    const first = fetchInventoryBatchesPage({
      search: " rice ",
      page: 1,
      pageSize: 25,
    });
    const second = fetchInventoryBatchesPage({
      pageSize: 25,
      page: 1,
      search: "rice",
    });

    await flushMicrotasks();
    assert.equal(calls.length, 1);
    assert.equal(
      calls[0],
      "http://localhost:5000/api/v1/inventory-batches?search=rice&page=1&pageSize=25",
    );

    releaseResponse();
    const [firstResult, secondResult] = await Promise.all([first, second]);
    assert.deepEqual(firstResult, paginatedPayload);
    assert.deepEqual(secondResult, paginatedPayload);
  } finally {
    globalThis.fetch = originalFetch;
  }

  globalThis.fetch = async () =>
    createJsonResponse([{ id: "complete-batch-1" }, { id: "complete-batch-2" }]);

  try {
    const legacyResult = await fetchInventoryBatches({ search: "rice" });
    assert.equal(Array.isArray(legacyResult), true);
    assert.equal(Object.prototype.hasOwnProperty.call(legacyResult, "data"), false);
    assert.equal(legacyResult.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("different paginated batch pages and filters do not coalesce", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return createJsonResponse({
      data: [],
      pagination: {
        page: 1,
        pageSize: 25,
        totalItems: 0,
        totalPages: 0,
        hasPreviousPage: false,
        hasNextPage: false,
      },
    });
  };

  try {
    await Promise.all([
      fetchInventoryBatchesPage({ page: 1, pageSize: 25 }),
      fetchInventoryBatchesPage({ page: 2, pageSize: 25 }),
      fetchInventoryBatchesPage({
        page: 1,
        pageSize: 25,
        source_type: "DONATED",
      }),
    ]);

    assert.equal(calls.length, 3);
    assert.deepEqual(
      [...calls].sort(),
      [
        "http://localhost:5000/api/v1/inventory-batches?page=1&pageSize=25",
        "http://localhost:5000/api/v1/inventory-batches?page=2&pageSize=25",
        "http://localhost:5000/api/v1/inventory-batches?source_type=DONATED&page=1&pageSize=25",
      ],
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("batch service keeps legacy and paginated response contracts explicit", async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async () => createJsonResponse([]);
    await assert.rejects(
      fetchInventoryBatchesPage({ page: 1, pageSize: 25 }),
      /incomplete paginated inventory batch response/,
    );

    globalThis.fetch = async () =>
      createJsonResponse({ data: [], pagination: { totalItems: 0 } });
    await assert.rejects(
      fetchInventoryBatches(),
      /invalid inventory batch list response/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("identical transaction reads share one underlying request", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return createJsonResponse([]);
  };

  try {
    await Promise.all([
      fetchInventoryTransactions({ transaction_type: "OUTFLOW" }),
      fetchInventoryTransactions({ transaction_type: "OUTFLOW" }),
    ]);
    assert.equal(calls.length, 1);
    assert.equal(
      calls[0],
      "http://localhost:5000/api/v1/inventory-transactions?transaction_type=OUTFLOW",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Mayor preparation and page graph overlap produce three reads instead of six", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return createJsonResponse([]);
  };

  try {
    await Promise.all([
      fetchInventoryItems({ search: "" }),
      fetchInventoryItemsFromBatchService(),
      fetchInventoryItemsFromReliefPackService(),
      fetchInventoryBatches(),
      fetchInventoryBatchesFromTransactionService(),
      fetchInventoryTransactions(),
      fetchInventoryTransactions({}),
    ]);

    assert.equal(calls.length, 3);
    assert.deepEqual(
      [...new Set(calls)].sort(),
      [
        "http://localhost:5000/api/v1/inventory-batches",
        "http://localhost:5000/api/v1/inventory-items",
        "http://localhost:5000/api/v1/inventory-transactions",
      ],
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
