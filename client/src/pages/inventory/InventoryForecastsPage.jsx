import React from "react";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
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
    <div
      style={{ flex: 1, minWidth: 0, maxWidth: "100%", overflowX: "hidden" }}
    >
      <PageHeader
        title="INVENTORY FORECASTS"
      />

      <section style={shellStyles.card}>
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
      </section>
    </div>
  );
};

export default InventoryForecastsPage;
