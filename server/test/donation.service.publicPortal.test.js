const test = require("node:test");
const assert = require("node:assert/strict");

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
const forecastServicePath = require.resolve("../src/services/forecast.service");
const mayorReportExportPath = require.resolve("../src/utils/mayorReportExport");
const notificationServicePath = require.resolve(
  "../src/modules/notifications/notification.service",
);
const systemLogPath = require.resolve("../src/utils/systemLog");
const systemLogRepositoryPath = require.resolve(
  "../src/repositories/systemLog.repository",
);
const inventoryBatchStatusServicePath = require.resolve(
  "../src/services/inventoryBatchStatus.service",
);

const formatDateOnly = (date) => date.toISOString().slice(0, 10);

const addDays = (date, days) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};

const withStubbedDonationService = async (
  { donationRepositoryOverrides = {}, forecastServiceOverrides = {} },
  runTest,
) => {
  const dependencyPaths = [
    dbPath,
    donationRepositoryPath,
    distributionTransactionRepositoryPath,
    inventoryItemRepositoryPath,
    inventoryBatchRepositoryPath,
    inventoryItemStockFormRepositoryPath,
    forecastServicePath,
    mayorReportExportPath,
    notificationServicePath,
    systemLogPath,
    systemLogRepositoryPath,
    inventoryBatchStatusServicePath,
  ];
  const originalEntries = new Map(
    dependencyPaths.map((modulePath) => [modulePath, require.cache[modulePath]]),
  );
  const originalServiceEntry = require.cache[servicePath];

  delete require.cache[servicePath];

  try {
    dependencyPaths.forEach((modulePath) => {
      delete require.cache[modulePath];
    });

    require.cache[dbPath] = {
      id: dbPath,
      filename: dbPath,
      loaded: true,
      exports: {},
    };
    require.cache[donationRepositoryPath] = {
      id: donationRepositoryPath,
      filename: donationRepositoryPath,
      loaded: true,
      exports: {
        getPublicDonationDisasterSummaries: async () => [
          {
            id: "00000000-0000-0000-0000-000000000001",
            title: "Active Flood Response",
            disaster_type: "Flood",
            status: "ACTIVE",
          },
        ],
        getDonationSummaryTotals: async () => ({}),
        getDonationItemTransparencySummary: async () => [],
        getPublicRecentDonationSummaries: async () => [],
        getDefaultEmergencyDonationNeeds: async () => [],
        ...donationRepositoryOverrides,
      },
    };
    require.cache[forecastServicePath] = {
      id: forecastServicePath,
      filename: forecastServicePath,
      loaded: true,
      exports: {
        getLatestInventoryForecast: async () => null,
        getLatestInventoryForecastOverall: async () => {
          throw new Error("Public portal should use event-scoped forecasts.");
        },
        buildPublicForecastSuggestions: () => [],
        ...forecastServiceOverrides,
      },
    };

    [
      distributionTransactionRepositoryPath,
      inventoryItemRepositoryPath,
      inventoryBatchRepositoryPath,
      inventoryItemStockFormRepositoryPath,
      mayorReportExportPath,
      notificationServicePath,
      systemLogRepositoryPath,
    ].forEach((modulePath) => {
      require.cache[modulePath] = {
        id: modulePath,
        filename: modulePath,
        loaded: true,
        exports: {},
      };
    });
    require.cache[inventoryBatchStatusServicePath] = {
      id: inventoryBatchStatusServicePath,
      filename: inventoryBatchStatusServicePath,
      loaded: true,
      exports: {
        refreshDerivedInventoryBatchStatusesForItem: async () => {},
        refreshDerivedInventoryBatchStatusesForItems: async () => {},
      },
    };
    require.cache[systemLogPath] = {
      id: systemLogPath,
      filename: systemLogPath,
      loaded: true,
      exports: {
        logAuditSafely: async () => {},
        pickDefined: (value) => value || {},
        normalizeActor: (actor) => actor || {},
      },
    };

    await runTest(require(servicePath));
  } finally {
    if (originalServiceEntry) {
      require.cache[servicePath] = originalServiceEntry;
    } else {
      delete require.cache[servicePath];
    }

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

test("public portal uses forecast suggestions before default emergency donation needs", async () => {
  await withStubbedDonationService(
    {
      donationRepositoryOverrides: {
        getDefaultEmergencyDonationNeeds: async () => [
          {
            inventory_item_id: "default-water",
            item_name: "Bottled Water",
            unit_of_measure: "bottles",
            suggested_quantity: 50,
            priority_level: "HIGH",
          },
        ],
      },
      forecastServiceOverrides: {
        getLatestInventoryForecast: async () => ({ id: "event-forecast" }),
        buildPublicForecastSuggestions: () => [
          {
            public_key: "forecast-rice",
            item_name: "Rice",
            unit_of_measure: "packs",
            suggested_quantity: 25,
            priority_level: "HIGH",
            forecasted_at: "2026-08-16T08:00:00.000Z",
          },
        ],
      },
    },
    async ({ getPublicDonationPortal }) => {
      const payload = await getPublicDonationPortal();

      assert.equal(payload.needed_items.source_type, "FORECAST");
      assert.equal(payload.needed_items.title, "Forecasted Donation Needs");
      assert.deepEqual(
        payload.needed_items.suggestions.map((item) => item.item_name),
        ["Rice"],
      );
    },
  );
});

test("public portal reports relief-pack utilization in packs and loose utilization in pieces", async () => {
  const eventId = "00000000-0000-0000-0000-000000000001";

  await withStubbedDonationService(
    {
      donationRepositoryOverrides: {
        getDonationItemTransparencySummary: async () => [
          {
            donation_id: "donation-pack",
            donor_name: "Relief Partner",
            donor_type: "NGO",
            disaster_event_id: eventId,
            disaster_event_title: "Active Flood Response",
            inventory_item_id: "water-item",
            item_name: "Bottled Water",
            quantity_received: 10,
            quantity_distributed: 5,
            quantity_remaining: 5,
            quantity_written_off: 0,
            donation_item_remarks: "Relief Pack: Family Pack x 2",
          },
          {
            donation_id: "donation-pack",
            donor_name: "Relief Partner",
            donor_type: "NGO",
            disaster_event_id: eventId,
            disaster_event_title: "Active Flood Response",
            inventory_item_id: "tuna-item",
            item_name: "Canned Tuna",
            quantity_received: 4,
            quantity_distributed: 2,
            quantity_remaining: 2,
            quantity_written_off: 0,
            donation_item_remarks: "Relief Pack: Family Pack x 2",
          },
          {
            donation_id: "donation-loose",
            donor_name: "Community Group",
            donor_type: "NGO",
            disaster_event_id: eventId,
            disaster_event_title: "Active Flood Response",
            inventory_item_id: "shampoo-item",
            item_name: "Sunsilk Shampoo",
            quantity_received: 12,
            quantity_distributed: 3,
            quantity_remaining: 9,
            quantity_written_off: 0,
            donation_item_remarks: "Per Family Allocation: 1",
          },
        ],
      },
    },
    async ({ getPublicDonationPortal }) => {
      const payload = await getPublicDonationPortal();
      const rows = payload.transparency_summary.received_vs_distributed;
      const packRow = rows.find((row) => row.source_type === "RELIEF_PACK");
      const looseRow = rows.find((row) => row.source_type === "LOOSE_ITEM");

      assert.deepEqual(
        {
          item_name: packRow.item_name,
          unit_of_measure: packRow.unit_of_measure,
          quantity_received: packRow.quantity_received,
          quantity_distributed: packRow.quantity_distributed,
          quantity_remaining: packRow.quantity_remaining,
        },
        {
          item_name: "Family Pack",
          unit_of_measure: "pack",
          quantity_received: 2,
          quantity_distributed: 1,
          quantity_remaining: 1,
        },
      );
      assert.deepEqual(
        {
          item_name: looseRow.item_name,
          unit_of_measure: looseRow.unit_of_measure,
          quantity_received: looseRow.quantity_received,
          quantity_distributed: looseRow.quantity_distributed,
          quantity_remaining: looseRow.quantity_remaining,
        },
        {
          item_name: "Sunsilk Shampoo",
          unit_of_measure: "pc",
          quantity_received: 12,
          quantity_distributed: 3,
          quantity_remaining: 9,
        },
      );
      assert.equal(packRow.donor_name, "Donor #1");
      assert.equal(packRow.donor_type_label, "NGO");
      assert.equal(looseRow.donor_name, "Donor #2");
      assert.equal(looseRow.donor_type_label, "NGO");
    },
  );
});

test("public portal does not show preparedness defaults when a current forecast has no stock shortfall", async () => {
  await withStubbedDonationService(
    {
      donationRepositoryOverrides: {
        getDefaultEmergencyDonationNeeds: async () => [
          {
            inventory_item_id: "default-water",
            item_name: "Bottled Water",
            unit_of_measure: "bottles",
            suggested_quantity: 50,
            priority_level: "HIGH",
          },
        ],
      },
      forecastServiceOverrides: {
        getLatestInventoryForecast: async () => ({ id: "event-forecast" }),
        buildPublicForecastSuggestions: () => [],
      },
    },
    async ({ getPublicDonationPortal }) => {
      const payload = await getPublicDonationPortal();

      assert.equal(payload.needed_items.source_type, "FORECAST");
      assert.deepEqual(payload.needed_items.suggestions, []);
    },
  );
});

test("public portal uses default emergency needs when no forecast exists", async () => {
  await withStubbedDonationService(
    {
      donationRepositoryOverrides: {
        getDefaultEmergencyDonationNeeds: async () => [
          {
            inventory_item_id: "default-water",
            item_name: "Bottled Water",
            unit_of_measure: "bottles",
            suggested_quantity: 50,
            priority_level: "HIGH",
          },
        ],
      },
    },
    async ({ getPublicDonationPortal }) => {
      const payload = await getPublicDonationPortal();

      assert.equal(payload.needed_items.source_type, "DEFAULT_EMERGENCY");
      assert.equal(payload.needed_items.title, "Emergency Donation Needs");
      assert.equal(payload.needed_items.suggestions.length, 1);
      assert.equal(payload.needed_items.suggestions[0].item_name, "Bottled Water");
      assert.equal(payload.needed_items.suggestions[0].priority_level, "HIGH");
      assert.equal(payload.needed_items.suggestions[0].suggested_quantity, 50);
    },
  );
});

test("public portal falls back to default emergency donation needs when no forecast exists", async () => {
  await withStubbedDonationService(
    {
      donationRepositoryOverrides: {
        getDefaultEmergencyDonationNeeds: async () => [
          {
            inventory_item_id: "default-first-aid",
            item_name: "First Aid Supplies",
            unit_of_measure: "kits",
            suggested_quantity: 10,
            priority_level: "URGENT",
          },
        ],
      },
    },
    async ({ getPublicDonationPortal }) => {
      const payload = await getPublicDonationPortal();

      assert.equal(payload.needed_items.source_type, "DEFAULT_EMERGENCY");
      assert.equal(payload.needed_items.title, "Emergency Donation Needs");
      assert.equal(payload.needed_items.suggestions[0].item_name, "First Aid Supplies");
      assert.equal(payload.needed_items.suggestions[0].priority_level, "HIGH");
    },
  );
});

test("public portal scopes donation transparency to current displayed disaster operations", async () => {
  const today = new Date();
  const currentEventId = "00000000-0000-0000-0000-000000000101";
  const endedEventId = "00000000-0000-0000-0000-000000000102";
  const scopedCalls = [];

  await withStubbedDonationService(
    {
      donationRepositoryOverrides: {
        getPublicDonationDisasterSummaries: async () => [
          {
            id: endedEventId,
            title: "Ended Flood Response",
            disaster_type: "Flood",
            status: "ACTIVE",
            start_date: formatDateOnly(addDays(today, -8)),
            end_date: formatDateOnly(addDays(today, -2)),
            created_at: addDays(today, -8).toISOString(),
            updated_at: addDays(today, -2).toISOString(),
          },
          {
            id: currentEventId,
            title: "Current Typhoon Response",
            disaster_type: "Typhoon",
            status: "ACTIVE",
            start_date: formatDateOnly(addDays(today, -1)),
            end_date: formatDateOnly(addDays(today, 2)),
            created_at: addDays(today, -1).toISOString(),
            updated_at: today.toISOString(),
          },
        ],
        getDonationSummaryTotals: async (eventIds) => {
          scopedCalls.push(["totals", eventIds]);
          return {};
        },
        getDonationItemTransparencySummary: async (eventIds) => {
          scopedCalls.push(["utilization", eventIds]);
          return [];
        },
        getPublicRecentDonationSummaries: async (eventIds) => {
          scopedCalls.push(["recent", eventIds]);
          return [];
        },
        getDefaultEmergencyDonationNeeds: async (disasterTypes) => {
          scopedCalls.push(["needs", disasterTypes]);
          return [];
        },
      },
    },
    async ({ getPublicDonationPortal }) => {
      const payload = await getPublicDonationPortal();

      assert.deepEqual(
        payload.disaster_events.map((event) => event.title),
        ["Current Typhoon Response"],
      );
      assert.deepEqual(scopedCalls, [
        ["totals", [currentEventId]],
        ["utilization", [currentEventId]],
        ["recent", [currentEventId]],
        ["needs", ["Typhoon"]],
      ]);
    },
  );
});

test("public portal scopes donation transparency to the three recent operations during fallback", async () => {
  const today = new Date();
  const recentEventIds = [
    "00000000-0000-0000-0000-000000000201",
    "00000000-0000-0000-0000-000000000202",
    "00000000-0000-0000-0000-000000000203",
  ];
  const olderEventId = "00000000-0000-0000-0000-000000000204";
  const scopedCalls = [];

  await withStubbedDonationService(
    {
      donationRepositoryOverrides: {
        getPublicDonationDisasterSummaries: async () => [
          {
            id: olderEventId,
            title: "Older Landslide Response",
            disaster_type: "Landslide",
            status: "ACTIVE",
            start_date: formatDateOnly(addDays(today, -18)),
            end_date: formatDateOnly(addDays(today, -15)),
            created_at: addDays(today, -18).toISOString(),
            updated_at: addDays(today, -15).toISOString(),
          },
          ...recentEventIds.map((id, index) => ({
            id,
            title: `Recent Response ${index + 1}`,
            disaster_type: "Flood",
            status: "ACTIVE",
            start_date: formatDateOnly(addDays(today, -index - 4)),
            end_date: formatDateOnly(addDays(today, -index - 1)),
            created_at: addDays(today, -index - 4).toISOString(),
            updated_at: addDays(today, -index - 1).toISOString(),
          })),
        ],
        getDonationSummaryTotals: async (eventIds) => {
          scopedCalls.push(["totals", eventIds]);
          return {};
        },
        getDonationItemTransparencySummary: async (eventIds) => {
          scopedCalls.push(["utilization", eventIds]);
          return [];
        },
        getPublicRecentDonationSummaries: async (eventIds) => {
          scopedCalls.push(["recent", eventIds]);
          return [];
        },
      },
    },
    async ({ getPublicDonationPortal }) => {
      const payload = await getPublicDonationPortal();

      assert.deepEqual(
        payload.disaster_events.map((event) => event.title),
        ["Recent Response 1", "Recent Response 2", "Recent Response 3"],
      );
      assert.deepEqual(scopedCalls, [
        ["totals", recentEventIds],
        ["utilization", recentEventIds],
        ["recent", recentEventIds],
      ]);
    },
  );
});

test("public portal reveals donor names only when explicitly published", async () => {
  await withStubbedDonationService(
    {
      donationRepositoryOverrides: {
        getPublicRecentDonationSummaries: async () => [
          {
            public_key: "anonymous-donation",
            donor_name: null,
            donor_name_public: false,
            donor_type: "INDIVIDUAL",
            donation_count: 1,
            item_count: 1,
            total_quantity_received: 5,
            items: [],
          },
          {
            public_key: "published-donation",
            donor_name: "Open Hands Foundation",
            donor_name_public: true,
            donor_type: "NGO",
            donation_count: 1,
            item_count: 1,
            total_quantity_received: 10,
            items: [],
          },
        ],
        getDonationItemTransparencySummary: async () => [
          {
            donation_id: "anonymous-donation",
            inventory_item_id: "item-1",
            donor_name: "Private Donor",
            donor_name_public: false,
            item_name: "Rice",
            unit_of_measure: "kg",
            quantity_received: 5,
            quantity_distributed: 0,
            quantity_written_off: 0,
            quantity_remaining: 5,
          },
          {
            donation_id: "published-donation",
            inventory_item_id: "item-2",
            donor_name: "Open Hands Foundation",
            donor_name_public: true,
            item_name: "Water",
            unit_of_measure: "bottles",
            quantity_received: 10,
            quantity_distributed: 0,
            quantity_written_off: 0,
            quantity_remaining: 10,
          },
        ],
      },
    },
    async ({ getPublicDonationPortal }) => {
      const payload = await getPublicDonationPortal();

      assert.deepEqual(
        payload.recent_donations.map((donation) => donation.donor_name),
        ["Donor #1", "Open Hands Foundation"],
      );
      assert.deepEqual(
        payload.transparency_summary.received_vs_distributed.map(
          (row) => row.donor_name,
        ),
        ["Donor #1", "Open Hands Foundation"],
      );
    },
  );
});

test("public portal omits the duplicate forecast alias only for paginated responses", async () => {
  const expectedSuggestions = [
    {
      public_key: "forecast-rice",
      item_name: "Rice",
      category: "Food",
      unit_of_measure: "packs",
      suggested_quantity: 25,
      priority_level: "HIGH",
      note: "Prioritized shortfall",
      forecasted_at: "2026-08-16T08:00:00.000Z",
    },
  ];

  await withStubbedDonationService(
    {
      forecastServiceOverrides: {
        getLatestInventoryForecast: async () => ({ id: "event-forecast" }),
        buildPublicForecastSuggestions: () => expectedSuggestions,
      },
    },
    async ({ getPublicDonationPortal }) => {
      const paginatedPayload = await getPublicDonationPortal({
        transparency_page: 1,
        transparency_page_size: 25,
      });

      assert.deepEqual(
        paginatedPayload.needed_items.suggestions,
        expectedSuggestions,
      );
      assert.equal(
        Object.prototype.hasOwnProperty.call(
          paginatedPayload,
          "forecast_suggestions",
        ),
        false,
      );
      assert.doesNotMatch(
        JSON.stringify(paginatedPayload),
        /"forecast_suggestions"/,
      );

      const legacyPayload = await getPublicDonationPortal();

      assert.equal(
        Object.prototype.hasOwnProperty.call(
          legacyPayload,
          "forecast_suggestions",
        ),
        true,
      );
      assert.strictEqual(
        legacyPayload.forecast_suggestions,
        legacyPayload.needed_items.suggestions,
      );
      assert.deepEqual(
        legacyPayload.forecast_suggestions,
        expectedSuggestions,
      );
      assert.equal(
        Object.prototype.hasOwnProperty.call(
          legacyPayload.transparency_summary,
          "pagination",
        ),
        false,
      );
    },
  );
});

test("public portal returns paginated transparency rows with full-scope totals", async () => {
  const eventId = "00000000-0000-0000-0000-000000000001";
  const requestedPagination = [];

  await withStubbedDonationService(
    {
      donationRepositoryOverrides: {
        getDonationSummaryTotals: async () => ({
          total_donations_received: 60,
          total_quantity_received: 600,
          total_donated_items_distributed: 200,
          total_donated_items_written_off: 10,
          remaining_donated_inventory: 390,
        }),
        getDonationItemTransparencySummary: async (eventIds, options) => {
          requestedPagination.push({ eventIds, options });
          return {
            rows: [
              {
                source_key: "donation-page-2",
                source_type: "LOOSE_ITEM",
                donor_name: "Private Donor",
                donor_name_public: false,
                donor_type: "INDIVIDUAL",
                disaster_event_id: eventId,
                disaster_event_title: "Active Flood Response",
                item_name: "Rice",
                unit_of_measure: "pc",
                quantity_received: 10,
                quantity_distributed: 4,
                quantity_written_off: 1,
                quantity_remaining: 5,
                write_off_reasons: [
                  { reason: "DAMAGED", quantity: 1 },
                ],
                donor_label_number: 7,
              },
            ],
            totalItems: 60,
            page: 2,
            pageSize: 25,
            totals: {
              loose_items_received: 500,
              loose_items_distributed: 150,
              loose_items_remaining: 340,
              relief_packs_received: 100,
              relief_packs_distributed: 50,
              relief_packs_remaining: 50,
            },
          };
        },
      },
    },
    async ({ getPublicDonationPortal }) => {
      const payload = await getPublicDonationPortal({
        disaster_event_id: eventId,
        transparency_page: 2,
        transparency_page_size: 25,
      });

      assert.deepEqual(requestedPagination, [
        {
          eventIds: [eventId],
          options: { page: 2, pageSize: 25 },
        },
      ]);
      assert.equal(
        payload.transparency_summary.received_vs_distributed.length,
        1,
      );
      assert.equal(
        payload.transparency_summary.received_vs_distributed[0].donor_name,
        "Donor #7",
      );
      assert.deepEqual(
        payload.transparency_summary.received_vs_distributed[0].write_off_reasons,
        [{ reason: "DAMAGED", quantity: 1 }],
      );
      assert.deepEqual(payload.transparency_summary.pagination, {
        page: 2,
        pageSize: 25,
        totalItems: 60,
        totalPages: 3,
        hasPreviousPage: true,
        hasNextPage: true,
      });
      assert.equal(payload.transparency_summary.total_loose_items_received, 500);
      assert.equal(payload.transparency_summary.total_relief_packs_received, 100);
      assert.equal(payload.transparency_summary.total_quantity_received, 600);
    },
  );
});
