export const forecastModelOptions = [
  {
    value: "MOVING_AVERAGE",
    label: "Moving Average",
    description:
      "Best when supply use is steady. It plans from the event's usual recent usage.",
  },
  {
    value: "EXPONENTIAL_SMOOTHING",
    label: "Exponential Smoothing",
    description:
      "Best when supply use is changing quickly. It reacts more to the latest activity.",
  },
  {
    value: "TREND_PROJECTION",
    label: "Trend Projection",
    description:
      "Best when supply use is steadily rising or falling. It plans ahead using that direction.",
  },
];

export const getForecastModelLabel = (modelName) => {
  return (
    forecastModelOptions.find((option) => option.value === modelName)?.label ||
    "Model unavailable"
  );
};

export const getForecastModelDescription = (modelName) => {
  return (
    forecastModelOptions.find((option) => option.value === modelName)
      ?.description ||
    "Forecast model description unavailable."
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
