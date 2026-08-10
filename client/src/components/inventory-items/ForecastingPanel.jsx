import React, { useMemo, useState } from "react";
import {
  FiActivity,
  FiAlertCircle,
  FiAlertTriangle,
  FiBarChart2,
  FiCheckCircle,
  FiFlag,
  FiPackage,
  FiPlusCircle,
  FiTrendingUp,
} from "react-icons/fi";
import { pageHeaderStyles } from "../layout/PageHeader";
import { shellStyles } from "../layout/BarangayLayout";

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
    gap: "24px",
  },
  card: {
    ...shellStyles.card,
  },
  softCard: {
    borderRadius: "12px",
    border: "1px solid #d6e2ef",
    backgroundColor: "#f7fbff",
    padding: "clamp(16px, 2vw, 22px)",
  },
  controlGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
    alignItems: "end",
  },
  filterLabel: {
    display: "block",
    marginBottom: "8px",
    color: "#5f7892",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  filterField: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1px solid #cfddeb",
    backgroundColor: "#f8fbfe",
    color: "#1f3b57",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  forecastActionRow: {
    display: "flex",
    justifyContent: "flex-end",
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
  sectionHeading: {
    margin: 0,
    color: "#17324d",
    fontSize: "24px",
    fontWeight: 800,
    lineHeight: 1.2,
  },
  tableTitle: {
    margin: 0,
    color: "#17324d",
    fontSize: "18px",
    fontWeight: 800,
    lineHeight: 1.25,
  },
  executiveGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
    gap: "24px",
    alignItems: "stretch",
  },
  executiveCard: {
    ...shellStyles.card,
    display: "grid",
    gap: "14px",
  },
  insightCard: {
    borderRadius: "10px",
    border: "1px solid #dbe6f0",
    backgroundColor: "#f7fbff",
    padding: "16px",
    minHeight: "116px",
    boxSizing: "border-box",
  },
  modelCardContent: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    width: "100%",
    minHeight: "84px",
    minWidth: 0,
    overflow: "hidden",
  },
  modelInsightCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  modelIconWrap: {
    width: "50px",
    height: "50px",
    borderRadius: "12px",
    backgroundColor: "#e8f1fa",
    color: "#2f6499",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 auto",
  },
  modelName: {
    margin: 0,
    color: "#17324d",
    fontSize: "16px",
    fontWeight: 800,
    lineHeight: 1.25,
    textAlign: "center",
    overflowWrap: "anywhere",
    minWidth: 0,
  },
  totalNeedCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },
  insightValue: {
    margin: 0,
    color: "#17324d",
    fontSize: "40px",
    lineHeight: 1.05,
    fontWeight: 800,
  },
  interpretationBanner: {
    borderRadius: "10px",
    border: "1px solid #d6e2ef",
    backgroundColor: "#f7fbff",
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
  inputSummaryCard: {
    ...shellStyles.card,
  },
  inputSummaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))",
    gap: "10px",
    marginTop: "12px",
  },
  inputSummaryPill: {
    borderRadius: "10px",
    border: "1px solid #dbe6f0",
    backgroundColor: "#ffffff",
    padding: "10px 12px",
  },
  usageSummaryPill: {
    borderRadius: "12px",
    border: "1px solid #d7e2ef",
    backgroundColor: "#f8fbfe",
    padding: "14px 16px",
  },
  inputSummaryValue: {
    margin: "4px 0 0",
    color: "#17324d",
    fontSize: "22px",
    fontWeight: 800,
    lineHeight: 1.1,
  },
  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "12px",
  },
  statCard: {
    borderRadius: "12px",
    padding: "16px",
    backgroundColor: "#f8fbfe",
    border: "1px solid #d7e2ef",
    boxShadow: "0 8px 18px rgba(58, 97, 141, 0.05)",
  },
  statButton: {
    width: "100%",
    minHeight: "92px",
    textAlign: "left",
    cursor: "pointer",
    appearance: "none",
    fontFamily: "inherit",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: "12px",
  },
  statValueRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minWidth: 0,
  },
  statIconWrap: {
    width: "38px",
    height: "38px",
    borderRadius: "12px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 auto",
  },
  statLabel: {
    margin: 0,
    color: "#4f6d8b",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    lineHeight: 1.25,
  },
  statValue: {
    margin: 0,
    fontSize: "32px",
    lineHeight: 1,
    fontWeight: 800,
    color: "#17324d",
    minWidth: 0,
  },
  priorityGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "24px",
    alignItems: "start",
  },
  chartGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "24px",
  },
  chartShell: {
    ...shellStyles.card,
    minHeight: "300px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  tableWrap: {
    overflowX: "auto",
    maxWidth: "100%",
    width: "100%",
  },
  table: {
    width: "100%",
    minWidth: "1080px",
    borderCollapse: "collapse",
    background: "transparent",
    tableLayout: "fixed",
  },
  compactTable: {
    width: "100%",
    minWidth: "720px",
    borderCollapse: "collapse",
    background: "transparent",
    tableLayout: "fixed",
  },
  stockActionColumnWidths: {
    item: "32%",
    currentStock: "14%",
    forecastNeed: "14%",
    addStock: "14%",
    afterForecast: "14%",
    risk: "12%",
  },
  detailedColumnWidths: {
    item: "24%",
    currentStock: "12%",
    forecastNeed: "12%",
    addStock: "12%",
    afterForecast: "12%",
    shortage: "20%",
    risk: "8%",
  },
  th: {
    textAlign: "center",
    padding: "14px 10px",
    fontSize: "12px",
    color: "#66809c",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    borderBottom: "1px solid #e0eaf4",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "16px 10px",
    fontSize: "14px",
    color: "#21405f",
    borderBottom: "1px solid #edf3f8",
    verticalAlign: "middle",
    lineHeight: 1.5,
    wordBreak: "break-word",
    textAlign: "center",
  },
  leftCell: {
    textAlign: "left",
  },
  itemNameCell: {
    color: "#17324d",
    display: "block",
    minWidth: "220px",
    whiteSpace: "normal",
    overflowWrap: "anywhere",
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
    borderRadius: "10px",
    backgroundColor: "#f7fbff",
    padding: "12px 14px",
    textAlign: "left",
    cursor: "pointer",
  },
  detailsBox: {
    ...shellStyles.card,
    overflow: "hidden",
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

const pieceUnitLabels = new Set(["pc", "pcs", "piece", "pieces", "unit", "units"]);

const isPieceBasedUnit = (unitOfMeasure) =>
  pieceUnitLabels.has(String(unitOfMeasure || "").trim().toLowerCase());

const formatForecastQuantity = (
  value,
  unitOfMeasure,
  { forceWhole = false, roundUp = false } = {},
) => {
  const numericValue = Number(value || 0);

  if (!forceWhole && !isPieceBasedUnit(unitOfMeasure)) {
    return formatNumber(numericValue);
  }

  const wholeValue = roundUp
    ? Math.ceil(Math.max(numericValue, 0))
    : Math.round(numericValue);

  return formatNumber(wholeValue);
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

const getNiceNumber = (value) => {
  if (value <= 0) {
    return 1;
  }

  const exponent = Math.floor(Math.log10(value));
  const fraction = value / 10 ** exponent;

  if (fraction <= 1) {
    return 1 * 10 ** exponent;
  }

  if (fraction <= 2) {
    return 2 * 10 ** exponent;
  }

  if (fraction <= 5) {
    return 5 * 10 ** exponent;
  }

  return 10 * 10 ** exponent;
};

const getChartScale = (maxValue, tickCount = 5) => {
  const safeTickCount = Math.max(tickCount, 2);
  const safeMaxValue = Math.max(Number(maxValue || 0), 1);
  const step = getNiceNumber(safeMaxValue / (safeTickCount - 1));
  const maxTick = Math.ceil(safeMaxValue / step) * step;
  const ticks = [];

  for (let value = maxTick; value >= 0; value -= step) {
    ticks.push(value);
  }

  return {
    maxTick,
    ticks,
  };
};

const getEvenTickIndexes = (rowCount, maxTicks = 5) => {
  if (rowCount <= 0) {
    return [];
  }

  if (rowCount <= maxTicks) {
    return Array.from({ length: rowCount }, (_, index) => index);
  }

  return Array.from(
    { length: maxTicks },
    (_, index) => Math.round((index * (rowCount - 1)) / (maxTicks - 1)),
  ).filter((index, currentIndex, indexes) => indexes.indexOf(index) === currentIndex);
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

const ChartHeader = ({ title, subtitle }) => (
  <div style={{ display: "grid", gap: subtitle ? "4px" : 0 }}>
    <h4 style={{ margin: 0, color: "#17324d", fontSize: "18px" }}>{title}</h4>
    {subtitle ? (
      <p style={{ ...panelStyles.emptyState, fontSize: "12px" }}>
        {subtitle}
      </p>
    ) : null}
  </div>
);

const ForecastModelIcon = ({ modelName }) => {
  if (modelName === "EXPONENTIAL_SMOOTHING") {
    return <FiTrendingUp size={26} aria-hidden="true" />;
  }

  if (modelName === "TREND_PROJECTION") {
    return <FiBarChart2 size={26} aria-hidden="true" />;
  }

  return <FiActivity size={26} aria-hidden="true" />;
};

const ForecastMetricIcon = ({ icon }) => {
  const iconProps = { size: 20, "aria-hidden": "true" };

  if (icon === "restock") {
    return <FiPackage {...iconProps} />;
  }

  if (icon === "risk") {
    return <FiAlertTriangle {...iconProps} />;
  }

  if (icon === "critical") {
    return <FiAlertCircle {...iconProps} />;
  }

  if (icon === "priority") {
    return <FiFlag {...iconProps} />;
  }

  if (icon === "addStock") {
    return <FiPlusCircle {...iconProps} />;
  }

  return <FiCheckCircle {...iconProps} />;
};

const LineChart = ({ rows = [] }) => {
  const [activePointIndex, setActivePointIndex] = useState(null);
  const chartRows = rows.slice(-14);

  if (!chartRows.length) {
    return <p style={panelStyles.emptyState}>No inventory usage trend is available yet.</p>;
  }

  const width = 720;
  const height = 260;
  const chartMargin = {
    top: 28,
    right: 28,
    bottom: 72,
    left: 74,
  };
  const chartWidth = width - chartMargin.left - chartMargin.right;
  const chartHeight = height - chartMargin.top - chartMargin.bottom;
  const maxValue = Math.max(...chartRows.map((row) => Number(row.total_quantity || 0)), 1);
  const chartScale = getChartScale(maxValue, 5);
  const totalUsed = chartRows.reduce(
    (total, row) => total + Number(row.total_quantity || 0),
    0,
  );
  const averageDailyUse = totalUsed / chartRows.length;
  const peakRow = chartRows.reduce((highest, row) => {
    return Number(row.total_quantity || 0) > Number(highest.total_quantity || 0)
      ? row
      : highest;
  }, chartRows[0]);
  const points = chartRows.map((row, index) => {
    const x =
      chartMargin.left +
      (index * chartWidth) / Math.max(chartRows.length - 1, 1);
    const y =
      height -
      chartMargin.bottom -
      (Number(row.total_quantity || 0) / chartScale.maxTick) * chartHeight;

    return {
      x,
      y,
      value: Number(row.total_quantity || 0),
      date: row.usage_date,
    };
  });
  const yTicks = chartScale.ticks.map((value) => {
    const y = height - chartMargin.bottom - (value / chartScale.maxTick) * chartHeight;

    return { value, y };
  });
  const xTickIndexes = getEvenTickIndexes(chartRows.length, 5);
  const activePoint =
    activePointIndex === null ? null : points[activePointIndex] || null;
  const tooltipWidth = 150;
  const tooltipHeight = 48;
  const tooltipX = activePoint
    ? Math.min(
        Math.max(activePoint.x - tooltipWidth / 2, chartMargin.left),
        width - chartMargin.right - tooltipWidth,
      )
    : 0;
  const tooltipY = activePoint
    ? Math.max(activePoint.y - tooltipHeight - 14, chartMargin.top)
    : 0;

  return (
    <div style={{ display: "grid", gap: "12px" }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", height: "auto", minHeight: "280px" }}
        onMouseLeave={() => setActivePointIndex(null)}
      >
        {yTicks.map((tick) => (
          <g key={tick.value}>
            <line
              x1={chartMargin.left}
              y1={tick.y}
              x2={width - chartMargin.right}
              y2={tick.y}
              stroke={tick.value === 0 ? "#cddcec" : "#e7edf5"}
              strokeWidth={tick.value === 0 ? "1.5" : "1"}
            />
            <text
              x={chartMargin.left - 12}
              y={tick.y + 4}
              textAnchor="end"
              fill="#60738a"
              fontSize="11"
              fontWeight="700"
            >
              {formatNumber(Math.round(tick.value))}
            </text>
          </g>
        ))}
        <line
          x1={chartMargin.left}
          y1={chartMargin.top}
          x2={chartMargin.left}
          y2={height - chartMargin.bottom}
          stroke="#cddcec"
          strokeWidth="1.5"
        />
        {xTickIndexes.map((index) => {
          const point = points[index];

          return (
            <g key={`${point.date}-${index}`}>
              <line
                x1={point.x}
                y1={height - chartMargin.bottom}
                x2={point.x}
                y2={height - chartMargin.bottom + 5}
                stroke="#cddcec"
                strokeWidth="1"
              />
              <text
                x={point.x}
                y={height - chartMargin.bottom + 22}
                textAnchor="middle"
                fill="#60738a"
                fontSize="11"
                fontWeight="700"
              >
                {formatShortDate(point.date)}
              </text>
            </g>
          );
        })}
        <text
          x={chartMargin.left + chartWidth / 2}
          y={height - 12}
          fill="#60738a"
          fontSize="12"
          fontWeight="700"
          textAnchor="middle"
        >
          Usage Date
        </text>
        <text
          x={18}
          y={chartMargin.top + chartHeight / 2}
          fill="#60738a"
          fontSize="12"
          fontWeight="700"
          textAnchor="middle"
          transform={`rotate(-90 18 ${chartMargin.top + chartHeight / 2})`}
        >
          Quantity Used
        </text>
        <polyline
          fill="none"
          stroke={accentMap.blue}
          strokeWidth="4"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points.map((point) => `${point.x},${point.y}`).join(" ")}
        />
        {points.map((point, index) => (
          <g key={`${point.date}-${index}`}>
            <circle
              cx={point.x}
              cy={point.y}
              r={activePointIndex === index ? "6" : "4.5"}
              fill={accentMap.blue}
              stroke="#ffffff"
              strokeWidth="2"
            />
            <circle
              cx={point.x}
              cy={point.y}
              r="14"
              fill="transparent"
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setActivePointIndex(index)}
              onFocus={() => setActivePointIndex(index)}
              tabIndex="0"
            >
              <title>
                {`${formatShortDate(point.date)}: ${formatNumber(point.value)} used`}
              </title>
            </circle>
          </g>
        ))}
        {activePoint ? (
          <g pointerEvents="none">
            <rect
              x={tooltipX}
              y={tooltipY}
              width={tooltipWidth}
              height={tooltipHeight}
              rx="10"
              fill="#ffffff"
              stroke="#d6e2ef"
            />
            <text
              x={tooltipX + 12}
              y={tooltipY + 19}
              fill="#60738a"
              fontSize="11"
              fontWeight="800"
            >
              {formatShortDate(activePoint.date)}
            </text>
            <text
              x={tooltipX + 12}
              y={tooltipY + 37}
              fill="#17324d"
              fontSize="14"
              fontWeight="800"
            >
              {formatNumber(activePoint.value)} used
            </text>
          </g>
        ) : null}
      </svg>

      <p style={{ ...panelStyles.emptyState, fontSize: "12px" }}>
        Based on inventory outflow and distribution records for this disaster event.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "12px" }}>
        {[
          ["Total Used", formatNumber(totalUsed)],
          [
            "Peak Day",
            `${formatNumber(peakRow.total_quantity)} on ${formatShortDate(peakRow.usage_date)}`,
          ],
          ["Average Daily Use", formatNumber(Math.round(averageDailyUse))],
        ].map(([label, value]) => (
          <div key={label} style={panelStyles.usageSummaryPill}>
            <p style={{ ...panelStyles.label, marginBottom: 0 }}>{label}</p>
            <p style={panelStyles.inputSummaryValue}>
              {value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

const BarChart = ({ rows = [], valueKey, labelKey, color }) => {
  if (!rows.length) {
    return <p style={panelStyles.emptyState}>No forecast demand rows are available yet.</p>;
  }

  const chartRows = [...rows]
    .sort((left, right) => {
      return (
        Number(right[valueKey] || 0) -
        Number(left[valueKey] || 0)
      );
    })
    .slice(0, 6);
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
                {formatForecastQuantity(value, row.unit_of_measure, {
                  forceWhole: true,
                  roundUp: true,
                })} {row.unit_of_measure || ""}
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

  const chartRows = [...rows]
    .sort((left, right) => {
      const riskDifference =
        getRiskPriority(right.risk_level) - getRiskPriority(left.risk_level);

      if (riskDifference !== 0) {
        return riskDifference;
      }

      return (
        Number(left.projected_remaining_stock || 0) -
        Number(right.projected_remaining_stock || 0)
      );
    })
    .slice(0, 6);

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
                {formatForecastQuantity(currentStock, row.unit_of_measure, {
                  forceWhole: true,
                })} now |{" "}
                {formatForecastQuantity(remainingStock, row.unit_of_measure, {
                  forceWhole: true,
                })} after
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
  const displayedTotalForecastNeed = Math.ceil(Math.max(totalForecastNeed, 0));
  const displayedTotalAddStock = Math.ceil(Math.max(totalAddStock, 0));
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
      icon: "checked",
      targetId: "forecast-detailed-results",
      opensDetails: true,
    },
    {
      label: "Needs Restock",
      value: modelHasResults ? eventSummary.shortage_item_count || 0 : "--",
      accent: accentMap.orange,
      icon: "restock",
      targetId: "forecast-stock-actions",
    },
    {
      label: "Recommended Restock",
      value: modelHasResults ? displayedTotalAddStock : "--",
      accent: accentMap.green,
      icon: "addStock",
      targetId: "forecast-stock-actions",
    },
    {
      label: "7-Day Risk",
      value: modelHasResults ? eventSummary.seven_day_shortage_count || 0 : "--",
      accent: accentMap.red,
      icon: "risk",
      targetId: "forecast-detailed-results",
      opensDetails: true,
    },
    {
      label: "Critical",
      value: modelHasResults ? criticalItemCount : "--",
      accent: accentMap.red,
      icon: "critical",
      targetId: "forecast-detailed-results",
      opensDetails: true,
    },
    {
      label: "Top Priority",
      value: topRestockRow?.item_name || "None",
      accent: accentMap.orange,
      icon: "priority",
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
      <section style={shellStyles.card}>
        <div style={panelStyles.controlGrid}>
          <div>
            <label
              htmlFor="forecast-disaster-event"
              style={panelStyles.filterLabel}
            >
              Disaster Event
            </label>
            <select
              id="forecast-disaster-event"
              value={selectedForecastEventId}
              onChange={(event) => onForecastEventChange(event.target.value)}
              style={panelStyles.filterField}
            >
              {forecastEvents.length === 0 ? (
                <option value="">No disaster events available</option>
              ) : (
                forecastEvents.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label
              htmlFor="forecast-model"
              style={panelStyles.filterLabel}
            >
              Forecast Model
            </label>
            <select
              id="forecast-model"
              value={selectedForecastModel}
              onChange={(event) => onForecastModelChange(event.target.value)}
              style={panelStyles.filterField}
            >
              {forecastModelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <div style={panelStyles.forecastActionRow}>
        <button
          type="button"
          onClick={onRunForecast}
          disabled={isRunningForecast || !selectedForecastEventId}
          style={{
            ...pageHeaderStyles.primaryButton,
            cursor:
              isRunningForecast || !selectedForecastEventId
                ? "not-allowed"
                : "pointer",
            opacity:
              isRunningForecast || !selectedForecastEventId ? 0.7 : 1,
          }}
        >
          <FiTrendingUp size={16} />
          {isRunningForecast ? "Running Forecast..." : "Run Forecast"}
        </button>
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
            <h3
              style={{
                margin: 0,
                color: "#17324d",
                fontSize: "clamp(24px, 2.6vw, 32px)",
                lineHeight: 1.15,
                overflowWrap: "anywhere",
              }}
            >
              {eventInfo?.title || "No selected disaster event"}
            </h3>
          </div>

          <div style={panelStyles.interpretationBanner}>{interpretationText}</div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
              gap: "12px",
            }}
          >
            <div style={{ ...panelStyles.insightCard, ...panelStyles.modelInsightCard }}>
              <div style={panelStyles.modelCardContent}>
                <span style={panelStyles.modelIconWrap}>
                  <ForecastModelIcon modelName={selectedForecastModel} />
                </span>
                <p style={panelStyles.modelName}>{selectedModelLabel}</p>
              </div>
            </div>
            <div style={{ ...panelStyles.insightCard, ...panelStyles.totalNeedCard }}>
              <p style={panelStyles.insightValue}>
                {modelHasResults ? formatNumber(displayedTotalForecastNeed) : "--"}
              </p>
              <p style={{ ...panelStyles.label, marginBottom: 0 }}>Total Need</p>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", alignItems: "stretch" }}>
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
                }}
              >
                <p style={panelStyles.statLabel}>{card.label}</p>
                <div style={panelStyles.statValueRow}>
                  <span
                    style={{
                      ...panelStyles.statIconWrap,
                      color: card.accent,
                      backgroundColor: `${card.accent}18`,
                    }}
                  >
                    <ForecastMetricIcon icon={card.icon} />
                  </span>
                  <p
                    style={{
                      ...panelStyles.statValue,
                      fontSize: typeof card.value === "string" ? "20px" : "32px",
                      lineHeight: typeof card.value === "string" ? 1.2 : 1,
                      wordBreak: "break-word",
                    }}
                  >
                    {formatMetricValue(card.value)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={panelStyles.section}>
        <div style={panelStyles.sectionHeader}>
          <div>
            <h4 style={panelStyles.sectionHeading}>Priority Actions</h4>
          </div>
        </div>

        <div style={panelStyles.priorityGrid}>
          <div id="forecast-stock-actions" style={panelStyles.card}>
            <h4 style={panelStyles.tableTitle}>Stock Action List</h4>
            {!resultRows.length ? (
              <p style={{ ...panelStyles.emptyState, marginTop: "14px" }}>
                Run a forecast to identify the highest-priority stock-up items.
              </p>
            ) : stockActionRows.length === 0 ? (
              <p style={{ ...panelStyles.emptyState, marginTop: "14px" }}>
                No stock-up actions are needed for this forecast.
              </p>
            ) : (
              <div style={{ ...panelStyles.tableWrap, marginTop: "14px" }}>
                <table style={panelStyles.compactTable}>
                  <thead>
                    <tr>
                      <th
                        style={{
                          ...panelStyles.th,
                          ...panelStyles.leftCell,
                          width: panelStyles.stockActionColumnWidths.item,
                        }}
                      >
                        Item Name
                      </th>
                      <th
                        style={{
                          ...panelStyles.th,
                          width: panelStyles.stockActionColumnWidths.currentStock,
                        }}
                      >
                        Current Stock
                      </th>
                      <th
                        style={{
                          ...panelStyles.th,
                          width: panelStyles.stockActionColumnWidths.forecastNeed,
                        }}
                      >
                        Forecast Need
                      </th>
                      <th
                        style={{
                          ...panelStyles.th,
                          width: panelStyles.stockActionColumnWidths.addStock,
                        }}
                      >
                        Add Stock
                      </th>
                      <th
                        style={{
                          ...panelStyles.th,
                          width: panelStyles.stockActionColumnWidths.afterForecast,
                        }}
                      >
                        After Forecast
                      </th>
                      <th
                        style={{
                          ...panelStyles.th,
                          width: panelStyles.stockActionColumnWidths.risk,
                        }}
                      >
                        Risk
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockActionRows.map((row) => (
                      <tr key={row.inventory_item_id}>
                        <td
                          style={{
                            ...panelStyles.td,
                            ...panelStyles.leftCell,
                            width: panelStyles.stockActionColumnWidths.item,
                          }}
                        >
                          <strong style={{ color: "#17324d" }}>{row.item_name}</strong>
                        </td>
                        <td
                          style={{
                            ...panelStyles.td,
                            width: panelStyles.stockActionColumnWidths.currentStock,
                          }}
                        >
                          {formatForecastQuantity(
                            row.current_available_stock,
                            row.unit_of_measure,
                          )} {row.unit_of_measure || "units"}
                        </td>
                        <td
                          style={{
                            ...panelStyles.td,
                            width: panelStyles.stockActionColumnWidths.forecastNeed,
                          }}
                        >
                          {formatForecastQuantity(row.forecasted_usage, row.unit_of_measure, {
                            roundUp: true,
                          })} {row.unit_of_measure || "units"}
                        </td>
                        <td
                          style={{
                            ...panelStyles.td,
                            width: panelStyles.stockActionColumnWidths.addStock,
                          }}
                        >
                          <strong style={{ color: "#17324d" }}>
                            {formatForecastQuantity(
                              row.recommended_reorder_quantity,
                              row.unit_of_measure,
                              { roundUp: true },
                            )} {row.unit_of_measure || "units"}
                          </strong>
                        </td>
                        <td
                          style={{
                            ...panelStyles.td,
                            width: panelStyles.stockActionColumnWidths.afterForecast,
                          }}
                        >
                          {formatForecastQuantity(
                            row.projected_remaining_stock,
                            row.unit_of_measure,
                          )} {row.unit_of_measure || "units"}
                        </td>
                        <td
                          style={{
                            ...panelStyles.td,
                            width: panelStyles.stockActionColumnWidths.risk,
                          }}
                        >
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
            <h4 style={panelStyles.tableTitle}>Donor Request List</h4>
            {!donorNeedRows.length ? (
              <p style={{ ...panelStyles.emptyState, marginTop: "14px" }}>
                {modelHasResults
                  ? "No donor requests are needed for this forecast."
                  : "Run a forecast to identify items that may need donor support."}
              </p>
            ) : (
              <div style={{ ...panelStyles.tableWrap, marginTop: "14px" }}>
                <table style={panelStyles.compactTable}>
                  <thead>
                    <tr>
                      {["Item Name", "Request", "Urgency"].map((header) => (
                        <th
                          key={header}
                          style={{
                            ...panelStyles.th,
                            ...(header === "Item Name" ? panelStyles.leftCell : null),
                          }}
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {donorNeedRows.map((row) => (
                      <tr key={row.inventory_item_id}>
                        <td style={{ ...panelStyles.td, ...panelStyles.leftCell }}>
                          <strong style={{ color: "#17324d" }}>{row.item_name}</strong>
                        </td>
                        <td style={panelStyles.td}>
                          <strong style={{ color: "#17324d" }}>
                            {formatForecastQuantity(
                              row.recommended_reorder_quantity,
                              row.unit_of_measure,
                              { roundUp: true },
                            )} {row.unit_of_measure || "units"}
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
            <h4 style={panelStyles.sectionHeading}>Trend and Stock View</h4>
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
            <ChartHeader
              title="Top Forecasted Needs"
              subtitle="Top 6 items by forecasted demand."
            />
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
            <ChartHeader
              title="Stock After Forecast"
              subtitle="Top 6 items by highest risk, then lowest projected remaining stock."
            />
            {isForecastLoading || isForecastHistoryDetailLoading ? (
              <p style={panelStyles.emptyState}>Loading projected stock levels...</p>
            ) : (
              <StockLevelChart rows={stockRows} />
            )}
          </div>
        </div>
      </div>

      <div style={panelStyles.inputSummaryCard}>
        <div style={panelStyles.sectionHeader}>
          <h4 style={{ ...panelStyles.sectionTitle, fontSize: "17px" }}>
            Forecast Inputs
          </h4>
        </div>

        <div style={panelStyles.inputSummaryGrid}>
          {sourceCards.map((card) => (
            <div key={card.label} style={panelStyles.inputSummaryPill}>
              <p style={{ ...panelStyles.label, marginBottom: 0 }}>{card.label}</p>
              <p style={panelStyles.inputSummaryValue}>
                {formatMetricValue(card.value)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <details id="forecast-detailed-results" style={panelStyles.detailsBox}>
        <summary style={panelStyles.detailsSummary}>Detailed Results by Item</summary>
        <div style={{ ...panelStyles.tableWrap, marginTop: "16px" }}>
          <table style={panelStyles.table}>
            <thead>
              <tr>
                {[
                  ["Item Name", panelStyles.detailedColumnWidths.item],
                  ["Current Stock", panelStyles.detailedColumnWidths.currentStock],
                  ["Forecast Need", panelStyles.detailedColumnWidths.forecastNeed],
                  ["Add Stock", panelStyles.detailedColumnWidths.addStock],
                  ["After Forecast", panelStyles.detailedColumnWidths.afterForecast],
                  ["Shortage", panelStyles.detailedColumnWidths.shortage],
                  ["Risk", panelStyles.detailedColumnWidths.risk],
                ].map(([header, width]) => (
                  <th
                    key={header}
                    style={{
                      ...panelStyles.th,
                      width,
                      ...(header === "Item Name" ? panelStyles.leftCell : null),
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isForecastLoading ? (
                <tr>
                  <td colSpan="7" style={panelStyles.td}>
                    Loading latest forecast...
                  </td>
                </tr>
              ) : isForecastHistoryDetailLoading ? (
                <tr>
                  <td colSpan="7" style={panelStyles.td}>
                    Loading forecast run details...
                  </td>
                </tr>
              ) : !resultRows.length ? (
                <tr>
                  <td colSpan="7" style={panelStyles.td}>
                    Run a forecast to see item needs, shortage warnings, and suggested stock additions.
                  </td>
                </tr>
              ) : (
                priorityResultRows.map((result) => (
                  <tr key={result.inventory_item_id}>
                    <td
                      style={{
                        ...panelStyles.td,
                        ...panelStyles.leftCell,
                        width: panelStyles.detailedColumnWidths.item,
                      }}
                    >
                      <strong
                        style={panelStyles.itemNameCell}
                        title={`${result.item_name} (${result.item_code || "--"} | ${getForecastModelLabel(result.selected_model)})`}
                      >
                        {result.item_name}
                      </strong>
                    </td>
                    <td
                      style={{
                        ...panelStyles.td,
                        width: panelStyles.detailedColumnWidths.currentStock,
                      }}
                    >
                      {formatForecastQuantity(
                        result.current_available_stock,
                        result.unit_of_measure,
                      )}
                    </td>
                    <td
                      style={{
                        ...panelStyles.td,
                        width: panelStyles.detailedColumnWidths.forecastNeed,
                      }}
                    >
                      {formatForecastQuantity(
                        result.forecasted_usage,
                        result.unit_of_measure,
                        { roundUp: true },
                      )}
                    </td>
                    <td
                      style={{
                        ...panelStyles.td,
                        width: panelStyles.detailedColumnWidths.addStock,
                      }}
                    >
                      {formatForecastQuantity(
                        result.recommended_reorder_quantity,
                        result.unit_of_measure,
                        { roundUp: true },
                      )}
                    </td>
                    <td
                      style={{
                        ...panelStyles.td,
                        width: panelStyles.detailedColumnWidths.afterForecast,
                      }}
                    >
                      {formatForecastQuantity(
                        result.projected_remaining_stock,
                        result.unit_of_measure,
                      )}
                    </td>
                    <td
                      style={{
                        ...panelStyles.td,
                        width: panelStyles.detailedColumnWidths.shortage,
                      }}
                    >
                      {result.shortage_within_seven_days
                        ? `Shortage in ${result.days_until_depletion || 0} day(s)`
                        : result.days_until_depletion === null
                          ? "No short-term shortage"
                          : `${result.days_until_depletion} day(s) remaining`}
                    </td>
                    <td
                      style={{
                        ...panelStyles.td,
                        width: panelStyles.detailedColumnWidths.risk,
                      }}
                    >
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

      <details style={panelStyles.detailsBox}>
        <summary style={panelStyles.detailsSummary}>Forecast Run History</summary>
        {isForecastHistoryLoading ? (
          <p style={{ ...panelStyles.emptyState, marginTop: "14px" }}>
            Loading forecast history...
          </p>
        ) : !forecastHistory.length ? (
          <p style={{ ...panelStyles.emptyState, marginTop: "14px" }}>
            No forecast runs have been saved for this disaster event yet.
          </p>
        ) : (
          <div style={{ display: "grid", gap: "10px", marginTop: "14px" }}>
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
                    {run.disaster_event?.title || "Selected disaster event"}
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
      </details>
    </div>
  );
};

export default ForecastingPanel;
