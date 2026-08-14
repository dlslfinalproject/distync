const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const servicePath = require.resolve("../src/services/inventoryBatch.service");
const repositoryPath = require.resolve("../src/repositories/inventoryBatch.repository");
const stockFormRepositoryPath = require.resolve(
  "../src/repositories/inventoryItemStockForm.repository",
);
const inventoryTransactionRepositoryPath = require.resolve(
  "../src/repositories/inventoryTransaction.repository",
);
const systemLogRepositoryPath = require.resolve("../src/repositories/systemLog.repository");
const notificationServicePath = require.resolve(
  "../src/modules/notifications/notification.service",
);
const mayorReportExportPath = require.resolve("../src/utils/mayorReportExport");
const systemLogPath = require.resolve("../src/utils/systemLog");
const inventoryStateBasisPath = require.resolve("../src/utils/inventoryStateBasis");
const dbPath = require.resolve("../src/config/db");

const withStubbedInventoryBatchService = async (stubs, runTest) => {
  const dependencyPaths = [
    repositoryPath,
    stockFormRepositoryPath,
    inventoryTransactionRepositoryPath,
    systemLogRepositoryPath,
    notificationServicePath,
    mayorReportExportPath,
    systemLogPath,
    inventoryStateBasisPath,
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

const buildRepositoryStub = (overrides = {}) => ({
  getInventoryItemById: async () => ({
    id: "item-1",
    item_code: "RICE",
    item_name: "Rice",
    category: "Food",
    unit_of_measure: "sack",
    is_active: true,
  }),
  getSupplierById: async () => null,
  getInventoryBatchByItemIdAndBatchNo: async () => null,
  insertInventoryBatch: async () => ({
    id: "batch-created",
    inventory_item_id: "item-1",
    inventory_item_stock_form_id: null,
    batch_no: "LOT-A",
    source_type: "LGU",
    quantity_received: 10,
    quantity_available: 10,
    stock_version: 0,
    expiration_date: null,
    received_at: "2026-08-09T00:00:00.000Z",
    storage_location: "Mayor's Office Inventory",
    status: "AVAILABLE",
    created_by: "user-1",
  }),
  getInventoryBatchById: async () => ({
    id: "batch-created",
    inventory_item_id: "item-1",
    inventory_item_stock_form_id: null,
    batch_no: "LOT-A",
    source_type: "LGU",
    quantity_received: 10,
    quantity_available: 10,
    stock_version: 0,
    expiration_date: null,
    received_at: "2026-08-09T00:00:00.000Z",
    storage_location: "Mayor's Office Inventory",
    status: "AVAILABLE",
    created_by: "user-1",
    item_code: "RICE",
    item_name: "Rice",
    category: "Food",
    unit_of_measure: "sack",
    is_active: true,
  }),
  ...overrides,
});

const baseStubs = (repositoryOverrides = {}) => ({
  [repositoryPath]: buildRepositoryStub(repositoryOverrides),
  [stockFormRepositoryPath]: {
    getInventoryItemStockFormsByItemId: async () => [],
    getInventoryItemStockFormById: async (id) => ({
      id,
      inventory_item_id: "item-1",
      is_active: true,
    }),
    getInventoryItemStockFormByDefinition: async () => null,
    insertInventoryItemStockForm: async () => ({ id: "stock-form-1" }),
  },
  [inventoryTransactionRepositoryPath]: {
    getInventoryTransactions: async () => [],
  },
  [systemLogRepositoryPath]: {
    getAuditLogsByEntity: async () => [],
  },
  [notificationServicePath]: {
    emitSafely: async () => {},
    emitBatchAlerts: async () => {},
  },
  [mayorReportExportPath]: {
    formatDateOnly: () => "",
    formatDateTime: () => "",
    buildExportFile: () => ({}),
    ALLOWED_EXPORT_FORMATS: ["csv", "excel", "pdf"],
  },
  [systemLogPath]: {
    logAuditSafely: async () => {},
    pickDefined: (value, keys) =>
      keys.reduce((picked, key) => {
        if (value[key] !== undefined) {
          picked[key] = value[key];
        }
        return picked;
      }, {}),
  },
  [inventoryStateBasisPath]: {
    createInventoryStateBasis: () => ({ basisVersion: 1 }),
  },
  [dbPath]: {},
});

test("INV-M03 migration and schema enforce per-item stored batch number uniqueness", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const migrationSql = fs.readFileSync(
    path.join(
      repoRoot,
      "database/migrations/2026-08-09_add_inventory_batch_identity_uniqueness.sql",
    ),
    "utf8",
  );
  const schemaSql = fs.readFileSync(
    path.join(repoRoot, "database/schema/distync_schema.sql"),
    "utf8",
  );

  for (const sql of [migrationSql, schemaSql]) {
    assert.match(
      sql,
      /inventory_batches_inventory_item_id_batch_no_unique[\s\S]*UNIQUE\s*\(\s*inventory_item_id\s*,\s*batch_no\s*\)/i,
    );
  }

  assert.doesNotMatch(migrationSql, /UNIQUE\s*\(\s*batch_no\s*\)/i);
  assert.doesNotMatch(migrationSql, /UNIQUE\s*\(\s*inventory_item_id\s*\)/i);
  assert.doesNotMatch(migrationSql, /LOWER\s*\(|BTRIM\s*\(/i);
});

test("INV-M03 repository insert uses non-aborting targeted ON CONFLICT", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const repositorySource = fs.readFileSync(
    path.join(repoRoot, "server/src/repositories/inventoryBatch.repository.js"),
    "utf8",
  );

  assert.match(
    repositorySource,
    /ON CONFLICT ON CONSTRAINT \$\{INVENTORY_BATCH_IDENTITY_CONSTRAINT\}\s+DO NOTHING\s+RETURNING/i,
  );
  assert.doesNotMatch(repositorySource, /catch\s*\([^)]*\)[\s\S]*23505/i);
});

test("createInventoryBatch restock path passes created_by through corrected batch repository insert", async () => {
  let insertedBatchPayload = null;

  await withStubbedInventoryBatchService(
    baseStubs({
      getInventoryBatchByItemIdAndBatchNo: async () => null,
      insertInventoryBatch: async (batchData) => {
        insertedBatchPayload = batchData;

        return {
          id: "batch-created",
          ...batchData,
        };
      },
    }),
    async ({ createInventoryBatch }) => {
      const batch = await createInventoryBatch({
        inventory_item_id: "item-1",
        inventory_item_stock_form_id: "stock-form-existing",
        batch_no: "LOT-RESTOCK",
        source_type: "LGU",
        quantity_received: 25,
        expiration_date: "2027-08-14",
        created_by: "mayor-user-1",
      });

      assert.equal(batch.id, "batch-created");
    },
  );

  assert.equal(insertedBatchPayload.inventory_item_id, "item-1");
  assert.equal(
    insertedBatchPayload.inventory_item_stock_form_id,
    "stock-form-existing",
  );
  assert.equal(insertedBatchPayload.quantity_available, 25);
  assert.equal(insertedBatchPayload.status, "AVAILABLE");
  assert.equal(insertedBatchPayload.created_by, "mayor-user-1");
});

test("createInventoryBatch maps friendly precheck duplicate to canonical 409", async () => {
  await withStubbedInventoryBatchService(
    baseStubs({
      getInventoryBatchByItemIdAndBatchNo: async () => ({
        id: "batch-existing",
        inventory_item_id: "item-1",
        batch_no: "LOT-A",
      }),
      insertInventoryBatch: async () => {
        throw new Error("insert must not run after duplicate precheck");
      },
    }),
    async ({ createInventoryBatch }) => {
      await assert.rejects(
        createInventoryBatch({
          inventory_item_id: "item-1",
          batch_no: "LOT-A",
          source_type: "LGU",
          quantity_received: 10,
          created_by: "user-1",
        }),
        (error) => {
          assert.equal(error.code, "DUPLICATE_INVENTORY_BATCH");
          assert.equal(error.statusCode, 409);
          assert.equal(error.entityServerId, "batch-existing");
          assert.equal(error.serverPayload.batch_no, "LOT-A");
          return true;
        },
      );
    },
  );
});

test("createInventoryBatch maps ON CONFLICT race loser to canonical duplicate without stock effects", async () => {
  let insertCalls = 0;
  let lookupCalls = 0;

  await withStubbedInventoryBatchService(
    baseStubs({
      getInventoryBatchByItemIdAndBatchNo: async () => {
        lookupCalls += 1;

        if (lookupCalls === 1) {
          return null;
        }

        return {
          id: "batch-winner",
          inventory_item_id: "item-1",
          batch_no: "LOT-A",
          quantity_received: 10,
          quantity_available: 10,
        };
      },
      insertInventoryBatch: async () => {
        insertCalls += 1;
        return null;
      },
      getInventoryBatchById: async () => {
        throw new Error("loser must not fetch a newly created batch");
      },
    }),
    async ({ createInventoryBatch }) => {
      await assert.rejects(
        createInventoryBatch({
          inventory_item_id: "item-1",
          batch_no: "LOT-A",
          source_type: "LGU",
          quantity_received: 20,
          created_by: "user-1",
        }),
        (error) => {
          assert.equal(error.code, "DUPLICATE_INVENTORY_BATCH");
          assert.equal(error.statusCode, 409);
          assert.equal(error.entityServerId, "batch-winner");
          assert.equal(error.serverPayload.quantity_received, 10);
          return true;
        },
      );
    },
  );

  assert.equal(insertCalls, 1);
  assert.equal(lookupCalls, 2);
});
