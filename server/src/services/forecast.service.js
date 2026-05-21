const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const pool = require("../config/db");
const forecastRepository = require("../repositories/forecast.repository");
const { logErrorSafely } = require("../utils/systemLog");

const FORECAST_MODELS = {
  MOVING_AVERAGE: "MOVING_AVERAGE",
  EXPONENTIAL_SMOOTHING: "EXPONENTIAL_SMOOTHING",
  TREND_PROJECTION: "TREND_PROJECTION",
};

const DEFAULT_FORECAST_MODEL = FORECAST_MODELS.MOVING_AVERAGE;
const FORECAST_HORIZON_DAYS = 14;
const LOOKBACK_DAYS = 30;
const MOVING_AVERAGE_WINDOW = 7;
const EXPONENTIAL_SMOOTHING_ALPHA = 0.4;
const ANALYTICS_SERVICE_URL =
  process.env.ANALYTICS_SERVICE_URL || "http://localhost:8000";
const ANALYTICS_TIMEOUT_MS = Number.parseInt(
  process.env.ANALYTICS_TIMEOUT_MS || "15000",
  10,
);

const normalizeAnalyticsServiceUrl = (value) => {
  return String(value || "").trim().replace(/\/+$/, "");
};

const buildUsageSeries = (usageRows, itemIds) => {
  const today = new Date();
  const dayKeys = [];

  for (let offset = LOOKBACK_DAYS - 1; offset >= 0; offset -= 1) {
    const bucketDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - offset,
    );
    dayKeys.push(bucketDate.toISOString().slice(0, 10));
  }

  const usageMap = new Map(
    itemIds.map((itemId) => [itemId, new Array(dayKeys.length).fill(0)]),
  );
  const dayIndexMap = new Map(dayKeys.map((dayKey, index) => [dayKey, index]));

  usageRows.forEach((row) => {
    const rowItemId = row.inventory_item_id;
    const usageDateKey = new Date(row.usage_date).toISOString().slice(0, 10);
    const targetSeries = usageMap.get(rowItemId);
    const targetIndex = dayIndexMap.get(usageDateKey);

    if (!targetSeries || targetIndex === undefined) {
      return;
    }

    targetSeries[targetIndex] = Number(row.total_quantity || 0);
  });

  return usageMap;
};

const mapStoredForecastRun = (forecastRun, resultRows) => {
  return {
    forecast_run: {
      id: forecastRun.id,
      disaster_event_id: forecastRun.disaster_event_id,
      disaster_event: {
        event_code: forecastRun.event_code,
        title: forecastRun.disaster_event_title,
      },
      run_type: forecastRun.run_type,
      run_by: forecastRun.run_by,
      run_at: forecastRun.run_at,
      model_name: forecastRun.model_name,
      parameters_json: forecastRun.parameters_json || {},
    },
    results: resultRows.map((row) => {
      let parsedNotes = {};

      try {
        parsedNotes = row.confidence_notes ? JSON.parse(row.confidence_notes) : {};
      } catch (_error) {
        parsedNotes = {};
      }

      return {
        inventory_item_id: row.inventory_item_id,
        item_name: row.item_name,
        item_code: row.item_code,
        category: row.category,
        unit_of_measure: row.unit_of_measure,
        current_available_stock: Number(parsedNotes.current_available_stock || 0),
        average_daily_usage: Number(parsedNotes.average_daily_usage || 0),
        forecasted_usage: Number(row.predicted_quantity_needed || 0),
        projected_depletion_date: row.predicted_depletion_date,
        recommended_reorder_quantity: Number(row.recommended_reorder_quantity || 0),
        risk_level: parsedNotes.risk_level || "LOW",
        selected_model: parsedNotes.model_name || forecastRun.model_name,
      };
    }),
  };
};

const ensureDisasterEvent = async (disasterEventId, dbClient = pool) => {
  const disasterEvent = await forecastRepository.getDisasterEventById(
    disasterEventId,
    dbClient,
  );

  if (!disasterEvent) {
    const error = new Error(
      "disaster_event_id does not refer to an existing disaster event",
    );
    error.statusCode = 400;
    throw error;
  }

  return disasterEvent;
};

const buildAnalyticsPayload = ({ forecastItems, usageSeriesMap, modelName }) => {
  return {
    model_name: modelName,
    forecast_horizon_days: FORECAST_HORIZON_DAYS,
    lookback_days: LOOKBACK_DAYS,
    moving_average_window: MOVING_AVERAGE_WINDOW,
    exponential_smoothing_alpha: EXPONENTIAL_SMOOTHING_ALPHA,
    items: forecastItems.map((item) => ({
      inventory_item_id: item.id,
      item_name: item.item_name,
      item_code: item.item_code,
      category: item.category,
      unit_of_measure: item.unit_of_measure,
      current_available_stock: Number(item.current_available_stock || 0),
      usage_series: usageSeriesMap.get(item.id) || new Array(LOOKBACK_DAYS).fill(0),
    })),
  };
};

const buildAnalyticsUnavailableError = (message) => {
  const error = new Error(message);
  error.statusCode = 503;
  return error;
};

const mapForecastRunSummary = (forecastRun) => ({
  id: forecastRun.id,
  disaster_event_id: forecastRun.disaster_event_id,
  disaster_event: {
    event_code: forecastRun.event_code,
    title: forecastRun.disaster_event_title,
  },
  run_type: forecastRun.run_type,
  run_by: forecastRun.run_by,
  generated_by:
    [forecastRun.run_by_first_name, forecastRun.run_by_last_name]
      .filter(Boolean)
      .join(" ")
      .trim() || forecastRun.run_by_email || forecastRun.run_by || "Unknown User",
  run_at: forecastRun.run_at,
  model_name: forecastRun.model_name,
  status: "COMPLETED",
  parameters_json: forecastRun.parameters_json || {},
});

const callAnalyticsInventoryForecast = async (payload, actor = null) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ANALYTICS_TIMEOUT_MS);
  const analyticsUrl = `${normalizeAnalyticsServiceUrl(
    ANALYTICS_SERVICE_URL,
  )}/forecasting/inventory-demand`;

  try {
    const response = await fetch(analyticsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const responseData = await response.json().catch(() => null);

    if (!response.ok) {
      const detail =
        typeof responseData?.detail === "string"
          ? responseData.detail
          : typeof responseData?.message === "string"
            ? responseData.message
            : "Analytics service failed to compute the inventory forecast.";

      console.error("Inventory forecasting analytics error:", detail);

      await logErrorSafely({
        actor,
        moduleName: "forecasting",
        errorCode: "ANALYTICS_FORECAST_REQUEST_FAILED",
        errorMessage: detail,
        severity: response.status >= 500 ? "ERROR" : "WARNING",
      });

      const error = new Error(detail);
      error.statusCode = response.status >= 500 ? 503 : response.status;
      throw error;
    }

    if (!responseData || !Array.isArray(responseData.results)) {
      console.error(
        "Inventory forecasting analytics returned an invalid response shape.",
        responseData,
      );
      const error = new Error(
        "Analytics service returned an invalid forecast response.",
      );
      error.statusCode = 502;

      await logErrorSafely({
        actor,
        moduleName: "forecasting",
        errorCode: "INVALID_FORECAST_RESPONSE",
        errorMessage: error.message,
        error,
      });

      throw error;
    }

    return responseData;
  } catch (error) {
    if (error.name === "AbortError") {
      console.error(
        `Inventory forecasting analytics timed out after ${ANALYTICS_TIMEOUT_MS}ms.`,
      );

      await logErrorSafely({
        actor,
        moduleName: "forecasting",
        errorCode: "ANALYTICS_FORECAST_TIMEOUT",
        errorMessage: "Analytics service timed out while computing the inventory forecast.",
        error,
      });

      throw buildAnalyticsUnavailableError(
        "Analytics service timed out while computing the inventory forecast.",
      );
    }

    if (error.statusCode) {
      throw error;
    }

    console.error("Inventory forecasting analytics request failed:", error.message);

    await logErrorSafely({
      actor,
      moduleName: "forecasting",
      errorCode: "ANALYTICS_SERVICE_UNAVAILABLE",
      errorMessage: error.message || "Analytics service is unavailable.",
      error,
    });

    throw buildAnalyticsUnavailableError(
      "Analytics service is unavailable. Please make sure the analytics server is running.",
    );
  } finally {
    clearTimeout(timeoutId);
  }
};

const getAnalyticsServiceHealth = async () => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ANALYTICS_TIMEOUT_MS);
  const analyticsUrl = `${normalizeAnalyticsServiceUrl(
    ANALYTICS_SERVICE_URL,
  )}/health`;

  try {
    const response = await fetch(analyticsUrl, {
      method: "GET",
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        status: "UNAVAILABLE",
        is_available: false,
        service_url: normalizeAnalyticsServiceUrl(ANALYTICS_SERVICE_URL),
      };
    }

    const responseData = await response.json().catch(() => null);

    return {
      status:
        String(responseData?.status || "").toLowerCase() === "online"
          ? "ONLINE"
          : "UNAVAILABLE",
      is_available: String(responseData?.status || "").toLowerCase() === "online",
      service_url: normalizeAnalyticsServiceUrl(ANALYTICS_SERVICE_URL),
    };
  } catch (error) {
    if (error.name === "AbortError") {
      return {
        status: "OFFLINE",
        is_available: false,
        service_url: normalizeAnalyticsServiceUrl(ANALYTICS_SERVICE_URL),
      };
    }

    return {
      status: "OFFLINE",
      is_available: false,
      service_url: normalizeAnalyticsServiceUrl(ANALYTICS_SERVICE_URL),
    };
  } finally {
    clearTimeout(timeoutId);
  }
};

const buildResultConfidenceNotes = ({
  analyticsResult,
  forecastHorizonDays,
  lookbackDays,
}) => {
  return JSON.stringify({
    risk_level: analyticsResult.risk_level || "LOW",
    current_available_stock: Number(analyticsResult.current_available_stock || 0),
    average_daily_usage: Number(analyticsResult.average_daily_usage || 0),
    forecasted_usage: Number(analyticsResult.forecasted_usage || 0),
    daily_forecast: Number(analyticsResult.daily_forecast || 0),
    forecast_horizon_days: forecastHorizonDays,
    lookback_days: lookbackDays,
    model_name: analyticsResult.selected_model || DEFAULT_FORECAST_MODEL,
  });
};

const buildResponseResults = (analyticsResults) => {
  return analyticsResults.map((result) => ({
    inventory_item_id: result.inventory_item_id,
    item_name: result.item_name,
    item_code: result.item_code,
    category: result.category,
    unit_of_measure: result.unit_of_measure,
    current_available_stock: Number(result.current_available_stock || 0),
    average_daily_usage: Number(result.average_daily_usage || 0),
    forecasted_usage: Number(result.forecasted_usage || 0),
    projected_depletion_date: result.projected_depletion_date,
    recommended_reorder_quantity: Number(result.recommended_reorder_quantity || 0),
    risk_level: result.risk_level || "LOW",
    selected_model: result.selected_model || DEFAULT_FORECAST_MODEL,
  }));
};

const runInventoryForecast = async ({ disaster_event_id, model_name, run_by }) => {
  const resolvedModelName = model_name || DEFAULT_FORECAST_MODEL;
  const disasterEvent = await ensureDisasterEvent(disaster_event_id);
  const forecastItems = await forecastRepository.getInventoryForecastItems();
  const usageRows = await forecastRepository.getInventoryUsageSeries(
    disaster_event_id,
    LOOKBACK_DAYS,
  );
  const usageSeriesMap = buildUsageSeries(
    usageRows,
    forecastItems.map((item) => item.id),
  );

  const analyticsPayload = buildAnalyticsPayload({
    forecastItems,
    usageSeriesMap,
    modelName: resolvedModelName,
  });
  const analyticsForecast = await callAnalyticsInventoryForecast(analyticsPayload, {
    userId: run_by,
    roleCode: "MAYOR",
  });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const createdForecastRun = await forecastRepository.insertForecastRun(
      {
        disaster_event_id,
        run_type: "INVENTORY_DEMAND",
        run_by,
        model_name: resolvedModelName,
        parameters_json: {
          model_name: resolvedModelName,
          recommended_default_model: DEFAULT_FORECAST_MODEL,
          forecast_horizon_days: analyticsForecast.forecast_horizon_days,
          lookback_days: analyticsForecast.lookback_days,
          moving_average_window: MOVING_AVERAGE_WINDOW,
          exponential_smoothing_alpha: EXPONENTIAL_SMOOTHING_ALPHA,
          analytics_service_url: normalizeAnalyticsServiceUrl(ANALYTICS_SERVICE_URL),
        },
      },
      client,
    );

    for (const analyticsResult of analyticsForecast.results) {
      await forecastRepository.insertForecastResult(
        {
          forecast_run_id: createdForecastRun.id,
          inventory_item_id: analyticsResult.inventory_item_id,
          predicted_quantity_needed: Number(analyticsResult.forecasted_usage || 0),
          predicted_depletion_date: analyticsResult.projected_depletion_date,
          recommended_reorder_quantity: Number(
            analyticsResult.recommended_reorder_quantity || 0,
          ),
          confidence_notes: buildResultConfidenceNotes({
            analyticsResult,
            forecastHorizonDays: analyticsForecast.forecast_horizon_days,
            lookbackDays: analyticsForecast.lookback_days,
          }),
        },
        client,
      );
    }

    await client.query("COMMIT");

    return {
      forecast_run: {
        id: createdForecastRun.id,
        disaster_event_id,
        disaster_event: {
          event_code: disasterEvent.event_code,
          title: disasterEvent.title,
        },
        run_type: createdForecastRun.run_type,
        run_by,
        run_at: createdForecastRun.run_at,
        model_name: resolvedModelName,
        parameters_json: createdForecastRun.parameters_json || {},
      },
      results: buildResponseResults(analyticsForecast.results),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const getLatestInventoryForecast = async (disasterEventId) => {
  await ensureDisasterEvent(disasterEventId);

  const latestRun = await forecastRepository.getLatestForecastRunByDisasterEvent(
    disasterEventId,
  );

  if (!latestRun) {
    return null;
  }

  const resultRows = await forecastRepository.getForecastResultsByRunId(latestRun.id);
  return mapStoredForecastRun(latestRun, resultRows);
};

const getInventoryForecastHistory = async ({
  disaster_event_id = null,
  limit = 10,
} = {}) => {
  const historyRows = await forecastRepository.getForecastRunHistory({
    disasterEventId: disaster_event_id,
    limit,
  });

  return historyRows.map(mapForecastRunSummary);
};

const getInventoryForecastRunDetails = async (forecastRunId) => {
  const forecastRun = await forecastRepository.getForecastRunById(forecastRunId);

  if (!forecastRun) {
    const error = new Error("Forecast run not found");
    error.statusCode = 404;
    throw error;
  }

  const resultRows = await forecastRepository.getForecastResultsByRunId(forecastRunId);
  const mappedResults = mapStoredForecastRun(forecastRun, resultRows);

  return {
    forecast_run: {
      ...mapForecastRunSummary(forecastRun),
      parameters_json: forecastRun.parameters_json || {},
    },
    results: mappedResults.results,
  };
};

module.exports = {
  FORECAST_MODELS,
  DEFAULT_FORECAST_MODEL,
  FORECAST_HORIZON_DAYS,
  LOOKBACK_DAYS,
  runInventoryForecast,
  getLatestInventoryForecast,
  getAnalyticsServiceHealth,
  getInventoryForecastHistory,
  getInventoryForecastRunDetails,
};
