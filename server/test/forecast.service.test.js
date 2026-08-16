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
