import React from "react";
import PageHeader from "../../components/layout/PageHeader";
import { pageSpacingStyles } from "../../components/layout/BarangayLayout";
import ForecastingPanel from "../../components/inventory-items/ForecastingPanel";
import { useInventoryForecast } from "../../features/inventory-items/useInventoryForecast";
import {
  forecastModelOptions,
  getForecastModelLabel,
} from "../../features/inventory-items/inventoryItemExportOptions";

const InventoryForecastsPage = () => {
  const {
    forecastEvents,
    selectedForecastEventId,
    selectedForecastModel,
    forecastContext,
    forecastRunData,
    forecastHistory,
    forecastHistoryDetails,
    isForecastContextLoading,
    isForecastLoading,
    isForecastHistoryLoading,
    isForecastHistoryDetailLoading,
    isRunningForecast,
    forecastErrorMessage,
    forecastSuccessMessage,
    setSelectedForecastEventId,
    setSelectedForecastModel,
    handleRunForecast,
    handleSelectForecastHistoryRun,
  } = useInventoryForecast();

  return (
    <div style={pageSpacingStyles.pageStack}>
      <PageHeader
        title="INVENTORY FORECASTING"
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
        forecastSuccessMessage={forecastSuccessMessage}
        forecastErrorMessage={forecastErrorMessage}
        isForecastContextLoading={isForecastContextLoading}
        isForecastLoading={isForecastLoading}
        isRunningForecast={isRunningForecast}
        isForecastHistoryLoading={isForecastHistoryLoading}
        isForecastHistoryDetailLoading={isForecastHistoryDetailLoading}
        getForecastModelLabel={getForecastModelLabel}
        onForecastEventChange={setSelectedForecastEventId}
        onForecastModelChange={setSelectedForecastModel}
        onRunForecast={handleRunForecast}
        onSelectForecastHistoryRun={handleSelectForecastHistoryRun}
      />
    </div>
  );
};

export default InventoryForecastsPage;
