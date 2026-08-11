export const forecastModelOptions = [
  {
    value: "MOVING_AVERAGE",
    label: "Moving Average",
    description: "Recommended default model for regular stock planning.",
  },
  {
    value: "EXPONENTIAL_SMOOTHING",
    label: "Exponential Smoothing",
    description: "Gives more weight to recent distribution activity.",
  },
  {
    value: "TREND_PROJECTION",
    label: "Trend Projection",
    description: "Uses historical trend direction to project demand.",
  },
];

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
