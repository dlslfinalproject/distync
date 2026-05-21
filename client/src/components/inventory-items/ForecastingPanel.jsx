import React from "react";
import { pageHeaderStyles } from "../layout/PageHeader";

const tableStyles = {
  tableWrap: {
    marginTop: 0,
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    background: "transparent",
  },
  th: {
    textAlign: "left",
    padding: "10px 8px",
    fontSize: "13px",
    color: "#17324d",
    fontWeight: 700,
    borderBottom: "none",
    whiteSpace: "nowrap",
  },
  tr: {
    borderBottom: "1px solid #e7edf5",
  },
  td: {
    padding: "10px 8px",
    fontSize: "13px",
    color: "#334155",
    verticalAlign: "middle",
  },
  emptyStateCell: {
    padding: "16px 8px",
    fontSize: "14px",
    color: "#334155",
  },
  label: {
    display: "block",
    marginBottom: "8px",
    color: "#4f677f",
    fontSize: "13px",
    fontWeight: 700,
  },
  select: {
    width: "100%",
    minHeight: "48px",
    padding: "12px 14px",
    borderRadius: "14px",
    border: "1px solid #d2deea",
    boxSizing: "border-box",
    fontSize: "14px",
    color: "#21405f",
    backgroundColor: "#ffffff",
    outline: "none",
  },
};

const getRiskLevelStyle = (riskLevel) => ({
  padding: "4px 10px",
  borderRadius: "8px",
  fontSize: "12px",
  fontWeight: 600,
  backgroundColor:
    riskLevel === "CRITICAL"
      ? "#fee2e2"
      : riskLevel === "HIGH"
        ? "#fef3c7"
        : riskLevel === "MEDIUM"
          ? "#ede9fe"
          : "#e0f2fe",
  color:
    riskLevel === "CRITICAL"
      ? "#b91c1c"
      : riskLevel === "HIGH"
        ? "#92400e"
        : riskLevel === "MEDIUM"
          ? "#6d28d9"
          : "#075985",
});

const ForecastingPanel = ({
  forecastEvents,
  selectedForecastEventId,
  selectedForecastModel,
  forecastModelOptions,
  forecastRunData,
  forecastSuccessMessage,
  forecastErrorMessage,
  isForecastLoading,
  isRunningForecast,
  getForecastModelLabel,
  onForecastEventChange,
  onForecastModelChange,
  onRunForecast,
}) => {
  return (
    <div style={{ display: "grid", gap: "18px" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
        }}
      >
        <div>
          <label style={tableStyles.label}>Disaster Event</label>
          <select
            value={selectedForecastEventId}
            onChange={(event) => onForecastEventChange(event.target.value)}
            style={tableStyles.select}
          >
            {forecastEvents.length === 0 ? (
              <option value="">No disaster events available</option>
            ) : (
              forecastEvents.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.event_code} - {event.title}
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <label style={tableStyles.label}>Forecast Model</label>
          <select
            value={selectedForecastModel}
            onChange={(event) => onForecastModelChange(event.target.value)}
            style={tableStyles.select}
          >
            {forecastModelOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p
            style={{
              margin: "8px 0 0",
              color: "#5d7188",
              fontSize: "13px",
              lineHeight: 1.5,
            }}
          >
            {
              forecastModelOptions.find(
                (option) => option.value === selectedForecastModel,
              )?.description
            }
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <button
            type="button"
            onClick={onRunForecast}
            disabled={isRunningForecast || !selectedForecastEventId}
            style={{
              ...pageHeaderStyles.primaryButton,
              opacity: isRunningForecast || !selectedForecastEventId ? 0.7 : 1,
              width: "100%",
            }}
          >
            {isRunningForecast ? "Running Forecast..." : "Run Forecast"}
          </button>
        </div>
      </div>

      <div
        style={{
          borderRadius: "16px",
          border: "1px solid #d6e2ef",
          backgroundColor: "#f8fbff",
          padding: "16px 18px",
        }}
      >
        <p
          style={{
            margin: 0,
            color: "#17324d",
            fontSize: "14px",
            fontWeight: 700,
          }}
        >
          Recommended Default Model: Moving Average
        </p>
        <p
          style={{
            margin: "8px 0 0",
            color: "#5d7188",
            fontSize: "13px",
            lineHeight: 1.6,
          }}
        >
          Moving Average is selected by default to give the Mayor&apos;s Office a
          stable baseline forecast using recent distribution demand.
        </p>
      </div>

      {forecastSuccessMessage ? (
        <div
          style={{
            padding: "14px 16px",
            borderRadius: "14px",
            backgroundColor: "#edf8f1",
            color: "#1f6b46",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          {forecastSuccessMessage}
        </div>
      ) : null}

      {forecastErrorMessage ? (
        <div
          style={{
            padding: "14px 16px",
            borderRadius: "14px",
            backgroundColor: "#fff3f1",
            color: "#a14538",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          {forecastErrorMessage}
        </div>
      ) : null}

      <div style={tableStyles.tableWrap}>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              {[
                "Item Name",
                "Current Stock",
                "Selected Model",
                "Average Daily Usage",
                "Forecasted Usage",
                "Projected Depletion Date",
                "Recommended Reorder Quantity",
                "Risk Level",
              ].map((header) => (
                <th key={header} style={tableStyles.th}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {isForecastLoading ? (
              <tr>
                <td colSpan="8" style={tableStyles.emptyStateCell}>
                  Loading latest forecast...
                </td>
              </tr>
            ) : !forecastRunData || forecastRunData.results.length === 0 ? (
              <tr>
                <td colSpan="8" style={tableStyles.emptyStateCell}>
                  No saved forecast results are available yet for the selected
                  disaster event.
                </td>
              </tr>
            ) : (
              forecastRunData.results.map((result) => (
                <tr key={result.inventory_item_id} style={tableStyles.tr}>
                  <td style={tableStyles.td}>{result.item_name}</td>
                  <td style={tableStyles.td}>{result.current_available_stock}</td>
                  <td style={tableStyles.td}>
                    {getForecastModelLabel(result.selected_model)}
                  </td>
                  <td style={tableStyles.td}>{result.average_daily_usage}</td>
                  <td style={tableStyles.td}>{result.forecasted_usage}</td>
                  <td style={tableStyles.td}>
                    {result.projected_depletion_date
                      ? new Date(
                          `${result.projected_depletion_date}T00:00:00`,
                        ).toLocaleDateString()
                      : "--"}
                  </td>
                  <td style={tableStyles.td}>
                    {result.recommended_reorder_quantity}
                  </td>
                  <td style={tableStyles.td}>
                    <span style={getRiskLevelStyle(result.risk_level)}>
                      {result.risk_level}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ForecastingPanel;
