import React, { useState } from "react";
import PageHeader from "../../components/layout/PageHeader";
import { pageSpacingStyles } from "../../components/layout/BarangayLayout";
import distyncLogo from "../../assets/distync-logo.png";
import ForecastingPanel from "../../components/inventory-items/ForecastingPanel";
import InventoryForecastExportModal from "../../components/inventory-items/InventoryForecastExportModal";
import { useInventoryForecast } from "../../features/inventory-items/useInventoryForecast";
import { runInventoryForecast } from "../../features/inventory-items/inventoryItemService";
import {
  forecastModelOptions,
  getForecastModelLabel,
} from "../../features/inventory-items/inventoryItemExportOptions";

const formatDateTime = (value) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(date);
};

const formatDate = (value) => {
  if (!value) {
    return "-";
  }

  const parsedDate = String(value).includes("T")
    ? new Date(value)
    : new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "Asia/Manila",
  }).format(parsedDate);
};

const escapeHtml = (value) => {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};

const formatNumber = (value) => {
  const numericValue = Number(value || 0);
  return Number.isInteger(numericValue)
    ? new Intl.NumberFormat().format(numericValue)
    : new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(
        numericValue,
      );
};

const pieceUnitLabels = new Set(["pc", "pcs", "piece", "pieces", "unit", "units"]);

const isPieceBasedUnit = (unitOfMeasure) =>
  pieceUnitLabels.has(String(unitOfMeasure || "").trim().toLowerCase());

const formatForecastQuantity = (value, unitOfMeasure, { roundUp = false } = {}) => {
  const numericValue = Number(value || 0);
  const displayValue = isPieceBasedUnit(unitOfMeasure)
    ? roundUp
      ? Math.ceil(Math.max(numericValue, 0))
      : Math.round(numericValue)
    : numericValue;

  return `${formatNumber(displayValue)} ${unitOfMeasure || "units"}`;
};

const mapTableRows = (items = [], columns = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    return `
      <tr>
        <td colspan="${columns.length}" class="empty-cell">No data available.</td>
      </tr>
    `;
  }

  return items
    .map(
      (item) => `
        <tr>
          ${columns
            .map((column) => `<td>${escapeHtml(column.render(item))}</td>`)
            .join("")}
        </tr>
      `,
    )
    .join("");
};

const buildReportTable = ({ title, columns, rows }) => `
  <section class="report-section">
    <h2>${escapeHtml(title)}</h2>
    <table>
      <thead>
        <tr>
          ${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${mapTableRows(rows, columns)}
      </tbody>
    </table>
  </section>
`;

const buildHorizontalBarRows = ({
  rows = [],
  valueKey,
  labelKey,
  valueFormatter = formatNumber,
  color = "#2f6499",
}) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  const maxValue = Math.max(
    ...safeRows.map((row) => Number(row?.[valueKey] || 0)),
    1,
  );

  if (!safeRows.length) {
    return `<p class="empty-chart">No chart data available.</p>`;
  }

  return safeRows
    .map((row) => {
      const value = Number(row?.[valueKey] || 0);
      const width = Math.max(4, Math.min(100, (value / maxValue) * 100));

      return `
        <div class="bar-row">
          <div class="bar-label">${escapeHtml(row?.[labelKey] || "Unknown")}</div>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${width}%; background: ${color};"></div>
          </div>
          <div class="bar-value">${escapeHtml(valueFormatter(value, row))}</div>
        </div>
      `;
    })
    .join("");
};

const buildStockLevelRows = (rows = []) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  const maxValue = Math.max(
    ...safeRows.map((row) =>
      Math.max(
        Number(row.current_available_stock || 0),
        Number(row.projected_remaining_stock || 0),
      ),
    ),
    1,
  );

  if (!safeRows.length) {
    return `<p class="empty-chart">No chart data available.</p>`;
  }

  return safeRows
    .map((row) => {
      const currentStock = Number(row.current_available_stock || 0);
      const remainingStock = Number(row.projected_remaining_stock || 0);
      const currentWidth = Math.max(4, Math.min(100, (currentStock / maxValue) * 100));
      const remainingWidth = Math.max(
        4,
        Math.min(100, (remainingStock / maxValue) * 100),
      );

      return `
        <div class="stock-row">
          <div class="bar-label">${escapeHtml(row.item_name || "Unknown")}</div>
          <div class="stock-bars">
            <div class="paired-bar">
              <span>Current</span>
              <div class="bar-track">
                <div class="bar-fill" style="width: ${currentWidth}%; background: #2f6499;"></div>
              </div>
              <strong>${escapeHtml(formatForecastQuantity(currentStock, row.unit_of_measure))}</strong>
            </div>
            <div class="paired-bar">
              <span>After</span>
              <div class="bar-track">
                <div class="bar-fill" style="width: ${remainingWidth}%; background: #2f8a57;"></div>
              </div>
              <strong>${escapeHtml(formatForecastQuantity(remainingStock, row.unit_of_measure))}</strong>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
};

const buildUsageSummary = (rows = []) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  const totalUsed = safeRows.reduce(
    (sum, row) => sum + Number(row.total_quantity || 0),
    0,
  );
  const activeDays = safeRows.filter(
    (row) => Number(row.total_quantity || 0) > 0,
  ).length;
  const averageDailyUse =
    safeRows.length > 0 ? totalUsed / safeRows.length : 0;
  const peakRow = safeRows.reduce((highest, row) => {
    return Number(row.total_quantity || 0) > Number(highest.total_quantity || 0)
      ? row
      : highest;
  }, safeRows[0] || {});

  return {
    totalUsed,
    activeDays,
    averageDailyUse,
    peakDate: peakRow?.usage_date || null,
    peakQuantity: Number(peakRow?.total_quantity || 0),
  };
};

const buildUsageTrendRows = (rows = []) => {
  const safeRows = Array.isArray(rows) ? rows : [];

  if (!safeRows.length) {
    return `
      <tr>
        <td colspan="3" class="empty-cell">No recent inventory usage records are available.</td>
      </tr>
    `;
  }

  return safeRows
    .map((row) => {
      const totalQuantity = Number(row.total_quantity || 0);
      const activityLabel = totalQuantity > 0 ? "Usage recorded" : "No usage";

      return `
        <tr>
          <td>${escapeHtml(formatDate(row.usage_date))}</td>
          <td>${escapeHtml(formatNumber(totalQuantity))}</td>
          <td>${escapeHtml(activityLabel)}</td>
        </tr>
      `;
    })
    .join("");
};

const buildReportCharts = ({ dashboard }) => {
  const charts = dashboard?.charts || {};
  const demandRows = charts.forecasted_demand || [];
  const stockRows = charts.projected_stock_levels || [];
  const usageRows = (charts.inventory_usage_trend || []).slice(-14);
  const usageSummary = buildUsageSummary(usageRows);

  return `
    <section class="first-page-chart">
      <div class="chart-card top-needs-card">
        <h2>Top Forecasted Needs</h2>
        ${buildHorizontalBarRows({
          rows: demandRows,
          valueKey: "forecasted_usage",
          labelKey: "item_name",
          valueFormatter: (value, row) =>
            formatForecastQuantity(value, row.unit_of_measure, { roundUp: true }),
          color: "#cf7d2d",
        })}
      </div>
    </section>

    <section class="report-page stock-page">
      <div class="chart-card full-page-card">
        <h2>Stock After Forecast</h2>
        ${buildStockLevelRows(stockRows)}
      </div>
    </section>

    <section class="report-page usage-page">
      <div class="chart-card full-page-card">
        <h2>Recent Inventory Usage</h2>
        <p class="chart-note">
          This shows how much inventory was released during the last 14 recorded days for the selected disaster event. Days with zero usage mean no inventory release was recorded on that date.
        </p>
        <div class="usage-summary-grid">
          <div class="usage-summary-card">
            <div class="label">Total Used</div>
            <div class="value">${escapeHtml(formatNumber(usageSummary.totalUsed))}</div>
          </div>
          <div class="usage-summary-card">
            <div class="label">Daily Average</div>
            <div class="value">${escapeHtml(formatNumber(usageSummary.averageDailyUse))}</div>
          </div>
          <div class="usage-summary-card">
            <div class="label">Peak Day</div>
            <div class="value">${escapeHtml(formatDate(usageSummary.peakDate))}</div>
          </div>
          <div class="usage-summary-card">
            <div class="label">Peak Quantity</div>
            <div class="value">${escapeHtml(formatNumber(usageSummary.peakQuantity))}</div>
          </div>
          <div class="usage-summary-card">
            <div class="label">Days With Usage</div>
            <div class="value">${escapeHtml(`${usageSummary.activeDays} of ${usageRows.length}`)}</div>
          </div>
        </div>
        <table class="usage-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Total Quantity Used</th>
              <th>Activity</th>
            </tr>
          </thead>
          <tbody>
            ${buildUsageTrendRows(usageRows)}
          </tbody>
        </table>
      </div>
    </section>
  `;
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

const buildInventoryForecastReportHtml = ({
  payload,
  disasterEventName,
  logoSrc,
}) => {
  const dashboard = payload?.dashboard || {};
  const summary = dashboard.summary || {};
  const forecastRun = payload?.forecast_run || {};
  const results = Array.isArray(payload?.results) ? payload.results : [];
  const generatedAt = formatDateTime(new Date().toISOString());
  const runAt = formatDateTime(forecastRun.run_at);
  const modelLabel = getForecastModelLabel(forecastRun.model_name);
  const priorityRows = [...results].sort((left, right) => {
    const riskDifference =
      getRiskPriority(right.risk_level) - getRiskPriority(left.risk_level);

    if (riskDifference !== 0) {
      return riskDifference;
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
  const stockPriorityRows = priorityRows.filter(
    (row) =>
      Number(row.recommended_reorder_quantity || 0) > 0 ||
      Number(row.forecasted_usage || 0) > 0 ||
      String(row.risk_level || "").toUpperCase() !== "LOW",
  );
  const displayedPriorityRows =
    stockPriorityRows.length > 0 ? stockPriorityRows : priorityRows.slice(0, 10);
  const metricRows = [
    ["Items Checked", results.length],
    ["Needs Restock", summary.shortage_item_count],
    ["Recommended Restock", Math.ceil(Number(summary.total_recommended_reorder || 0))],
    ["7-Day Risk", summary.seven_day_shortage_count],
    ["Eligible Families", summary.eligible_household_count],
    ["Not Yet Received", summary.unclaimed_eligible_household_count],
  ];

  const tables = [
    buildReportTable({
      title: "Stock-Up Priorities",
      rows: displayedPriorityRows,
      columns: [
        { label: "Item Name", render: (item) => item.item_name },
        {
          label: "Current Stock",
          render: (item) =>
            formatForecastQuantity(
              item.current_available_stock,
              item.unit_of_measure,
            ),
        },
        {
          label: "Forecast Need",
          render: (item) =>
            formatForecastQuantity(item.forecasted_usage, item.unit_of_measure, {
              roundUp: true,
            }),
        },
        {
          label: "Add Stock",
          render: (item) =>
            formatForecastQuantity(
              item.recommended_reorder_quantity,
              item.unit_of_measure,
              { roundUp: true },
            ),
        },
        {
          label: "After Forecast",
          render: (item) =>
            formatForecastQuantity(
              item.projected_remaining_stock,
              item.unit_of_measure,
            ),
        },
        { label: "Risk", render: (item) => item.risk_level || "LOW" },
      ],
    }),
    buildReportTable({
      title: "Detailed Forecast Results by Item",
      rows: priorityRows,
      columns: [
        { label: "Item Name", render: (item) => item.item_name },
        {
          label: "Assigned Pack Demand",
          render: (item) =>
            formatForecastQuantity(
              item.projected_household_demand,
              item.unit_of_measure,
              { roundUp: true },
            ),
        },
        {
          label: "Forecast Need",
          render: (item) =>
            formatForecastQuantity(item.forecasted_usage, item.unit_of_measure, {
              roundUp: true,
            }),
        },
        {
          label: "Recommended Restock",
          render: (item) =>
            formatForecastQuantity(
              item.recommended_reorder_quantity,
              item.unit_of_measure,
              { roundUp: true },
            ),
        },
        {
          label: "Projected Depletion",
          render: (item) => formatDate(item.projected_depletion_date),
        },
        {
          label: "Shortage",
          render: (item) =>
            item.shortage_within_seven_days
              ? `Shortage in ${item.days_until_depletion || 0} day(s)`
              : item.days_until_depletion === null
                ? "No short-term shortage"
                : `${item.days_until_depletion} day(s) remaining`,
        },
        { label: "Risk", render: (item) => item.risk_level || "LOW" },
      ],
    }),
  ].join("");
  const reportCharts = buildReportCharts({ dashboard });

  return `
    <!doctype html>
    <html>
      <head>
        <title>Inventory Forecasting Report</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 14mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            margin: 0;
            color: #082b4d;
            font-family: Arial, sans-serif;
            font-size: 12px;
            line-height: 1.45;
          }
          .report-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 18px;
            margin-bottom: 18px;
            padding: 18px 22px;
            background: #17395f;
            color: #ffffff;
          }
          .report-identity {
            display: flex;
            align-items: center;
            gap: 16px;
            min-width: 0;
          }
          .report-logo {
            width: 64px;
            height: 64px;
            object-fit: contain;
            flex: 0 0 auto;
            padding: 8px;
            background: #ffffff;
          }
          .brand {
            font-size: 28px;
            font-weight: 800;
            letter-spacing: 0.02em;
            line-height: 1;
          }
          .report-source {
            margin-top: 6px;
            font-size: 18px;
            font-weight: 800;
            line-height: 1.1;
          }
          .report-location {
            margin-top: 4px;
            font-size: 14px;
            font-weight: 700;
            line-height: 1.2;
          }
          .report-title {
            max-width: 45%;
            font-size: 18px;
            font-weight: 800;
            text-align: right;
            line-height: 1.25;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin-bottom: 18px;
          }
          .meta-item,
          .metric-card {
            border: 1px solid #d7e2ef;
            border-radius: 10px;
            padding: 10px;
            background: #f8fbfe;
          }
          .label {
            color: #5f7892;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }
          .value {
            margin-top: 4px;
            font-size: 13px;
            font-weight: 700;
          }
          .metrics {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin-bottom: 18px;
          }
          .metric-card .value {
            font-size: 20px;
            color: #17324d;
          }
          .report-section {
            margin-bottom: 18px;
            page-break-inside: avoid;
          }
          .first-page-chart {
            margin-bottom: 18px;
          }
          .report-page {
            break-before: page;
            page-break-before: always;
            margin-bottom: 18px;
          }
          .chart-card {
            border: 1px solid #d7e2ef;
            border-radius: 10px;
            padding: 12px;
            background: #ffffff;
            page-break-inside: avoid;
          }
          .top-needs-card {
            min-height: 260px;
          }
          .full-page-card {
            min-height: 920px;
          }
          .bar-row,
          .stock-row {
            display: grid;
            gap: 5px;
            margin-top: 9px;
          }
          .bar-label {
            color: #17324d;
            font-size: 11px;
            font-weight: 700;
            overflow-wrap: anywhere;
          }
          .bar-track {
            width: 100%;
            height: 10px;
            border-radius: 999px;
            background: #edf4fb;
            overflow: hidden;
          }
          .bar-fill {
            height: 100%;
            border-radius: 999px;
          }
          .bar-value {
            color: #5f7892;
            font-size: 10px;
            font-weight: 700;
          }
          .stock-bars {
            display: grid;
            gap: 5px;
          }
          .paired-bar {
            display: grid;
            grid-template-columns: 44px 1fr 76px;
            gap: 8px;
            align-items: center;
            color: #5f7892;
            font-size: 10px;
          }
          .paired-bar strong {
            color: #17324d;
            font-size: 10px;
            text-align: right;
          }
          .empty-chart {
            margin: 8px 0 0;
            color: #5f7892;
            font-size: 12px;
          }
          .chart-note {
            margin: 0 0 12px;
            color: #5f7892;
            font-size: 12px;
            line-height: 1.5;
          }
          .usage-summary-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin-bottom: 14px;
          }
          .usage-summary-card {
            border: 1px solid #d7e2ef;
            border-radius: 10px;
            padding: 10px;
            background: #f8fbfe;
          }
          .usage-summary-card .value {
            font-size: 16px;
            color: #17324d;
          }
          .usage-table {
            margin-top: 10px;
          }
          h2 {
            margin: 0 0 8px;
            color: #17324d;
            font-size: 15px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }
          th {
            background: #2f6499;
            color: #ffffff;
            font-size: 10px;
            letter-spacing: 0.04em;
            text-transform: uppercase;
          }
          th,
          td {
            border: 1px solid #d7e2ef;
            padding: 8px;
            text-align: left;
            vertical-align: top;
            overflow-wrap: anywhere;
          }
          tr:nth-child(even) td {
            background: #f8fbfe;
          }
          .empty-cell {
            color: #5f7892;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <header class="report-header">
          <div class="report-identity">
            <img class="report-logo" src="${escapeHtml(logoSrc)}" alt="DISTYNC logo" />
            <div>
              <div class="brand">DISTYNC</div>
              <div class="report-source">MAYOR</div>
              <div class="report-location">Municipality of Malvar, Batangas</div>
            </div>
          </div>
          <div class="report-title">Inventory Forecasting Report</div>
        </header>

        <section class="meta-grid">
          <div class="meta-item">
            <div class="label">Disaster Event</div>
            <div class="value">${escapeHtml(disasterEventName)}</div>
          </div>
          <div class="meta-item">
            <div class="label">Forecast Model</div>
            <div class="value">${escapeHtml(modelLabel)}</div>
          </div>
          <div class="meta-item">
            <div class="label">Generated</div>
            <div class="value">${escapeHtml(generatedAt)}</div>
          </div>
          <div class="meta-item">
            <div class="label">Forecast Run</div>
            <div class="value">${escapeHtml(runAt)}</div>
          </div>
          <div class="meta-item">
            <div class="label">Forecast Horizon</div>
            <div class="value">${escapeHtml(forecastRun.parameters_json?.forecast_horizon_days || 14)} days</div>
          </div>
          <div class="meta-item">
            <div class="label">Lookback</div>
            <div class="value">${escapeHtml(forecastRun.parameters_json?.lookback_days || 30)} days</div>
          </div>
        </section>

        <section class="metrics">
          ${metricRows
            .map(
              ([label, value]) => `
                <div class="metric-card">
                  <div class="label">${escapeHtml(label)}</div>
                  <div class="value">${escapeHtml(formatNumber(value))}</div>
                </div>
              `,
            )
            .join("")}
        </section>

        ${reportCharts}

        ${tables}
      </body>
    </html>
  `;
};

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
      const response = await runInventoryForecast({
        disaster_event_id: disasterEventId,
        model_name: selectedForecastModel,
      });
      const payload = response?.data || null;

      const disasterEvent = forecastEvents.find(
        (event) => event.id === disasterEventId,
      );
      const reportWindow = window.open("", "_blank");

      if (!reportWindow) {
        setExportErrorMessage(
          "Please allow pop-ups to open the printable inventory forecasting report.",
        );
        return;
      }

      reportWindow.document.open();
      reportWindow.document.write(
        buildInventoryForecastReportHtml({
          payload,
          disasterEventName:
            disasterEvent?.title ||
            payload.forecast_run?.disaster_event?.title ||
            payload.dashboard?.disaster_event?.title ||
            "Selected disaster event",
          logoSrc: distyncLogo,
        }),
      );
      reportWindow.document.close();
      reportWindow.focus();
      reportWindow.onload = () => {
        reportWindow.print();
      };

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
        forecastSuccessMessage={forecastSuccessMessage}
        forecastErrorMessage={forecastErrorMessage}
        isForecastContextLoading={isForecastContextLoading}
        isForecastLoading={isForecastLoading}
        isRunningForecast={isRunningForecast}
        isForecastHistoryLoading={isForecastHistoryLoading}
        isForecastHistoryDetailLoading={isForecastHistoryDetailLoading}
        getForecastModelLabel={getForecastModelLabel}
        onOpenExportModal={handleOpenExportModal}
        onForecastEventChange={setSelectedForecastEventId}
        onForecastModelChange={setSelectedForecastModel}
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
