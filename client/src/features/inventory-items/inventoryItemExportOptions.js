export const forecastModelOptions = [
  {
    value: "MOVING_AVERAGE",
    label: "Moving Average",
    description:
      "Averages recent demand. Best for steady, predictable event usage.",
  },
  {
    value: "EXPONENTIAL_SMOOTHING",
    label: "Exponential Smoothing",
    description:
      "Weights recent demand more heavily. Best when the latest activity is changing quickly.",
  },
  {
    value: "TREND_PROJECTION",
    label: "Trend Projection",
    description:
      "Extends a clear upward or downward pattern. Best when enough event history shows a sustained trend.",
  },
];

const FORECAST_DAY_MS = 24 * 60 * 60 * 1000;

const buildModelRecommendation = ({ modelName, rationale, basis }) => {
  const option = forecastModelOptions.find(({ value }) => value === modelName);

  return {
    modelName,
    label: option?.label || "Moving Average",
    description: option?.description || "Averages recent demand.",
    rationale,
    basis,
  };
};

const getUsageValues = (forecastContext) => {
  if (!Array.isArray(forecastContext?.usage_trend)) {
    return [];
  }

  return forecastContext.usage_trend
    .map((row) => Number(row?.total_quantity || 0))
    .filter((value) => Number.isFinite(value) && value >= 0);
};

const getLinearTrendStats = (values) => {
  const sampleSize = values.length;

  if (sampleSize < 2) {
    return { slope: 0, rSquared: 0, mean: values[0] || 0 };
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / sampleSize;
  const xMean = (sampleSize - 1) / 2;
  const numerator = values.reduce(
    (sum, value, index) => sum + (index - xMean) * (value - mean),
    0,
  );
  const denominator = values.reduce(
    (sum, _value, index) => sum + (index - xMean) ** 2,
    0,
  );
  const slope = denominator ? numerator / denominator : 0;
  const intercept = mean - slope * xMean;
  const totalSumOfSquares = values.reduce(
    (sum, value) => sum + (value - mean) ** 2,
    0,
  );
  const residualSumOfSquares = values.reduce(
    (sum, value, index) =>
      sum + (value - (intercept + slope * index)) ** 2,
    0,
  );

  return {
    slope,
    mean,
    rSquared:
      totalSumOfSquares > 0
        ? Math.max(0, 1 - residualSumOfSquares / totalSumOfSquares)
        : 0,
  };
};

const getEventAgeInDays = (event) => {
  const eventStart = new Date(event?.start_date || 0).getTime();

  if (!Number.isFinite(eventStart) || eventStart <= 0) {
    return null;
  }

  return Math.max(0, Math.floor((Date.now() - eventStart) / FORECAST_DAY_MS));
};

export const getForecastModelRecommendation = ({
  event = null,
  forecastContext = null,
} = {}) => {
  const usageValues = getUsageValues(forecastContext);
  const activeUsageDays = usageValues.filter((value) => value > 0).length;
  const recentValues = usageValues.slice(-7);
  const previousValues = usageValues.slice(-14, -7);
  const recentAverage = recentValues.length
    ? recentValues.reduce((sum, value) => sum + value, 0) / recentValues.length
    : 0;
  const previousAverage = previousValues.length
    ? previousValues.reduce((sum, value) => sum + value, 0) /
      previousValues.length
    : 0;
  const eventAgeInDays = getEventAgeInDays(event);

  if (usageValues.length >= 14 && activeUsageDays >= 7) {
    const trendStats = getLinearTrendStats(usageValues);
    const relativeSlope =
      Math.abs(trendStats.slope) / Math.max(trendStats.mean, 1);

    if (trendStats.rSquared >= 0.8 && relativeSlope >= 0.04) {
      return buildModelRecommendation({
        modelName: "TREND_PROJECTION",
        basis: "clear sustained usage trend",
        rationale:
          "This event has enough usage history to show a clear sustained direction, so Trend Projection can account for that pattern.",
      });
    }
  }

  const hasRecentUsageShift =
    recentValues.length >= 3 &&
    ((previousAverage > 0 &&
      (recentAverage >= previousAverage * 1.25 ||
        recentAverage <= previousAverage * 0.75)) ||
      (previousAverage === 0 && recentAverage > 0));

  if (
    hasRecentUsageShift ||
    (eventAgeInDays !== null && eventAgeInDays <= 7 && activeUsageDays > 0)
  ) {
    return buildModelRecommendation({
      modelName: "EXPONENTIAL_SMOOTHING",
      basis: "recent event activity is changing",
      rationale:
        "Recent activity for this event is changing, so Exponential Smoothing gives more weight to the latest distribution pattern.",
    });
  }

  if (usageValues.length < 7 || activeUsageDays < 3) {
    return buildModelRecommendation({
      modelName: "MOVING_AVERAGE",
      basis: "limited event-specific history",
      rationale:
        "There is not enough event-specific history for a reliable trend, so Moving Average is the safest starting point.",
    });
  }

  return buildModelRecommendation({
    modelName: "MOVING_AVERAGE",
    basis: "steady event activity",
    rationale:
      "This event does not show a strong recent shift or sustained trend, so Moving Average provides a stable baseline.",
  });
};

export const getForecastModelLabel = (modelName) => {
  return (
    forecastModelOptions.find((option) => option.value === modelName)?.label ||
    "Moving Average"
  );
};

export const hasInventoryExportRows = ({
  category,
  status,
  visibleInventoryItems,
}) => {
  const normalizedCategory = String(category || "All").trim().toLowerCase();
  const normalizedStatus = String(status || "All").trim().toLowerCase();

  return visibleInventoryItems.some((item) => {
    const matchesCategory =
      normalizedCategory === "all" ||
      String(item.category || "").trim().toLowerCase() === normalizedCategory;
    const matchesStatus =
      normalizedStatus === "all" ||
      (Array.isArray(item.stock_statuses)
        ? item.stock_statuses.some(
            (entry) =>
              String(entry.key || entry.label || "").trim().toLowerCase() ===
              normalizedStatus,
          )
        : false);

    return matchesCategory && matchesStatus;
  });
};
