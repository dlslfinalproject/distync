const test = require("node:test");
const assert = require("node:assert/strict");

const servicePath = require.resolve("../src/services/inventoryBatchStatus.service");
const repositoryPath = require.resolve(
  "../src/repositories/inventoryBatchStatus.repository",
);
const dbPath = require.resolve("../src/config/db");

const withStubbedStatusService = async ({ repository, pool }, runTest) => {
  const dependencyPaths = [servicePath, repositoryPath, dbPath];
  const originalEntries = new Map(
    dependencyPaths.map((modulePath) => [modulePath, require.cache[modulePath]]),
  );

  dependencyPaths.forEach((modulePath) => delete require.cache[modulePath]);
  require.cache[repositoryPath] = {
    id: repositoryPath,
    filename: repositoryPath,
    loaded: true,
    exports: repository,
  };
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: pool || {},
  };

  try {
    await runTest(require(servicePath));
  } finally {
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

const createFixture = ({ reorderLevel, batches }) => {
  const updates = [];
  const repository = {
    getInventoryItemStatusContextForUpdate: async () => ({
      id: "item-1",
      reorder_level: reorderLevel,
    }),
    getInventoryBatchesForStatusRefresh: async () => batches,
    updateInventoryBatchStatusIfChanged: async (batchId, nextStatus) => {
      const batch = batches.find((candidate) => candidate.id === batchId);

      if (!batch || batch.status === nextStatus) {
        return null;
      }

      batch.status = nextStatus;
      updates.push({ batchId, nextStatus });
      return {
        id: batch.id,
        status: batch.status,
        stock_version: 0,
        updated_at: "2026-09-07T00:00:00.000Z",
      };
    },
    getExpiredDerivedInventoryItemIds: async () => ["item-1"],
  };

  return { repository, updates };
};

const externalClient = () => ({
  query: async () => ({ rows: [] }),
});

test("refreshes a derived batch when time passes and is idempotent", async () => {
  const originalDate = global.Date;
  let now = new originalDate("2026-09-01T12:00:00.000Z").getTime();

  class ControlledDate extends originalDate {
    constructor(...args) {
      super(...(args.length === 0 ? [now] : args));
    }

    static now() {
      return now;
    }
  }

  global.Date = ControlledDate;
  const fixture = createFixture({
    reorderLevel: 30,
    batches: [
      {
        id: "batch-expiring",
        quantity_available: 40,
        expiration_date: "2026-09-02",
        status: "AVAILABLE",
      },
    ],
  });

  try {
    await withStubbedStatusService(
      { repository: fixture.repository },
      async (service) => {
        let summary =
          await service.refreshDerivedInventoryBatchStatusesForItem(
            "item-1",
            { dbClient: externalClient() },
          );
        assert.equal(summary.changed, 0);

        now = new originalDate("2026-09-03T12:00:00.000Z").getTime();
        summary = await service.refreshDerivedInventoryBatchStatusesForItem(
          "item-1",
          { dbClient: externalClient() },
        );

        assert.equal(summary.changed, 1);
        assert.deepEqual(summary.transitions, {
          "AVAILABLE->EXPIRED": 1,
        });
        assert.deepEqual(fixture.updates, [
          { batchId: "batch-expiring", nextStatus: "EXPIRED" },
        ]);

        summary = await service.refreshDerivedInventoryBatchStatusesForItem(
          "item-1",
          { dbClient: externalClient() },
        );
        assert.equal(summary.changed, 0);
        assert.equal(fixture.updates.length, 1);
      },
    );
  } finally {
    global.Date = originalDate;
  }
});

test("owned dry runs never update rows and always roll back", async () => {
  const events = [];
  const client = {
    query: async (sql) => {
      events.push(String(sql).trim());
      return { rows: [] };
    },
    release: () => events.push("RELEASE"),
  };
  const fixture = createFixture({
    reorderLevel: 20,
    batches: [
      {
        id: "batch-dry-run",
        quantity_available: 10,
        expiration_date: null,
        status: "AVAILABLE",
      },
    ],
  });

  await withStubbedStatusService(
    {
      repository: fixture.repository,
      pool: { connect: async () => client },
    },
    async (service) => {
      const summary = await service.refreshDerivedInventoryBatchStatusesForItem(
        "item-1",
        { dryRun: true },
      );

      assert.equal(summary.changed, 1);
      assert.deepEqual(fixture.updates, []);
      assert.equal(events[0], "BEGIN");
      assert.equal(events[1], "ROLLBACK");
      assert.equal(events[2], "RELEASE");
    },
  );
});

test("reconciles sibling aggregate status while preserving manual statuses", async () => {
  const fixture = createFixture({
    reorderLevel: 20,
    batches: [
      {
        id: "batch-low",
        quantity_available: 10,
        expiration_date: null,
        status: "AVAILABLE",
      },
      {
        id: "batch-sibling",
        quantity_available: 20,
        expiration_date: null,
        status: "LOW_STOCK",
      },
      {
        id: "batch-missing",
        quantity_available: 5,
        expiration_date: null,
        status: "MISSING",
      },
      {
        id: "batch-damaged",
        quantity_available: 5,
        expiration_date: null,
        status: "DAMAGED",
      },
    ],
  });

  await withStubbedStatusService(
    { repository: fixture.repository },
    async (service) => {
      const summary =
        await service.refreshDerivedInventoryBatchStatusesForItem(
          "item-1",
          { dbClient: externalClient() },
        );

      assert.equal(summary.examined, 4);
      assert.equal(summary.changed, 1);
      assert.equal(summary.skippedManual, 2);
      assert.deepEqual(summary.transitions, {
        "LOW_STOCK->AVAILABLE": 1,
      });
      assert.deepEqual(fixture.updates, [
        { batchId: "batch-sibling", nextStatus: "AVAILABLE" },
      ]);
    },
  );
});

test("reconciles a sibling decrease across the low-stock threshold", async () => {
  const fixture = createFixture({
    reorderLevel: 30,
    batches: [
      {
        id: "batch-primary",
        quantity_available: 20,
        expiration_date: null,
        status: "AVAILABLE",
      },
      {
        id: "batch-decreased-sibling",
        quantity_available: 10,
        expiration_date: null,
        status: "LOW_STOCK",
      },
    ],
  });

  await withStubbedStatusService(
    { repository: fixture.repository },
    async (service) => {
      const summary =
        await service.refreshDerivedInventoryBatchStatusesForItem(
          "item-1",
          { dbClient: externalClient() },
        );

      assert.equal(summary.changed, 1);
      assert.deepEqual(summary.transitions, {
        "AVAILABLE->LOW_STOCK": 1,
      });
      assert.deepEqual(fixture.updates, [
        { batchId: "batch-primary", nextStatus: "LOW_STOCK" },
      ]);
    },
  );
});

test("applies DEPLETED before expiration and expiration before low stock", async () => {
  const fixture = createFixture({
    reorderLevel: 100,
    batches: [
      {
        id: "batch-depleted",
        quantity_available: 0,
        expiration_date: "2099-12-31",
        status: "AVAILABLE",
      },
      {
        id: "batch-expired",
        quantity_available: 5,
        expiration_date: "2000-01-01",
        status: "LOW_STOCK",
      },
    ],
  });

  await withStubbedStatusService(
    { repository: fixture.repository },
    async (service) => {
      const summary =
        await service.refreshDerivedInventoryBatchStatusesForItem(
          "item-1",
          { dbClient: externalClient() },
        );

      assert.deepEqual(summary.transitions, {
        "AVAILABLE->DEPLETED": 1,
        "LOW_STOCK->EXPIRED": 1,
      });
    },
  );
});

test("periodic refresh uses the advisory lock and commits only when acquired", async () => {
  const events = [];
  const client = {
    query: async (sql) => {
      events.push(String(sql).trim());

      if (String(sql).includes("pg_try_advisory_xact_lock")) {
        return { rows: [{ acquired: true }] };
      }

      return { rows: [] };
    },
    release: () => events.push("RELEASE"),
  };
  const fixture = createFixture({
    reorderLevel: 20,
    batches: [
      {
        id: "batch-periodic",
        quantity_available: 10,
        expiration_date: "2000-01-01",
        status: "AVAILABLE",
      },
    ],
  });

  await withStubbedStatusService(
    {
      repository: fixture.repository,
      pool: { connect: async () => client },
    },
    async (service) => {
      const result = await service.executeExpiredInventoryBatchStatusRefresh();

      assert.equal(result.skipped, false);
      assert.equal(result.changed, 1);
      assert.equal(
        events.some((event) => event.includes("pg_try_advisory_xact_lock")),
        true,
      );
      assert.equal(events.includes("COMMIT"), true);
      assert.equal(events.includes("RELEASE"), true);
    },
  );
});

test("periodic refresh rolls back when another instance owns the advisory lock", async () => {
  const events = [];
  const client = {
    query: async (sql) => {
      events.push(String(sql).trim());

      if (String(sql).includes("pg_try_advisory_xact_lock")) {
        return { rows: [{ acquired: false }] };
      }

      return { rows: [] };
    },
    release: () => events.push("RELEASE"),
  };

  await withStubbedStatusService(
    {
      repository: {
        getExpiredDerivedInventoryItemIds: async () => {
          throw new Error("candidate query should be skipped");
        },
      },
      pool: { connect: async () => client },
    },
    async (service) => {
      const result = await service.executeExpiredInventoryBatchStatusRefresh();

      assert.equal(result.skipped, true);
      assert.equal(result.reason, "advisory-lock-unavailable");
      assert.equal(events.includes("ROLLBACK"), true);
      assert.equal(events.includes("RELEASE"), true);
    },
  );
});

test("periodic refresh never converts expired manual incident statuses", async () => {
  const events = [];
  const client = {
    query: async (sql) => {
      events.push(String(sql).trim());

      if (String(sql).includes("pg_try_advisory_xact_lock")) {
        return { rows: [{ acquired: true }] };
      }

      return { rows: [] };
    },
    release: () => events.push("RELEASE"),
  };
  const fixture = createFixture({
    reorderLevel: 20,
    batches: [
      {
        id: "batch-missing",
        quantity_available: 10,
        expiration_date: "2000-01-01",
        status: "MISSING",
      },
      {
        id: "batch-damaged",
        quantity_available: 10,
        expiration_date: "2000-01-01",
        status: "DAMAGED",
      },
    ],
  });

  await withStubbedStatusService(
    {
      repository: fixture.repository,
      pool: { connect: async () => client },
    },
    async (service) => {
      const result = await service.executeExpiredInventoryBatchStatusRefresh();

      assert.equal(result.changed, 0);
      assert.equal(result.itemSummaries[0].skippedManual, 2);
      assert.deepEqual(fixture.updates, []);
      assert.equal(events.includes("COMMIT"), true);
    },
  );
});

test("periodic maintenance lifecycle is idempotent and stoppable", async () => {
  const events = [];
  const client = {
    query: async (sql) => {
      events.push(String(sql).trim());

      if (String(sql).includes("pg_try_advisory_xact_lock")) {
        return { rows: [{ acquired: true }] };
      }

      return { rows: [] };
    },
    release: () => events.push("RELEASE"),
  };
  const fixture = createFixture({
    reorderLevel: 20,
    batches: [
      {
        id: "batch-lifecycle",
        quantity_available: 10,
        expiration_date: "2000-01-01",
        status: "AVAILABLE",
      },
    ],
  });
  const originalSetInterval = global.setInterval;
  const originalClearInterval = global.clearInterval;
  const intervalHandles = [];

  global.setInterval = (handler, intervalMs) => {
    const handle = {
      handler,
      intervalMs,
      unref: () => events.push("UNREF"),
    };
    intervalHandles.push(handle);
    return handle;
  };
  global.clearInterval = (handle) => events.push(handle);

  try {
    await withStubbedStatusService(
      {
        repository: fixture.repository,
        pool: { connect: async () => client },
      },
      async (service) => {
        const result =
          await service.initializeInventoryBatchStatusMaintenance();

        assert.equal(result.changed, 1);
        service.startInventoryBatchStatusMaintenance();
        service.startInventoryBatchStatusMaintenance();

        assert.equal(intervalHandles.length, 1);
        assert.equal(
          intervalHandles[0].intervalMs,
          service.INVENTORY_BATCH_STATUS_MAINTENANCE_INTERVAL_MS,
        );
        assert.equal(events.includes("UNREF"), true);

        service.stopInventoryBatchStatusMaintenance();
        assert.equal(events.includes(intervalHandles[0]), true);
      },
    );
  } finally {
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
  }
});

test("concurrent in-process runs collapse to one maintenance execution", async () => {
  let releaseFirstRun;
  let resolveLockReached;
  const lockReached = new Promise((resolve) => {
    resolveLockReached = resolve;
  });
  const firstRunMayContinue = new Promise((resolve) => {
    releaseFirstRun = resolve;
  });
  const client = {
    query: async (sql) => {
      if (String(sql).includes("pg_try_advisory_xact_lock")) {
        resolveLockReached();
        await firstRunMayContinue;
        return { rows: [{ acquired: true }] };
      }

      return { rows: [] };
    },
    release: () => {},
  };
  const fixture = createFixture({
    reorderLevel: 20,
    batches: [
      {
        id: "batch-concurrent",
        quantity_available: 10,
        expiration_date: "2000-01-01",
        status: "AVAILABLE",
      },
    ],
  });

  await withStubbedStatusService(
    {
      repository: fixture.repository,
      pool: { connect: async () => client },
    },
    async (service) => {
      const firstRun = service.runInventoryBatchStatusMaintenance();
      await lockReached;

      const secondResult = await service.runInventoryBatchStatusMaintenance();
      assert.equal(secondResult.skipped, true);
      assert.equal(secondResult.reason, "already-running");

      releaseFirstRun();
      const firstResult = await firstRun;
      assert.equal(firstResult.changed, 1);
    },
  );
});
