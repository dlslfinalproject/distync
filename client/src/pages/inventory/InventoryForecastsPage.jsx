import React, { useState } from "react";
import PageHeader from "../../components/layout/PageHeader";
import { pageSpacingStyles } from "../../components/layout/BarangayLayout";
import ForecastingPanel from "../../components/inventory-items/ForecastingPanel";
import InventoryForecastExportModal from "../../components/inventory-items/InventoryForecastExportModal";
import { useInventoryForecast } from "../../features/inventory-items/useInventoryForecast";
import { exportInventoryForecast } from "../../features/inventory-items/inventoryItemService";
import { downloadExportFile } from "../../utils/exportHelpers";
import { useRememberedInitialLoading } from "../../utils/rememberedPageLoading";
import {
  forecastModelOptions,
  getForecastModelLabel,
} from "../../features/inventory-items/inventoryItemExportOptions";

const InventoryForecastsPage = () => {
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportErrorMessage, setExportErrorMessage] = useState("");
  const {
    forecastEvents,
    selectedForecastEventId,
    selectedForecastModel,
    forecastContext,
    forecastRunData,
    forecastHistory,
    forecastHistoryDetails,
    isInitialForecastEventsLoading,
    isInitialForecastContextLoading: baseIsForecastContextLoading,
    isInitialForecastLoading: baseIsForecastLoading,
    isInitialForecastHistoryLoading: baseIsForecastHistoryLoading,
    isForecastHistoryDetailLoading,
    isRunningForecast,
    forecastErrorMessage,
    forecastSuccessMessage,
    handleForecastEventChange,
    handleForecastModelChange,
    handleRunForecast,
    handleSelectForecastHistoryRun,
  } = useInventoryForecast();

  const shouldShowInitialLoading = useRememberedInitialLoading({
    pageKey: "mayor:inventory-forecasts",
    isLoading:
      baseIsForecastContextLoading ||
      baseIsForecastLoading ||
      baseIsForecastHistoryLoading,
    errorMessage: forecastErrorMessage,
    hasUsableData:
      (!baseIsForecastContextLoading || Boolean(forecastContext)) &&
      (!baseIsForecastLoading || Boolean(forecastRunData)) &&
      (!baseIsForecastHistoryLoading || forecastHistory.length > 0),
  });
  const isForecastContextLoading =
    baseIsForecastContextLoading && shouldShowInitialLoading;
  const isForecastLoading = baseIsForecastLoading && shouldShowInitialLoading;
  const isForecastHistoryLoading =
    baseIsForecastHistoryLoading && shouldShowInitialLoading;

  const handleOpenExportModal = () => {
    setExportErrorMessage("");
    setIsExportModalOpen(true);
  };

  const handleCloseExportModal = () => {
    if (isExporting) {
      return;
    }

    setExportErrorMessage("");
    setIsExportModalOpen(false);
  };

  const handleExportForecast = async ({ disasterEventId }) => {
    if (!disasterEventId) {
      setExportErrorMessage("Disaster event is required.");
      return;
    }

    setIsExporting(true);
    setExportErrorMessage("");

    try {
      const file = await exportInventoryForecast({
        disaster_event_id: disasterEventId,
        model_name: selectedForecastModel,
      });
      downloadExportFile(file);

      setIsExportModalOpen(false);
    } catch (error) {
      setExportErrorMessage(
        error.message || "Failed to export inventory forecasting report.",
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div style={pageSpacingStyles.pageStack}>
      <PageHeader
        title="INVENTORY FORECASTING MANAGEMENT"
      />

      <ForecastingPanel
        forecastEvents={forecastEvents}
        selectedForecastEventId={selectedForecastEventId}
        selectedForecastModel={selectedForecastModel}
        forecastModelOptions={forecastModelOptions}
        forecastContext={forecastContext}
        forecastRunData={forecastRunData}
        forecastHistory={forecastHistory}
        forecastHistoryDetails={forecastHistoryDetails}
        isForecastEventsLoading={isInitialForecastEventsLoading}
        forecastSuccessMessage={forecastSuccessMessage}
        forecastErrorMessage={forecastErrorMessage}
        isForecastContextLoading={isForecastContextLoading}
        isForecastLoading={isForecastLoading}
        isRunningForecast={isRunningForecast}
        isForecastHistoryLoading={isForecastHistoryLoading}
        isForecastHistoryDetailLoading={isForecastHistoryDetailLoading}
        getForecastModelLabel={getForecastModelLabel}
        onOpenExportModal={handleOpenExportModal}
        onForecastEventChange={handleForecastEventChange}
        onForecastModelChange={handleForecastModelChange}
        onRunForecast={handleRunForecast}
        onSelectForecastHistoryRun={handleSelectForecastHistoryRun}
      />

      <InventoryForecastExportModal
        isOpen={isExportModalOpen}
        isSubmitting={isExporting}
        disasterEvents={forecastEvents}
        selectedDisasterEventId={selectedForecastEventId}
        errorMessage={exportErrorMessage}
        onClose={handleCloseExportModal}
        onSubmit={handleExportForecast}
      />
    </div>
  );
};

export default InventoryForecastsPage;
