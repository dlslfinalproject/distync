const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repositoryPath = require.resolve(
  "../src/repositories/inventoryTransaction.repository",
);
const dbPath = require.resolve("../src/config/db");
const servicePath = require.resolve("../src/services/inventoryTransaction.service");
const inventoryBatchRepositoryPath = require.resolve(
  "../src/repositories/inventoryBatch.repository",
);
const inventoryItemRepositoryPath = require.resolve(
  "../src/repositories/inventoryItem.repository",
);
const notificationServicePath = require.resolve(
  "../src/modules/notifications/notification.service",
);
const systemLogRepositoryPath = require.resolve(
  "../src/repositories/systemLog.repository",
);

const withStubbedInventoryRepository = async (poolStub, runTest) => {
  const originalRepository = require.cache[repositoryPath];
  const originalDb = require.cache[dbPath];

  delete require.cache[repositoryPath];

  try {
    require.cache[dbPath] = {
      id: dbPath,
      filename: dbPath,
      loaded: true,
      exports: poolStub,
    };

    const repository = require(repositoryPath);
    await runTest(repository);
  } finally {
    delete require.cache[repositoryPath];

    if (originalRepository) {
      require.cache[repositoryPath] = originalRepository;
    }

    if (originalDb) {
      require.cache[dbPath] = originalDb;
    } else {
      delete require.cache[dbPath];
    }
  }
};

const withStubbedInventoryService = async (stubs, runTest) => {
  const dependencyPaths = [
    repositoryPath,
    inventoryBatchRepositoryPath,
    inventoryItemRepositoryPath,
    notificationServicePath,
    systemLogRepositoryPath,
    dbPath,
  ];
  const originalEntries = new Map(
    dependencyPaths.map((modulePath) => [modulePath, require.cache[modulePath]]),
  );

  delete require.cache[servicePath];

  try {
    dependencyPaths.forEach((modulePath) => {
      require.cache[modulePath] = {
        id: modulePath,
        filename: modulePath,
        loaded: true,
        exports: stubs[modulePath] || {},
      };
    });

    const service = require(servicePath);
    await runTest(service);
  } finally {
    delete require.cache[servicePath];

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

test("INV-M02 durable effect migration and schema define intent and audit source key", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const migrationSql = fs.readFileSync(
    path.join(
      repoRoot,
      "database/migrations/2026-08-09_add_inventory_domain_effect_intents.sql",
    ),
    "utf8",
  );
  const schemaSql = fs.readFileSync(
    path.join(repoRoot, "database/schema/distync_schema.sql"),
    "utf8",
  );

  for (const sql of [migrationSql, schemaSql]) {
    assert.match(sql, /inventory_domain_effect_intents/);
    assert.match(sql, /inventory_transaction_id/);
    assert.match(sql, /sync_transaction_id/);
    assert.match(sql, /audit_processed_at/);
    assert.match(sql, /alerts_processed_at/);
    assert.match(sql, /inventory_domain_effect_intents_pending_idx/);
    assert.match(sql, /source_event_key text/);
    assert.match(sql, /audit_logs_source_event_key_unique/);
    assert.match(sql, /WHERE source_event_key IS NOT NULL/);
  }
});

test("INV-M02 inventory incident alerts use a stable source event key", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const serviceSource = fs.readFileSync(
    path.join(repoRoot, "server/src/modules/notifications/notification.service.js"),
    "utf8",
  );

  assert.match(serviceSource, /source_event_key:\s*`INVENTORY_INCIDENT:\$\{transaction\.id\}`/);
  assert.match(serviceSource, /source_event_key,\s*dedupeHours/s);
});

test("INV-M02 inventory effect intent insertion is source unique and retry-claimable", async () => {
  const queries = [];

  await withStubbedInventoryRepository(
    {
      query: async (sql, params) => {
        queries.push({ sql, params });
        return {
          rows: [
            {
              id: "intent-1",
              inventory_transaction_id: params?.[0],
            },
          ],
        };
      },
      on: () => {},
    },
    async ({
      ensureInventoryDomainEffectIntent,
      claimPendingInventoryDomainEffectIntents,
    }) => {
      await ensureInventoryDomainEffectIntent(
        {
          inventoryTransactionId: "tx-1",
          syncTransactionId: "sync-1",
          effectPayload: { transaction: { id: "tx-1" } },
        },
        { query: async (sql, params) => {
          queries.push({ sql, params });
          return { rows: [{ id: "intent-1" }] };
        } },
      );
      await claimPendingInventoryDomainEffectIntents(10);

      assert.match(queries[0].sql, /INSERT INTO inventory_domain_effect_intents/);
      assert.match(queries[0].sql, /ON CONFLICT \(inventory_transaction_id\)/);
      assert.equal(queries[0].params[0], "tx-1");
      assert.equal(queries[0].params[1], "sync-1");
      assert.match(queries[1].sql, /FOR UPDATE SKIP LOCKED/);
      assert.match(queries[1].sql, /status IN \('PENDING', 'FAILED'\)/);
      assert.match(queries[1].sql, /status = 'PROCESSING'/);
    },
  );
});

test("EE-FIX-04 repository event lookup returns authoritative status using the supplied client", async () => {
  const queries = [];

  await withStubbedInventoryRepository(
    {
      query: async () => {
        throw new Error("pool should not be used when a dbClient is supplied");
      },
      on: () => {},
    },
    async ({ getDisasterEventById }) => {
      const event = await getDisasterEventById("event-1", {
        query: async (sql, params) => {
          queries.push({ sql, params });
          return {
            rows: [
              {
                id: "event-1",
                event_code: "EVT-2026-001",
                title: "Flood",
                status: "CLOSED",
              },
            ],
          };
        },
      });

      assert.equal(event.status, "CLOSED");
      assert.match(queries[0].sql, /SELECT id, event_code, title, status/);
      assert.deepEqual(queries[0].params, ["event-1"]);
    },
  );
});

test("INV-M02 processor persists canonical audit with offline device and then alerts", async () => {
  const marks = [];
  const auditPayloads = [];
  const alertPayloads = [];

  await withStubbedInventoryService(
    {
      [repositoryPath]: {
        claimInventoryDomainEffectIntentById: async () => ({
          id: "intent-1",
          audit_processed_at: null,
          alerts_processed_at: null,
          effect_payload_json: {
            transaction: {
              id: "tx-1",
              inventory_batch_id: "batch-1",
              transaction_type: "MISSING",
              quantity: 2,
              performed_by: "user-1",
            },
            batch: {
              id: "batch-1",
              inventory_item_id: "item-1",
              batch_no: "BATCH-1",
              quantity_available: 4,
              status: "LOW_STOCK",
            },
            previousQuantityAvailable: 6,
            previousStatus: "AVAILABLE",
            disasterEventId: null,
            actor: {
              userId: "user-1",
              roleCode: "MAYOR",
              deviceId: "device-1",
            },
          },
        }),
        markInventoryDomainEffectAuditProcessed: async (id) => marks.push(`audit:${id}`),
        markInventoryDomainEffectAlertsProcessed: async (id) => marks.push(`alerts:${id}`),
        markInventoryDomainEffectIntentProcessed: async (id) => marks.push(`processed:${id}`),
        markInventoryDomainEffectIntentFailed: async () => {
          throw new Error("processor should not fail");
        },
      },
      [notificationServicePath]: {
        emitInventoryTransactionAlerts: async (payload) => {
          alertPayloads.push(payload);
        },
      },
      [systemLogRepositoryPath]: {
        insertAuditLog: async (payload) => {
          auditPayloads.push(payload);
          return { id: "audit-1" };
        },
      },
      [dbPath]: {
        connect: async () => {
          throw new Error("pool should not be used");
        },
      },
    },
    async ({ processInventoryDomainEffectIntentById }) => {
      await processInventoryDomainEffectIntentById("intent-1");

      assert.equal(auditPayloads.length, 1);
      assert.equal(auditPayloads[0].action, "INVENTORY_TRANSACTION_CREATE");
      assert.equal(auditPayloads[0].entity_id, "tx-1");
      assert.equal(auditPayloads[0].user_id, "user-1");
      assert.equal(auditPayloads[0].role_code, "MAYOR");
      assert.equal(auditPayloads[0].device_id, "device-1");
      assert.equal(
        auditPayloads[0].source_event_key,
        "INVENTORY_TRANSACTION_CREATE:tx-1",
      );
      assert.equal(alertPayloads.length, 1);
      assert.equal(alertPayloads[0].transaction.id, "tx-1");
      assert.deepEqual(marks, ["audit:intent-1", "alerts:intent-1", "processed:intent-1"]);
    },
  );
});

const buildInventoryCreateStubs = ({
  disasterEventStatus = "ACTIVE",
  existingTransaction = null,
  batchQuantity = 20,
  events = [],
} = {}) => ({
  [repositoryPath]: {
    getUserById: async (id) => ({ id, first_name: "Mayor", last_name: "User" }),
    getInventoryTransactionByReferenceNo: async (referenceNo) => {
      events.push(`duplicate:${referenceNo}`);
      return existingTransaction;
    },
    getDisasterEventById: async (id, dbClient) => {
      events.push(`event:${id}:${dbClient?.id || "pool"}`);
      return disasterEventStatus
        ? { id, event_code: "EVT-2026-001", title: "Flood", status: disasterEventStatus }
        : null;
    },
    getInventoryBatchByIdForUpdate: async (id) => {
      events.push(`batch:${id}`);
      return {
        id,
        inventory_item_id: "item-1",
        batch_no: "BATCH-1",
        quantity_available: batchQuantity,
        expiration_date: null,
        status: "AVAILABLE",
        item_name: "Rice",
      };
    },
    getAvailableInventoryBatchesByItemIdForUpdate: async () => [],
    insertInventoryTransaction: async (transactionData) => {
      events.push(`insert:${transactionData.inventory_transaction_reference_no}`);
      return {
        id: "tx-1",
        ...transactionData,
        performed_at: "2026-08-10T00:00:00.000Z",
        created_at: "2026-08-10T00:00:00.000Z",
      };
    },
    updateInventoryBatchQuantityAndStatus: async (id, quantityAvailable, status) => {
      events.push(`batch-update:${id}:${quantityAvailable}:${status}`);
      return { id, quantity_available: quantityAvailable, status };
    },
    ensureInventoryDomainEffectIntent: async ({ inventoryTransactionId }) => {
      events.push(`intent:${inventoryTransactionId}`);
      return { id: "intent-1" };
    },
  },
  [inventoryItemRepositoryPath]: {
    getInventoryItemByIdForUpdate: async (id) => {
      events.push(`item:${id}`);
      return {
        id,
        item_code: "RICE",
        item_name: "Rice",
        quantity: 20,
        packaging: "piece",
        packaging_count: 20,
      };
    },
    updateInventoryItemStockSnapshot: async (id, snapshot) => {
      events.push(`item-update:${id}:${snapshot.packaging_count}`);
      return { id, ...snapshot };
    },
  },
  [inventoryBatchRepositoryPath]: {
    insertInventoryBatch: async () => {
      throw new Error("fallback batch should not be created");
    },
  },
  [notificationServicePath]: {
    emitInventoryTransactionAlerts: async () => {
      throw new Error("external transaction test should defer side effects");
    },
  },
  [systemLogRepositoryPath]: {
    insertAuditLog: async () => {
      throw new Error("external transaction test should defer audit side effects");
    },
  },
  [dbPath]: {
    connect: async () => {
      throw new Error("external dbClient should be reused");
    },
  },
});

const createInventoryPayload = (overrides = {}) => ({
  disaster_event_id: "event-1",
  inventory_batch_id: "batch-1",
  transaction_type: "OUTFLOW",
  quantity: 5,
  reference_type: "MANUAL",
  reference_id: null,
  inventoryTransactionReferenceNo: "ITR-2026-000321",
  performed_by: "user-1",
  remarks: null,
  dbClient: {
    id: "sync-client",
    query: async () => ({ rows: [{ total_quantity: 15 }] }),
  },
  ...overrides,
});

test("EE-FIX-04 ACTIVE event-specific manual OUTFLOW proceeds with existing validation and stock mutation", async () => {
  const events = [];

  await withStubbedInventoryService(
    buildInventoryCreateStubs({ disasterEventStatus: "ACTIVE", events }),
    async ({ createInventoryTransaction }) => {
      const result = await createInventoryTransaction(createInventoryPayload());

      assert.equal(result.inventory_transaction_reference_no, "ITR-2026-000321");
      assert.equal(result.new_quantity_available, 15);
      assert.deepEqual(events, [
        "duplicate:ITR-2026-000321",
        "event:event-1:sync-client",
        "batch:batch-1",
        "item:item-1",
        "insert:ITR-2026-000321",
        "batch-update:batch-1:15:AVAILABLE",
        "item-update:item-1:15",
        "intent:tx-1",
      ]);
    },
  );
});

test("EE-FIX-04 non-ACTIVE event-specific manual OUTFLOW is rejected before inventory effects", async () => {
  for (const disasterEventStatus of ["PLANNED", "CLOSED", "ARCHIVED"]) {
    const events = [];

    await withStubbedInventoryService(
      buildInventoryCreateStubs({ disasterEventStatus, events }),
      async ({ createInventoryTransaction }) => {
        await assert.rejects(
          () => createInventoryTransaction(createInventoryPayload()),
          (error) => {
            assert.equal(error.statusCode, 400);
            assert.equal(error.code, "DISASTER_EVENT_NOT_ACTIVE");
            return true;
          },
        );

        assert.deepEqual(events, [
          "duplicate:ITR-2026-000321",
          "event:event-1:sync-client",
        ]);
      },
    );
  }
});

test("EE-FIX-04 general inventory transactions are not blocked by non-ACTIVE event metadata", async () => {
  for (const transactionType of ["INFLOW", "ADJUSTMENT", "EXPIRED", "MISSING", "DAMAGED", "SPOILED", "STOLEN", "RETURN"]) {
    const events = [];

    await withStubbedInventoryService(
      buildInventoryCreateStubs({ disasterEventStatus: "CLOSED", events }),
      async ({ createInventoryTransaction }) => {
        const result = await createInventoryTransaction(
          createInventoryPayload({
            transaction_type: transactionType,
            quantity: 1,
            inventoryTransactionReferenceNo: `ITR-2026-10000${events.length + 1}`,
          }),
        );

        assert.equal(result.transaction_type, transactionType);
        assert.equal(events.some((entry) => entry.startsWith("insert:")), true);
      },
    );
  }
});

test("EE-FIX-04 general non-event OUTFLOW remains valid and does not require event status", async () => {
  const events = [];

  await withStubbedInventoryService(
    buildInventoryCreateStubs({ disasterEventStatus: "CLOSED", events }),
    async ({ createInventoryTransaction }) => {
      const result = await createInventoryTransaction(
        createInventoryPayload({ disaster_event_id: null }),
      );

      assert.equal(result.transaction_type, "OUTFLOW");
      assert.equal(events.some((entry) => entry.startsWith("event:")), false);
      assert.equal(events.some((entry) => entry.startsWith("insert:")), true);
    },
  );
});

test("EE-FIX-04 duplicate ITR remains authoritative before lifecycle rejection for different client IDs", async () => {
  const events = [];

  await withStubbedInventoryService(
    buildInventoryCreateStubs({
      disasterEventStatus: "CLOSED",
      existingTransaction: {
        id: "tx-existing",
        inventory_transaction_reference_no: "ITR-2026-000321",
        transaction_type: "OUTFLOW",
      },
      events,
    }),
    async ({ createInventoryTransaction }) => {
      await assert.rejects(
        () => createInventoryTransaction(createInventoryPayload()),
        (error) => {
          assert.equal(error.code, "DUPLICATE_INVENTORY_TRANSACTION_REFERENCE_NO");
          assert.equal(error.entityServerId, "tx-existing");
          return true;
        },
      );

      assert.deepEqual(events, ["duplicate:ITR-2026-000321"]);
    },
  );
});

test("EE-FIX-04 invalid ITR and ACTIVE insufficient stock remain protected", async () => {
  await withStubbedInventoryService(
    buildInventoryCreateStubs(),
    async ({ createInventoryTransaction }) => {
      await assert.rejects(
        () =>
          createInventoryTransaction(
            createInventoryPayload({
              inventoryTransactionReferenceNo: "ITR-2026-000000",
            }),
          ),
        /Inventory Transaction Reference No\. must use ITR-YYYY-NNNNNN/,
      );
    },
  );

  const events = [];
  await withStubbedInventoryService(
    buildInventoryCreateStubs({ batchQuantity: 2, events }),
    async ({ createInventoryTransaction }) => {
      await assert.rejects(
        () => createInventoryTransaction(createInventoryPayload({ quantity: 5 })),
        /Insufficient quantity_available/,
      );

      assert.equal(events.some((entry) => entry.startsWith("insert:")), false);
      assert.equal(events.some((entry) => entry.startsWith("batch-update:")), false);
    },
  );
});
