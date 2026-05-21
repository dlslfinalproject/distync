import {
  createEmptyTrackingStats,
  isItemExpiring,
} from "./inventoryItemStockStatus";

export const inventoryExportReportOptions = [
  { value: "INVENTORY_ITEMS", label: "Inventory Items" },
  { value: "LOW_STOCK", label: "Low Stock" },
  { value: "NEAR_EXPIRY", label: "Near Expiry" },
  { value: "EXPIRED", label: "Expired Items" },
  { value: "INCIDENT_LOSS", label: "Inventory Loss" },
];

export const inventoryExportFormatOptions = [
  { value: "csv", label: "CSV" },
  { value: "excel", label: "Excel" },
  { value: "pdf", label: "PDF" },
];

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

export const NO_EXPORT_DATA_MESSAGE = "No available data to export.";

export const getForecastModelLabel = (modelName) => {
  return (
    forecastModelOptions.find((option) => option.value === modelName)?.label ||
    "Moving Average"
  );
};

export const buildInventoryExportFilters = (selectedReportType) => {
  if (selectedReportType === "LOW_STOCK") {
    return { report_type: "LOW_STOCK" };
  }

  if (selectedReportType === "NEAR_EXPIRY") {
    return { report_type: "NEAR_EXPIRY", near_expiry_days: 14 };
  }

  if (selectedReportType === "EXPIRED") {
    return { report_type: "EXPIRED" };
  }

  if (selectedReportType === "INCIDENT_LOSS") {
    return { report_type: "INCIDENT_LOSS" };
  }

  return {};
};

export const hasInventoryExportRows = ({
  reportType,
  visibleInventoryItems,
  inventoryBatches,
  inventoryTrackingMap,
}) => {
  if (reportType === "INVENTORY_ITEMS") {
    return visibleInventoryItems.length > 0;
  }

  if (reportType === "LOW_STOCK") {
    return inventoryBatches.some((batch) => batch.status === "LOW_STOCK");
  }

  if (reportType === "NEAR_EXPIRY") {
    return inventoryBatches.some((batch) => isItemExpiring(batch));
  }

  if (reportType === "EXPIRED") {
    return inventoryBatches.some((batch) => batch.status === "EXPIRED");
  }

  if (reportType === "INCIDENT_LOSS") {
    return visibleInventoryItems.some((item) => {
      const trackingStats =
        inventoryTrackingMap.get(item.id) || createEmptyTrackingStats();

      return (
        trackingStats.damaged > 0 ||
        trackingStats.missing > 0 ||
        trackingStats.spoiled > 0 ||
        trackingStats.stolen > 0
      );
    });
  }

  return false;
};
