const path = require("path");
const crypto = require("crypto");
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
const FORECAST_ELIGIBLE_SOURCE_TYPES = Object.freeze(["LGU", "DONATED"]);
const FORECAST_NEAR_EXPIRY_EXCLUSION_DAYS = 30;
const ANALYTICS_SERVICE_URL =
  process.env.ANALYTICS_SERVICE_URL || "http://localhost:8000";
const ANALYTICS_TIMEOUT_MS = Number.parseInt(
  process.env.ANALYTICS_TIMEOUT_MS || "15000",
  10,
);

if (process.env.NODE_ENV === "production" && !process.env.ANALYTICS_SERVICE_URL) {
  throw new Error(
    "ANALYTICS_SERVICE_URL is required in production so forecasting does not target localhost.",
  );
}

const normalizeAnalyticsServiceUrl = (value) => {
  const normalizedValue = String(value || "").trim().replace(/\/+$/, "");

  if (!normalizedValue) {
    return normalizedValue;
  }

  try {
    const parsedUrl = new URL(normalizedValue);

    // Uvicorn is commonly started on 127.0.0.1 in local Windows setups.
    // Normalizing localhost here avoids loopback resolution mismatches.
    if (parsedUrl.hostname === "localhost") {
      parsedUrl.hostname = "127.0.0.1";
    }

    return parsedUrl.toString().replace(/\/+$/, "");
  } catch (_error) {
    return normalizedValue;
  }
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

const buildDemandMap = (demandRows) => {
  return new Map(
    (demandRows || []).map((row) => [
      row.inventory_item_id,
      {
        quantity_per_household: Number(row.quantity_per_household || 0),
        projected_household_demand: Number(row.projected_household_demand || 0),
      },
    ]),
  );
};

const formatUsageTrend = (trendRows) => {
  return (trendRows || []).map((row) => ({
    usage_date: row.usage_date,
    total_quantity: Number(row.total_quantity || 0),
  }));
};

const buildForecastReadinessWarnings = ({
  eventContext,
  demandRows = [],
  forecastItems = null,
}) => {
  const warnings = [];
  const activeInventoryItemCount = Array.isArray(forecastItems)
    ? forecastItems.length
    : Number(eventContext?.active_inventory_item_count || 0);
  const unclaimedEligibleHouseholdCount = Number(
    eventContext?.unclaimed_eligible_household_count || 0,
  );
  const activeStandardPackCount = Number(
    eventContext?.active_standard_pack_count || 0,
  );
  const demandRowCount = Array.isArray(demandRows) ? demandRows.length : 0;

  if (activeInventoryItemCount <= 0) {
    warnings.push({
      code: "NO_ACTIVE_INVENTORY_ITEMS",
      severity: "WARNING",
      message:
        "No active inventory items are available, so the forecast has no item targets.",
    });
  }

  if (unclaimedEligibleHouseholdCount <= 0) {
    warnings.push({
      code: "NO_UNCLAIMED_ELIGIBLE_FAMILIES",
      severity: "INFO",
      message:
        "There are no eligible evacuation-center families marked as not yet received.",
    });
  }

  if (activeStandardPackCount <= 0) {
    warnings.push({
      code: "NO_ACTIVE_STANDARD_RELIEF_PACKS",
      severity: "WARNING",
      message:
        "No active standard relief pack templates are available for planned relief demand.",
    });
  }

  if (unclaimedEligibleHouseholdCount > 0 && demandRowCount <= 0) {
    warnings.push({
      code: "NO_ASSIGNED_PACK_ITEM_DEMAND",
      severity: "WARNING",
      message:
        "Eligible not-yet-received families exist, but no active assigned relief pack items were found.",
    });
  }

  return warnings;
};

const getResolvedForecastedUsage = ({
  analyticsForecastedUsage,
  projectedHouseholdDemand,
}) => {
  return Math.max(
    Number(analyticsForecastedUsage || 0),
    Number(projectedHouseholdDemand || 0),
  );
};

const getResolvedRiskLevel = ({
  currentAvailableStock,
  forecastedUsage,
  projectedHouseholdDemand,
  daysUntilDepletion,
}) => {
  if (currentAvailableStock <= 0) {
    return "CRITICAL";
  }

  if (daysUntilDepletion !== null && daysUntilDepletion <= 7) {
    return "CRITICAL";
  }

  if (daysUntilDepletion !== null && daysUntilDepletion <= 14) {
    return "HIGH";
  }

  if (
    forecastedUsage > currentAvailableStock ||
    projectedHouseholdDemand > currentAvailableStock
  ) {
    return "HIGH";
  }

  return "LOW";
};

const getRiskPriority = (riskLevel) => {
  const priorities = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };

  return priorities[String(riskLevel || "").toUpperCase()] || 0;
};

const getRecommendedReorderQuantity = ({
  currentAvailableStock,
  forecastedUsage,
  reorderLevel,
  analyticsRecommendedReorderQuantity,
}) => {
  const reorderBuffer = Math.max(0, Number(reorderLevel || 0));
  const forecastWithBufferShortfall = Math.ceil(
    Math.max(
      0,
      Number(forecastedUsage || 0) + reorderBuffer - Number(currentAvailableStock || 0),
    ),
  );

  return Math.max(
    Number(analyticsRecommendedReorderQuantity || 0),
    forecastWithBufferShortfall,
  );
};

const enrichForecastResult = ({
  result,
  demandContext,
  stockContext,
  forecastHorizonDays,
  fallbackModelName,
}) => {
  const currentAvailableStock = Number(
    result.current_available_stock ?? stockContext?.current_available_stock ?? 0,
  );
  const currentLguAvailableStock = Number(
    stockContext?.current_lgu_available_stock ??
      result.current_lgu_available_stock ??
      0,
  );
  const currentDonatedAvailableStock = Number(
    stockContext?.current_donated_available_stock ??
      result.current_donated_available_stock ??
      0,
  );
  const reorderLevel = Number(result.reorder_level || 0);
  const averageDailyUsage = Number(result.average_daily_usage || 0);
  const analyticsForecastedUsage = Number(result.forecasted_usage || 0);
  const projectedHouseholdDemand = Number(
    demandContext?.projected_household_demand || 0,
  );
  const quantityPerHousehold = Number(demandContext?.quantity_per_household || 0);
  const resolvedForecastedUsage = getResolvedForecastedUsage({
    analyticsForecastedUsage,
    projectedHouseholdDemand,
  });
  const projectedRemainingStock = Math.max(
    0,
    currentAvailableStock - resolvedForecastedUsage,
  );
  const recommendedReorderQuantity = getRecommendedReorderQuantity({
    currentAvailableStock,
    forecastedUsage: resolvedForecastedUsage,
    reorderLevel,
    analyticsRecommendedReorderQuantity: result.recommended_reorder_quantity,
  });
  const dailyForecast = Number(
    result.daily_forecast ||
      (forecastHorizonDays > 0 ? resolvedForecastedUsage / forecastHorizonDays : 0),
  );
  const daysUntilDepletion =
    currentAvailableStock <= 0
      ? 0
      : dailyForecast > 0
        ? Math.ceil(currentAvailableStock / dailyForecast)
        : null;
  const projectedDepletionDate =
    result.projected_depletion_date ||
    (daysUntilDepletion !== null
      ? new Date(
          Date.now() + daysUntilDepletion * 24 * 60 * 60 * 1000,
        )
          .toISOString()
          .slice(0, 10)
      : null);

  return {
    ...result,
    current_available_stock: currentAvailableStock,
    current_lgu_available_stock: currentLguAvailableStock,
    current_donated_available_stock: currentDonatedAvailableStock,
    reorder_level: reorderLevel,
    average_daily_usage: averageDailyUsage,
    forecasted_usage: resolvedForecastedUsage,
    projected_depletion_date: projectedDepletionDate,
    recommended_reorder_quantity: recommendedReorderQuantity,
    projected_household_demand: projectedHouseholdDemand,
    quantity_per_household: quantityPerHousehold,
    projected_remaining_stock: projectedRemainingStock,
    days_until_depletion: daysUntilDepletion,
    shortage_within_seven_days:
      daysUntilDepletion !== null && daysUntilDepletion <= 7,
    risk_level: getResolvedRiskLevel({
      currentAvailableStock,
      forecastedUsage: resolvedForecastedUsage,
      projectedHouseholdDemand,
      daysUntilDepletion,
    }),
    selected_model: result.selected_model || fallbackModelName || DEFAULT_FORECAST_MODEL,
    daily_forecast: dailyForecast,
  };
};

const buildForecastDashboard = ({
  disasterEvent,
  forecastResults,
  eventContext,
  usageTrend,
  readinessWarnings = [],
}) => {
  const enrichedResults = [...(forecastResults || [])].sort(
    (left, right) => right.forecasted_usage - left.forecasted_usage,
  );
  const criticalItems = enrichedResults.filter(
    (result) => result.risk_level === "CRITICAL" || result.risk_level === "HIGH",
  );
  const totalForecastedDemand = enrichedResults.reduce(
    (sum, result) => sum + Number(result.forecasted_usage || 0),
    0,
  );
  const totalRecommendedReorder = enrichedResults.reduce(
    (sum, result) => sum + Number(result.recommended_reorder_quantity || 0),
    0,
  );
  const shortageItems = enrichedResults.filter(
    (result) => Number(result.recommended_reorder_quantity || 0) > 0,
  );
  const demandPreview = enrichedResults.slice(0, 6).map((result) => ({
    inventory_item_id: result.inventory_item_id,
    item_name: result.item_name,
    item_code: result.item_code,
    projected_household_demand: Number(result.projected_household_demand || 0),
    forecasted_usage: Number(result.forecasted_usage || 0),
    recommended_reorder_quantity: Number(result.recommended_reorder_quantity || 0),
    unit_of_measure: result.unit_of_measure,
  }));
  const projectedStockLevels = [...enrichedResults]
    .sort((left, right) => {
      const riskDifference =
        getRiskPriority(right.risk_level) - getRiskPriority(left.risk_level);

      if (riskDifference !== 0) {
        return riskDifference;
      }

      return (
        Number(left.projected_remaining_stock || 0) -
        Number(right.projected_remaining_stock || 0)
      );
    })
    .slice(0, 8)
    .map((result) => ({
      inventory_item_id: result.inventory_item_id,
      item_name: result.item_name,
      current_available_stock: Number(result.current_available_stock || 0),
      current_lgu_available_stock: Number(
        result.current_lgu_available_stock || 0,
      ),
      current_donated_available_stock: Number(
        result.current_donated_available_stock || 0,
      ),
      projected_remaining_stock: Number(result.projected_remaining_stock || 0),
      forecasted_usage: Number(result.forecasted_usage || 0),
      risk_level: result.risk_level,
      unit_of_measure: result.unit_of_measure,
    }));

  return {
    disaster_event: {
      id: disasterEvent?.id || null,
      event_code: disasterEvent?.event_code || "",
      title: disasterEvent?.title || "",
      status: disasterEvent?.status || "",
      start_date: disasterEvent?.start_date || null,
      end_date: disasterEvent?.end_date || null,
      ended_at: disasterEvent?.ended_at || null,
    },
    summary: {
      evacuee_count: Number(eventContext?.evacuee_count || 0),
      household_count: Number(eventContext?.household_count || 0),
      attendance_record_count: Number(eventContext?.attendance_record_count || 0),
      present_evacuee_count: Number(eventContext?.present_evacuee_count || 0),
      eligible_household_count: Number(
        eventContext?.eligible_household_count || 0,
      ),
      eligible_evacuee_count: Number(eventContext?.eligible_evacuee_count || 0),
      claimed_household_count: Number(eventContext?.claimed_household_count || 0),
      unclaimed_eligible_household_count: Number(
        eventContext?.unclaimed_eligible_household_count || 0,
      ),
      distribution_transaction_count: Number(
        eventContext?.distribution_transaction_count || 0,
      ),
      total_released_quantity: Number(eventContext?.total_released_quantity || 0),
      active_inventory_item_count: Number(
        eventContext?.active_inventory_item_count || 0,
      ),
      active_standard_pack_count: Number(
        eventContext?.active_standard_pack_count || 0,
      ),
      total_forecasted_demand: totalForecastedDemand,
      total_recommended_reorder: totalRecommendedReorder,
      critical_item_count: criticalItems.length,
      shortage_item_count: shortageItems.length,
      seven_day_shortage_count: enrichedResults.filter(
        (result) => result.shortage_within_seven_days,
      ).length,
    },
    charts: {
      inventory_usage_trend: formatUsageTrend(usageTrend),
      forecasted_demand: demandPreview,
      projected_stock_levels: projectedStockLevels,
    },
    recommendations: shortageItems.slice(0, 8).map((result) => ({
      inventory_item_id: result.inventory_item_id,
      item_name: result.item_name,
      recommended_reorder_quantity: Number(
        result.recommended_reorder_quantity || 0,
      ),
      risk_level: result.risk_level,
      projected_depletion_date: result.projected_depletion_date,
      shortage_within_seven_days: Boolean(result.shortage_within_seven_days),
      unit_of_measure: result.unit_of_measure,
    })),
    readiness_warnings: readinessWarnings,
  };
};

const createPublicKey = (prefix, value) =>
  `${prefix}-${crypto
    .createHash("sha256")
    .update(String(value || ""))
    .digest("hex")
    .slice(0, 16)}`;

const resolvePublicForecastPriority = (riskLevel) => {
  const normalizedRiskLevel = String(riskLevel || "").toUpperCase();

  if (normalizedRiskLevel === "CRITICAL" || normalizedRiskLevel === "HIGH") {
    return "HIGH";
  }

  if (normalizedRiskLevel === "MEDIUM") {
    return "MEDIUM";
  }

  return "LOW";
};

const buildPublicForecastSuggestionNote = (result) => {
  if (result.shortage_within_seven_days) {
    return "Recommended because stock may run short within the next seven days.";
  }

  if (Number(result.projected_remaining_stock || 0) <= 0) {
    return "Recommended because projected demand may exceed available stock.";
  }

  return null;
};

const resolvePublicSuggestedQuantity = (result) => {
  return Math.max(0, Number(result.recommended_reorder_quantity || 0));
};

const buildPublicForecastSuggestions = (storedForecast) => {
  const forecastedAt = storedForecast?.forecast_run?.run_at || null;
  const results = Array.isArray(storedForecast?.results)
    ? storedForecast.results
    : [];

  return [...results]
    .filter((result) => resolvePublicSuggestedQuantity(result) > 0)
    .sort((left, right) => {
      const quantityDifference =
        resolvePublicSuggestedQuantity(right) -
        resolvePublicSuggestedQuantity(left);

      if (quantityDifference !== 0) {
        return quantityDifference;
      }

      return String(left.item_name || "").localeCompare(
        String(right.item_name || ""),
      );
    })
    .map((result) => ({
      public_key: createPublicKey("forecast-item", result.inventory_item_id),
      item_name: result.item_name,
      category: result.category,
      unit_of_measure: result.unit_of_measure || "items",
      suggested_quantity: Math.ceil(resolvePublicSuggestedQuantity(result)),
      priority_level: resolvePublicForecastPriority(result.risk_level),
      note: buildPublicForecastSuggestionNote(result),
      forecasted_at: forecastedAt,
    }));
};

const mapStoredForecastRun = (forecastRun, resultRows) => {
  const mappedResults = resultRows.map((row) => {
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
      current_lgu_available_stock: Number(
        parsedNotes.current_lgu_available_stock || 0,
      ),
      current_donated_available_stock: Number(
        parsedNotes.current_donated_available_stock || 0,
      ),
      reorder_level: Number(parsedNotes.reorder_level || 0),
      average_daily_usage: Number(parsedNotes.average_daily_usage || 0),
      forecasted_usage: Number(row.predicted_quantity_needed || 0),
      projected_depletion_date: row.predicted_depletion_date,
      recommended_reorder_quantity: Number(row.recommended_reorder_quantity || 0),
      projected_household_demand: Number(
        parsedNotes.projected_household_demand || 0,
      ),
      quantity_per_household: Number(parsedNotes.quantity_per_household || 0),
      projected_remaining_stock: Number(
        parsedNotes.projected_remaining_stock || 0,
      ),
      days_until_depletion:
        parsedNotes.days_until_depletion === null ||
        parsedNotes.days_until_depletion === undefined
          ? null
          : Number(parsedNotes.days_until_depletion || 0),
      shortage_within_seven_days: Boolean(
        parsedNotes.shortage_within_seven_days || false,
      ),
      risk_level: parsedNotes.risk_level || "LOW",
      selected_model: parsedNotes.model_name || forecastRun.model_name,
      daily_forecast: Number(parsedNotes.daily_forecast || 0),
    };
  });

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
    dashboard: {
      disaster_event: {
        id: forecastRun.disaster_event_id,
        event_code: forecastRun.event_code,
        title: forecastRun.disaster_event_title,
      },
      summary: {
        evacuee_count: Number(
          forecastRun.parameters_json?.event_context?.evacuee_count || 0,
        ),
        household_count: Number(
          forecastRun.parameters_json?.event_context?.household_count || 0,
        ),
        attendance_record_count: Number(
          forecastRun.parameters_json?.event_context?.attendance_record_count || 0,
        ),
        present_evacuee_count: Number(
          forecastRun.parameters_json?.event_context?.present_evacuee_count || 0,
        ),
        eligible_household_count: Number(
          forecastRun.parameters_json?.event_context?.eligible_household_count || 0,
        ),
        eligible_evacuee_count: Number(
          forecastRun.parameters_json?.event_context?.eligible_evacuee_count || 0,
        ),
        claimed_household_count: Number(
          forecastRun.parameters_json?.event_context?.claimed_household_count || 0,
        ),
        unclaimed_eligible_household_count: Number(
          forecastRun.parameters_json?.event_context
            ?.unclaimed_eligible_household_count || 0,
        ),
        distribution_transaction_count: Number(
          forecastRun.parameters_json?.event_context?.distribution_transaction_count || 0,
        ),
        total_released_quantity: Number(
          forecastRun.parameters_json?.event_context?.total_released_quantity || 0,
        ),
        active_inventory_item_count: Number(
          forecastRun.parameters_json?.event_context?.active_inventory_item_count || 0,
        ),
        active_standard_pack_count: Number(
          forecastRun.parameters_json?.event_context?.active_standard_pack_count || 0,
        ),
        total_forecasted_demand: mappedResults.reduce(
          (sum, result) => sum + Number(result.forecasted_usage || 0),
          0,
        ),
        total_recommended_reorder: mappedResults.reduce(
          (sum, result) =>
            sum + Number(result.recommended_reorder_quantity || 0),
          0,
        ),
        critical_item_count: mappedResults.filter(
          (result) =>
            result.risk_level === "CRITICAL" || result.risk_level === "HIGH",
        ).length,
        shortage_item_count: mappedResults.filter(
          (result) => Number(result.recommended_reorder_quantity || 0) > 0,
        ).length,
        seven_day_shortage_count: mappedResults.filter(
          (result) => result.shortage_within_seven_days,
        ).length,
      },
      charts: {
        inventory_usage_trend:
          forecastRun.parameters_json?.inventory_usage_trend || [],
        forecasted_demand: [...mappedResults]
          .sort((left, right) => right.forecasted_usage - left.forecasted_usage)
          .slice(0, 6)
          .map((result) => ({
            inventory_item_id: result.inventory_item_id,
            item_name: result.item_name,
            item_code: result.item_code,
            projected_household_demand: Number(
              result.projected_household_demand || 0,
            ),
            forecasted_usage: Number(result.forecasted_usage || 0),
            recommended_reorder_quantity: Number(
              result.recommended_reorder_quantity || 0,
            ),
            unit_of_measure: result.unit_of_measure,
          })),
        projected_stock_levels: [...mappedResults]
          .sort((left, right) => right.forecasted_usage - left.forecasted_usage)
          .slice(0, 8)
          .map((result) => ({
            inventory_item_id: result.inventory_item_id,
            item_name: result.item_name,
            current_available_stock: Number(
              result.current_available_stock || 0,
            ),
            projected_remaining_stock: Number(
              result.projected_remaining_stock || 0,
            ),
            forecasted_usage: Number(result.forecasted_usage || 0),
          })),
      },
      recommendations: [...mappedResults]
        .filter((result) => Number(result.recommended_reorder_quantity || 0) > 0)
        .sort(
          (left, right) =>
            Number(right.recommended_reorder_quantity || 0) -
            Number(left.recommended_reorder_quantity || 0),
        )
        .slice(0, 8)
        .map((result) => ({
          inventory_item_id: result.inventory_item_id,
          item_name: result.item_name,
          recommended_reorder_quantity: Number(
            result.recommended_reorder_quantity || 0,
          ),
          risk_level: result.risk_level,
          projected_depletion_date: result.projected_depletion_date,
          shortage_within_seven_days: Boolean(
            result.shortage_within_seven_days,
          ),
          unit_of_measure: result.unit_of_measure,
        })),
      readiness_warnings: forecastRun.parameters_json?.readiness_warnings || [],
    },
    results: mappedResults,
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

const ensureForecastableDisasterEvent = async (disasterEventId, dbClient = pool) => {
  const disasterEvent = await ensureDisasterEvent(disasterEventId, dbClient);

  if (disasterEvent.status !== "ACTIVE") {
    const error = new Error(
      "Inventory forecasting can only be run for active disaster events.",
    );
    error.statusCode = 400;
    error.code = "DISASTER_EVENT_NOT_ACTIVE_FOR_FORECAST";
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
      reorder_level: Number(item.reorder_level || 0),
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
    current_lgu_available_stock: Number(
      analyticsResult.current_lgu_available_stock || 0,
    ),
    current_donated_available_stock: Number(
      analyticsResult.current_donated_available_stock || 0,
    ),
    reorder_level: Number(analyticsResult.reorder_level || 0),
    average_daily_usage: Number(analyticsResult.average_daily_usage || 0),
    forecasted_usage: Number(analyticsResult.forecasted_usage || 0),
    daily_forecast: Number(analyticsResult.daily_forecast || 0),
    forecast_horizon_days: forecastHorizonDays,
    lookback_days: lookbackDays,
    projected_household_demand: Number(
      analyticsResult.projected_household_demand || 0,
    ),
    quantity_per_household: Number(analyticsResult.quantity_per_household || 0),
    projected_remaining_stock: Number(
      analyticsResult.projected_remaining_stock || 0,
    ),
    days_until_depletion:
      analyticsResult.days_until_depletion === null ||
      analyticsResult.days_until_depletion === undefined
        ? null
        : Number(analyticsResult.days_until_depletion || 0),
    shortage_within_seven_days: Boolean(
      analyticsResult.shortage_within_seven_days || false,
    ),
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
    current_lgu_available_stock: Number(
      result.current_lgu_available_stock || 0,
    ),
    current_donated_available_stock: Number(
      result.current_donated_available_stock || 0,
    ),
    reorder_level: Number(result.reorder_level || 0),
    average_daily_usage: Number(result.average_daily_usage || 0),
    forecasted_usage: Number(result.forecasted_usage || 0),
    projected_depletion_date: result.projected_depletion_date,
    recommended_reorder_quantity: Number(result.recommended_reorder_quantity || 0),
    projected_household_demand: Number(result.projected_household_demand || 0),
    quantity_per_household: Number(result.quantity_per_household || 0),
    projected_remaining_stock: Number(result.projected_remaining_stock || 0),
    days_until_depletion:
      result.days_until_depletion === null || result.days_until_depletion === undefined
        ? null
        : Number(result.days_until_depletion || 0),
    shortage_within_seven_days: Boolean(result.shortage_within_seven_days || false),
    risk_level: result.risk_level || "LOW",
    selected_model: result.selected_model || DEFAULT_FORECAST_MODEL,
    daily_forecast: Number(result.daily_forecast || 0),
  }));
};

const runInventoryForecast = async ({ disaster_event_id, model_name, run_by }) => {
  const resolvedModelName = model_name || DEFAULT_FORECAST_MODEL;
  const disasterEvent = await ensureForecastableDisasterEvent(disaster_event_id);
  const forecastItems = await forecastRepository.getInventoryForecastItems(
    disaster_event_id,
  );
  const forecastItemStockById = new Map(
    forecastItems.map((item) => [item.id, item]),
  );
  const eventContext = await forecastRepository.getForecastEventContext(
    disaster_event_id,
  );
  const demandRows = await forecastRepository.getReliefPackDemandByEvent(
    disaster_event_id,
  );
  const usageRows = await forecastRepository.getInventoryUsageSeries(
    disaster_event_id,
    LOOKBACK_DAYS,
  );
  const usageTrendRows = await forecastRepository.getInventoryUsageTrend(
    disaster_event_id,
    LOOKBACK_DAYS,
  );
  const usageSeriesMap = buildUsageSeries(
    usageRows,
    forecastItems.map((item) => item.id),
  );
  const demandMap = buildDemandMap(demandRows);
  const readinessWarnings = buildForecastReadinessWarnings({
    eventContext,
    demandRows,
    forecastItems,
  });

  const analyticsPayload = buildAnalyticsPayload({
    forecastItems,
    usageSeriesMap,
    modelName: resolvedModelName,
  });
  const analyticsForecast = await callAnalyticsInventoryForecast(analyticsPayload, {
    userId: run_by,
    roleCode: "MAYOR",
  });
  const enrichedResults = analyticsForecast.results.map((result) =>
    enrichForecastResult({
      result,
      demandContext: demandMap.get(result.inventory_item_id),
      stockContext: forecastItemStockById.get(result.inventory_item_id),
      forecastHorizonDays: analyticsForecast.forecast_horizon_days,
      fallbackModelName: resolvedModelName,
    }),
  );
  const dashboard = buildForecastDashboard({
    disasterEvent: {
      ...disasterEvent,
      start_date: eventContext?.start_date || null,
      end_date: eventContext?.end_date || null,
      ended_at: eventContext?.ended_at || null,
    },
    forecastResults: enrichedResults,
    eventContext,
    usageTrend: usageTrendRows,
    readinessWarnings,
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
          inventory_stock_basis: {
            included_source_types: [...FORECAST_ELIGIBLE_SOURCE_TYPES],
            included_batch_statuses: ["AVAILABLE", "LOW_STOCK"],
            near_expiry_exclusion_days: FORECAST_NEAR_EXPIRY_EXCLUSION_DAYS,
            donated_stock_scope: "SELECTED_DISASTER_EVENT",
          },
          analytics_service_url: normalizeAnalyticsServiceUrl(ANALYTICS_SERVICE_URL),
          event_context: {
            household_count: Number(eventContext?.household_count || 0),
            evacuee_count: Number(eventContext?.evacuee_count || 0),
            attendance_record_count: Number(
              eventContext?.attendance_record_count || 0,
            ),
            present_evacuee_count: Number(
              eventContext?.present_evacuee_count || 0,
            ),
            eligible_household_count: Number(
              eventContext?.eligible_household_count || 0,
            ),
            eligible_evacuee_count: Number(
              eventContext?.eligible_evacuee_count || 0,
            ),
            claimed_household_count: Number(
              eventContext?.claimed_household_count || 0,
            ),
            unclaimed_eligible_household_count: Number(
              eventContext?.unclaimed_eligible_household_count || 0,
            ),
            distribution_transaction_count: Number(
              eventContext?.distribution_transaction_count || 0,
            ),
            total_released_quantity: Number(
              eventContext?.total_released_quantity || 0,
            ),
            active_inventory_item_count: Number(
              forecastItems.length || eventContext?.active_inventory_item_count || 0,
            ),
            active_standard_pack_count: Number(
              eventContext?.active_standard_pack_count || 0,
            ),
          },
          readiness_warnings: readinessWarnings,
          inventory_usage_trend: dashboard.charts.inventory_usage_trend,
        },
      },
      client,
    );

    for (const analyticsResult of enrichedResults) {
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
      dashboard,
      results: buildResponseResults(enrichedResults),
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

const getLatestInventoryForecastOverall = async () => {
  const latestRun = await forecastRepository.getLatestForecastRun();

  if (!latestRun) {
    return null;
  }

  const resultRows = await forecastRepository.getForecastResultsByRunId(latestRun.id);
  return mapStoredForecastRun(latestRun, resultRows);
};

const getInventoryForecastContext = async (disasterEventId) => {
  const disasterEvent = await ensureDisasterEvent(disasterEventId);
  const eventContext = await forecastRepository.getForecastEventContext(
    disasterEventId,
  );
  const demandRows = await forecastRepository.getReliefPackDemandByEvent(
    disasterEventId,
  );
  const usageTrendRows = await forecastRepository.getInventoryUsageTrend(
    disasterEventId,
    LOOKBACK_DAYS,
  );
  const readinessWarnings = buildForecastReadinessWarnings({
    eventContext,
    demandRows,
  });

  return {
    disaster_event: {
      id: disasterEvent.id,
      event_code: disasterEvent.event_code,
      title: disasterEvent.title,
      status: disasterEvent.status,
      start_date: eventContext?.start_date || null,
      end_date: eventContext?.end_date || null,
      ended_at: eventContext?.ended_at || null,
    },
    summary: {
      household_count: Number(eventContext?.household_count || 0),
      evacuee_count: Number(eventContext?.evacuee_count || 0),
      attendance_record_count: Number(eventContext?.attendance_record_count || 0),
      present_evacuee_count: Number(eventContext?.present_evacuee_count || 0),
      eligible_household_count: Number(
        eventContext?.eligible_household_count || 0,
      ),
      eligible_evacuee_count: Number(eventContext?.eligible_evacuee_count || 0),
      claimed_household_count: Number(eventContext?.claimed_household_count || 0),
      unclaimed_eligible_household_count: Number(
        eventContext?.unclaimed_eligible_household_count || 0,
      ),
      distribution_transaction_count: Number(
        eventContext?.distribution_transaction_count || 0,
      ),
      total_released_quantity: Number(eventContext?.total_released_quantity || 0),
      active_inventory_item_count: Number(
        eventContext?.active_inventory_item_count || 0,
      ),
      active_standard_pack_count: Number(
        eventContext?.active_standard_pack_count || 0,
      ),
    },
    demand_preview: (demandRows || []).slice(0, 8).map((row) => ({
      inventory_item_id: row.inventory_item_id,
      item_code: row.item_code,
      item_name: row.item_name,
      category: row.category,
      unit_of_measure: row.unit_of_measure,
      quantity_per_household: Number(row.quantity_per_household || 0),
      projected_household_demand: Number(row.projected_household_demand || 0),
    })),
    usage_trend: formatUsageTrend(usageTrendRows),
    readiness_warnings: readinessWarnings,
  };
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
    dashboard: mappedResults.dashboard,
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
  getLatestInventoryForecastOverall,
  getInventoryForecastContext,
  getAnalyticsServiceHealth,
  getInventoryForecastHistory,
  getInventoryForecastRunDetails,
  buildPublicForecastSuggestions,
};
