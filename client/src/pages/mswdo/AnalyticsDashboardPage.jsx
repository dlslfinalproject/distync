import React from "react";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import AverageHouseholdSizeChart from "../../components/mswdo-analytics/AverageHouseholdSizeChart";
import BarangayBarChart from "../../components/mswdo-analytics/BarangayBarChart";
import DistributionPieChart from "../../components/mswdo-analytics/DistributionPieChart";
import { useMswdoAnalytics } from "../../features/mswdo-analytics/useMswdoAnalytics";

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

const AnalyticsDashboardPage = () => {
  const {
    disasterEvents,
    barangays,
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

  return (
    <>
      <PageHeader
        title="EVACUEE ANALYTICS DASHBOARD"
      />

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
    </>
  );
};

export default AnalyticsDashboardPage;
