const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const servicePath = require.resolve("../src/services/inventoryBatch.service");
const repositoryPath = require.resolve("../src/repositories/inventoryBatch.repository");
const inventoryItemRepositoryPath = require.resolve(
  "../src/repositories/inventoryItem.repository",
);
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
    inventoryItemRepositoryPath,
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
  [inventoryItemRepositoryPath]: {
    updateInventoryItemReorderLevel: async (id, reorderLevel) => ({
      id,
      reorder_level: reorderLevel,
    }),
  },
  [stockFormRepositoryPath]: {
    getInventoryItemStockFormsByItemId: async () => [],
    getInventoryItemStockFormById: async (id) => ({
      id,
      inventory_item_id: "item-1",
      is_active: true,
    }),
    getInventoryItemStockFormByBarcode: async () => null,
    getInventoryItemStockFormByDefinition: async () => null,
    insertInventoryItemStockForm: async () => ({ id: "stock-form-1" }),
    updateInventoryItemStockForm: async (id, stockFormData) => ({
      id,
      ...stockFormData,
    }),
  },
  [inventoryTransactionRepositoryPath]: {
    getInventoryTransactions: async () => [],
    insertInventoryTransaction: async (transactionData) => ({
      id: "transaction-created",
      ...transactionData,
      inventory_transaction_reference_no: "ITR-2026-000001",
    }),
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
  [dbPath]: {
    connect: async () => ({
      query: async () => ({ rows: [] }),
      release() {},
    }),
  },
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

test("stock form definitions stay unique regardless of barcode assignment", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const migrationSql = fs.readFileSync(
    path.join(
      repoRoot,
      "database/migrations/2026-08-26_enforce_inventory_stock_form_definition.sql",
    ),
    "utf8",
  );
  const schemaSql = fs.readFileSync(
    path.join(repoRoot, "database/schema/distync_schema.sql"),
    "utf8",
  );

  assert.match(
    migrationSql,
    /inventory_item_stock_forms_unique_definition/i,
  );
  assert.match(
    migrationSql,
    /COALESCE\(unit_of_measure_value,\s*'-1'::numeric\)/i,
  );
  assert.match(
    migrationSql,
    /DROP\s+INDEX\s+IF\s+EXISTS\s+inventory_item_stock_forms_unique_(?:unbarcoded|barcoded)_definition/i,
  );
  assert.match(
    schemaSql,
    /CREATE\s+UNIQUE\s+INDEX\s+inventory_item_stock_forms_unique_definition[\s\S]*COALESCE\(unit_of_measure_value,\s*'-1'::numeric\)/i,
  );
  assert.doesNotMatch(
    schemaSql,
    /inventory_item_stock_forms_unique_(?:unbarcoded|barcoded)_definition/i,
  );
  assert.doesNotMatch(
    schemaSql,
    /inventory_item_stock_forms_unique_packaging\s+UNIQUE/i,
  );
});

test("createInventoryBatch restock path passes created_by through corrected batch repository insert", async () => {
  let insertedBatchPayload = null;
  let insertedTransactionPayload = null;
  const stubs = baseStubs({
    getInventoryBatchByItemIdAndBatchNo: async () => null,
    insertInventoryBatch: async (batchData) => {
      insertedBatchPayload = batchData;

      return {
        id: "batch-created",
        ...batchData,
      };
    },
  });
  stubs[inventoryTransactionRepositoryPath] = {
    ...stubs[inventoryTransactionRepositoryPath],
    insertInventoryTransaction: async (transactionData) => {
      insertedTransactionPayload = transactionData;

      return {
        id: "transaction-created",
        ...transactionData,
        inventory_transaction_reference_no: "ITR-2026-000001",
      };
    },
  };

  await withStubbedInventoryBatchService(
    stubs,
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
  assert.deepEqual(insertedTransactionPayload, {
    disaster_event_id: null,
    inventory_batch_id: "batch-created",
    transaction_type: "INFLOW",
    quantity: 25,
    reference_type: "MANUAL",
    reference_id: "batch-created",
    performed_by: "mayor-user-1",
    remarks: "Stock received during inventory batch creation",
  });
});

test("createInventoryBatch updates a missing reorder level in the same transaction as restock", async () => {
  const transactionEvents = [];
  const actions = [];
  let updatedReorderLevel = null;
  let reorderUpdateClient = null;
  const fakeClient = {
    async query(sql) {
      transactionEvents.push(sql);
      return { rows: [] };
    },
    release() {
      transactionEvents.push("RELEASE");
    },
  };

  await withStubbedInventoryBatchService(
    {
      ...baseStubs({
        insertInventoryBatch: async (batchData) => {
          actions.push("batch");
          return { id: "batch-created", ...batchData };
        },
        getInventoryBatchById: async () => ({
          id: "batch-created",
          inventory_item_id: "item-1",
          inventory_item_stock_form_id: "stock-form-existing",
          batch_no: "LOT-REORDER",
          source_type: "LGU",
          quantity_received: 10,
          quantity_available: 10,
          status: "AVAILABLE",
          item_code: "RICE",
          item_name: "Rice",
          category: "Food",
          unit_of_measure: "sack",
          is_active: true,
        }),
      }),
      [inventoryItemRepositoryPath]: {
        updateInventoryItemReorderLevel: async (id, reorderLevel, dbClient) => {
          actions.push("reorder");
          updatedReorderLevel = reorderLevel;
          reorderUpdateClient = dbClient;
          return { id, reorder_level: reorderLevel };
        },
      },
      [dbPath]: {
        connect: async () => fakeClient,
      },
    },
    async ({ createInventoryBatch }) => {
      const batch = await createInventoryBatch({
        inventory_item_id: "item-1",
        inventory_item_stock_form_id: "stock-form-existing",
        batch_no: "LOT-REORDER",
        source_type: "LGU",
        quantity_received: 10,
        inventory_item_reorder_level: 12,
      });

      assert.equal(batch.id, "batch-created");
    },
  );

  assert.equal(updatedReorderLevel, 12);
  assert.equal(reorderUpdateClient, fakeClient);
  assert.deepEqual(actions, ["reorder", "batch"]);
  assert.deepEqual(transactionEvents, ["BEGIN", "COMMIT", "RELEASE"]);
});

test("createInventoryBatch rejects inactive packaging", async () => {
  await withStubbedInventoryBatchService(
    {
      ...baseStubs(),
      [stockFormRepositoryPath]: {
        ...baseStubs()[stockFormRepositoryPath],
        getInventoryItemStockFormById: async () => ({
          id: "stock-form-inactive",
          inventory_item_id: "item-1",
          is_active: false,
        }),
      },
    },
    async ({ createInventoryBatch }) => {
      await assert.rejects(
        createInventoryBatch({
          inventory_item_id: "item-1",
          inventory_item_stock_form_id: "stock-form-inactive",
          batch_no: "LOT-INACTIVE",
          source_type: "LGU",
          quantity_received: 10,
        }),
        (error) => {
          assert.equal(error.statusCode, 400);
          assert.equal(error.message, "The selected packaging is inactive");
          return true;
        },
      );
    },
  );
});

test("createInventoryBatch creates a new barcode stock form for a new packaging definition", async () => {
  let insertedStockFormPayload = null;
  let insertedBatchPayload = null;

  await withStubbedInventoryBatchService(
    {
      ...baseStubs({
        getInventoryItemById: async () => ({
          id: "item-1",
          item_code: "TUNA",
          item_name: "Century Tuna Flakes in Oil - Century Tuna",
          category: "Perishable",
          unit_of_measure: "pc",
          unit_of_measure_value: 1,
          packaging: "piece",
          quantity: 1,
          is_active: true,
        }),
        insertInventoryBatch: async (batchData) => {
          insertedBatchPayload = batchData;
          return {
            id: "batch-created",
            ...batchData,
          };
        },
        getInventoryBatchById: async () => ({
          id: "batch-created",
          ...insertedBatchPayload,
          item_code: "TUNA",
          item_name: "Century Tuna Flakes in Oil - Century Tuna",
          category: "Perishable",
          unit_of_measure: "pc",
          barcode: null,
          stock_form_barcode: insertedStockFormPayload?.barcode || null,
          stock_form_packaging: insertedStockFormPayload?.packaging || null,
          stock_form_units_per_packaging:
            insertedStockFormPayload?.units_per_packaging || null,
          stock_form_unit_of_measure:
            insertedStockFormPayload?.unit_of_measure || null,
          stock_form_unit_of_measure_value:
            insertedStockFormPayload?.unit_of_measure_value || null,
          stock_form_is_active: true,
          is_active: true,
        }),
      }),
      [stockFormRepositoryPath]: {
        getInventoryItemStockFormsByItemId: async () => [
          {
            id: "stock-form-no-barcode",
            inventory_item_id: "item-1",
            barcode: null,
            packaging: "piece",
            units_per_packaging: 1,
            unit_of_measure: "pc",
            unit_of_measure_value: 1,
            is_active: true,
          },
        ],
        getInventoryItemStockFormById: async () => null,
        insertInventoryItemStockForm: async (stockFormData) => {
          insertedStockFormPayload = stockFormData;
          return { id: "stock-form-barcode", ...stockFormData };
        },
      },
    },
    async ({ createInventoryBatch }) => {
      const batch = await createInventoryBatch({
        inventory_item_id: "item-1",
        batch_no: "TUNA-BATCH-001",
        source_type: "LGU",
        quantity_received: 20,
        stock_form_barcode: "0748485100081",
        stock_form_packaging: "box",
        stock_form_units_per_packaging: 10,
        stock_form_unit_of_measure: "pc",
        stock_form_unit_of_measure_value: 1,
      });

      assert.equal(batch.inventory_item_stock_form.id, "stock-form-barcode");
      assert.equal(batch.inventory_item_stock_form.barcode, "0748485100081");
    },
  );

  assert.equal(insertedStockFormPayload.barcode, "0748485100081");
  assert.equal(insertedBatchPayload.inventory_item_stock_form_id, "stock-form-barcode");
});

test("createInventoryBatch automatically assigns a scanned barcode to selected matching packaging", async () => {
  const transactionEvents = [];
  const existingStockForm = {
    id: "stock-form-piece",
    inventory_item_id: "item-1",
    barcode: null,
    packaging: "piece",
    units_per_packaging: 1,
    unit_of_measure: "pc",
    unit_of_measure_value: 1,
    is_active: true,
  };
  let updatedStockForm = null;
  let insertedBatchPayload = null;
  const fakeClient = {
    async query(sql) {
      transactionEvents.push(sql);
      return { rows: [] };
    },
    release() {
      transactionEvents.push("RELEASE");
    },
  };

  await withStubbedInventoryBatchService(
    {
      ...baseStubs({
        getInventoryItemById: async () => ({
          id: "item-1",
          item_code: "BLANKET",
          item_name: "Blanket",
          category: "Non-Perishable",
          unit_of_measure: "pc",
          unit_of_measure_value: 1,
          packaging: "piece",
          quantity: 1,
          barcode: null,
          is_active: true,
        }),
        insertInventoryBatch: async (batchData) => {
          insertedBatchPayload = batchData;
          return {
            id: "batch-created",
            ...batchData,
          };
        },
        getInventoryBatchById: async () => ({
          id: "batch-created",
          ...insertedBatchPayload,
          item_code: "BLANKET",
          item_name: "Blanket",
          category: "Non-Perishable",
          unit_of_measure: "pc",
          barcode: null,
          stock_form_barcode: updatedStockForm?.barcode || null,
          stock_form_packaging: updatedStockForm?.packaging || null,
          stock_form_units_per_packaging:
            updatedStockForm?.units_per_packaging || null,
          stock_form_unit_of_measure: updatedStockForm?.unit_of_measure || null,
          stock_form_unit_of_measure_value:
            updatedStockForm?.unit_of_measure_value || null,
          stock_form_is_active: true,
          is_active: true,
        }),
      }),
      [stockFormRepositoryPath]: {
        getInventoryItemStockFormById: async () => existingStockForm,
        getInventoryItemStockFormByBarcode: async () => null,
        updateInventoryItemStockForm: async (id, stockFormData) => {
          updatedStockForm = { id, ...stockFormData };
          return updatedStockForm;
        },
      },
      [dbPath]: {
        connect: async () => fakeClient,
      },
    },
    async ({ createInventoryBatch }) => {
      const batch = await createInventoryBatch({
        inventory_item_id: "item-1",
        inventory_item_stock_form_id: existingStockForm.id,
        stock_form_barcode: "123456789012",
        stock_form_packaging: "piece",
        stock_form_units_per_packaging: 1,
        stock_form_unit_of_measure: "pc",
        stock_form_unit_of_measure_value: 1,
        batch_no: "BLANKET-BATCH-001",
        source_type: "LGU",
        quantity_received: 5,
      });

      assert.equal(batch.inventory_item_stock_form.id, existingStockForm.id);
      assert.equal(batch.inventory_item_stock_form.barcode, "123456789012");
    },
  );

  assert.equal(updatedStockForm.barcode, "123456789012");
  assert.equal(insertedBatchPayload.inventory_item_stock_form_id, existingStockForm.id);
  assert.deepEqual(transactionEvents, ["BEGIN", "COMMIT", "RELEASE"]);
});

test("createInventoryBatch automatically assigns a scanned barcode to an unselected matching packaging", async () => {
  const transactionEvents = [];
  const existingStockForm = {
    id: "stock-form-pack",
    inventory_item_id: "item-1",
    barcode: null,
    packaging: "pack",
    units_per_packaging: 8,
    unit_of_measure: "pc",
    unit_of_measure_value: 1,
    is_active: true,
  };
  let updatedStockForm = null;
  let insertedBatchPayload = null;
  const fakeClient = {
    async query(sql) {
      transactionEvents.push(sql);
      return { rows: [] };
    },
    release() {
      transactionEvents.push("RELEASE");
    },
  };

  await withStubbedInventoryBatchService(
    {
      ...baseStubs({
        getInventoryItemById: async () => ({
          id: "item-1",
          item_code: "SLEEPING-BAG",
          item_name: "Sleeping Bag",
          category: "Non-Perishable",
          unit_of_measure: "pc",
          unit_of_measure_value: 1,
          packaging: "piece",
          quantity: 1,
          barcode: null,
          is_active: true,
        }),
        insertInventoryBatch: async (batchData) => {
          insertedBatchPayload = batchData;
          return {
            id: "batch-created",
            ...batchData,
          };
        },
        getInventoryBatchById: async () => ({
          id: "batch-created",
          ...insertedBatchPayload,
          item_code: "SLEEPING-BAG",
          item_name: "Sleeping Bag",
          category: "Non-Perishable",
          unit_of_measure: "pc",
          barcode: null,
          stock_form_barcode: updatedStockForm?.barcode || null,
          stock_form_packaging: updatedStockForm?.packaging || null,
          stock_form_units_per_packaging:
            updatedStockForm?.units_per_packaging || null,
          stock_form_unit_of_measure: updatedStockForm?.unit_of_measure || null,
          stock_form_unit_of_measure_value:
            updatedStockForm?.unit_of_measure_value || null,
          stock_form_is_active: true,
          is_active: true,
        }),
      }),
      [stockFormRepositoryPath]: {
        getInventoryItemStockFormsByItemId: async () => [existingStockForm],
        getInventoryItemStockFormByBarcode: async () => null,
        updateInventoryItemStockForm: async (id, stockFormData) => {
          updatedStockForm = { id, ...stockFormData };
          return updatedStockForm;
        },
      },
      [dbPath]: {
        connect: async () => fakeClient,
      },
    },
    async ({ createInventoryBatch }) => {
      const batch = await createInventoryBatch({
        inventory_item_id: "item-1",
        batch_no: "SLEEPING-BAG-BATCH-002",
        source_type: "LGU",
        quantity_received: 16,
        stock_form_barcode: "123456789012",
        stock_form_packaging: "pack",
        stock_form_units_per_packaging: 8,
        stock_form_unit_of_measure: "pc",
        stock_form_unit_of_measure_value: 1,
      });

      assert.equal(batch.inventory_item_stock_form.id, existingStockForm.id);
      assert.equal(batch.inventory_item_stock_form.barcode, "123456789012");
    },
  );

  assert.equal(updatedStockForm.barcode, "123456789012");
  assert.equal(insertedBatchPayload.inventory_item_stock_form_id, existingStockForm.id);
  assert.deepEqual(transactionEvents, ["BEGIN", "COMMIT", "RELEASE"]);
});

test("createInventoryBatch requires a barcode for a new packaging on a barcode-managed item", async () => {
  await withStubbedInventoryBatchService(
    {
      ...baseStubs({
        getInventoryItemById: async () => ({
          id: "item-1",
          item_code: "WATER",
          item_name: "Water",
          category: "Non-Perishable",
          unit_of_measure: "pc",
          packaging: "piece",
          quantity: 1,
          barcode: null,
          is_active: true,
        }),
      }),
      [stockFormRepositoryPath]: {
        getInventoryItemStockFormsByItemId: async () => [
          {
            id: "stock-form-piece",
            inventory_item_id: "item-1",
            barcode: "123456789012",
            packaging: "piece",
            units_per_packaging: 1,
            unit_of_measure: "pc",
            unit_of_measure_value: 1,
            is_active: true,
          },
        ],
        getInventoryItemStockFormById: async () => null,
        getInventoryItemStockFormByDefinition: async () => {
          throw new Error("definition lookup must not run without a barcode");
        },
        insertInventoryItemStockForm: async () => {
          throw new Error("stock form insert must not run without a barcode");
        },
      },
    },
    async ({ createInventoryBatch }) => {
      await assert.rejects(
        createInventoryBatch({
          inventory_item_id: "item-1",
          batch_no: "WATER-BOX-001",
          source_type: "LGU",
          quantity_received: 10,
          stock_form_barcode: null,
          stock_form_packaging: "box",
          stock_form_units_per_packaging: 10,
          stock_form_unit_of_measure: "pc",
          stock_form_unit_of_measure_value: 1,
        }),
        (error) => {
          assert.equal(error.statusCode, 400);
          assert.equal(
            error.message,
            "barcode is required when adding a new packaging to a barcode-managed item",
          );
          return true;
        },
      );
    },
  );
});

test("createInventoryBatch rejects a new packaging barcode owned by another item", async () => {
  let insertCalled = false;

  await withStubbedInventoryBatchService(
    {
      ...baseStubs({
        insertInventoryBatch: async () => {
          insertCalled = true;
          return { id: "should-not-create" };
        },
      }),
      [stockFormRepositoryPath]: {
        ...baseStubs()[stockFormRepositoryPath],
        getInventoryItemStockFormByBarcode: async () => ({
          id: "stock-form-other-item",
          inventory_item_id: "item-2",
          barcode: "123456789012",
          packaging: "box",
          units_per_packaging: 10,
          unit_of_measure: "pc",
          unit_of_measure_value: 1,
          is_active: true,
        }),
      },
    },
    async ({ createInventoryBatch }) => {
      await assert.rejects(
        createInventoryBatch({
          inventory_item_id: "item-1",
          batch_no: "LOT-DUPLICATE-BARCODE",
          source_type: "LGU",
          quantity_received: 10,
          stock_form_barcode: "123456789012",
          stock_form_packaging: "box",
          stock_form_units_per_packaging: 10,
          stock_form_unit_of_measure: "pc",
          stock_form_unit_of_measure_value: 1,
        }),
        (error) => {
          assert.equal(error.statusCode, 409);
          assert.equal(
            error.message,
            "This barcode is already assigned to another packaging",
          );
          return true;
        },
      );
    },
  );

  assert.equal(insertCalled, false);
});

test("createInventoryBatch rejects a barcode that does not match the selected packaging", async () => {
  await withStubbedInventoryBatchService(
    {
      ...baseStubs(),
      [stockFormRepositoryPath]: {
        ...baseStubs()[stockFormRepositoryPath],
        getInventoryItemStockFormById: async () => ({
          id: "stock-form-piece",
          inventory_item_id: "item-1",
          barcode: "123456789012",
          packaging: "piece",
          units_per_packaging: 1,
          unit_of_measure: "pc",
          unit_of_measure_value: 1,
          is_active: true,
        }),
      },
    },
    async ({ createInventoryBatch }) => {
      await assert.rejects(
        createInventoryBatch({
          inventory_item_id: "item-1",
          inventory_item_stock_form_id: "stock-form-piece",
          batch_no: "LOT-MISMATCHED-BARCODE",
          source_type: "LGU",
          quantity_received: 10,
          stock_form_barcode: "987654321098",
        }),
        (error) => {
          assert.equal(error.statusCode, 409);
          assert.equal(
            error.message,
            "This packaging already has a different barcode. Choose different packaging details.",
          );
          return true;
        },
      );
    },
  );
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
