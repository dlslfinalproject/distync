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
