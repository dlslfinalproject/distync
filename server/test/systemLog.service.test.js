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

test("item detail edit records use the pre-edit item name", async () => {
  await withMockRepository(
    {
      getAuditLogs: async () => [
        {
          id: "audit-item-edit-record-1",
          action: "INVENTORY_ITEM_UPDATE",
          entity_type: "INVENTORY_ITEM",
          entity_id: "item-1",
          role_code: "MAYOR",
          old_values_json: {
            item_name: "Gardenias",
            item_code: "INV-GARDENIA-001",
          },
          new_values_json: {
            item_name: "Gardenia",
            item_code: "INV-GARDENIA-001",
          },
          created_at: "2026-08-11T01:30:00.000Z",
          first_name: "Maria",
          last_name: "Santos",
          inventory_item_name: "Gardenia",
        },
      ],
      getErrorLogs: async () => [],
    },
    async ({ getSystemLogReview }) => {
      const result = await getSystemLogReview({ type: "audit", limit: "all" });
      const [entry] = result.audit_logs;

      assert.equal(entry.action_label, "Item Details Edited");
      assert.deepEqual(entry.record_lines, ["Gardenias"]);
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
        timeZone: "Asia/Manila",
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
        timeZone: "Asia/Manila",
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

test("relief pack template creation details use clear rule labels and disaster types", async () => {
  await withMockRepository(
    {
      getAuditLogs: async () => [
        {
          id: "audit-relief-pack-create-1",
          action: "RELIEF_PACK_TEMPLATE_CREATE",
          entity_type: "RELIEF_PACK_TEMPLATE",
          entity_id: "template-1",
          role_code: "MAYOR",
          old_values_json: {},
          new_values_json: {
            name: "Standard Food Pack",
            description: "5",
            based_on_family_size: true,
            based_on_sector: false,
            is_additional_pack: false,
            applies_to_all_disasters: false,
            disaster_types: ["Typhoon", "Flood"],
            is_active: true,
            items: [
              {
                inventory_item_id: "item-rice",
                item_name: "Rice",
                quantity_required: 10,
                remarks: "Should not be shown in the breakdown",
              },
            ],
          },
          created_at: "2026-08-11T01:30:00.000Z",
          first_name: "Maria",
          last_name: "Santos",
        },
        {
          id: "audit-relief-pack-create-2",
          action: "RELIEF_PACK_TEMPLATE_CREATE",
          entity_type: "RELIEF_PACK_TEMPLATE",
          entity_id: "template-2",
          role_code: "MAYOR",
          old_values_json: {},
          new_values_json: {
            name: "Additional Pack",
            based_on_family_size: false,
            based_on_sector: true,
            is_additional_pack: true,
            sector_ids: ["sector-1"],
            applies_to_all_disasters: true,
            disaster_types: [],
            is_active: false,
            items: [],
          },
          created_at: "2026-08-11T01:29:00.000Z",
          first_name: "Maria",
          last_name: "Santos",
        },
      ],
      getErrorLogs: async () => [],
    },
    async ({ getSystemLogReview }) => {
      const result = await getSystemLogReview({ type: "audit", limit: "all" });
      const [standardPack, additionalPack] = result.audit_logs;

      assert.deepEqual(
        standardPack.audit_detail.changes.map(({ field, label, new_value }) => ({
          field,
          label,
          new_value,
        })),
        [
          { field: "name", label: "Pack Name", new_value: "Standard Food Pack" },
          { field: "family_size_covered", label: "Family Size Covered", new_value: "5" },
          { field: "sector_match", label: "Sector Match", new_value: "No" },
          { field: "is_additional_pack", label: "Pack Type", new_value: "Standard pack" },
          { field: "disaster_types", label: "Disaster Types", new_value: "Typhoon, Flood" },
          { field: "is_active", label: "Template Status", new_value: "Active" },
        ],
      );
      assert.equal(
        Object.prototype.hasOwnProperty.call(
          standardPack.audit_detail.item_changes[0],
          "remarks",
        ),
        false,
      );
      assert.equal(
        additionalPack.audit_detail.changes.find(
          ({ field }) => field === "disaster_types",
        ).new_value,
        "All disaster types",
      );
      assert.equal(
        additionalPack.audit_detail.changes.find(
          ({ field }) => field === "sector_match",
        ).new_value,
        "Yes",
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
        timeZone: "Asia/Manila",
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

test("written-off audits cover LGU and donated loose-item inventory", async () => {
  await withMockRepository(
    {
      getAuditLogs: async () => [
        {
          id: "audit-write-off-lgu-1",
          action: "INVENTORY_TRANSACTION_CREATE",
          entity_type: "INVENTORY_TRANSACTION",
          entity_id: "transaction-lgu-1",
          role_code: "MAYOR",
          old_values_json: {},
          new_values_json: {
            transaction_type: "DAMAGED",
            quantity: 3,
            reference_type: "MANUAL",
            remarks: "Damaged stock",
          },
          created_at: "2026-08-11T02:00:00.000Z",
          first_name: "Maria",
          last_name: "Santos",
          inventory_item_name: "Rice",
          inventory_batch_no: "BATCH-RICE-001",
          inventory_transaction_reference_type: "MANUAL",
        },
        {
          id: "audit-write-off-donation-1",
          action: "INVENTORY_TRANSACTION_CREATE",
          entity_type: "INVENTORY_TRANSACTION",
          entity_id: "transaction-donation-1",
          role_code: "MAYOR",
          old_values_json: {},
          new_values_json: {
            transaction_type: "EXPIRED",
            quantity: 2,
            reference_type: "DONATION",
            remarks: "Expired donated stock",
          },
          created_at: "2026-08-11T02:01:00.000Z",
          first_name: "Maria",
          last_name: "Santos",
          donation_donor_name: "Donor One",
          donation_items_json: [
            {
              item_name: "Canned Goods",
              quantity_received: 2,
              unit_of_measure: "pcs",
            },
          ],
          inventory_item_name: "Canned Goods",
          inventory_batch_no: "DON-CANNED-BATCH-001",
          inventory_transaction_reference_type: "DONATION",
        },
      ],
      getErrorLogs: async () => [],
    },
    async ({ getSystemLogReview }) => {
      const result = await getSystemLogReview({ type: "audit", limit: "all" });
      const lguEntry = result.audit_logs.find(
        ({ id }) => id === "audit-write-off-lgu-1",
      );
      const donatedEntry = result.audit_logs.find(
        ({ id }) => id === "audit-write-off-donation-1",
      );

      assert.equal(lguEntry.action_label, "Written Off");
      assert.equal(lguEntry.module, "Inventory");
      assert.deepEqual(lguEntry.record_lines, ["Rice", "BATCH-RICE-001"]);

      assert.equal(donatedEntry.action_label, "Written Off");
      assert.equal(donatedEntry.module, "Donation");
      assert.deepEqual(donatedEntry.record_lines, [
        "Donor One",
        "Canned Goods (2 pcs)",
      ]);
    },
  );
});

test("donation entry details include loose item donation information", async () => {
  await withMockRepository(
    {
      getAuditLogs: async () => [
        {
          id: "audit-donation-loose-1",
          action: "DONATION_CREATE",
          entity_type: "DONATION",
          entity_id: "donation-1",
          role_code: "MAYOR",
          old_values_json: {},
          new_values_json: {
            donation_type: "LOOSE_ITEM",
            donor_name: "Acer Company",
            donor_type: "PRIVATE_ORGANIZATION",
            disaster_event_title: "Habagat Flood Response 2026",
            received_at: "2026-08-11T01:50:00.000Z",
            status: "RECEIVED",
            item_count: 1,
            total_quantity_received: 200,
            items: [
              {
                inventory_item_id: "item-4",
                item_name: "Acer Charger",
                quantity_received: 200,
                unit_of_measure: "pc",
                packaging: "box",
                batch_no: "DONATION-001",
                expiration_date: null,
                remarks: "Opening donation stock",
              },
            ],
          },
          created_at: "2026-08-11T01:50:00.000Z",
          first_name: "Maria",
          last_name: "Santos",
          donation_donor_name: "Acer Company",
          donation_disaster_event_title: "Habagat Flood Response 2026",
          donation_items_json: [
            {
              item_name: "Acer Charger",
              quantity_received: 200,
              unit_of_measure: "pc",
              packaging: "box",
              batch_no: "DONATION-001",
              expiration_date: null,
              inventory_transaction_remarks:
                "Received donation stock for Acer Charger from Acer Company",
              remarks: "Opening donation stock",
            },
          ],
        },
      ],
      getErrorLogs: async () => [],
    },
    async ({ getSystemLogReview }) => {
      const result = await getSystemLogReview({ type: "audit", limit: "all" });
      const [entry] = result.audit_logs;

      assert.equal(entry.action_label, "Donation Entry");
      assert.deepEqual(
        entry.audit_detail.donation_details.map(({ field, label, new_value }) => ({
          field,
          label,
          new_value,
        })),
        [
          { field: "donation_type", label: "Donation Type", new_value: "Loose Item" },
          { field: "donor_name", label: "Donor Name", new_value: "Acer Company" },
          {
            field: "disaster_event_title",
            label: "Disaster Event",
            new_value: "Habagat Flood Response 2026",
          },
          {
            field: "donor_type",
            label: "Donor Type",
            new_value: "Private Organization",
          },
          {
            field: "received_at",
            label: "Received At",
            new_value: "Aug 11, 2026, 9:50 AM",
          },
          { field: "item_count", label: "Number of Items", new_value: "1" },
          {
            field: "total_quantity_received",
            label: "Total Quantity Received",
            new_value: "200",
          },
        ],
      );
      assert.deepEqual(entry.audit_detail.donation_items, [
        {
          donation_type: "Loose Item",
          item_name: "Acer Charger",
          relief_pack_name: null,
          relief_pack_quantity: null,
          quantity_received: "200",
          unit_of_measure: "pc",
          packaging: "box",
          batch_no: "DONATION-001",
          expiration_date: "N/A",
          remarks: "Received donation stock for Acer Charger from Acer Company",
        },
      ]);
    },
  );
});

test("donation entry details group relief pack details and pack quantity", async () => {
  await withMockRepository(
    {
      getAuditLogs: async () => [
        {
          id: "audit-donation-pack-1",
          action: "DONATION_CREATE",
          entity_type: "DONATION",
          entity_id: "donation-2",
          role_code: "MAYOR",
          old_values_json: {},
          new_values_json: {
            donation_type: "RELIEF_PACK",
            donor_name: "Hybe Corp.",
            donor_type: "PRIVATE_ORGANIZATION",
            disaster_event_title: "Typhoon Odette Response",
            items: [
              {
                inventory_item_id: "item-rice",
                item_name: "Rice",
                quantity_received: 100,
                unit_of_measure: "kg",
                packaging: "sack",
                remarks: "Relief Pack: Family Food Pack x 20",
              },
              {
                inventory_item_id: "item-water",
                item_name: "Nature Spring Water",
                quantity_received: 20,
                unit_of_measure: "pc",
                packaging: "piece",
                remarks: "Relief Pack: Family Food Pack x 20",
              },
            ],
          },
          created_at: "2026-08-11T02:00:00.000Z",
          first_name: "Maria",
          last_name: "Santos",
          donation_donor_name: "Hybe Corp.",
          donation_disaster_event_title: "Typhoon Odette Response",
          donation_items_json: [
            {
              item_name: "Rice",
              quantity_received: 100,
              unit_of_measure: "kg",
              packaging: "sack",
              remarks: "Relief Pack: Family Food Pack x 20",
            },
            {
              item_name: "Nature Spring Water",
              quantity_received: 20,
              unit_of_measure: "pc",
              packaging: "piece",
              remarks: "Relief Pack: Family Food Pack x 20",
            },
          ],
        },
      ],
      getErrorLogs: async () => [],
    },
    async ({ getSystemLogReview }) => {
      const result = await getSystemLogReview({ type: "audit", limit: "all" });
      const [entry] = result.audit_logs;
      const [reliefPack] = entry.audit_detail.donation_items;

      assert.equal(
        entry.audit_detail.donation_details.find(
          ({ field }) => field === "donation_type",
        ).new_value,
        "Relief Pack",
      );
      assert.deepEqual(
        entry.audit_detail.donation_details.map(({ field, label, new_value }) => ({
          field,
          label,
          new_value,
        })),
        [
          { field: "donation_type", label: "Donation Type", new_value: "Relief Pack" },
          { field: "donor_name", label: "Donor Name", new_value: "Hybe Corp." },
          {
            field: "disaster_event_title",
            label: "Disaster Event",
            new_value: "Typhoon Odette Response",
          },
          {
            field: "relief_pack_name",
            label: "Relief Pack Name",
            new_value: "Family Food Pack",
          },
          {
            field: "relief_pack_quantity",
            label: "Number of Relief Packs Received",
            new_value: "20",
          },
          { field: "donor_type", label: "Donor Type", new_value: "Private Organization" },
        ],
      );
      assert.equal(reliefPack.donation_type, "Relief Pack");
      assert.equal(reliefPack.relief_pack_name, "Family Food Pack");
      assert.equal(reliefPack.relief_pack_quantity, "20");
      assert.equal(reliefPack.contents, undefined);
      assert.deepEqual(reliefPack.relief_pack_contents, [
        {
          itemName: "Rice",
          quantityReceived: "100",
          unitOfMeasure: "kg",
          packaging: "sack",
          batchNo: "--",
          expirationDate: "N/A",
        },
        {
          itemName: "Nature Spring Water",
          quantityReceived: "20",
          unitOfMeasure: "pc",
          packaging: "piece",
          batchNo: "--",
          expirationDate: "N/A",
        },
      ]);
    },
  );
});

test("donation details edited includes the related stock adjustment", async () => {
  await withMockRepository(
    {
      getAuditLogs: async () => [
        {
          id: "audit-donation-edit-1",
          action: "DONATION_ITEM_UPDATE",
          entity_type: "DONATION_ITEM",
          entity_id: "donation-item-1",
          role_code: "MAYOR",
          old_values_json: {
            quantity_received: 10,
            remarks: "Original donation quantity",
          },
          new_values_json: {
            quantity_received: 12,
            remarks: "Adjusted donation quantity",
            adjustment_transaction_id: "transaction-adjustment-1",
          },
          donation_adjustment_json: {
            id: "transaction-adjustment-1",
            new_values_json: {
              transaction_type: "INFLOW",
              quantity: 2,
              performed_at: "2026-08-11T02:10:00.000Z",
              remarks: "Adjusted up donation stock for Rice from Acer Company",
            },
          },
          created_at: "2026-08-11T02:10:00.000Z",
          first_name: "Maria",
          last_name: "Santos",
          donation_donor_name: "Acer Company",
          donation_disaster_event_title: "Habagat Flood Response 2026",
          inventory_item_name: "Rice",
        },
      ],
      getErrorLogs: async () => [],
    },
    async ({ getSystemLogReview }) => {
      const result = await getSystemLogReview({ type: "audit", limit: "all" });
      const [entry] = result.audit_logs;

      assert.equal(entry.action_label, "Donation Details Edited");
      assert.deepEqual(
        entry.audit_detail.changes.map(({ field, label, previous_value, new_value }) => ({
          field,
          label,
          previous_value,
          new_value,
        })),
        [
          {
            field: "quantity_received",
            label: "Quantity",
            previous_value: "10",
            new_value: "12",
          },
          {
            field: "remarks",
            label: "Item Remarks",
            previous_value: "Original donation quantity",
            new_value: "Adjusted donation quantity",
          },
        ],
      );

      const expectedAdjustedAt = new Intl.DateTimeFormat("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Asia/Manila",
      }).format(new Date("2026-08-11T02:10:00.000Z"));

      assert.deepEqual(
        entry.audit_detail.donation_stock_adjustment.map(
          ({ field, label, new_value }) => ({ field, label, new_value }),
        ),
        [
          { field: "transaction_type", label: "Stock Action", new_value: "Inflow" },
          { field: "quantity", label: "Quantity Adjusted", new_value: "2" },
          { field: "performed_at", label: "Adjusted At", new_value: expectedAdjustedAt },
          {
            field: "remarks",
            label: "Remarks",
            new_value: "Adjusted up donation stock for Rice from Acer Company",
          },
        ],
      );
    },
  );
});

test("donation details edited shows donation-level changes before and after", async () => {
  await withMockRepository(
    {
      getAuditLogs: async () => [
        {
          id: "audit-donation-edit-2",
          action: "DONATION_UPDATE",
          entity_type: "DONATION",
          entity_id: "donation-2",
          role_code: "MAYOR",
          old_values_json: {
            donor_name: "Hybe Corp.",
            donor_name_public: false,
            disaster_event_title: "Habagat Flood Response 2026",
            donor_type: "PRIVATE_ORGANIZATION",
            contact_information: "Old contact",
            remarks: "Original remarks",
          },
          new_values_json: {
            donor_name: "Hybe Foundation",
            donor_name_public: false,
            disaster_event_title: "Typhoon Odette Response",
            donor_type: "NGO",
            contact_information: "New contact",
            remarks: "Updated remarks",
          },
          created_at: "2026-08-12T02:10:00.000Z",
          first_name: "Maria",
          last_name: "Santos",
          donation_donor_name: "Hybe Foundation",
          donation_disaster_event_title: "Typhoon Odette Response",
        },
      ],
      getErrorLogs: async () => [],
    },
    async ({ getSystemLogReview }) => {
      const result = await getSystemLogReview({ type: "audit", limit: "all" });
      const [entry] = result.audit_logs;

      assert.equal(entry.action_label, "Donation Details Edited");
      assert.deepEqual(
        entry.audit_detail.changes.map(
          ({ field, label, previous_value, new_value }) => ({
            field,
            label,
            previous_value,
            new_value,
          }),
        ),
        [
          {
            field: "donor_name",
            label: "Donor Name",
            previous_value: "Hybe Corp.",
            new_value: "Hybe Foundation",
          },
          {
            field: "disaster_event_title",
            label: "Disaster Event",
            previous_value: "Habagat Flood Response 2026",
            new_value: "Typhoon Odette Response",
          },
          {
            field: "donor_type",
            label: "Donor Type",
            previous_value: "Private Organization",
            new_value: "NGO",
          },
          {
            field: "contact_information",
            label: "Contact Information",
            previous_value: "Old contact",
            new_value: "New contact",
          },
          {
            field: "remarks",
            label: "Remarks",
            previous_value: "Original remarks",
            new_value: "Updated remarks",
          },
        ],
      );
    },
  );
});

test("legacy donation edit snapshots show available one-sided changes", async () => {
  await withMockRepository(
    {
      getAuditLogs: async () => [
        {
          id: "audit-donation-edit-legacy-1",
          action: "DONATION_UPDATE",
          entity_type: "DONATION",
          entity_id: "donation-legacy-1",
          role_code: "MAYOR",
          old_values_json: {
            donor_name: "Legacy Donor",
            donor_type: "NGO",
            received_at: "2026-08-08T00:00:00.000Z",
            status: "RECEIVED",
            remarks: null,
          },
          new_values_json: {
            donor_name: "Legacy Donor",
            donor_type: "NGO",
            received_at: "2026-08-08T00:00:00.000Z",
            status: "RECEIVED",
            remarks: null,
            item_count: 2,
            total_quantity_received: 300,
            items: [
              {
                item_name: "Gardenia",
                quantity_received: 100,
              },
              {
                item_name: "Gatorade",
                quantity_received: 200,
              },
            ],
          },
          created_at: "2026-08-08T02:10:00.000Z",
          first_name: "Maria",
          last_name: "Santos",
          donation_donor_name: "Legacy Donor",
        },
      ],
      getErrorLogs: async () => [],
    },
    async ({ getSystemLogReview }) => {
      const result = await getSystemLogReview({ type: "audit", limit: "all" });
      const [entry] = result.audit_logs;

      assert.equal(
        entry.action_detail,
        "Edited: Number of Items, Total Quantity Received",
      );
      assert.deepEqual(
        entry.audit_detail.changes.map(
          ({ field, label, previous_value, new_value }) => ({
            field,
            label,
            previous_value,
            new_value,
          }),
        ),
        [
          {
            field: "item_count",
            label: "Number of Items",
            previous_value: "--",
            new_value: "2",
          },
          {
            field: "total_quantity_received",
            label: "Total Quantity Received",
            previous_value: "--",
            new_value: "300",
          },
        ],
      );
    },
  );
});

test("donor name visibility audit shows hidden and visible values", async () => {
  await withMockRepository(
    {
      getAuditLogs: async () => [
        {
          id: "audit-donor-visibility-1",
          action: "DONATION_PUBLIC_NAME_UPDATE",
          entity_type: "DONATION",
          entity_id: "donation-3",
          role_code: "MAYOR",
          old_values_json: { donor_name_public: false },
          new_values_json: { donor_name_public: true },
          created_at: "2026-08-12T02:10:00.000Z",
          first_name: "Maria",
          last_name: "Santos",
          donation_donor_name: "Hybe Corp.",
        },
      ],
      getErrorLogs: async () => [],
    },
    async ({ getSystemLogReview }) => {
      const result = await getSystemLogReview({ type: "audit", limit: "all" });
      const [entry] = result.audit_logs;

      assert.equal(entry.action_label, "Donor Name Visibility Updated");
      assert.deepEqual(entry.audit_detail.changes, [
        {
          field: "donor_name_public",
          label: "Donor Name Visibility",
          previous_value: "Hidden",
          new_value: "Visible",
        },
      ]);
    },
  );
});

test("donation item edits show item and stock details before and after", async () => {
  await withMockRepository(
    {
      getAuditLogs: async () => [
        {
          id: "audit-donation-item-edit-1",
          action: "DONATION_ITEM_UPDATE",
          entity_type: "DONATION_ITEM",
          entity_id: "donation-item-2",
          role_code: "MAYOR",
          old_values_json: {
            item_code: "INV-RICE-001",
            item_name: "Rice",
            category: "Perishable",
            quantity_received: 10,
            unit_of_measure: "kg",
            packaging: "sack",
            units_per_packaging: 10,
            batch_no: "DON-RICE-BATCH-001",
            quantity_available: 10,
            remarks: "Original quantity",
          },
          new_values_json: {
            item_code: "INV-RICE-001",
            item_name: "Brown Rice",
            category: "Perishable",
            quantity_received: 12,
            unit_of_measure: "kg",
            packaging: "sack",
            units_per_packaging: 10,
            batch_no: "DON-RICE-BATCH-001",
            expiration_date: "2026-12-31",
            quantity_available: 12,
            remarks: "Updated quantity",
          },
          created_at: "2026-08-12T02:10:00.000Z",
          first_name: "Maria",
          last_name: "Santos",
          donation_donor_name: "Hybe Corp.",
          inventory_item_name: "Brown Rice",
        },
      ],
      getErrorLogs: async () => [],
    },
    async ({ getSystemLogReview }) => {
      const result = await getSystemLogReview({ type: "audit", limit: "all" });
      const [entry] = result.audit_logs;

      assert.deepEqual(
        entry.audit_detail.changes.map(({ field, label }) => ({ field, label })),
        [
          { field: "item_name", label: "Item Name" },
          { field: "quantity_received", label: "Quantity" },
          { field: "expiration_date", label: "Expiration Date" },
          { field: "quantity_available", label: "Quantity Available" },
          { field: "remarks", label: "Item Remarks" },
        ],
      );
      assert.equal(
        entry.audit_detail.changes.find((change) => change.field === "quantity_received")
          .previous_value,
        "10",
      );
      assert.equal(
        entry.audit_detail.changes.find((change) => change.field === "quantity_received")
          .new_value,
        "12",
      );
    },
  );
});
