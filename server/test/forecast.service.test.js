const test = require("node:test");
const assert = require("node:assert/strict");

const servicePath = require.resolve("../src/services/forecast.service");
const repositoryPath = require.resolve("../src/repositories/forecast.repository");
const dbPath = require.resolve("../src/config/db");
const systemLogPath = require.resolve("../src/utils/systemLog");

const withStubbedForecastService = async (stubs, runTest) => {
  const dependencyPaths = Object.keys(stubs);
  const originalEntries = new Map(
    dependencyPaths.map((modulePath) => [modulePath, require.cache[modulePath]]),
  );
  const originalServiceEntry = require.cache[servicePath];

  delete require.cache[servicePath];

  try {
    dependencyPaths.forEach((modulePath) => {
      delete require.cache[modulePath];
      require.cache[modulePath] = {
        id: modulePath,
        filename: modulePath,
        loaded: true,
        exports: stubs[modulePath],
      };
    });

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

test("runInventoryForecast rejects non-active disaster events before computing demand", async () => {
  const calls = [];

  await withStubbedForecastService(
    {
      [dbPath]: {},
      [systemLogPath]: {
        logErrorSafely: async () => {},
      },
      [repositoryPath]: {
        getDisasterEventById: async () => ({
          id: "event-1",
          event_code: "DE-TEST",
          title: "Closed Event",
          status: "CLOSED",
        }),
        getInventoryForecastItems: async () => {
          calls.push("getInventoryForecastItems");
          return [];
        },
      },
    },
    async ({ runInventoryForecast }) => {
      await assert.rejects(
        () =>
          runInventoryForecast({
            disaster_event_id: "event-1",
            model_name: "MOVING_AVERAGE",
            run_by: "user-1",
          }),
        (error) => {
          assert.equal(error.statusCode, 400);
          assert.equal(error.code, "DISASTER_EVENT_NOT_ACTIVE_FOR_FORECAST");
          assert.match(error.message, /active disaster events/);
          return true;
        },
      );
    },
  );

  assert.deepEqual(calls, []);
});

test("getLatestInventoryForecastOverall maps the newest forecast run without requiring an event id", async () => {
  await withStubbedForecastService(
    {
      [dbPath]: {},
      [systemLogPath]: {
        logErrorSafely: async () => {},
      },
      [repositoryPath]: {
        getLatestForecastRun: async () => ({
          id: "forecast-run-1",
          disaster_event_id: "event-1",
          event_code: "DE-001",
          disaster_event_title: "Flood Response",
          run_type: "INVENTORY_DEMAND",
          run_by: "user-1",
          run_at: "2026-08-16T08:00:00.000Z",
          model_name: "MOVING_AVERAGE",
          parameters_json: {},
        }),
        getForecastResultsByRunId: async (runId) => {
          assert.equal(runId, "forecast-run-1");
          return [
            {
              inventory_item_id: "item-1",
              item_name: "Rice",
              item_code: "RICE",
              category: "Food",
              unit_of_measure: "packs",
              predicted_quantity_needed: 12,
              predicted_depletion_date: null,
              recommended_reorder_quantity: 8,
              confidence_notes: JSON.stringify({
                risk_level: "HIGH",
                shortage_within_seven_days: true,
              }),
            },
          ];
        },
      },
    },
    async ({ getLatestInventoryForecastOverall }) => {
      const latestForecast = await getLatestInventoryForecastOverall();

      assert.equal(latestForecast.forecast_run.id, "forecast-run-1");
      assert.equal(latestForecast.results.length, 1);
      assert.equal(latestForecast.results[0].item_name, "Rice");
      assert.equal(latestForecast.results[0].risk_level, "HIGH");
    },
  );
});

test("public forecast suggestions request only the eligible-stock shortfall", async () => {
  await withStubbedForecastService(
    {
      [dbPath]: {},
      [systemLogPath]: {
        logErrorSafely: async () => {},
      },
      [repositoryPath]: {},
    },
    async ({ buildPublicForecastSuggestions }) => {
      const suggestions = buildPublicForecastSuggestions({
        forecast_run: {
          run_at: "2026-08-28T08:00:00.000Z",
        },
        results: [
          {
            inventory_item_id: "item-covered",
            item_name: "Covered Rice",
            category: "Food",
            unit_of_measure: "packs",
            forecasted_usage: 100,
            current_available_stock: 150,
            recommended_reorder_quantity: 0,
            projected_remaining_stock: 50,
            risk_level: "LOW",
          },
          {
            inventory_item_id: "item-short",
            item_name: "Short Rice",
            category: "Food",
            unit_of_measure: "packs",
            forecasted_usage: 100,
            current_available_stock: 75,
            recommended_reorder_quantity: 35,
            projected_remaining_stock: 0,
            risk_level: "HIGH",
          },
        ],
      });

      assert.deepEqual(
        suggestions.map((suggestion) => [
          suggestion.item_name,
          suggestion.suggested_quantity,
        ]),
        [["Short Rice", 35]],
      );
    },
  );
});

test("runInventoryForecast sends eligible LGU and donated stock to analytics and persists its basis", async () => {
  const calls = {
    forecastItemEventId: null,
    analyticsPayload: null,
    runPayload: null,
    resultPayload: null,
  };
  const originalFetch = global.fetch;
  const transactionClient = {
    query: async () => ({ rows: [] }),
    release: () => {},
  };

  global.fetch = async (_url, options) => {
    calls.analyticsPayload = JSON.parse(options.body);

    return {
      ok: true,
      json: async () => ({
        forecast_horizon_days: 14,
        lookback_days: 30,
        results: [
          {
            inventory_item_id: "item-1",
            item_name: "Rice",
            item_code: "RICE",
            category: "Food",
            unit_of_measure: "packs",
            current_available_stock: 25,
            reorder_level: 0,
            average_daily_usage: 0,
            forecasted_usage: 0,
            projected_depletion_date: null,
            recommended_reorder_quantity: 0,
            risk_level: "LOW",
            selected_model: "MOVING_AVERAGE",
            daily_forecast: 0,
          },
        ],
      }),
    };
  };

  try {
    await withStubbedForecastService(
      {
        [dbPath]: {
          connect: async () => transactionClient,
        },
        [systemLogPath]: {
          logErrorSafely: async () => {},
        },
        [repositoryPath]: {
          getDisasterEventById: async () => ({
            id: "event-1",
            event_code: "DE-001",
            title: "Flood Response",
            status: "ACTIVE",
          }),
          getInventoryForecastItems: async (eventId) => {
            calls.forecastItemEventId = eventId;
            return [
              {
                id: "item-1",
                item_code: "RICE",
                item_name: "Rice",
                category: "Food",
                unit_of_measure: "packs",
                reorder_level: 0,
                current_available_stock: "25",
                current_lgu_available_stock: "15",
                current_donated_available_stock: "10",
              },
            ];
          },
          getForecastEventContext: async () => ({
            start_date: "2026-08-28",
            end_date: null,
            ended_at: null,
            household_count: 1,
            evacuee_count: 4,
            attendance_record_count: 4,
            present_evacuee_count: 4,
            eligible_household_count: 1,
            eligible_evacuee_count: 4,
            claimed_household_count: 0,
            unclaimed_eligible_household_count: 1,
            distribution_transaction_count: 0,
            total_released_quantity: 0,
            active_inventory_item_count: 1,
            active_standard_pack_count: 1,
          }),
          getReliefPackDemandByEvent: async () => [],
          getInventoryUsageSeries: async () => [],
          getInventoryUsageTrend: async () => [],
          insertForecastRun: async (payload) => {
            calls.runPayload = payload;
            return {
              id: "run-1",
              ...payload,
              run_at: "2026-08-28T08:00:00.000Z",
              parameters_json: payload.parameters_json,
            };
          },
          insertForecastResult: async (payload) => {
            calls.resultPayload = payload;
            return { id: "result-1" };
          },
        },
      },
      async ({ runInventoryForecast }) => {
        const response = await runInventoryForecast({
          disaster_event_id: "event-1",
          model_name: "MOVING_AVERAGE",
          run_by: "user-1",
        });

        assert.equal(response.results[0].current_available_stock, 25);
        assert.equal(response.results[0].current_lgu_available_stock, 15);
        assert.equal(response.results[0].current_donated_available_stock, 10);
      },
    );
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(calls.forecastItemEventId, "event-1");
  assert.equal(calls.analyticsPayload.items[0].current_available_stock, 25);
  assert.deepEqual(calls.runPayload.parameters_json.inventory_stock_basis, {
    included_source_types: ["LGU", "DONATED"],
    included_batch_statuses: ["AVAILABLE", "LOW_STOCK"],
    near_expiry_exclusion_days: 30,
    donated_stock_scope:
      "SELECTED_DISASTER_EVENT_WITH_CLOSED_EVENT_LOOSE_DONATION_ROLLOVER",
  });

  const confidenceNotes = JSON.parse(calls.resultPayload.confidence_notes);
  assert.equal(confidenceNotes.current_lgu_available_stock, 15);
  assert.equal(confidenceNotes.current_donated_available_stock, 10);
});
