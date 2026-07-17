import React, { useMemo } from "react";
import { pageHeaderStyles } from "../layout/PageHeader";

const accentMap = {
  blue: "#2f6499",
  orange: "#cf7d2d",
  green: "#2f8a57",
  purple: "#7d59bf",
  red: "#c2413b",
};

const panelStyles = {
  page: {
    display: "grid",
    gap: "22px",
  },
  card: {
    borderRadius: "20px",
    border: "1px solid #d6e2ef",
    backgroundColor: "#ffffff",
    padding: "20px 22px",
  },
  softCard: {
    borderRadius: "20px",
    border: "1px solid #d6e2ef",
    backgroundColor: "#f8fbff",
    padding: "20px 22px",
  },
  controlGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "16px",
    alignItems: "end",
  },
  section: {
    display: "grid",
    gap: "14px",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: "14px",
    flexWrap: "wrap",
  },
  sectionTitle: {
    margin: 0,
    color: "#17324d",
    fontSize: "19px",
  },
  sectionText: {
    margin: "8px 0 0",
    color: "#5d7188",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  executiveGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "18px",
    alignItems: "stretch",
  },
  executiveCard: {
    borderRadius: "20px",
    border: "1px solid #d6e2ef",
    backgroundColor: "#ffffff",
    padding: "20px 22px",
    display: "grid",
    gap: "14px",
  },
  insightCard: {
    borderRadius: "18px",
    border: "1px solid #dbe6f0",
    backgroundColor: "#f8fbff",
    padding: "16px",
  },
  insightValue: {
    margin: "6px 0 0",
    color: "#17324d",
    fontSize: "30px",
    lineHeight: 1.05,
    fontWeight: 800,
  },
  interpretationBanner: {
    borderRadius: "18px",
    border: "1px solid #d6e2ef",
    backgroundColor: "#f8fbff",
    padding: "16px 18px",
    color: "#17324d",
    fontSize: "15px",
    fontWeight: 700,
    lineHeight: 1.45,
  },
  label: {
    display: "block",
    marginBottom: "8px",
    color: "#58708a",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
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
  sourceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(115px, 1fr))",
    gap: "12px",
  },
  sourcePill: {
    borderRadius: "16px",
    border: "1px solid #dbe6f0",
    backgroundColor: "#ffffff",
    padding: "12px 14px",
  },
  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: "14px",
  },
  statCard: {
    borderRadius: "18px",
    padding: "18px 18px 16px",
    backgroundColor: "#ffffff",
    border: "1px solid #d7e2ef",
    boxShadow: "0 8px 18px rgba(58, 97, 141, 0.08)",
  },
  statButton: {
    width: "100%",
    minHeight: "112px",
    textAlign: "left",
    cursor: "pointer",
    appearance: "none",
    fontFamily: "inherit",
  },
  statValue: {
    margin: "10px 0 0",
    fontSize: "34px",
    lineHeight: 1,
    fontWeight: 800,
    color: "#17324d",
  },
  priorityGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
    gap: "18px",
    alignItems: "start",
  },
  chartGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "18px",
  },
  chartShell: {
    borderRadius: "20px",
    border: "1px solid #d6e2ef",
    backgroundColor: "#ffffff",
    padding: "20px 22px",
    minHeight: "300px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    minWidth: "980px",
    borderCollapse: "collapse",
  },
  compactTable: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "10px 9px",
    fontSize: "11px",
    color: "#58708a",
    fontWeight: 800,
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    borderBottom: "1px solid #dfe9f2",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "9px",
    fontSize: "13px",
    color: "#334155",
    borderBottom: "1px solid #e7edf5",
    verticalAlign: "middle",
  },
  itemNameCell: {
    maxWidth: "220px",
    color: "#17324d",
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  emptyState: {
    margin: 0,
    color: "#5d7188",
    fontSize: "14px",
    lineHeight: 1.6,
  },
  historyButton: {
    width: "100%",
    border: "1px solid #dbe6f0",
    borderRadius: "14px",
    backgroundColor: "#f8fbff",
    padding: "12px 14px",
    textAlign: "left",
    cursor: "pointer",
  },
  detailsBox: {
    borderRadius: "20px",
    border: "1px solid #d6e2ef",
    backgroundColor: "#ffffff",
    padding: "18px 22px",
  },
  detailsSummary: {
    cursor: "pointer",
    color: "#17324d",
    fontSize: "18px",
    fontWeight: 800,
  },
};

const getRiskLevelStyle = (riskLevel) => ({
  padding: "5px 10px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: 700,
  backgroundColor:
    riskLevel === "CRITICAL"
      ? "#fee2e2"
      : riskLevel === "HIGH"
        ? "#fef3c7"
        : riskLevel === "MEDIUM"
          ? "#e0f2fe"
          : "#e7f7ee",
  color:
    riskLevel === "CRITICAL"
      ? "#b91c1c"
      : riskLevel === "HIGH"
        ? "#92400e"
        : riskLevel === "MEDIUM"
          ? "#075985"
          : "#1f6b46",
});

const formatNumber = (value) => {
  return new Intl.NumberFormat().format(Number(value || 0));
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

const getDepletionPriority = (daysUntilDepletion) => {
  if (daysUntilDepletion === null || daysUntilDepletion === undefined) {
    return Number.POSITIVE_INFINITY;
  }

  return Number(daysUntilDepletion);
};

const formatMetricValue = (value) => {
  if (typeof value === "string") {
    return value || "--";
  }

  return formatNumber(value);
};

const formatDate = (value) => {
  if (!value) {
    return "--";
  }

  const parsedDate = String(value).includes("T")
    ? new Date(value)
    : new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return "--";
  }

  return parsedDate.toLocaleDateString();
};

const formatShortDate = (value) => {
  if (!value) {
    return "--";
  }

  const parsedDate = String(value).includes("T")
    ? new Date(value)
    : new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return "--";
  }

  return parsedDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

const getDashboardFromSources = ({
  forecastContext,
  forecastRunData,
  forecastHistoryDetails,
}) => {
  return (
    forecastHistoryDetails?.dashboard ||
    forecastRunData?.dashboard || {
      disaster_event: forecastContext?.disaster_event || null,
      summary: forecastContext?.summary || {},
      charts: {
        inventory_usage_trend: forecastContext?.usage_trend || [],
        forecasted_demand: forecastContext?.demand_preview || [],
        projected_stock_levels: [],
      },
      recommendations: [],
    }
  );
};

const getResultRowsFromSources = ({ forecastRunData, forecastHistoryDetails }) => {
  if (forecastHistoryDetails?.results?.length) {
    return forecastHistoryDetails.results;
  }

  return forecastRunData?.results || [];
};

const getStockBalanceColor = (remainingStock, currentStock) => {
  if (remainingStock <= 0 || currentStock <= 0) {
    return accentMap.red;
  }

  const remainingRatio = remainingStock / currentStock;

  if (remainingRatio <= 0.2) {
    return accentMap.red;
  }

  if (remainingRatio <= 0.45) {
    return accentMap.orange;
  }

  return accentMap.green;
};

const ChartHeader = ({ title }) => (
  <h4 style={{ margin: 0, color: "#17324d", fontSize: "18px" }}>{title}</h4>
);

const LineChart = ({ rows = [] }) => {
  const chartRows = rows.slice(-14);

  if (!chartRows.length) {
    return <p style={panelStyles.emptyState}>No inventory usage trend is available yet.</p>;
  }

  const width = 720;
  const height = 200;
  const padding = 28;
  const maxValue = Math.max(...chartRows.map((row) => Number(row.total_quantity || 0)), 1);
  const totalUsed = chartRows.reduce(
    (total, row) => total + Number(row.total_quantity || 0),
    0,
  );
  const peakRow = chartRows.reduce((highest, row) => {
    return Number(row.total_quantity || 0) > Number(highest.total_quantity || 0)
      ? row
      : highest;
  }, chartRows[0]);
  const latestRow = chartRows[chartRows.length - 1];
  const points = chartRows.map((row, index) => {
    const x =
      padding +
      (index * (width - padding * 2)) / Math.max(chartRows.length - 1, 1);
    const y =
      height -
      padding -
      (Number(row.total_quantity || 0) / maxValue) * (height - padding * 2);

    return `${x},${y}`;
  });

  return (
    <div style={{ display: "grid", gap: "12px" }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "220px" }}>
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#cddcec" strokeWidth="1.5" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#cddcec" strokeWidth="1.5" />
        <polyline
          fill="none"
          stroke={accentMap.blue}
          strokeWidth="4"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points.join(" ")}
        />
        {chartRows.map((row, index) => {
          const [x, y] = points[index].split(",");

          return (
            <circle
              key={`${row.usage_date}-${index}`}
              cx={x}
              cy={y}
              r="4.5"
              fill={accentMap.blue}
            />
          );
        })}
      </svg>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "12px" }}>
        {[
          ["Total Used", formatNumber(totalUsed)],
          [
            "Peak Day",
            `${formatNumber(peakRow.total_quantity)} on ${formatShortDate(peakRow.usage_date)}`,
          ],
          ["Latest Day", formatNumber(latestRow.total_quantity)],
        ].map(([label, value]) => (
          <div key={label} style={panelStyles.sourcePill}>
            <p style={{ ...panelStyles.label, marginBottom: "6px" }}>{label}</p>
            <p style={{ margin: 0, color: "#17324d", fontSize: "15px", fontWeight: 800 }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
          paddingTop: "2px",
          borderTop: "1px solid #e7edf5",
          fontSize: "12px",
          color: "#60738a",
        }}
      >
        <span>Start: {formatShortDate(chartRows[0]?.usage_date)}</span>
        <span>End: {formatShortDate(chartRows[chartRows.length - 1]?.usage_date)}</span>
      </div>
    </div>
  );
};

const BarChart = ({ rows = [], valueKey, labelKey, color }) => {
  if (!rows.length) {
    return <p style={panelStyles.emptyState}>No forecast demand rows are available yet.</p>;
  }

  const chartRows = rows.slice(0, 6);
  const maxValue = Math.max(...chartRows.map((row) => Number(row[valueKey] || 0)), 1);

  return (
    <div style={{ display: "grid", gap: "14px" }}>
      {chartRows.map((row, index) => {
        const value = Number(row[valueKey] || 0);
        const widthPercent = `${Math.max((value / maxValue) * 100, value > 0 ? 8 : 0)}%`;

        return (
          <div key={row.inventory_item_id || row[labelKey]}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
                marginBottom: "6px",
                fontSize: "13px",
              }}
            >
              <strong style={{ color: "#17324d" }}>
                {index + 1}. {row[labelKey]}
              </strong>
              <span style={{ color: "#17324d", fontWeight: 800 }}>
                {formatNumber(value)} {row.unit_of_measure || ""}
              </span>
            </div>
            <div
              style={{
                width: "100%",
                height: "12px",
                borderRadius: "999px",
                backgroundColor: "#edf4fb",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: widthPercent,
                  height: "100%",
                  borderRadius: "999px",
                  background: `linear-gradient(90deg, ${color} 0%, ${color}cc 100%)`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const StockLevelChart = ({ rows = [] }) => {
  if (!rows.length) {
    return <p style={panelStyles.emptyState}>Projected stock levels will appear after a forecast run.</p>;
  }

  const chartRows = rows.slice(0, 6);

  return (
    <div style={{ display: "grid", gap: "14px" }}>
      {chartRows.map((row) => {
        const currentStock = Number(row.current_available_stock || 0);
        const remainingStock = Number(row.projected_remaining_stock || 0);
        const remainingPercent =
          currentStock > 0 ? Math.min((remainingStock / currentStock) * 100, 100) : 0;
        const barWidth = `${Math.max(remainingPercent, remainingStock > 0 ? 6 : 0)}%`;
        const balanceColor = getStockBalanceColor(remainingStock, currentStock);

        return (
          <div key={row.inventory_item_id || row.item_name}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
                marginBottom: "8px",
                fontSize: "13px",
              }}
            >
              <strong style={{ color: "#17324d" }}>{row.item_name}</strong>
              <span style={{ color: "#5d7188" }}>
                {formatNumber(currentStock)} now | {formatNumber(remainingStock)} after
              </span>
            </div>
            <div style={{ width: "100%", height: "12px", borderRadius: "999px", backgroundColor: "#edf4fb" }}>
              <div
                style={{
                  width: barWidth,
                  height: "100%",
                  borderRadius: "999px",
                  backgroundColor: balanceColor,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const ForecastingPanel = ({
  forecastEvents,
  selectedForecastEventId,
  selectedForecastModel,
  forecastModelOptions,
  forecastContext,
  forecastRunData,
  forecastHistory,
  forecastHistoryDetails,
  forecastSuccessMessage,
  forecastErrorMessage,
  isForecastContextLoading,
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
  const activeDashboard = useMemo(
    () =>
      getDashboardFromSources({
        forecastContext,
        forecastRunData,
        forecastHistoryDetails,
      }),
    [forecastContext, forecastRunData, forecastHistoryDetails],
  );

  const resultRows = useMemo(
    () =>
      getResultRowsFromSources({
        forecastRunData,
        forecastHistoryDetails,
      }),
    [forecastRunData, forecastHistoryDetails],
  );

  const eventSummary = activeDashboard?.summary || {};
  const eventInfo =
    activeDashboard?.disaster_event || forecastContext?.disaster_event || null;
  const recommendationRows = activeDashboard?.recommendations || [];
  const usageTrendRows = activeDashboard?.charts?.inventory_usage_trend || [];
  const demandRows = activeDashboard?.charts?.forecasted_demand || [];
  const stockRows = activeDashboard?.charts?.projected_stock_levels || [];
  const priorityResultRows = [...resultRows].sort((left, right) => {
    const riskDifference =
      getRiskPriority(right.risk_level) - getRiskPriority(left.risk_level);

    if (riskDifference !== 0) {
      return riskDifference;
    }

    const shortageDifference =
      Number(Boolean(right.shortage_within_seven_days)) -
      Number(Boolean(left.shortage_within_seven_days));

    if (shortageDifference !== 0) {
      return shortageDifference;
    }

    const depletionDifference =
      getDepletionPriority(left.days_until_depletion) -
      getDepletionPriority(right.days_until_depletion);

    if (depletionDifference !== 0) {
      return depletionDifference;
    }

    return (
      Number(right.recommended_reorder_quantity || 0) -
      Number(left.recommended_reorder_quantity || 0)
    );
  });
  const sortedRestockRows = [...resultRows].sort(
    (left, right) =>
      Number(right.recommended_reorder_quantity || 0) -
      Number(left.recommended_reorder_quantity || 0),
  );
  const stockActionRows = sortedRestockRows
    .filter(
      (row) =>
        Number(row.forecasted_usage || 0) > 0 ||
        Number(row.recommended_reorder_quantity || 0) > 0,
    )
    .slice(0, 6);
  const topRestockRow = sortedRestockRows.find(
    (row) => Number(row.recommended_reorder_quantity || 0) > 0,
  );
  const donorNeedRows = recommendationRows.slice(0, 6);
  const modelHasResults = resultRows.length > 0;
  const selectedModelLabel = getForecastModelLabel(selectedForecastModel);
  const totalForecastNeed = resultRows.reduce(
    (total, row) => total + Number(row.forecasted_usage || 0),
    0,
  );
  const totalAddStock = resultRows.reduce(
    (total, row) => total + Number(row.recommended_reorder_quantity || 0),
    0,
  );
  const criticalItemCount = resultRows.filter(
    (row) => row.risk_level === "CRITICAL",
  ).length;
  const interpretationText = !modelHasResults
    ? "Run a forecast to generate stock-up priorities and donor-facing needs."
    : eventSummary.seven_day_shortage_count > 0
      ? `${eventSummary.seven_day_shortage_count} item(s) may run short within 7 days. Prioritize restocking and donor requests for the listed items.`
      : totalAddStock > 0
        ? "Some items need replenishment, but no immediate 7-day shortage is flagged."
        : "Current stock can cover the forecasted need for this event.";

  const sourceCards = [
    {
      label: "Families",
      value: eventSummary.household_count || 0,
      accent: accentMap.blue,
    },
    {
      label: "Evacuees",
      value: eventSummary.evacuee_count || 0,
      accent: accentMap.orange,
    },
    {
      label: "Attendance Logs",
      value: eventSummary.attendance_record_count || 0,
      accent: accentMap.green,
    },
    {
      label: "Release Records",
      value: eventSummary.distribution_transaction_count || 0,
      accent: accentMap.purple,
    },
    {
      label: "Standard Packs",
      value: eventSummary.active_standard_pack_count || 0,
      accent: accentMap.blue,
    },
  ];

  const forecastCards = [
    {
      label: "Items Checked",
      value: modelHasResults ? resultRows.length : "--",
      accent: accentMap.blue,
      targetId: "forecast-detailed-results",
      opensDetails: true,
    },
    {
      label: "Items to Restock",
      value: modelHasResults ? eventSummary.shortage_item_count || 0 : "--",
      accent: accentMap.orange,
      targetId: "forecast-stock-actions",
    },
    {
      label: "7-Day Risk Items",
      value: modelHasResults ? eventSummary.seven_day_shortage_count || 0 : "--",
      accent: accentMap.red,
      targetId: "forecast-detailed-results",
      opensDetails: true,
    },
    {
      label: "Critical Items",
      value: modelHasResults ? criticalItemCount : "--",
      accent: accentMap.red,
      targetId: "forecast-detailed-results",
      opensDetails: true,
    },
    {
      label: "Top Priority",
      value: topRestockRow?.item_name || "--",
      accent: accentMap.orange,
      targetId: "forecast-stock-actions",
    },
    {
      label: "Total Add Stock",
      value: modelHasResults ? totalAddStock : "--",
      accent: accentMap.green,
      targetId: "forecast-stock-actions",
    },
  ];

  const handleForecastCardClick = (card) => {
    if (!card.targetId) {
      return;
    }

    const target = document.getElementById(card.targetId);

    if (!target) {
      return;
    }

    if (card.opensDetails && target.tagName === "DETAILS") {
      target.open = true;
    }

    target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div style={panelStyles.page}>
      <div style={panelStyles.card}>
        <div style={panelStyles.controlGrid}>
          <div>
            <label style={panelStyles.label}>Disaster Event</label>
            <select
              value={selectedForecastEventId}
              onChange={(event) => onForecastEventChange(event.target.value)}
              style={panelStyles.select}
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
            <label style={panelStyles.label}>Forecast Model</label>
            <select
              value={selectedForecastModel}
              onChange={(event) => onForecastModelChange(event.target.value)}
              style={panelStyles.select}
            >
              {forecastModelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={onRunForecast}
            disabled={isRunningForecast || !selectedForecastEventId}
            style={{
              ...pageHeaderStyles.primaryButton,
              width: "100%",
              minHeight: "48px",
              opacity:
                isRunningForecast || !selectedForecastEventId ? 0.7 : 1,
            }}
          >
            {isRunningForecast ? "Running Forecast..." : "Run Forecast"}
          </button>
        </div>
      </div>

      {forecastSuccessMessage ? (
        <div
          style={{
            padding: "14px 16px",
            borderRadius: "14px",
            backgroundColor: "#edf8f1",
            color: "#1f6b46",
            fontSize: "14px",
            fontWeight: 700,
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
            fontWeight: 700,
          }}
        >
          {forecastErrorMessage}
        </div>
      ) : null}

      <div style={panelStyles.executiveGrid}>
        <div style={panelStyles.executiveCard}>
          <div>
            <span style={panelStyles.label}>Forecast Brief</span>
            <h3 style={{ margin: 0, color: "#17324d", fontSize: "22px", lineHeight: 1.25 }}>
              {eventInfo?.event_code ? `${eventInfo.event_code} - ` : ""}
              {eventInfo?.title || "No selected disaster event"}
            </h3>
          </div>

          <div style={panelStyles.interpretationBanner}>{interpretationText}</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div style={panelStyles.insightCard}>
              <p style={panelStyles.label}>Model</p>
              <p style={{ margin: "6px 0 0", color: "#17324d", fontSize: "16px", fontWeight: 800 }}>
                {selectedModelLabel}
              </p>
            </div>
            <div style={panelStyles.insightCard}>
              <p style={panelStyles.label}>Total Need</p>
              <p style={panelStyles.insightValue}>
                {modelHasResults ? formatNumber(totalForecastNeed) : "--"}
              </p>
            </div>
          </div>
        </div>

        <div style={panelStyles.executiveCard}>
          <div style={panelStyles.statGrid}>
            {forecastCards.map((card) => (
              <button
                key={card.label}
                type="button"
                onClick={() => handleForecastCardClick(card)}
                aria-label={`View details for ${card.label}`}
                style={{
                  ...panelStyles.statCard,
                  ...panelStyles.statButton,
                  boxShadow: "none",
                  borderTop: `4px solid ${card.accent}`,
                }}
              >
                <p style={panelStyles.label}>{card.label}</p>
                <p
                  style={{
                    ...panelStyles.statValue,
                    fontSize: typeof card.value === "string" ? "22px" : "32px",
                    lineHeight: typeof card.value === "string" ? 1.2 : 1,
                    wordBreak: "break-word",
                  }}
                >
                  {formatMetricValue(card.value)}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={panelStyles.softCard}>
        <div style={panelStyles.sectionHeader}>
          <h4 style={panelStyles.sectionTitle}>Data Used</h4>
        </div>

        <div style={{ ...panelStyles.sourceGrid, marginTop: "14px" }}>
          {sourceCards.map((card) => (
            <div
              key={card.label}
              style={{
                ...panelStyles.sourcePill,
                borderTop: `4px solid ${card.accent}`,
              }}
            >
              <p style={{ ...panelStyles.label, marginBottom: "6px" }}>{card.label}</p>
              <p style={{ margin: 0, color: "#17324d", fontSize: "24px", fontWeight: 800 }}>
                {formatMetricValue(card.value)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div style={panelStyles.section}>
        <div style={panelStyles.sectionHeader}>
          <div>
            <h4 style={panelStyles.sectionTitle}>Priority Actions</h4>
          </div>
        </div>

        <div style={panelStyles.priorityGrid}>
          <div id="forecast-stock-actions" style={panelStyles.card}>
            <h4 style={panelStyles.sectionTitle}>Stock Action List</h4>
            {!resultRows.length ? (
              <p style={{ ...panelStyles.emptyState, marginTop: "14px" }}>
                Run a forecast to identify the highest-priority stock-up items.
              </p>
            ) : stockActionRows.length === 0 ? (
              <p style={{ ...panelStyles.emptyState, marginTop: "14px" }}>
                No stock-up actions are needed for this forecast.
              </p>
            ) : (
              <div style={{ marginTop: "14px", overflowX: "auto" }}>
                <table style={panelStyles.compactTable}>
                  <thead>
                    <tr>
                      {["Item", "Forecast Need", "Add Stock", "After Forecast", "Risk"].map((header) => (
                        <th key={header} style={panelStyles.th}>
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stockActionRows.map((row) => (
                      <tr key={row.inventory_item_id}>
                        <td style={panelStyles.td}>
                          <strong style={{ color: "#17324d" }}>{row.item_name}</strong>
                        </td>
                        <td style={panelStyles.td}>
                          {formatNumber(row.forecasted_usage)} {row.unit_of_measure || "units"}
                        </td>
                        <td style={panelStyles.td}>
                          <strong style={{ color: "#17324d" }}>
                            {formatNumber(row.recommended_reorder_quantity)} {row.unit_of_measure || "units"}
                          </strong>
                        </td>
                        <td style={panelStyles.td}>
                          {formatNumber(row.projected_remaining_stock)} {row.unit_of_measure || "units"}
                        </td>
                        <td style={panelStyles.td}>
                          <span style={getRiskLevelStyle(row.risk_level)}>
                            {row.risk_level}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div id="forecast-donor-requests" style={panelStyles.card}>
            <h4 style={panelStyles.sectionTitle}>Donor Request List</h4>
            {!donorNeedRows.length ? (
              <p style={{ ...panelStyles.emptyState, marginTop: "14px" }}>
                Donor requests will appear after a forecast identifies shortages.
              </p>
            ) : (
              <div style={{ marginTop: "14px", overflowX: "auto" }}>
                <table style={panelStyles.compactTable}>
                  <thead>
                    <tr>
                      {["Item", "Request", "Urgency"].map((header) => (
                        <th key={header} style={panelStyles.th}>
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {donorNeedRows.map((row) => (
                      <tr key={row.inventory_item_id}>
                        <td style={panelStyles.td}>
                          <strong style={{ color: "#17324d" }}>{row.item_name}</strong>
                        </td>
                        <td style={panelStyles.td}>
                          <strong style={{ color: "#17324d" }}>
                            {formatNumber(row.recommended_reorder_quantity)} {row.unit_of_measure || "units"}
                          </strong>
                        </td>
                        <td style={panelStyles.td}>
                          {row.shortage_within_seven_days
                            ? "Within 7 days"
                            : formatDate(row.projected_depletion_date)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <div id="forecast-trends" style={panelStyles.section}>
        <div style={panelStyles.sectionHeader}>
          <div>
            <h4 style={panelStyles.sectionTitle}>Trend and Stock View</h4>
            <p style={panelStyles.sectionText}>
              Recent use, forecasted need, and stock remaining after the forecast.
            </p>
          </div>
        </div>

        <div style={panelStyles.chartGrid}>
          <div style={panelStyles.chartShell}>
            <ChartHeader title="Inventory Usage Trend" />
            {isForecastContextLoading ? (
              <p style={panelStyles.emptyState}>Loading usage trend...</p>
            ) : (
              <LineChart rows={usageTrendRows} />
            )}
          </div>

          <div style={panelStyles.chartShell}>
            <ChartHeader title="Forecasted Item Need" />
            {isForecastLoading || isForecastHistoryDetailLoading ? (
              <p style={panelStyles.emptyState}>Loading forecasted demand...</p>
            ) : (
              <BarChart
                rows={demandRows}
                valueKey="forecasted_usage"
                labelKey="item_name"
                color={accentMap.orange}
              />
            )}
          </div>

          <div style={panelStyles.chartShell}>
            <ChartHeader title="Stock After Forecast" />
            {isForecastLoading || isForecastHistoryDetailLoading ? (
              <p style={panelStyles.emptyState}>Loading projected stock levels...</p>
            ) : (
              <StockLevelChart rows={stockRows} />
            )}
          </div>
        </div>
      </div>

      <details id="forecast-detailed-results" style={panelStyles.detailsBox}>
        <summary style={panelStyles.detailsSummary}>Detailed Results by Item</summary>
        <div style={{ ...panelStyles.tableWrap, marginTop: "16px" }}>
          <table style={panelStyles.table}>
            <thead>
              <tr>
                {[
                  "Item",
                  "Current Stock",
                  "Per Household",
                  "Forecast Need",
                  "Pack Need",
                  "After Forecast",
                  "Add Stock",
                  "Shortage",
                  "Risk",
                ].map((header) => (
                  <th key={header} style={panelStyles.th}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isForecastLoading ? (
                <tr>
                  <td colSpan="9" style={panelStyles.td}>
                    Loading latest forecast...
                  </td>
                </tr>
              ) : isForecastHistoryDetailLoading ? (
                <tr>
                  <td colSpan="9" style={panelStyles.td}>
                    Loading forecast run details...
                  </td>
                </tr>
              ) : !resultRows.length ? (
                <tr>
                  <td colSpan="9" style={panelStyles.td}>
                    Run a forecast to see item needs, shortage warnings, and suggested stock additions.
                  </td>
                </tr>
              ) : (
                priorityResultRows.map((result) => (
                  <tr key={result.inventory_item_id}>
                    <td style={panelStyles.td}>
                      <strong
                        style={panelStyles.itemNameCell}
                        title={`${result.item_name} (${result.item_code || "--"} | ${getForecastModelLabel(result.selected_model)})`}
                      >
                        {result.item_name}
                      </strong>
                    </td>
                    <td style={panelStyles.td}>{formatNumber(result.current_available_stock)}</td>
                    <td style={panelStyles.td}>{formatNumber(result.quantity_per_household)}</td>
                    <td style={panelStyles.td}>{formatNumber(result.forecasted_usage)}</td>
                    <td style={panelStyles.td}>{formatNumber(result.projected_household_demand)}</td>
                    <td style={panelStyles.td}>{formatNumber(result.projected_remaining_stock)}</td>
                    <td style={panelStyles.td}>{formatNumber(result.recommended_reorder_quantity)}</td>
                    <td style={panelStyles.td}>
                      {result.shortage_within_seven_days
                        ? `Shortage in ${result.days_until_depletion || 0} day(s)`
                        : result.days_until_depletion === null
                          ? "No short-term shortage"
                          : `${result.days_until_depletion} day(s) remaining`}
                    </td>
                    <td style={panelStyles.td}>
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
      </details>

      <div style={panelStyles.card}>
        <h4 style={{ margin: "0 0 12px", color: "#17324d", fontSize: "18px" }}>
          Forecast History
        </h4>
        {isForecastHistoryLoading ? (
          <p style={panelStyles.emptyState}>Loading forecast history...</p>
        ) : !forecastHistory.length ? (
          <p style={panelStyles.emptyState}>No saved forecast runs yet for this disaster event.</p>
        ) : (
          <div style={{ display: "grid", gap: "10px" }}>
            {forecastHistory.slice(0, 5).map((run) => (
              <button
                key={run.id}
                type="button"
                onClick={() => onSelectForecastHistoryRun(run.id)}
                style={panelStyles.historyButton}
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
                  <span style={{ color: "#5d7188", fontSize: "12px" }}>
                    {new Date(run.run_at).toLocaleString()}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: "6px",
                    display: "flex",
                    gap: "12px",
                    flexWrap: "wrap",
                    color: "#5d7188",
                    fontSize: "12px",
                  }}
                >
                  <span>Model: {getForecastModelLabel(run.model_name)}</span>
                  <span>Generated By: {run.generated_by}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ForecastingPanel;
