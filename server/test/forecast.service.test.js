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
