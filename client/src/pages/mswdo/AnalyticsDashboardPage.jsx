import React from "react";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import AnalyticsSummaryCards from "../../components/mswdo-analytics/AnalyticsSummaryCards";
import BarangayBarChart from "../../components/mswdo-analytics/BarangayBarChart";
import BarangayStatusBreakdownChart from "../../components/mswdo-analytics/BarangayStatusBreakdownChart";
import DistributionPieChart from "../../components/mswdo-analytics/DistributionPieChart";
import SectorDistributionChart from "../../components/mswdo-analytics/SectorDistributionChart";
import StayTypeChart from "../../components/mswdo-analytics/StayTypeChart";
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

const AnalyticsDashboardPage = () => {
  const {
    disasterEvents,
    barangays,
    selectedDisasterEventId,
    selectedBarangayId,
    selectedDisasterEvent,
    summaryMetrics,
    evacueesPerBarangay,
    householdsPerBarangay,
    sectorDistribution,
    stayTypeDistribution,
    operationalEvacueesPerBarangay,
    operationalFamiliesPerBarangay,
    admittedVsDepartedDistribution,
    barangayStatusBreakdown,
    isLoadingFilters,
    isLoadingDashboard,
    errorMessage,
    hasSelectedEvent,
    hasData,
    hasOperationalData,
    setSelectedDisasterEventId,
    setSelectedBarangayId,
  } = useMswdoAnalytics();

  const activeEventLabel = selectedDisasterEvent
    ? `${selectedDisasterEvent.event_code} - ${selectedDisasterEvent.title}`
    : "No disaster event selected";

  return (
    <>
      <PageHeader
        eyebrow="MSWDO Workspace"
        title="DESCRIPTIVE ANALYTICS DASHBOARD"
        description="Visual summaries for evacuee distribution, household counts, sectors, and stay type patterns based on the selected disaster event."
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
                  {event.event_code} - {event.title}
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

          <div
            style={{
              border: "1px solid #d6e2ef",
              borderRadius: "14px",
              padding: "12px 14px",
              backgroundColor: "#f8fbfe",
              color: "#64809a",
              fontSize: "14px",
            }}
          >
            {activeEventLabel}
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
            No masterlist records were found for the selected disaster event and
            barangay filter.
          </p>
        </section>
      ) : null}

      {hasSelectedEvent && !isLoadingDashboard && !errorMessage && hasData ? (
        <>
          <AnalyticsSummaryCards summaryMetrics={summaryMetrics} />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "20px",
            }}
          >
            <BarangayBarChart
              title="Evacuees per Barangay"
              description="Active evacuee individuals grouped by barangay for the current MSWDO filter scope."
              data={hasOperationalData ? operationalEvacueesPerBarangay : evacueesPerBarangay}
              dataKey="value"
              color="#4f86be"
            />
            <BarangayBarChart
              title="Families per Barangay"
              description="Active household counts by barangay for the selected disaster event view."
              data={hasOperationalData ? operationalFamiliesPerBarangay : householdsPerBarangay}
              dataKey="value"
              color="#7ea7cf"
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "20px",
            }}
          >
            <SectorDistributionChart data={sectorDistribution} />
            <StayTypeChart data={stayTypeDistribution} />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "20px",
            }}
          >
            <DistributionPieChart
              title="Admitted vs Departed Distribution"
              description="Latest-log-per-evacuee distribution of currently admitted versus departed evacuees."
              data={admittedVsDepartedDistribution}
              emptyMessage="No admitted or departed breakdown is available for this view."
            />
            <BarangayStatusBreakdownChart data={barangayStatusBreakdown} />
          </div>
        </>
      ) : null}
    </>
  );
};

export default AnalyticsDashboardPage;
