const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const donationValidator = require("../src/validators/donation.validator");

const servicePath = require.resolve("../src/services/donation.service");
const dbPath = require.resolve("../src/config/db");
const donationRepositoryPath = require.resolve("../src/repositories/donation.repository");
const distributionTransactionRepositoryPath = require.resolve(
  "../src/repositories/distributionTransaction.repository",
);
const inventoryItemRepositoryPath = require.resolve(
  "../src/repositories/inventoryItem.repository",
);
const inventoryBatchRepositoryPath = require.resolve(
  "../src/repositories/inventoryBatch.repository",
);
const inventoryItemStockFormRepositoryPath = require.resolve(
  "../src/repositories/inventoryItemStockForm.repository",
);
const inventoryItemServicePath = require.resolve(
  "../src/services/inventoryItem.service",
);
const forecastServicePath = require.resolve("../src/services/forecast.service");
const mayorReportExportPath = require.resolve("../src/utils/mayorReportExport");
const notificationServicePath = require.resolve(
  "../src/modules/notifications/notification.service",
);
const systemLogPath = require.resolve("../src/utils/systemLog");
const systemLogRepositoryPath = require.resolve(
  "../src/repositories/systemLog.repository",
);

const dependencyPaths = [
  dbPath,
  donationRepositoryPath,
  distributionTransactionRepositoryPath,
  inventoryItemRepositoryPath,
  inventoryBatchRepositoryPath,
  inventoryItemStockFormRepositoryPath,
  inventoryItemServicePath,
  forecastServicePath,
  mayorReportExportPath,
  notificationServicePath,
  systemLogPath,
  systemLogRepositoryPath,
];

const buildDonationPayload = (items) => ({
  disaster_event_id: "event-1",
  donor_name: "Test Donor",
  donor_type: "INDIVIDUAL",
  donor_type_other: null,
  contact_information: null,
  received_at: "2026-09-03T08:00:00.000Z",
  status: "RECEIVED",
  remarks: null,
  items,
});

const buildNewInventoryItem = (overrides = {}) => ({
  item_name: "Rice",
  category: "Perishable",
  unit_of_measure: "pc",
  unit_of_measure_value: 1,
  packaging: "piece",
  packaging_count: 1,
  quantity: 1,
  expiration_date: null,
  barcode: null,
  is_perishable: true,
  is_active: true,
  skip_opening_stock: true,
  ...overrides,
});

const buildClient = (events) => ({
  query: async (sql) => {
    const normalizedSql = String(sql).trim();
    events.push(normalizedSql);

    if (normalizedSql.includes("SELECT COALESCE(SUM(quantity_available)")) {
      return { rows: [{ total_quantity: 0 }] };
    }

    return { rows: [] };
  },
  release: () => events.push("RELEASE"),
});

const withStubbedDonationService = async (overrides, runTest) => {
  const originalEntries = new Map(
    dependencyPaths.map((modulePath) => [modulePath, require.cache[modulePath]]),
  );
  const originalServiceEntry = require.cache[servicePath];
  const events = [];
  const calls = {
    createdInventoryItems: [],
    insertedDonationItems: [],
    insertedBatches: [],
    insertedTransactions: [],
  };
  const client = buildClient(events);
  const donationRecord = {
    id: "donation-1",
    disaster_event_id: "event-1",
    donor_name: "Test Donor",
    donor_type: "INDIVIDUAL",
    donor_type_other: null,
    contact_information: null,
    received_by: "user-1",
    received_at: "2026-09-03T08:00:00.000Z",
    status: "RECEIVED",
    remarks: null,
  };
  const inventoryItem = {
    id: "inventory-item-1",
    item_code: "INV-RICE-001",
    item_name: "Rice",
    category: "Perishable",
    unit_of_measure: "pc",
    unit_of_measure_value: 1,
    packaging: "piece",
    packaging_count: 1,
    quantity: 1,
    reorder_level: null,
    is_perishable: true,
    is_active: true,
  };

  delete require.cache[servicePath];
  dependencyPaths.forEach((modulePath) => delete require.cache[modulePath]);

  try {
    require.cache[dbPath] = {
      id: dbPath,
      filename: dbPath,
      loaded: true,
      exports: {
        connect: async () => client,
      },
    };
    require.cache[donationRepositoryPath] = {
      id: donationRepositoryPath,
      filename: donationRepositoryPath,
      loaded: true,
      exports: {
        getDisasterEventById: async () => ({
          id: "event-1",
          event_code: "EVT-1",
          title: "Test Event",
          status: "ACTIVE",
        }),
        getUserById: async () => ({ id: "user-1" }),
        insertDonation: async () => ({ id: "donation-1" }),
        getDonationByIdForUpdate: async () => donationRecord,
        getDonationById: async () => donationRecord,
        getDonationItemsByDonationId: async () =>
          calls.insertedDonationItems.map((item) => ({
            id: item.id,
            donation_id: item.donation_id,
            inventory_item_id: item.inventory_item_id,
            inventory_batch_id: item.inventory_batch_id,
            quantity_received: item.quantity_received,
            remarks: item.remarks,
            item_code: inventoryItem.item_code,
            item_name: inventoryItem.item_name,
            category: inventoryItem.category,
            unit_of_measure: inventoryItem.unit_of_measure,
            reorder_level: null,
            item_total_stock: 0,
            inventory_item_stock_form_id: "stock-form-1",
            batch_no: "DON-INV-RICE-001-BATCH-001",
            source_type: "DONATED",
            quantity_available: item.quantity_received,
            expiration_date: null,
            storage_location: null,
            stock_form_barcode: null,
            stock_form_packaging: "piece",
            stock_form_units_per_packaging: 1,
            stock_form_unit_of_measure: "pc",
            stock_form_unit_of_measure_value: 1,
          })),
        getInventoryItemByName:
          overrides.getInventoryItemByName || (async () => null),
        getInventoryItemById: async () => inventoryItem,
        insertDonationItem: async (payload) => {
          const createdItem = {
            id: `donation-item-${calls.insertedDonationItems.length + 1}`,
            ...payload,
          };
          calls.insertedDonationItems.push(createdItem);
          return createdItem;
        },
        insertInventoryTransaction: async (payload) => {
          const createdTransaction = {
            id: `transaction-${calls.insertedTransactions.length + 1}`,
            ...payload,
          };
          calls.insertedTransactions.push(createdTransaction);
          return createdTransaction;
        },
        ...overrides.donationRepository,
      },
    };
    require.cache[distributionTransactionRepositoryPath] = {
      id: distributionTransactionRepositoryPath,
      filename: distributionTransactionRepositoryPath,
      loaded: true,
      exports: {},
    };
    require.cache[inventoryItemRepositoryPath] = {
      id: inventoryItemRepositoryPath,
      filename: inventoryItemRepositoryPath,
      loaded: true,
      exports: {
        getInventoryItemByIdForUpdate: async () => inventoryItem,
        updateInventoryItemStockSnapshot: async () => inventoryItem,
        ...overrides.inventoryItemRepository,
      },
    };
    require.cache[inventoryBatchRepositoryPath] = {
      id: inventoryBatchRepositoryPath,
      filename: inventoryBatchRepositoryPath,
      loaded: true,
      exports: {
        insertInventoryBatch: async (payload) => {
          const createdBatch = {
            id: `batch-${calls.insertedBatches.length + 1}`,
            ...payload,
          };
          calls.insertedBatches.push(createdBatch);
          return createdBatch;
        },
        ...overrides.inventoryBatchRepository,
      },
    };
    require.cache[inventoryItemStockFormRepositoryPath] = {
      id: inventoryItemStockFormRepositoryPath,
      filename: inventoryItemStockFormRepositoryPath,
      loaded: true,
      exports: {
        getInventoryItemStockFormById: async () => null,
        getInventoryItemStockFormsByItemId: async () => [],
        getInventoryItemStockFormByDefinition: async () => ({
          id: "stock-form-1",
          inventory_item_id: inventoryItem.id,
        }),
        insertInventoryItemStockForm: async () => ({
          id: "stock-form-1",
          inventory_item_id: inventoryItem.id,
        }),
        ...overrides.inventoryItemStockFormRepository,
      },
    };
    require.cache[inventoryItemServicePath] = {
      id: inventoryItemServicePath,
      filename: inventoryItemServicePath,
      loaded: true,
      exports: {
        createInventoryItem: async (payload, actor, options) => {
          calls.createdInventoryItems.push({ payload, actor, options });
          return {
            ...inventoryItem,
            ...payload,
          };
        },
        ...overrides.inventoryItemService,
      },
    };
    require.cache[forecastServicePath] = {
      id: forecastServicePath,
      filename: forecastServicePath,
      loaded: true,
      exports: {},
    };
    require.cache[mayorReportExportPath] = {
      id: mayorReportExportPath,
      filename: mayorReportExportPath,
      loaded: true,
      exports: {},
    };
    require.cache[notificationServicePath] = {
      id: notificationServicePath,
      filename: notificationServicePath,
      loaded: true,
      exports: {
        emitSafely: async () => {},
      },
    };
    require.cache[systemLogPath] = {
      id: systemLogPath,
      filename: systemLogPath,
      loaded: true,
      exports: {
        logAuditSafely: async () => {},
        pickDefined: (value, keys) =>
          keys.reduce((result, key) => {
            if (value?.[key] !== undefined) {
              result[key] = value[key];
            }
            return result;
          }, {}),
        normalizeActor: (actor) => actor,
      },
    };
    require.cache[systemLogRepositoryPath] = {
      id: systemLogRepositoryPath,
      filename: systemLogRepositoryPath,
      loaded: true,
      exports: {},
    };

    await runTest(require(servicePath), { calls, client, events, inventoryItem });
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

    if (originalServiceEntry) {
      require.cache[servicePath] = originalServiceEntry;
    }
  }
};

const buildDonationItemPayload = (quantity_received, itemName = "Rice") => ({
  inventory_item_id: null,
  new_inventory_item: buildNewInventoryItem({ item_name: itemName }),
  inventory_item_stock_form_id: null,
  quantity_received,
  remarks: "Per Family Allocation: 1",
  expiration_date: null,
  storage_location: null,
  stock_form_barcode: null,
  stock_form_packaging: "piece",
  stock_form_units_per_packaging: 1,
  stock_form_unit_of_measure: "pc",
  stock_form_unit_of_measure_value: 1,
});

test("donation creation rolls back a staged inventory item when a later inventory write fails", async () => {
  await withStubbedDonationService(
    {
      inventoryBatchRepository: {
        insertInventoryBatch: async () => {
          throw new Error("batch insert failed");
        },
      },
    },
    async (service, { calls, events, client }) => {
      await assert.rejects(
        service.createDonation(
          buildDonationPayload([buildDonationItemPayload(5)]),
          { userId: "user-1", roleCode: "MAYOR" },
        ),
        /batch insert failed/,
      );

      assert.equal(calls.createdInventoryItems.length, 1);
      assert.equal(calls.createdInventoryItems[0].options.dbClient, client);
      assert.ok(events.includes("BEGIN"));
      assert.ok(events.includes("ROLLBACK"));
      assert.equal(events.includes("COMMIT"), false);
      assert.equal(calls.insertedTransactions.length, 0);
    },
  );
});

test("donation creation reuses one staged inventory item for duplicate names", async () => {
  await withStubbedDonationService({}, async (service, { calls, events }) => {
    const donation = await service.createDonation(
      buildDonationPayload([
        buildDonationItemPayload(5),
        buildDonationItemPayload(7, " rice "),
      ]),
      { userId: "user-1", roleCode: "MAYOR" },
    );

    assert.equal(calls.createdInventoryItems.length, 1);
    assert.deepEqual(
      calls.insertedDonationItems.map((item) => item.inventory_item_id),
      ["inventory-item-1", "inventory-item-1"],
    );
    assert.deepEqual(
      calls.insertedBatches.map((batch) => batch.quantity_received),
      [5, 7],
    );
    assert.deepEqual(
      calls.insertedTransactions.map((transaction) => transaction.quantity),
      [5, 7],
    );
    assert.equal(donation.total_quantity_received, 12);
    assert.ok(events.includes("COMMIT"));
    assert.equal(events.includes("ROLLBACK"), false);
  });
});

test("donor name publication updates only the visibility flag and commits", async () => {
  let visibilityUpdate = null;

  await withStubbedDonationService(
    {
      donationRepository: {
        getDonationByIdForUpdate: async () => ({
          id: "donation-1",
          disaster_event_id: "event-1",
          donor_name: "Test Donor",
          donor_name_public: false,
          donor_type: "INDIVIDUAL",
          donor_type_other: null,
          contact_information: null,
          received_by: "user-1",
          received_at: "2026-09-03T08:00:00.000Z",
          status: "RECEIVED",
          remarks: null,
        }),
        getDonationById: async () => ({
          id: "donation-1",
          disaster_event_id: "event-1",
          donor_name: "Test Donor",
          donor_name_public: true,
          donor_type: "INDIVIDUAL",
          donor_type_other: null,
          contact_information: null,
          received_by: "user-1",
          received_at: "2026-09-03T08:00:00.000Z",
          status: "RECEIVED",
          remarks: null,
        }),
        updateDonationPublicName: async (id, donorNamePublic, dbClient) => {
          visibilityUpdate = { id, donorNamePublic, dbClient };
          return { id, donor_name_public: donorNamePublic };
        },
      },
    },
    async (service, { client, events }) => {
      const donation = await service.updateDonationPublicName(
        "donation-1",
        true,
        { userId: "user-1", roleCode: "MAYOR" },
      );

      assert.deepEqual(visibilityUpdate, {
        id: "donation-1",
        donorNamePublic: true,
        dbClient: client,
      });
      assert.equal(donation.donor_name_public, true);
      assert.ok(events.includes("BEGIN"));
      assert.ok(events.includes("COMMIT"));
      assert.equal(events.includes("ROLLBACK"), false);
    },
  );
});

test("donation inventory repair migration adds the columns used by receipt writes and reads", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const migrationPath = path.join(
    repoRoot,
    "database/migrations/2026-09-03_repair_donation_inventory_columns.sql",
  );
  const migrationSql = fs.readFileSync(migrationPath, "utf8");

  assert.match(
    migrationSql,
    /inventory_item_stock_forms[\s\S]*ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE/i,
  );
  assert.match(
    migrationSql,
    /inventory_batches[\s\S]*ADD COLUMN IF NOT EXISTS inventory_item_stock_form_id UUID[\s\S]*ADD COLUMN IF NOT EXISTS stock_version INTEGER NOT NULL DEFAULT 0/i,
  );
  assert.match(
    migrationSql,
    /inventory_transactions[\s\S]*ADD COLUMN IF NOT EXISTS other_status VARCHAR\(80\)[\s\S]*ADD COLUMN IF NOT EXISTS inventory_transaction_reference_no VARCHAR\(15\)/i,
  );
  assert.match(
    migrationSql,
    /donations[\s\S]*ADD COLUMN IF NOT EXISTS donor_type_other VARCHAR/i,
  );

  const visibilityMigrationPath = path.join(
    repoRoot,
    "database/migrations/2026-09-03_add_donation_public_name_visibility.sql",
  );
  const visibilityMigrationSql = fs.readFileSync(visibilityMigrationPath, "utf8");
  const schemaSql = fs.readFileSync(
    path.join(repoRoot, "database/schema/distync_schema.sql"),
    "utf8",
  );

  assert.match(
    visibilityMigrationSql,
    /ALTER TABLE public\.donations[\s\S]*ADD COLUMN IF NOT EXISTS donor_name_public BOOLEAN NOT NULL DEFAULT FALSE/i,
  );
  assert.match(
    schemaSql,
    /donor_name_public boolean NOT NULL DEFAULT false/i,
  );
});

test("donation validation accepts and normalizes staged inventory definitions", () => {
  const request = {
    body: {
      ...buildDonationPayload([]),
      disaster_event_id: "00000000-0000-4000-8000-000000000001",
      items: [
        {
          ...buildDonationItemPayload(5),
          new_inventory_item: buildNewInventoryItem({
            category: "perishable",
            is_perishable: undefined,
          }),
        },
      ],
    },
  };
  let responseStatus = null;
  let responsePayload = null;
  let nextCalled = false;
  const response = {
    status: (statusCode) => {
      responseStatus = statusCode;
      return response;
    },
    json: (payload) => {
      responsePayload = payload;
      return response;
    },
  };

  donationValidator.validateDonationPayload(request, response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(responseStatus, null);
  assert.equal(responsePayload, null);
  assert.equal(request.validatedBody.items[0].inventory_item_id, null);
  assert.equal(
    request.validatedBody.items[0].new_inventory_item.category,
    "Perishable",
  );
  assert.equal(
    request.validatedBody.items[0].new_inventory_item.is_perishable,
    true,
  );
  assert.equal(
    request.validatedBody.items[0].new_inventory_item.skip_opening_stock,
    true,
  );
});

test("donation public-name validation accepts only boolean visibility values", () => {
  const request = {
    body: {
      donor_name_public: true,
    },
  };
  let nextCalled = false;
  const response = {
    status: () => response,
    json: () => response,
  };

  donationValidator.validateDonationPublicNamePayload(request, response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.deepEqual(request.validatedBody, { donor_name_public: true });
});
