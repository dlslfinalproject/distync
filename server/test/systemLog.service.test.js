const test = require("node:test");
const assert = require("node:assert/strict");

const servicePath = require.resolve("../src/services/systemLog.service");
const repositoryPath = require.resolve("../src/repositories/systemLog.repository");

const withMockRepository = async (repositoryMock, runTest) => {
  const originalServiceEntry = require.cache[servicePath];
  const originalRepositoryEntry = require.cache[repositoryPath];

  delete require.cache[servicePath];
  require.cache[repositoryPath] = {
    id: repositoryPath,
    filename: repositoryPath,
    loaded: true,
    exports: repositoryMock,
  };

  try {
    const service = require(servicePath);
    await runTest(service);
  } finally {
    delete require.cache[servicePath];

    if (originalServiceEntry) {
      require.cache[servicePath] = originalServiceEntry;
    }

    if (originalRepositoryEntry) {
      require.cache[repositoryPath] = originalRepositoryEntry;
    } else {
      delete require.cache[repositoryPath];
    }
  }
};

test("getSystemLogReview maps distribution claims as Distributed Items", async () => {
  await withMockRepository(
    {
      getAuditLogs: async () => [
        {
          id: "audit-1",
          action: "DISTRIBUTION_QR_CLAIM",
          entity_type: "DISTRIBUTION_TRANSACTION",
          entity_id: "distribution-1",
          role_code: "MSWDO",
          old_values_json: {},
          new_values_json: {
            distribution_status: "CLAIMED",
          },
          created_at: "2026-08-11T01:30:00.000Z",
          distribution_date: "2026-08-11T01:25:00.000Z",
          distribution_status: "CLAIMED",
          distribution_verified_by_first_name: "Ana",
          distribution_verified_by_last_name: "Reyes",
          distribution_relief_pack_template_name: "Family Relief Pack",
          distribution_items_json: [
            {
              item_name: "Rice",
              quantity_released: 5,
              unit_of_measure: "kg",
              donor_name: "Jane Allyson Paray",
              source_type: "DONATED",
              donation_remarks: "Per Family Allocation: 5",
            },
            {
              item_name: "Canned Goods",
              quantity_released: 3,
              unit_of_measure: "pcs",
              source_type: "DONATED",
              donation_remarks: "Relief Pack: NGO Pack x 10",
            },
          ],
        },
      ],
      getErrorLogs: async () => [],
    },
    async ({ getSystemLogReview }) => {
      const result = await getSystemLogReview({ type: "audit", limit: "all" });
      const [entry] = result.audit_logs;

      assert.equal(entry.action_label, "Distributed Items");
      assert.equal(entry.module, "Distribution");
      assert.equal(entry.performed_by, "Ana Reyes");
      assert.equal(entry.timestamp, "2026-08-11T01:25:00.000Z");
      assert.deepEqual(entry.record_lines, [
        "Family Relief Pack",
        "NGO Pack",
        "Jane Allyson Paray Donation",
      ]);
    },
  );
});

test("getSystemLogReview passes audit pagination and returns metadata", async () => {
  const requestedPages = [];

  await withMockRepository(
    {
      getAuditLogs: async (filters) => {
        requestedPages.push(filters);
        return [
          {
            id: "audit-2",
            total_count: "125",
            inventory_count: "80",
            relief_pack_count: "10",
            donation_count: "25",
            distribution_count: "10",
            action: "INVENTORY_ITEM_CREATE",
            entity_type: "INVENTORY_ITEM",
            entity_id: "item-1",
            role_code: "MSWDO",
            old_values_json: {},
            new_values_json: {
              item_name: "Rice",
            },
            created_at: "2026-08-11T01:30:00.000Z",
            first_name: "Maria",
            last_name: "Santos",
            inventory_item_name: "Rice",
            inventory_item_is_active: true,
          },
        ];
      },
      getErrorLogs: async () => [],
    },
    async ({ getSystemLogReview }) => {
      const result = await getSystemLogReview({
        type: "audit",
        limit: 50,
        module: "inventory",
        page: 2,
        search: "rice",
      });

      assert.deepEqual(requestedPages, [
        {
          auditAction: "all",
          dateFrom: "",
          dateTo: "",
          limit: 50,
          module: "inventory",
          page: 2,
          search: "rice",
        },
      ]);
      assert.equal(result.filters.auditAction, "all");
      assert.equal(result.filters.dateFrom, "");
      assert.equal(result.filters.dateTo, "");
      assert.equal(result.filters.module, "inventory");
      assert.equal(result.filters.search, "rice");
      assert.equal(result.pagination.audit_logs.page, 2);
      assert.equal(result.pagination.audit_logs.limit, 50);
      assert.equal(result.pagination.audit_logs.total_records, 125);
      assert.equal(result.pagination.audit_logs.total_pages, 3);
      assert.equal(result.pagination.audit_logs.has_previous_page, true);
      assert.equal(result.pagination.audit_logs.has_next_page, true);
      assert.equal(result.pagination.audit_logs.retention_years, 5);
      assert.deepEqual(result.summary.audit_logs, {
        total_matching_records: 125,
        inventory_records: 80,
        relief_pack_records: 10,
        donation_records: 25,
        distribution_records: 10,
      });
      assert.equal(result.audit_logs.length, 1);
    },
  );
});

test("audit item details omit redundant perishable status and trim unit value decimals", async () => {
  await withMockRepository(
    {
      getAuditLogs: async () => [
        {
          id: "audit-item-create-1",
          action: "INVENTORY_ITEM_CREATE",
          entity_type: "INVENTORY_ITEM",
          entity_id: "item-1",
          role_code: "MSWDO",
          old_values_json: {},
          new_values_json: {
            item_code: "INV-MSWDO_TOWEL-001",
            item_name: "MSWDO Towel",
            category: "Non-Perishable",
            unit_of_measure: "pc",
            unit_of_measure_value: "1.00",
            is_perishable: false,
            quantity: 1,
          },
          created_at: "2026-08-11T01:30:00.000Z",
          first_name: "Maria",
          last_name: "Santos",
          inventory_item_name: "MSWDO Towel",
          inventory_item_is_active: true,
        },
      ],
      getErrorLogs: async () => [],
    },
    async ({ getSystemLogReview }) => {
      const result = await getSystemLogReview({ type: "audit", limit: "all" });
      const [entry] = result.audit_logs;

      assert.deepEqual(
        entry.audit_detail.changes.map(({ field, new_value }) => ({ field, new_value })),
        [
          { field: "item_code", new_value: "INV-MSWDO_TOWEL-001" },
          { field: "item_name", new_value: "MSWDO Towel" },
          { field: "category", new_value: "Non-Perishable" },
          { field: "unit_of_measure", new_value: "pc" },
          { field: "unit_of_measure_value", new_value: "1" },
          { field: "quantity", new_value: "1" },
        ],
      );
      assert.equal(
        entry.audit_detail.changes.some(({ field }) => field === "is_perishable"),
        false,
      );
    },
  );
});

test("item creation details include related opening stock and transaction sections", async () => {
  await withMockRepository(
    {
      getAuditLogs: async () => [
        {
          id: "audit-item-create-2",
          action: "INVENTORY_ITEM_CREATE",
          entity_type: "INVENTORY_ITEM",
          entity_id: "item-2",
          role_code: "MAYOR",
          old_values_json: {},
          new_values_json: {
            item_code: "INV-RICE-001",
            item_name: "Rice",
            category: "Non-Perishable",
            unit_of_measure: "pc",
            unit_of_measure_value: "1.00",
            packaging: "piece",
            packaging_count: 20,
            quantity: 1,
            reorder_level: 10,
          },
          created_at: "2026-08-11T01:30:00.000Z",
          first_name: "Maria",
          last_name: "Santos",
          inventory_item_name: "Rice",
        },
      ],
      getInventoryItemCreationRelatedAuditLogs: async () => [
        {
          id: "audit-batch-2",
          action: "INVENTORY_BATCH_CREATE",
          entity_type: "INVENTORY_BATCH",
          entity_id: "batch-2",
          related_inventory_item_id: "item-2",
          old_values_json: {},
          new_values_json: {
            inventory_item_id: "item-2",
            batch_no: "BATCH-RICE-001",
            source_type: "LGU",
            quantity_received: 20,
            quantity_available: 20,
            expiration_date: null,
            storage_location: "Should not be displayed",
          },
          created_at: "2026-08-11T01:30:00.010Z",
        },
        {
          id: "audit-transaction-2",
          action: "INVENTORY_TRANSACTION_CREATE",
          entity_type: "INVENTORY_TRANSACTION",
          entity_id: "transaction-2",
          related_inventory_item_id: "item-2",
          old_values_json: {},
          new_values_json: {
            inventory_batch_id: "batch-2",
            transaction_type: "INFLOW",
            performed_at: "2026-08-11T01:30:00.020Z",
            remarks: "Opening stock recorded during inventory item creation",
          },
          created_at: "2026-08-11T01:30:00.020Z",
        },
      ],
      getErrorLogs: async () => [],
    },
    async ({ getSystemLogReview }) => {
      const result = await getSystemLogReview({ type: "audit", limit: "all" });
      const [entry] = result.audit_logs;
      const expectedPerformedAt = new Intl.DateTimeFormat("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date("2026-08-11T01:30:00.020Z"));

      assert.deepEqual(
        entry.audit_detail.item_details.map(({ field, label, new_value }) => ({
          field,
          label,
          new_value,
        })),
        [
          { field: "item_code", label: "Item Code", new_value: "INV-RICE-001" },
          { field: "item_name", label: "Item Name", new_value: "Rice" },
          { field: "category", label: "Category", new_value: "Non-Perishable" },
          { field: "unit_of_measure", label: "Unit", new_value: "pc" },
          { field: "unit_of_measure_value", label: "Unit Value", new_value: "1" },
          { field: "packaging", label: "Packaging", new_value: "piece" },
          { field: "reorder_level", label: "Reorder Level", new_value: "10" },
        ],
      );
      assert.deepEqual(
        entry.audit_detail.opening_stock.map(({ field, label, new_value }) => ({
          field,
          label,
          new_value,
        })),
        [
          { field: "packaging_count", label: "Quantity on Hand", new_value: "20" },
          { field: "quantity", label: "Units per Packaging", new_value: "1" },
          { field: "batch_no", label: "Batch Number", new_value: "BATCH-RICE-001" },
          { field: "quantity_received", label: "Total Opening Stock", new_value: "20 pc" },
          { field: "source_type", label: "Source", new_value: "LGU" },
        ],
      );
      assert.deepEqual(
        entry.audit_detail.opening_transaction.map(({ field, label, new_value }) => ({
          field,
          label,
          new_value,
        })),
        [
          { field: "transaction_type", label: "Transaction Type", new_value: "Inflow" },
          {
            field: "performed_at",
            label: "Received/Performed At",
            new_value: expectedPerformedAt,
          },
          {
            field: "remarks",
            label: "Remarks",
            new_value: "Opening stock recorded during inventory item creation",
          },
        ],
      );
    },
  );
});

test("packaging added details include the new packaging and its opening stock", async () => {
  await withMockRepository(
    {
      getAuditLogs: async () => [
        {
          id: "audit-packaging-add-1",
          action: "INVENTORY_ITEM_STOCK_FORM_CREATE",
          entity_type: "INVENTORY_ITEM_STOCK_FORM",
          entity_id: "stock-form-2",
          role_code: "MAYOR",
          old_values_json: {},
          new_values_json: {
            inventory_item_id: "item-2",
            is_additional_packaging: true,
            packaging: "box",
            units_per_packaging: 20,
            unit_of_measure: "pc",
            unit_of_measure_value: "1.00",
            barcode: "BOX-RICE-001",
            is_active: true,
          },
          created_at: "2026-08-11T01:30:00.000Z",
          first_name: "Maria",
          last_name: "Santos",
          inventory_item_code: "INV-RICE-001",
          inventory_item_name: "Rice",
          inventory_item_category: "Non-Perishable",
          inventory_item_unit_of_measure: "pc",
          inventory_item_unit_of_measure_value: "1.00",
          inventory_item_reorder_level: 10,
          inventory_packaging: "box",
          inventory_units_per_packaging: 20,
          inventory_packaging_unit_of_measure: "pc",
          inventory_barcode: "BOX-RICE-001",
        },
      ],
      getInventoryPackagingAddedRelatedAuditLogs: async () => [
        {
          id: "audit-packaging-batch-1",
          action: "INVENTORY_BATCH_CREATE",
          entity_type: "INVENTORY_BATCH",
          entity_id: "batch-2",
          related_inventory_item_stock_form_id: "stock-form-2",
          new_values_json: {
            inventory_item_stock_form_id: "stock-form-2",
            batch_no: "BATCH-RICE-BOX-001",
            source_type: "LGU",
            quantity_received: 100,
            expiration_date: "2027-08-11",
          },
          created_at: "2026-08-11T01:30:00.010Z",
        },
        {
          id: "audit-packaging-transaction-1",
          action: "INVENTORY_TRANSACTION_CREATE",
          entity_type: "INVENTORY_TRANSACTION",
          entity_id: "transaction-2",
          related_inventory_item_stock_form_id: "stock-form-2",
          new_values_json: {
            inventory_batch_id: "batch-2",
            transaction_type: "INFLOW",
            performed_at: "2026-08-11T01:30:00.020Z",
            remarks: "Stock received during inventory batch creation",
          },
          created_at: "2026-08-11T01:30:00.020Z",
        },
      ],
      getErrorLogs: async () => [],
    },
    async ({ getSystemLogReview }) => {
      const result = await getSystemLogReview({ type: "audit", limit: "all" });
      const [entry] = result.audit_logs;
      const expectedPerformedAt = new Intl.DateTimeFormat("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date("2026-08-11T01:30:00.020Z"));

      assert.equal(entry.action_label, "Packaging Added");
      assert.deepEqual(
        entry.audit_detail.item_details.map(({ field, label, new_value }) => ({
          field,
          label,
          new_value,
        })),
        [
          { field: "item_code", label: "Item Code", new_value: "INV-RICE-001" },
          { field: "item_name", label: "Item Name", new_value: "Rice" },
          { field: "category", label: "Category", new_value: "Non-Perishable" },
          { field: "unit_of_measure", label: "Unit", new_value: "pc" },
          { field: "unit_of_measure_value", label: "Unit Value", new_value: "1" },
          { field: "packaging", label: "Packaging", new_value: "box" },
          { field: "barcode", label: "Barcode", new_value: "BOX-RICE-001" },
          { field: "reorder_level", label: "Reorder Level", new_value: "10" },
        ],
      );
      assert.deepEqual(
        entry.audit_detail.opening_stock.map(({ field, label, new_value }) => ({
          field,
          label,
          new_value,
        })),
        [
          { field: "units_per_packaging", label: "Units per Packaging", new_value: "20" },
          { field: "batch_no", label: "Batch Number", new_value: "BATCH-RICE-BOX-001" },
          { field: "quantity_received", label: "Total Opening Stock", new_value: "100 pc" },
          { field: "source_type", label: "Source", new_value: "LGU" },
          { field: "expiration_date", label: "Expiration Date", new_value: "Aug 11, 2027" },
        ],
      );
      assert.equal(
        entry.audit_detail.opening_transaction.find(
          ({ field }) => field === "transaction_type",
        ).new_value,
        "Inflow",
      );
      assert.equal(
        entry.audit_detail.opening_transaction.find(
          ({ field }) => field === "performed_at",
        ).new_value,
        expectedPerformedAt,
      );
    },
  );
});

test("stock added details focus on the added stock and inflow transaction", async () => {
  await withMockRepository(
    {
      getAuditLogs: async () => [
        {
          id: "audit-stock-add-1",
          action: "INVENTORY_BATCH_CREATE",
          entity_type: "INVENTORY_BATCH",
          entity_id: "batch-3",
          role_code: "MAYOR",
          old_values_json: {},
          new_values_json: {
            inventory_item_id: "item-3",
            inventory_item_stock_form_id: "stock-form-3",
            batch_no: "BATCH-RICE-002",
            source_type: "LGU",
            quantity_received: 50,
            expiration_date: null,
            received_at: "2026-08-11T01:45:00.000Z",
          },
          created_at: "2026-08-11T01:45:00.000Z",
          first_name: "Maria",
          last_name: "Santos",
          inventory_item_name: "Rice",
          inventory_packaging: "box",
          inventory_item_unit_of_measure: "pc",
          inventory_source_type: "LGU",
          inventory_received_at: "2026-08-11T01:45:00.000Z",
          inventory_batch_no: "BATCH-RICE-002",
        },
      ],
      getErrorLogs: async () => [],
    },
    async ({ getSystemLogReview }) => {
      const result = await getSystemLogReview({ type: "audit", limit: "all" });
      const [entry] = result.audit_logs;
      const expectedPerformedAt = new Intl.DateTimeFormat("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date("2026-08-11T01:45:00.000Z"));

      assert.equal(entry.action_label, "Stock Added");
      assert.deepEqual(
        entry.audit_detail.stock_addition.map(({ field, label, new_value }) => ({
          field,
          label,
          new_value,
        })),
        [
          { field: "item_name", label: "Item", new_value: "Rice" },
          { field: "packaging", label: "Packaging", new_value: "box" },
          { field: "batch_no", label: "Batch Number", new_value: "BATCH-RICE-002" },
          { field: "quantity_received", label: "Quantity Added", new_value: "50" },
          { field: "unit_of_measure", label: "Unit", new_value: "pc" },
          { field: "source_type", label: "Source", new_value: "LGU" },
        ],
      );
      assert.deepEqual(
        entry.audit_detail.stock_transaction.map(({ field, label, new_value }) => ({
          field,
          label,
          new_value,
        })),
        [
          { field: "transaction_type", label: "Stock Action", new_value: "Inflow" },
          {
            field: "performed_at",
            label: "Received/Performed At",
            new_value: expectedPerformedAt,
          },
          {
            field: "remarks",
            label: "Remarks",
            new_value: "Stock received during inventory batch creation",
          },
        ],
      );
    },
  );
});
