import React, { useEffect, useMemo, useState } from "react";
import { FiFileText } from "react-icons/fi";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import AverageHouseholdSizeChart from "../../components/mswdo-analytics/AverageHouseholdSizeChart";
import AnalyticsExportModal from "../../components/mswdo-analytics/AnalyticsExportModal";
import BarangayBarChart from "../../components/mswdo-analytics/BarangayBarChart";
import DistributionPieChart from "../../components/mswdo-analytics/DistributionPieChart";
import {
  BARANGAY_CHART_COLORS,
  BARANGAY_CHART_HIGHLIGHT_COLOR,
  getBarangayChartColorMap,
} from "../../components/mswdo-analytics/barangayChartColors.mjs";
import { useMswdoAnalytics } from "../../features/mswdo-analytics/useMswdoAnalytics";
import { useRememberedInitialLoading } from "../../utils/rememberedPageLoading";
import { exportMasterlistOperationalAnalytics } from "../../features/mswdo-analytics/mswdoAnalyticsService";
import { downloadExportFile } from "../../utils/exportHelpers";

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
    minWidth: 0,
  },
  barAndDonut: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.35fr) minmax(260px, 0.65fr)",
    gap: "20px",
    minWidth: 0,
  },
  distributionCards: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "20px",
    minWidth: 0,
  },
};

const getViewportWidth = () => {
  return typeof window === "undefined" ? 1440 : window.innerWidth;
};

const useAnalyticsViewport = () => {
  const [viewportWidth, setViewportWidth] = useState(getViewportWidth);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return {
    viewportWidth,
    isNarrow: viewportWidth <= 640,
    isTablet: viewportWidth <= 1024,
  };
};

const AnalyticsDashboardPage = () => {
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportErrorMessage, setExportErrorMessage] = useState("");
  const { isNarrow, isTablet } = useAnalyticsViewport();
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
    barangayCoverageCount,
    evacuationCenterDistribution,
    isInitialLoadingFilters: baseIsInitialLoadingFilters,
    isInitialLoadingDashboard: baseIsInitialLoadingDashboard,
    errorMessage,
    hasSelectedEvent,
    hasData,
    setSelectedDisasterEventId,
    setSelectedBarangayId,
  } = useMswdoAnalytics();
  const shouldShowInitialLoading = useRememberedInitialLoading({
    pageKey: "mswdo:analytics",
    isLoading:
      baseIsInitialLoadingFilters || baseIsInitialLoadingDashboard,
    errorMessage,
  });
  const isInitialLoadingFilters =
    baseIsInitialLoadingFilters && shouldShowInitialLoading;
  const isInitialLoadingDashboard =
    baseIsInitialLoadingDashboard && shouldShowInitialLoading;
  const evacuationCenterChartHeight = Math.max(
    isNarrow ? 340 : 380,
    evacuationCenterDistribution.length * (isNarrow ? 46 : 54) + 110,
  );
  const barangayCoverageColorMap = useMemo(() => {
    const colorMap = getBarangayChartColorMap({
      sourceData: familiesPerBarangay,
      targetData: barangayCoverageDistribution,
    });

    if (barangayCoverageDistribution.some((item) => item.name === "Covered")) {
      colorMap.Covered = BARANGAY_CHART_HIGHLIGHT_COLOR;
    }

    if (barangayCoverageDistribution.some((item) => item.name === "Not Covered")) {
      colorMap["Not Covered"] = "#cbd5e1";
    }

    if (selectedBarangayId) {
      const selectedCoverage = barangayCoverageDistribution.find(
        (item) => String(item.barangay_id) === String(selectedBarangayId),
      );

      if (selectedCoverage) {
        const selectedColor =
          colorMap[selectedCoverage.name] || BARANGAY_CHART_HIGHLIGHT_COLOR;

        barangayCoverageDistribution.forEach((item) => {
          colorMap[item.name] =
            String(item.barangay_id) === String(selectedBarangayId)
              ? selectedColor
              : "#d5dee8";
        });
      }
    }

    return colorMap;
  }, [barangayCoverageDistribution, familiesPerBarangay, selectedBarangayId]);
  const filterGridStyle = useMemo(
    () => ({
      display: "grid",
      gridTemplateColumns: isNarrow
        ? "minmax(0, 1fr)"
        : "repeat(auto-fit, minmax(220px, 1fr))",
      gap: isNarrow ? "14px" : "16px",
      alignItems: "end",
      minWidth: 0,
    }),
    [isNarrow],
  );
  const exportActionRowStyle = useMemo(
    () => ({
      ...filterStyles.exportActionRow,
      justifyContent: isNarrow ? "stretch" : filterStyles.exportActionRow.justifyContent,
      marginTop: isNarrow ? "-4px" : filterStyles.exportActionRow.marginTop,
    }),
    [isNarrow],
  );
  const exportButtonStyle = useMemo(
    () => ({
      ...filterStyles.exportButton,
      width: isNarrow ? "100%" : "auto",
      cursor:
        !hasSelectedEvent || isInitialLoadingFilters || isInitialLoadingDashboard
          ? "not-allowed"
          : "pointer",
      opacity:
        !hasSelectedEvent || isInitialLoadingFilters || isInitialLoadingDashboard
          ? 0.7
          : 1,
    }),
    [hasSelectedEvent, isInitialLoadingDashboard, isInitialLoadingFilters, isNarrow],
  );
  const mixedChartGridStyle = useMemo(
    () => ({
      ...analyticsGridStyles.donutAndBar,
      gridTemplateColumns: isTablet
        ? "minmax(0, 1fr)"
        : analyticsGridStyles.donutAndBar.gridTemplateColumns,
      gap: isNarrow ? "16px" : analyticsGridStyles.donutAndBar.gap,
    }),
    [isNarrow, isTablet],
  );
  const distributionGridStyle = useMemo(
    () => ({
      ...analyticsGridStyles.distributionCards,
      gridTemplateColumns: isTablet
        ? "minmax(0, 1fr)"
        : analyticsGridStyles.distributionCards.gridTemplateColumns,
      gap: isNarrow ? "16px" : analyticsGridStyles.distributionCards.gap,
    }),
    [isNarrow, isTablet],
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
      const file = await exportMasterlistOperationalAnalytics({
        disasterEventId,
        barangayId,
      });

      downloadExportFile(file);

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
        <div style={filterGridStyle}>
          <div>
            <label htmlFor="analytics-disaster-event" style={filterStyles.label}>
              Disaster Event
            </label>
            <select
              id="analytics-disaster-event"
              value={selectedDisasterEventId}
              onChange={(event) => setSelectedDisasterEventId(event.target.value)}
              disabled={isInitialLoadingFilters}
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
              disabled={isInitialLoadingFilters}
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

      <div className="mswdo-analytics-export-row" style={exportActionRowStyle}>
        <button
          className="mswdo-analytics-export-button"
          type="button"
          onClick={handleOpenExportModal}
          disabled={!hasSelectedEvent || isInitialLoadingFilters || isInitialLoadingDashboard}
          style={exportButtonStyle}
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

      {hasSelectedEvent && (isInitialLoadingFilters || isInitialLoadingDashboard) ? (
        <section style={shellStyles.card}>
          <h3 style={{ marginTop: 0, color: "#17324d" }}>Loading Dashboard</h3>
          <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
            Preparing analytics summaries and charts...
          </p>
        </section>
      ) : null}

      {hasSelectedEvent && !isInitialLoadingDashboard && errorMessage ? (
        <section style={shellStyles.card}>
          <h3 style={{ marginTop: 0, color: "#17324d" }}>Dashboard Error</h3>
          <p style={{ ...shellStyles.mutedText, marginTop: "10px", color: "#a14d58" }}>
            {errorMessage}
          </p>
        </section>
      ) : null}

      {hasSelectedEvent && !isInitialLoadingDashboard && !errorMessage && !hasData ? (
        <section style={shellStyles.card}>
          <h3 style={{ marginTop: 0, color: "#17324d" }}>No Analytics Data</h3>
          <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
            No matching records found. Try adjusting your search or filters.
          </p>
        </section>
      ) : null}

      {hasSelectedEvent && !isInitialLoadingDashboard && !errorMessage && hasData ? (
        <>
          <div style={mixedChartGridStyle}>
            <DistributionPieChart
              title="Barangays Covered"
              data={barangayCoverageDistribution}
              colors={BARANGAY_CHART_COLORS}
              colorMap={barangayCoverageColorMap}
              highlightHighest={false}
              showSliceLabels={false}
              showLegend={false}
              centerValue={barangayCoverageCount}
              centerLabel="Covered Barangays"
              outerRadius={120}
              mobileOuterRadius={104}
              innerRadius={76}
              mobileInnerRadius={64}
            />
            <BarangayBarChart
              title="Affected Families per Barangay"
              data={familiesPerBarangay}
              dataKey="value"
            />
          </div>

          <div style={mixedChartGridStyle}>
            <AverageHouseholdSizeChart
              value={summaryMetrics.averageHouseholdSize}
            />
            <BarangayBarChart
              title="Affected Individuals per Barangay"
              data={evacueesPerBarangay}
              dataKey="value"
            />
          </div>

          <div style={distributionGridStyle}>
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
            <DistributionPieChart
              title="Household Conditions"
              data={householdConditionDistribution}
              innerRadius={0}
            />
          </div>

          <div style={distributionGridStyle}>
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
