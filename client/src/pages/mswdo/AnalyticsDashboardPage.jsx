import React, { useState } from "react";
import { FiFileText } from "react-icons/fi";
import PageHeader from "../../components/layout/PageHeader";
import distyncLogo from "../../assets/distync-logo.png";
import { shellStyles } from "../../components/layout/BarangayLayout";
import AverageHouseholdSizeChart from "../../components/mswdo-analytics/AverageHouseholdSizeChart";
import AnalyticsExportModal from "../../components/mswdo-analytics/AnalyticsExportModal";
import BarangayBarChart from "../../components/mswdo-analytics/BarangayBarChart";
import DistributionPieChart from "../../components/mswdo-analytics/DistributionPieChart";
import { useMswdoAnalytics } from "../../features/mswdo-analytics/useMswdoAnalytics";
import { fetchMasterlistOperationalAnalytics } from "../../features/mswdo-analytics/mswdoAnalyticsService";

const filterStyles = {
  field: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1px solid #cfddeb",
    backgroundColor: "#f8fbfe",
    color: "#1f3b57",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  label: {
    display: "block",
    marginBottom: "8px",
    color: "#5f7892",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  exportButton: {
    border: "1px solid #c6d8ea",
    borderRadius: "14px",
    padding: "12px 18px",
    minHeight: "46px",
    backgroundColor: "#f8fbfe",
    color: "#2a4c6f",
    fontSize: "14px",
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },
  exportActionRow: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "-8px",
  },
};

const analyticsGridStyles = {
  donutAndBar: {
    display: "grid",
    gridTemplateColumns: "minmax(260px, 0.65fr) minmax(0, 1.35fr)",
    gap: "20px",
  },
  barAndDonut: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.35fr) minmax(260px, 0.65fr)",
    gap: "20px",
  },
};

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
    ? String(numericValue)
    : numericValue.toFixed(1);
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

const mapSimpleDistributionRows = (items = []) => {
  return (Array.isArray(items) ? items : []).map((item) => ({
    name: item.name || "Unknown",
    value: Number(item.value || 0),
  }));
};

const buildAnalyticsReportHtml = ({
  payload,
  disasterEventName,
  barangayName,
  logoSrc,
  sourceName = "MSWDO",
  reportTitle = "Evacuee Analytics Report",
}) => {
  const summary = payload.summary_metrics || {};
  const charts = payload.charts || {};
  const generatedAt = formatDateTime(new Date().toISOString());
  const metricRows = [
    ["Total Affected Individuals", summary.total_number_of_evacuees_individuals],
    ["Total Affected Families", summary.total_number_of_families],
    ["Average Household Size", summary.average_household_size],
    ["Currently Admitted Evacuees", summary.currently_admitted_evacuees],
    ["Departed Evacuees", summary.total_departed_evacuees],
    ["Barangays Covered", summary.total_barangays_covered],
  ];

  const perBarangayRows = (charts.per_barangay || []).map((item) => ({
    barangayName: item.barangay_name || "Unknown",
    individuals: Number(item.evacuees_count || 0),
    families: Number(item.families_count || 0),
    admitted: Number(item.admitted_evacuees_count || 0),
    departed: Number(item.departed_evacuees_count || 0),
  }));

  const distributionColumns = [
    { label: "Category", render: (item) => item.name },
    { label: "Count", render: (item) => item.value },
  ];

  const tables = [
    buildReportTable({
      title: "Affected Individuals and Families per Barangay",
      rows: perBarangayRows,
      columns: [
        { label: "Barangay", render: (item) => item.barangayName },
        { label: "Affected Individuals", render: (item) => item.individuals },
        { label: "Affected Families", render: (item) => item.families },
        { label: "Admitted Evacuees", render: (item) => item.admitted },
        { label: "Departed Evacuees", render: (item) => item.departed },
      ],
    }),
    buildReportTable({
      title: "Sex Distribution",
      rows: mapSimpleDistributionRows(charts.sex_distribution),
      columns: distributionColumns,
    }),
    buildReportTable({
      title: "Sector and Household Condition Distribution",
      rows: mapSimpleDistributionRows(charts.sector_distribution),
      columns: distributionColumns,
    }),
    buildReportTable({
      title: "Stay Type Distribution",
      rows: mapSimpleDistributionRows(charts.stay_type_distribution),
      columns: distributionColumns,
    }),
    buildReportTable({
      title: "Evacuees per Evacuation Center (Accumulated)",
      rows: mapSimpleDistributionRows(charts.evacuation_center_distribution),
      columns: distributionColumns,
    }),
  ].join("");

  return `
    <!doctype html>
    <html>
      <head>
        <title>Evacuee Analytics Report</title>
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
              <div class="report-source">${escapeHtml(sourceName)}</div>
              <div class="report-location">Municipality of Malvar, Batangas</div>
            </div>
          </div>
          <div class="report-title">${escapeHtml(reportTitle)}</div>
        </header>

        <section class="meta-grid">
          <div class="meta-item">
            <div class="label">Disaster Event</div>
            <div class="value">${escapeHtml(disasterEventName)}</div>
          </div>
          <div class="meta-item">
            <div class="label">Barangay</div>
            <div class="value">${escapeHtml(barangayName)}</div>
          </div>
          <div class="meta-item">
            <div class="label">Generated</div>
            <div class="value">${escapeHtml(generatedAt)}</div>
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

        ${tables}
      </body>
    </html>
  `;
};

const AnalyticsDashboardPage = () => {
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportErrorMessage, setExportErrorMessage] = useState("");
  const {
    disasterEvents,
    barangays,
    allBarangays,
    selectedDisasterEventId,
    selectedBarangayId,
    summaryMetrics,
    evacueesPerBarangay,
    familiesPerBarangay,
    sexDistribution,
    ageBasedSectorDistribution,
    nonAgeBasedSectorDistribution,
    householdConditionDistribution,
    stayTypeDistribution,
    admittedVsDepartedDistribution,
    barangayCoverageDistribution,
    evacuationCenterDistribution,
    isLoadingFilters,
    isLoadingDashboard,
    errorMessage,
    hasSelectedEvent,
    hasData,
    setSelectedDisasterEventId,
    setSelectedBarangayId,
  } = useMswdoAnalytics();
  const evacuationCenterChartHeight = Math.max(
    380,
    evacuationCenterDistribution.length * 54 + 110,
  );

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

  const handleExportAnalytics = async ({ disasterEventId, barangayId }) => {
    if (!disasterEventId) {
      setExportErrorMessage("Disaster event is required.");
      return;
    }

    setIsExporting(true);
    setExportErrorMessage("");

    try {
      const payload = await fetchMasterlistOperationalAnalytics({
        disasterEventId,
        barangayId,
      });
      const disasterEvent = disasterEvents.find(
        (event) => event.id === disasterEventId,
      );
      const barangay = allBarangays.find((item) => item.id === barangayId);
      const reportWindow = window.open("", "_blank");

      if (!reportWindow) {
        setExportErrorMessage(
          "Please allow pop-ups to open the printable analytics report.",
        );
        return;
      }

      reportWindow.document.open();
      reportWindow.document.write(
        buildAnalyticsReportHtml({
          payload,
          disasterEventName:
            disasterEvent?.title || payload.disaster_event?.title || "Selected disaster event",
          barangayName: barangay?.name || "All barangays",
          logoSrc: distyncLogo,
          sourceName: "MSWDO",
          reportTitle: "Evacuee Analytics Report",
        }),
      );
      reportWindow.document.close();
      reportWindow.focus();
      reportWindow.onload = () => {
        reportWindow.print();
      };

      setIsExportModalOpen(false);
    } catch (error) {
      setExportErrorMessage(error.message || "Failed to export analytics report.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <PageHeader title="EVACUEE ANALYTICS DASHBOARD" />

      <section style={shellStyles.card}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            alignItems: "end",
          }}
        >
          <div>
            <label htmlFor="analytics-disaster-event" style={filterStyles.label}>
              Disaster Event
            </label>
            <select
              id="analytics-disaster-event"
              value={selectedDisasterEventId}
              onChange={(event) => setSelectedDisasterEventId(event.target.value)}
              disabled={isLoadingFilters}
              style={filterStyles.field}
            >
              <option value="">Select disaster event</option>
              {disasterEvents.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="analytics-barangay" style={filterStyles.label}>
              Barangay
            </label>
            <select
              id="analytics-barangay"
              value={selectedBarangayId}
              onChange={(event) => setSelectedBarangayId(event.target.value)}
              disabled={isLoadingFilters}
              style={filterStyles.field}
            >
              <option value="">All barangays</option>
              {barangays.map((barangay) => (
                <option key={barangay.id} value={barangay.id}>
                  {barangay.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <div style={filterStyles.exportActionRow}>
        <button
          type="button"
          onClick={handleOpenExportModal}
          disabled={!hasSelectedEvent || isLoadingFilters || isLoadingDashboard}
          style={{
            ...filterStyles.exportButton,
            cursor:
              !hasSelectedEvent || isLoadingFilters || isLoadingDashboard
                ? "not-allowed"
                : "pointer",
            opacity:
              !hasSelectedEvent || isLoadingFilters || isLoadingDashboard ? 0.7 : 1,
          }}
        >
          <FiFileText size={16} />
          Export
        </button>
      </div>

      {!hasSelectedEvent ? (
        <section style={shellStyles.card}>
          <h3 style={{ marginTop: 0, color: "#17324d" }}>No Event Selected</h3>
          <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
            Select a disaster event to load the descriptive analytics dashboard.
          </p>
        </section>
      ) : null}

      {hasSelectedEvent && (isLoadingFilters || isLoadingDashboard) ? (
        <section style={shellStyles.card}>
          <h3 style={{ marginTop: 0, color: "#17324d" }}>Loading Dashboard</h3>
          <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
            Preparing analytics summaries and charts...
          </p>
        </section>
      ) : null}

      {hasSelectedEvent && !isLoadingDashboard && errorMessage ? (
        <section style={shellStyles.card}>
          <h3 style={{ marginTop: 0, color: "#17324d" }}>Dashboard Error</h3>
          <p style={{ ...shellStyles.mutedText, marginTop: "10px", color: "#a14d58" }}>
            {errorMessage}
          </p>
        </section>
      ) : null}

      {hasSelectedEvent && !isLoadingDashboard && !errorMessage && !hasData ? (
        <section style={shellStyles.card}>
          <h3 style={{ marginTop: 0, color: "#17324d" }}>No Analytics Data</h3>
          <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
            No matching records found. Try adjusting your search or filters.
          </p>
        </section>
      ) : null}

      {hasSelectedEvent && !isLoadingDashboard && !errorMessage && hasData ? (
        <>
          <div style={analyticsGridStyles.donutAndBar}>
            <DistributionPieChart
              title="Barangays Covered"
              data={barangayCoverageDistribution}
              colors={["#2f6499", "#cbd5e1"]}
              highlightHighest={false}
            />
            <BarangayBarChart
              title="Affected Families per Barangay"
              data={familiesPerBarangay}
              dataKey="value"
            />
          </div>

          <div style={analyticsGridStyles.donutAndBar}>
            <AverageHouseholdSizeChart
              value={summaryMetrics.averageHouseholdSize}
            />
            <BarangayBarChart
              title="Affected Individuals per Barangay"
              data={evacueesPerBarangay}
              dataKey="value"
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "20px",
            }}
          >
            <DistributionPieChart
              title="Sex Distribution"
              data={sexDistribution}
              colors={["#2f6499", "#d977a8", "#94a3b8"]}
              highlightHighest={false}
              colorMap={{
                Male: "#2f6499",
                Female: "#d977a8",
              }}
            />
            <DistributionPieChart
              title="Age-Based Sector Distribution"
              data={ageBasedSectorDistribution}
              innerRadius={0}
            />
            <DistributionPieChart
              title="Non-Age-Based Sector Distribution"
              data={nonAgeBasedSectorDistribution}
              innerRadius={0}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "20px",
            }}
          >
            <DistributionPieChart
              title="Household Conditions"
              data={householdConditionDistribution}
              innerRadius={0}
            />
            <DistributionPieChart
              title="Stay Type Distribution"
              data={stayTypeDistribution}
              colors={["#2f6499", "#14b8a6", "#f59e0b", "#7c8fd6"]}
              innerRadius={0}
            />
            <DistributionPieChart
              title="Evacuation Status"
              data={admittedVsDepartedDistribution}
              colors={["#2f6499", "#cbd5e1"]}
              colorMap={{
                Admitted: "#2f6499",
                Departed: "#cbd5e1",
              }}
              highlightHighest={false}
              innerRadius={0}
            />
          </div>

          <BarangayBarChart
            title="Evacuees per Evacuation Center (Accumulated)"
            data={evacuationCenterDistribution}
            dataKey="value"
            height={evacuationCenterChartHeight}
          />
        </>
      ) : null}

      <AnalyticsExportModal
        isOpen={isExportModalOpen}
        isSubmitting={isExporting}
        disasterEvents={disasterEvents}
        barangays={allBarangays}
        selectedDisasterEventId={selectedDisasterEventId}
        selectedBarangayId={selectedBarangayId}
        errorMessage={exportErrorMessage}
        onClose={handleCloseExportModal}
        onSubmit={handleExportAnalytics}
      />
    </>
  );
};

export default AnalyticsDashboardPage;
