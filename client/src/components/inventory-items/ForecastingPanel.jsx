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
  historyCard: {
    borderRadius: "16px",
    border: "1px solid #d6e2ef",
    backgroundColor: "#ffffff",
    padding: "16px 18px",
  },
  historyRowButton: {
    width: "100%",
    border: "1px solid #dbe6f0",
    borderRadius: "12px",
    backgroundColor: "#f8fbff",
    padding: "12px 14px",
    textAlign: "left",
    cursor: "pointer",
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
  forecastHistory,
  forecastHistoryDetails,
  forecastHealth,
  forecastSuccessMessage,
  forecastErrorMessage,
  isForecastLoading,
  isRunningForecast,
  isForecastHistoryLoading,
  isForecastHistoryDetailLoading,
  getForecastModelLabel,
  onForecastEventChange,
  onForecastModelChange,
  onRunForecast,
  onSelectForecastHistoryRun,
}) => {
  const healthStatusText =
    forecastHealth?.status === "ONLINE"
      ? "Online"
      : forecastHealth?.status === "OFFLINE"
        ? "Offline"
        : "Unavailable";

  const activeForecastResults =
    forecastHistoryDetails?.results?.length > 0
      ? forecastHistoryDetails
      : forecastRunData;

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
        <p
          style={{
            margin: "10px 0 0",
            color:
              forecastHealth?.status === "ONLINE"
                ? "#1f6b46"
                : forecastHealth?.status === "OFFLINE"
                  ? "#92400e"
                  : "#a14538",
            fontSize: "13px",
            fontWeight: 700,
          }}
        >
          Analytics Service: {healthStatusText}
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

      <div style={tableStyles.historyCard}>
        <h4 style={{ margin: "0 0 12px", color: "#17324d", fontSize: "16px" }}>
          Forecast History
        </h4>

        {forecastHealth?.status !== "ONLINE" ? (
          <p style={{ margin: 0, color: "#a14538", fontSize: "14px" }}>
            Analytics service unavailable
          </p>
        ) : isForecastHistoryLoading ? (
          <p style={{ margin: 0, color: "#5d7188", fontSize: "14px" }}>
            Loading forecast history...
          </p>
        ) : !forecastHistory.length ? (
          <p style={{ margin: 0, color: "#5d7188", fontSize: "14px" }}>
            No forecast history yet
          </p>
        ) : (
          <div style={{ display: "grid", gap: "10px" }}>
            {forecastHistory.map((run) => (
              <button
                key={run.id}
                type="button"
                onClick={() => onSelectForecastHistoryRun(run.id)}
                style={tableStyles.historyRowButton}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  <strong style={{ color: "#17324d" }}>
                    {run.disaster_event?.event_code} - {run.disaster_event?.title}
                  </strong>
                  <span style={{ color: "#5d7188", fontSize: "13px" }}>
                    {new Date(run.run_at).toLocaleString()}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: "6px",
                    display: "flex",
                    gap: "14px",
                    flexWrap: "wrap",
                    color: "#5d7188",
                    fontSize: "13px",
                  }}
                >
                  <span>Model: {getForecastModelLabel(run.model_name)}</span>
                  <span>Generated By: {run.generated_by}</span>
                  <span>Status: {run.status}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

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
            ) : isForecastHistoryDetailLoading ? (
              <tr>
                <td colSpan="8" style={tableStyles.emptyStateCell}>
                  Loading forecast run details...
                </td>
              </tr>
            ) : !activeForecastResults || activeForecastResults.results.length === 0 ? (
              <tr>
                <td colSpan="8" style={tableStyles.emptyStateCell}>
                  No saved forecast results are available yet for the selected
                  disaster event.
                </td>
              </tr>
            ) : (
              activeForecastResults.results.map((result) => (
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
