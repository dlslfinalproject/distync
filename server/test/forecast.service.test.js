const test = require("node:test");
const assert = require("node:assert/strict");

const servicePath = require.resolve("../src/services/forecast.service");
const repositoryPath = require.resolve("../src/repositories/forecast.repository");
const dbPath = require.resolve("../src/config/db");
const systemLogPath = require.resolve("../src/utils/systemLog");

const AUTO_REFERENCE_INSTANT = "2026-09-29T16:30:00.000Z";
const AUTO_FORECAST_MODELS = [
  "MOVING_AVERAGE",
  "EXPONENTIAL_SMOOTHING",
  "TREND_PROJECTION",
];

const createAutoForecastItems = () => [
  {
    id: "item-rice",
    item_code: "RICE",
    item_name: "Rice",
    category: "Food",
    unit_of_measure: "packs",
    reorder_level: 2,
    current_available_stock: 25,
    current_lgu_available_stock: 20,
    current_donated_available_stock: 5,
  },
  {
    id: "item-water",
    item_code: "WATER",
    item_name: "Water",
    category: "Water",
    unit_of_measure: "bottles",
    reorder_level: 5,
    current_available_stock: 400,
    current_lgu_available_stock: 400,
    current_donated_available_stock: 0,
  },
  {
    id: "item-canned",
    item_code: "CANNED",
    item_name: "Canned Goods",
    category: "Food",
    unit_of_measure: "cans",
    reorder_level: 0,
    current_available_stock: 5,
    current_lgu_available_stock: 5,
    current_donated_available_stock: 0,
  },
];

const createAutoAnalyticsResult = ({
  item,
  selectedModel,
  selectedUsage,
  insufficientHistory,
}) => {
  const selectedDaily = selectedUsage / 14;
  const candidateEvaluations = AUTO_FORECAST_MODELS.map((modelName, index) => {
    const isSelected = modelName === selectedModel;
    const currentForecast = {
      model_name: modelName,
      daily_forecast: isSelected ? selectedDaily : index + 1,
      forecasted_usage: isSelected ? selectedUsage : (index + 1) * 14,
    };

    return {
      model_name: modelName,
      status: insufficientHistory ? "NOT_EVALUATED" : "EVALUATED",
      mae: insufficientHistory ? null : isSelected ? 0.5 : index + 1,
      rmse: insufficientHistory ? null : isSelected ? 1 : index + 2,
      backtest_point_count: insufficientHistory ? 0 : item.usage_series.length - 7,
      current_forecast: currentForecast,
      failure_reason: insufficientHistory ? "INSUFFICIENT_HISTORY" : null,
    };
  });
  const rawForecast = candidateEvaluations.find(
    (candidate) => candidate.model_name === selectedModel,
  ).current_forecast;

  return {
    inventory_item_id: item.inventory_item_id,
    item_name: item.item_name,
    current_available_stock: item.current_available_stock,
    reorder_level: item.reorder_level,
    average_daily_usage: 0,
    forecasted_usage: selectedUsage,
    projected_depletion_date: null,
    recommended_reorder_quantity: 0,
    risk_level: "LOW",
    selected_model: selectedModel,
    daily_forecast: selectedDaily,
    recommended_model: insufficientHistory ? null : selectedModel,
    recommendation_status: insufficientHistory ? "NOT_EVALUATED" : "RECOMMENDED",
    recommendation_reason: insufficientHistory
      ? "INSUFFICIENT_HISTORY"
      : "UNIQUE_LOWEST_MAE",
    selection_reason: insufficientHistory
      ? "OPERATIONAL_FALLBACK"
      : "HISTORICALLY_RECOMMENDED",
    evaluation_status: insufficientHistory ? "INSUFFICIENT_HISTORY" : "EVALUATED",
    evaluation_method: "ROLLING_ORIGIN_ONE_STEP",
    initial_training_points: 7,
    available_observations: item.usage_series.length,
    backtest_points: Math.max(0, item.usage_series.length - 7),
    candidate_evaluations: candidateEvaluations,
    raw_statistical_forecast: rawForecast,
  };
};

const buildAutoAnalyticsResponse = (
  payload,
  {
    recommendations = {
      "item-rice": "EXPONENTIAL_SMOOTHING",
      "item-water": "MOVING_AVERAGE",
      "item-canned": "TREND_PROJECTION",
    },
    selectedUsage = {
      "item-rice": 50,
      "item-water": 100,
      "item-canned": 10,
    },
  } = {},
) => ({
  model_name: "MOVING_AVERAGE",
  forecast_horizon_days: 14,
  lookback_days: 30,
  results: payload.items
    .map((item) => {
      const insufficientHistory = item.usage_series.length < 14;
      const selectedModel = insufficientHistory
        ? "MOVING_AVERAGE"
        : recommendations[item.inventory_item_id];
      const fallbackUsage =
        item.usage_series.slice(-7).reduce((total, value) => total + value, 0) /
        Math.max(1, item.usage_series.slice(-7).length) *
        14;

      return createAutoAnalyticsResult({
        item,
        selectedModel,
        selectedUsage: insufficientHistory
          ? fallbackUsage
          : selectedUsage[item.inventory_item_id],
        insufficientHistory,
      });
    })
    .reverse(),
});

const withAutoForecastFixture = async (
  {
    eventStartDate = "2026-08-01",
    forecastItems = createAutoForecastItems(),
    usageRows = [
      {
        inventory_item_id: "item-rice",
        usage_date: "2026-09-20",
        total_quantity: "5",
      },
      {
        inventory_item_id: "item-water",
        usage_date: "2026-09-22",
        total_quantity: "7",
      },
      {
        inventory_item_id: "item-rice",
        usage_date: "2026-09-30",
        total_quantity: "999",
      },
    ],
    demandRows = [
      { inventory_item_id: "item-rice", projected_household_demand: "80" },
      { inventory_item_id: "item-water", projected_household_demand: "80" },
      { inventory_item_id: "item-canned", projected_household_demand: "4" },
    ],
    persist = false,
    failResultInsertAt = null,
    responseFactory = (payload) => buildAutoAnalyticsResponse(payload),
  } = {},
  runTest,
) => {
  const calls = {
    eventIds: [],
    itemEventIds: [],
    contextEventIds: [],
    demandEventIds: [],
    historyQueries: [],
    analyticsCallCount: 0,
    analyticsPayload: null,
    connectCount: 0,
    forecastRunInserts: 0,
    forecastResultInserts: 0,
    transactionCommands: [],
    runInsertPayloads: [],
    resultInsertPayloads: [],
    repositoryClients: [],
    releaseCount: 0,
  };
  const transactionClient = {
    query: async (sql) => {
      calls.transactionCommands.push(sql);
      return { rows: [] };
    },
    release: () => {
      calls.releaseCount += 1;
    },
  };
  const originalFetch = global.fetch;
  global.fetch = async (_url, options) => {
    calls.analyticsCallCount += 1;
    calls.analyticsPayload = JSON.parse(options.body);
    const responseData = await responseFactory(calls.analyticsPayload);
    return {
      ok: true,
      json: async () => responseData,
    };
  };

  try {
    await withStubbedForecastService(
      {
        [dbPath]: {
          connect: async () => {
            calls.connectCount += 1;
            if (!persist) {
              throw new Error("AUTO_BACKTEST must not connect for evaluation");
            }
            return transactionClient;
          },
        },
        [systemLogPath]: { logErrorSafely: async () => {} },
        [repositoryPath]: {
          getDisasterEventById: async (eventId) => {
            calls.eventIds.push(eventId);
            return {
              id: eventId,
              event_code: "DE-001",
              title: "Flood Response",
              status: "ACTIVE",
            };
          },
          getInventoryForecastItems: async (eventId) => {
            calls.itemEventIds.push(eventId);
            return forecastItems;
          },
          getForecastEventContext: async (eventId) => {
            calls.contextEventIds.push(eventId);
            return {
              id: eventId,
              start_date: eventStartDate,
              end_date: null,
              ended_at: null,
              household_count: 7,
              evacuee_count: 10,
              attendance_record_count: 12,
              present_evacuee_count: 8,
              eligible_household_count: 6,
              eligible_evacuee_count: 9,
              claimed_household_count: 2,
              unclaimed_eligible_household_count: 4,
              distribution_transaction_count: 3,
              total_released_quantity: 18,
              inventory_item_count: 30,
              active_standard_pack_count: 5,
            };
          },
          getReliefPackDemandByEvent: async (eventId) => {
            calls.demandEventIds.push(eventId);
            return demandRows;
          },
          getEligibleInventoryUsageSeries: async (...args) => {
            calls.historyQueries.push(args);
            return usageRows;
          },
          getInventoryUsageSeries: async () => {
            throw new Error("AUTO_BACKTEST must use eligible history");
          },
          getInventoryUsageTrend: async () => {
            throw new Error("AUTO_BACKTEST does not request the legacy trend");
          },
          insertForecastRun: async (payload, dbClient) => {
            calls.forecastRunInserts += 1;
            if (!persist) {
              throw new Error("AUTO_BACKTEST must not insert forecast runs");
            }
            calls.runInsertPayloads.push(payload);
            calls.repositoryClients.push(dbClient);
            return {
              id: "forecast-run-auto",
              ...payload,
              run_type: payload.run_type,
              run_at: "2026-09-30T00:00:00.000Z",
            };
          },
          insertForecastResult: async (payload, dbClient) => {
            calls.forecastResultInserts += 1;
            if (!persist) {
              throw new Error("AUTO_BACKTEST must not insert forecast results");
            }
            calls.resultInsertPayloads.push(payload);
            calls.repositoryClients.push(dbClient);
            if (calls.forecastResultInserts === failResultInsertAt) {
              throw new Error("simulated result persistence failure");
            }
            return {
              id: `forecast-result-${calls.forecastResultInserts}`,
            };
          },
        },
      },
      async (forecastService) => runTest(forecastService, calls),
    );
  } finally {
    global.fetch = originalFetch;
  }
};

test("eligible history windows use Manila completed days, event start, and a 30-day cap", async () => {
  await withStubbedForecastService(
    {
      [dbPath]: {},
      [systemLogPath]: { logErrorSafely: async () => {} },
      [repositoryPath]: {},
    },
    async ({ buildEligibleHistoryWindow, getManilaDateKey }) => {
      const utcBoundary = new Date("2026-09-29T16:30:00.000Z");
      assert.equal(getManilaDateKey(utcBoundary), "2026-09-30");

      const eventWindow = buildEligibleHistoryWindow({
        eventStartDate: "2026-09-20",
        referenceInstant: utcBoundary,
      });
      assert.equal(eventWindow.eligible_start_date, "2026-09-20");
      assert.equal(eventWindow.eligible_end_date, "2026-09-29");
      assert.equal(eventWindow.eligible_day_count, 10);
      assert.equal(eventWindow.current_incomplete_day_excluded, true);
      assert.equal(eventWindow.day_keys.includes("2026-09-30"), false);

      const cappedWindow = buildEligibleHistoryWindow({
        eventStartDate: "2020-01-01",
        referenceInstant: utcBoundary,
      });
      assert.equal(cappedWindow.eligible_start_date, "2026-08-31");
      assert.equal(cappedWindow.eligible_end_date, "2026-09-29");
      assert.equal(cappedWindow.eligible_day_count, 30);

      const eventStartingToday = buildEligibleHistoryWindow({
        eventStartDate: "2026-09-30",
        referenceInstant: utcBoundary,
      });
      assert.equal(eventStartingToday.eligible_day_count, 0);
      assert.deepEqual(eventStartingToday.day_keys, []);
    },
  );
});

test("eligible series zero-fills missing dates and aligns every item to shared keys", async () => {
  await withStubbedForecastService(
    {
      [dbPath]: {},
      [systemLogPath]: { logErrorSafely: async () => {} },
      [repositoryPath]: {},
    },
    async ({ buildEligibleHistoricalSeries }) => {
      const dayKeys = [
        "2026-09-20",
        "2026-09-21",
        "2026-09-22",
        "2026-09-23",
      ];
      const usageSeriesByItemId = buildEligibleHistoricalSeries(
        [
          { inventory_item_id: "item-a", usage_date: dayKeys[0], total_quantity: "5" },
          { inventory_item_id: "item-a", usage_date: dayKeys[2], total_quantity: "2" },
          { inventory_item_id: "item-b", usage_date: dayKeys[1], total_quantity: "7" },
        ],
        ["item-a", "item-b", "item-c"],
        dayKeys,
      );

      assert.deepEqual(usageSeriesByItemId.get("item-a"), [5, 0, 2, 0]);
      assert.deepEqual(usageSeriesByItemId.get("item-b"), [0, 7, 0, 0]);
      assert.deepEqual(usageSeriesByItemId.get("item-c"), [0, 0, 0, 0]);
      assert.equal(usageSeriesByItemId.get("item-a").length, dayKeys.length);
      assert.equal(usageSeriesByItemId.get("item-b").length, dayKeys.length);
    },
  );
});

test("AUTO_BACKTEST uses one aligned analytics call and enriches per-item selections without persistence", async () => {
  await withAutoForecastFixture({}, async ({ evaluateInventoryForecastModels }, calls) => {
    const result = await evaluateInventoryForecastModels({
      disaster_event_id: "event-1",
      run_by: "user-1",
      referenceInstant: AUTO_REFERENCE_INSTANT,
    });

    assert.equal(result.selection_mode, "AUTO_BACKTEST");
    assert.equal(result.historical_window.time_zone, "Asia/Manila");
    assert.equal(result.historical_window.eligible_start_date, "2026-08-31");
    assert.equal(result.historical_window.eligible_end_date, "2026-09-29");
    assert.equal(result.historical_window.eligible_day_count, 30);
    assert.equal(result.historical_window.day_keys.includes("2026-09-30"), false);
    assert.deepEqual(
      result.results.map((item) => item.inventory_item_id),
      ["item-rice", "item-water", "item-canned"],
    );
    assert.deepEqual(
      result.results.map((item) => item.recommended_model),
      ["EXPONENTIAL_SMOOTHING", "MOVING_AVERAGE", "TREND_PROJECTION"],
    );
    assert.deepEqual(
      result.results.map((item) => item.selected_model),
      ["EXPONENTIAL_SMOOTHING", "MOVING_AVERAGE", "TREND_PROJECTION"],
    );

    const riceResult = result.results[0];
    const waterResult = result.results[1];
    const cannedResult = result.results[2];
    assert.equal(riceResult.raw_statistical_forecast.forecasted_usage, 50);
    assert.equal(riceResult.resolved_operational_usage, 80);
    assert.equal(riceResult.forecasted_usage, 80);
    assert.equal(riceResult.projected_remaining_stock, 0);
    assert.equal(riceResult.recommended_reorder_quantity, 57);
    assert.equal(riceResult.risk_level, "CRITICAL");
    assert.equal(waterResult.raw_statistical_forecast.forecasted_usage, 100);
    assert.equal(waterResult.resolved_operational_usage, 100);
    assert.equal(waterResult.risk_level, "LOW");
    assert.equal(cannedResult.raw_statistical_forecast.forecasted_usage, 10);
    assert.equal(cannedResult.resolved_operational_usage, 10);
    assert.equal(riceResult.candidate_evaluations[1].mae, 0.5);

    assert.equal(calls.analyticsCallCount, 1);
    assert.equal(calls.historyQueries.length, 1);
    assert.deepEqual(calls.historyQueries[0], [
      "event-1",
      "2026-08-31",
      "2026-09-29",
    ]);
    assert.equal(calls.analyticsPayload.selection_mode, "AUTO_BACKTEST");
    assert.equal(calls.analyticsPayload.forecast_horizon_days, 14);
    assert.equal(calls.analyticsPayload.lookback_days, 30);
    assert.equal(calls.analyticsPayload.moving_average_window, 7);
    assert.equal(calls.analyticsPayload.exponential_smoothing_alpha, 0.4);
    assert.equal(calls.analyticsPayload.items.length, 3);
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        calls.analyticsPayload.items[0],
        "projected_household_demand",
      ),
      false,
    );
    assert.deepEqual(
      calls.analyticsPayload.items.map((item) => item.usage_series.length),
      [30, 30, 30],
    );
    const riceHistory = calls.analyticsPayload.items.find(
      (item) => item.inventory_item_id === "item-rice",
    ).usage_series;
    assert.equal(
      riceHistory[result.historical_window.day_keys.indexOf("2026-09-20")],
      5,
    );
    assert.equal(
      calls.analyticsPayload.items.some((item) => item.usage_series.includes(999)),
      false,
    );
    assert.equal(calls.eventIds.length, 1);
    assert.equal(calls.itemEventIds.length, 1);
    assert.equal(calls.contextEventIds.length, 1);
    assert.equal(calls.demandEventIds.length, 1);
    assert.equal(calls.connectCount, 0);
    assert.equal(calls.forecastRunInserts, 0);
    assert.equal(calls.forecastResultInserts, 0);
  });
});

test("AUTO_BACKTEST preserves 13 actual periods and accepts insufficient history as fallback", async () => {
  const riceOnly = createAutoForecastItems().slice(0, 1);
  await withAutoForecastFixture(
    {
      eventStartDate: "2026-09-17",
      forecastItems: riceOnly,
      usageRows: [],
      demandRows: [
        { inventory_item_id: "item-rice", projected_household_demand: "80" },
      ],
    },
    async ({ evaluateInventoryForecastModels }, calls) => {
      const result = await evaluateInventoryForecastModels({
        disaster_event_id: "event-1",
        run_by: "user-1",
        referenceInstant: AUTO_REFERENCE_INSTANT,
      });
      const riceResult = result.results[0];

      assert.equal(result.historical_window.eligible_day_count, 13);
      assert.equal(calls.analyticsPayload.items[0].usage_series.length, 13);
      assert.equal(riceResult.available_observations, 13);
      assert.equal(riceResult.evaluation_status, "INSUFFICIENT_HISTORY");
      assert.equal(riceResult.recommended_model, null);
      assert.equal(riceResult.recommendation_reason, "INSUFFICIENT_HISTORY");
      assert.equal(riceResult.selected_model, "MOVING_AVERAGE");
      assert.equal(riceResult.selection_reason, "OPERATIONAL_FALLBACK");
      assert.equal(riceResult.raw_statistical_forecast.forecasted_usage, 0);
      assert.equal(riceResult.resolved_operational_usage, 80);
      assert.equal(riceResult.candidate_evaluations.length, 3);
      assert.equal(
        riceResult.candidate_evaluations.every(
          (candidate) => candidate.status === "NOT_EVALUATED",
        ),
        true,
      );
      assert.equal(calls.analyticsCallCount, 1);
      assert.equal(calls.connectCount, 0);
      assert.equal(calls.forecastRunInserts, 0);
      assert.equal(calls.forecastResultInserts, 0);
    },
  );
});

test("AUTO_BACKTEST rejects a missing item response before returning any results", async () => {
  await withAutoForecastFixture(
    {
      responseFactory: (payload) => {
        const validResponse = buildAutoAnalyticsResponse(payload);
        return { ...validResponse, results: validResponse.results.slice(1) };
      },
    },
    async ({ evaluateInventoryForecastModels }, calls) => {
      await assert.rejects(
        () =>
          evaluateInventoryForecastModels({
            disaster_event_id: "event-1",
            run_by: "user-1",
            referenceInstant: AUTO_REFERENCE_INSTANT,
          }),
        (error) => error.statusCode === 502 && error.code === "INVALID_FORECAST_RESPONSE",
      );
      assert.equal(calls.analyticsCallCount, 1);
      assert.equal(calls.connectCount, 0);
      assert.equal(calls.forecastRunInserts, 0);
      assert.equal(calls.forecastResultInserts, 0);
    },
  );
});

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
          parameters_json: {
            event_context: {
              active_inventory_item_count: 39,
            },
          },
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
      assert.equal(latestForecast.forecast_run.selection_mode, "FIXED_MODEL");
      assert.equal(latestForecast.results.length, 1);
      assert.equal(latestForecast.results[0].item_name, "Rice");
      assert.equal(latestForecast.results[0].selected_model_name, "MOVING_AVERAGE");
      assert.equal(latestForecast.results[0].selected_model, "MOVING_AVERAGE");
      assert.equal(latestForecast.results[0].risk_level, "HIGH");
      assert.equal(latestForecast.dashboard.summary.inventory_item_count, 39);
      assert.equal(
        latestForecast.dashboard.summary.active_inventory_item_count,
        39,
      );
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
            inventory_item_count: 1,
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
  assert.equal(calls.analyticsPayload.model_name, "MOVING_AVERAGE");
  assert.equal(calls.analyticsPayload.selection_mode, undefined);
  assert.equal(calls.runPayload.selection_mode, "FIXED_MODEL");
  assert.equal(calls.analyticsPayload.items[0].current_available_stock, 25);
  assert.equal(
    calls.runPayload.parameters_json.event_context.inventory_item_count,
    1,
  );
  assert.equal(
    calls.runPayload.parameters_json.event_context.active_inventory_item_count,
    1,
  );
  assert.equal(
    calls.runPayload.parameters_json.event_context.inventory_item_count,
    calls.runPayload.parameters_json.event_context.active_inventory_item_count,
  );
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

test("AUTO_BACKTEST persistence writes one mixed-model run with bounded evidence and raw forecasts", async () => {
  await withAutoForecastFixture(
    { persist: true },
    async ({ runAndPersistAutoInventoryForecast }, calls) => {
      const persistedForecast = await runAndPersistAutoInventoryForecast({
        disaster_event_id: "event-1",
        run_by: "user-1",
        referenceInstant: AUTO_REFERENCE_INSTANT,
      });

      assert.equal(persistedForecast.forecast_run.selection_mode, "AUTO_BACKTEST");
      assert.equal(persistedForecast.forecast_run.model_name, null);
      assert.equal(calls.analyticsCallCount, 1);
      assert.equal(calls.historyQueries.length, 1);
      assert.equal(calls.forecastRunInserts, 1);
      assert.equal(calls.forecastResultInserts, 3);
      assert.deepEqual(calls.transactionCommands, ["BEGIN", "COMMIT"]);
      assert.equal(calls.releaseCount, 1);
      assert.equal(calls.repositoryClients.length, 4);
      assert.ok(calls.repositoryClients.every((client) => client === calls.repositoryClients[0]));

      const runInsert = calls.runInsertPayloads[0];
      assert.equal(runInsert.selection_mode, "AUTO_BACKTEST");
      assert.equal(runInsert.model_name, null);
      assert.equal(runInsert.parameters_json.selection_mode, "AUTO_BACKTEST");
      assert.equal(runInsert.parameters_json.forecast_horizon_days, 14);
      assert.equal(runInsert.parameters_json.lookback_days, 30);
      assert.equal(runInsert.parameters_json.moving_average_window, 7);
      assert.equal(runInsert.parameters_json.exponential_smoothing_alpha, 0.4);
      assert.equal(runInsert.parameters_json.evaluation_method, "ROLLING_ORIGIN_ONE_STEP");
      assert.equal(runInsert.parameters_json.initial_training_points, 7);
      assert.equal(runInsert.parameters_json.minimum_backtest_points, 7);
      assert.equal(runInsert.parameters_json.minimum_history_points, 14);
      assert.equal(runInsert.parameters_json.timezone, "Asia/Manila");
      assert.equal(runInsert.parameters_json.current_incomplete_day_excluded, true);
      assert.equal(runInsert.parameters_json.event_context.household_count, 7);
      assert.equal(runInsert.parameters_json.event_context.inventory_item_count, 30);
      assert.equal(
        runInsert.parameters_json.event_context.active_inventory_item_count,
        30,
      );
      assert.equal(
        runInsert.parameters_json.event_context.active_standard_pack_count,
        5,
      );

      const resultModels = calls.resultInsertPayloads.map(
        (payload) => payload.selected_model_name,
      );
      assert.deepEqual(resultModels, [
        "EXPONENTIAL_SMOOTHING",
        "MOVING_AVERAGE",
        "TREND_PROJECTION",
      ]);
      assert.deepEqual(
        persistedForecast.results.map((result) => result.selected_model_name),
        resultModels,
      );

      const riceInsert = calls.resultInsertPayloads.find(
        (payload) => payload.inventory_item_id === "item-rice",
      );
      assert.equal(riceInsert.predicted_quantity_needed, 80);
      assert.equal(riceInsert.selected_model_name, "EXPONENTIAL_SMOOTHING");
      assert.equal(riceInsert.model_evaluation.recommended_model, "EXPONENTIAL_SMOOTHING");
      assert.equal(riceInsert.model_evaluation.selected_model, "EXPONENTIAL_SMOOTHING");
      assert.equal(riceInsert.model_evaluation.raw_statistical_forecast.forecasted_usage, 50);
      assert.equal(riceInsert.model_evaluation.version, 1);
      assert.equal(riceInsert.model_evaluation.evaluation_method, "ROLLING_ORIGIN_ONE_STEP");
      assert.equal(riceInsert.model_evaluation.eligible_start_date, "2026-08-31");
      assert.equal(riceInsert.model_evaluation.eligible_end_date, "2026-09-29");
      assert.deepEqual(
        riceInsert.model_evaluation.candidates.map((candidate) => candidate.model_name),
        ["MOVING_AVERAGE", "EXPONENTIAL_SMOOTHING", "TREND_PROJECTION"],
      );
      assert.equal(riceInsert.model_evaluation.candidates.length, 3);
      assert.equal(riceInsert.model_evaluation.candidates[1].mae, 0.5);
      assert.equal(riceInsert.model_evaluation.candidates[1].rmse, 1);
      assert.equal(riceInsert.model_evaluation.candidates[1].backtest_points, 23);
      assert.equal(riceInsert.model_evaluation.candidates[1].forecasted_usage, 50);

      const serializedEvaluation = JSON.stringify(riceInsert.model_evaluation);
      assert.ok(serializedEvaluation.length < 2500);
      assert.doesNotMatch(
        serializedEvaluation,
        /folds|training_prefixes|targets|per_fold_predictions|usage_series|household_id|member_name|address|phone/i,
      );
      assert.equal(persistedForecast.results[0].model_evaluation.version, 1);
    },
  );
});

test("AUTO_BACKTEST persistence keeps the Moving Average operational fallback distinct from recommendation", async () => {
  await withAutoForecastFixture(
    {
      persist: true,
      eventStartDate: "2026-09-17",
      forecastItems: createAutoForecastItems().slice(0, 1),
      usageRows: [],
      demandRows: [
        { inventory_item_id: "item-rice", projected_household_demand: "80" },
      ],
    },
    async ({ runAndPersistAutoInventoryForecast }, calls) => {
      const persistedForecast = await runAndPersistAutoInventoryForecast({
        disaster_event_id: "event-1",
        run_by: "user-1",
        referenceInstant: AUTO_REFERENCE_INSTANT,
      });
      const result = persistedForecast.results[0];
      const modelEvaluation = calls.resultInsertPayloads[0].model_evaluation;

      assert.equal(calls.analyticsCallCount, 1);
      assert.equal(calls.forecastRunInserts, 1);
      assert.equal(calls.forecastResultInserts, 1);
      assert.equal(result.selected_model_name, "MOVING_AVERAGE");
      assert.equal(modelEvaluation.recommended_model, null);
      assert.equal(modelEvaluation.selected_model, "MOVING_AVERAGE");
      assert.equal(modelEvaluation.recommendation_status, "NOT_EVALUATED");
      assert.equal(modelEvaluation.recommendation_reason, "INSUFFICIENT_HISTORY");
      assert.equal(modelEvaluation.selection_reason, "OPERATIONAL_FALLBACK");
      assert.equal(modelEvaluation.evaluation_status, "INSUFFICIENT_HISTORY");
      assert.equal(modelEvaluation.available_observations, 13);
      assert.equal(modelEvaluation.backtest_points, 6);
    },
  );
});

test("AUTO_BACKTEST persistence rolls back the run and earlier item inserts on failure", async () => {
  await withAutoForecastFixture(
    { persist: true, failResultInsertAt: 2 },
    async ({ runAndPersistAutoInventoryForecast }, calls) => {
      await assert.rejects(
        runAndPersistAutoInventoryForecast({
          disaster_event_id: "event-1",
          run_by: "user-1",
          referenceInstant: AUTO_REFERENCE_INSTANT,
        }),
        /simulated result persistence failure/,
      );

      assert.equal(calls.analyticsCallCount, 1);
      assert.equal(calls.historyQueries.length, 1);
      assert.equal(calls.forecastRunInserts, 1);
      assert.equal(calls.forecastResultInserts, 2);
      assert.deepEqual(calls.transactionCommands, ["BEGIN", "ROLLBACK"]);
      assert.equal(calls.releaseCount, 1);
    },
  );
});

test("AUTO_BACKTEST invalid non-finite evidence is rejected before opening a transaction", async () => {
  await withAutoForecastFixture(
    {
      persist: true,
      responseFactory: (payload) => {
        const response = buildAutoAnalyticsResponse(payload);
        response.results[0].candidate_evaluations[0].mae = Number.NaN;
        return response;
      },
    },
    async ({ runAndPersistAutoInventoryForecast }, calls) => {
      await assert.rejects(
        runAndPersistAutoInventoryForecast({
          disaster_event_id: "event-1",
          run_by: "user-1",
          referenceInstant: AUTO_REFERENCE_INSTANT,
        }),
        (error) => error.code === "INVALID_FORECAST_RESPONSE",
      );
      assert.equal(calls.analyticsCallCount, 1);
      assert.equal(calls.connectCount, 0);
      assert.equal(calls.forecastRunInserts, 0);
      assert.equal(calls.forecastResultInserts, 0);
    },
  );
});

test("AUTO stored reads preserve item evidence, suppress run-wide models, and tolerate malformed rows", async () => {
  const modelEvaluation = {
    version: 1,
    evaluation_method: "ROLLING_ORIGIN_ONE_STEP",
    recommended_model: "EXPONENTIAL_SMOOTHING",
    selected_model: "EXPONENTIAL_SMOOTHING",
    candidates: [
      { model_name: "MOVING_AVERAGE", status: "EVALUATED", mae: 1, rmse: 2 },
      { model_name: "EXPONENTIAL_SMOOTHING", status: "EVALUATED", mae: 0.5, rmse: 1 },
      { model_name: "TREND_PROJECTION", status: "EVALUATED", mae: 3, rmse: 4 },
    ],
  };
  const autoRun = {
    id: "forecast-run-auto",
    disaster_event_id: "event-1",
    event_code: "DE-001",
    disaster_event_title: "Flood Response",
    run_type: "INVENTORY_DEMAND",
    run_by: "user-1",
    run_at: "2026-09-30T00:00:00.000Z",
    selection_mode: "AUTO_BACKTEST",
    model_name: "TREND_PROJECTION",
    parameters_json: {},
  };
  let resultRows = [
    {
      inventory_item_id: "item-1",
      item_name: "Rice",
      item_code: "RICE",
      category: "Food",
      unit_of_measure: "packs",
      predicted_quantity_needed: 80,
      predicted_depletion_date: "2026-10-04",
      recommended_reorder_quantity: 57,
      confidence_notes: JSON.stringify({ risk_level: "HIGH" }),
      selected_model_name: "EXPONENTIAL_SMOOTHING",
      model_evaluation: JSON.stringify(modelEvaluation),
    },
  ];

  await withStubbedForecastService(
    {
      [dbPath]: {},
      [systemLogPath]: { logErrorSafely: async () => {} },
      [repositoryPath]: {
        getLatestForecastRun: async () => autoRun,
        getForecastRunHistory: async () => [
          { ...autoRun, model_name: "MOVING_AVERAGE" },
        ],
        getForecastRunById: async () => autoRun,
        getForecastResultsByRunId: async () => resultRows,
      },
    },
    async ({
      getLatestInventoryForecastOverall,
      getInventoryForecastHistory,
      getInventoryForecastRunDetails,
    }) => {
      const latest = await getLatestInventoryForecastOverall();
      assert.equal(latest.forecast_run.selection_mode, "AUTO_BACKTEST");
      assert.equal(latest.forecast_run.model_name, null);
      assert.equal(latest.results[0].selected_model_name, "EXPONENTIAL_SMOOTHING");
      assert.equal(latest.results[0].selected_model, "EXPONENTIAL_SMOOTHING");
      assert.deepEqual(latest.results[0].model_evaluation, modelEvaluation);
      assert.equal(latest.results[0].forecasted_usage, 80);

      const history = await getInventoryForecastHistory();
      assert.equal(history[0].selection_mode, "AUTO_BACKTEST");
      assert.equal(history[0].model_name, null);

      const detail = await getInventoryForecastRunDetails("forecast-run-auto");
      assert.equal(detail.forecast_run.selection_mode, "AUTO_BACKTEST");
      assert.equal(detail.forecast_run.model_name, null);
      assert.equal(detail.results[0].selected_model_name, "EXPONENTIAL_SMOOTHING");
      assert.deepEqual(detail.results[0].model_evaluation, modelEvaluation);

      resultRows = [{ ...resultRows[0], selected_model_name: null }];
      const malformed = await getLatestInventoryForecastOverall();
      assert.equal(malformed.forecast_run.model_name, null);
      assert.equal(malformed.results[0].selected_model_name, null);
      assert.equal(malformed.results[0].selected_model, null);
    },
  );
});
