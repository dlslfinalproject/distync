import React, { useEffect, useState } from "react";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import SummaryCards from "../../components/analytics/SummaryCards";
import BarangaySummaryChart from "../../components/analytics/BarangaySummaryChart";
import InventoryAlertsPanel from "../../components/analytics/InventoryAlertsPanel";
import { fetchDescriptiveAnalytics } from "../../features/analytics/analyticsService";

const DescriptiveAnalyticsPage = () => {
  const [dashboardData, setDashboardData] = useState({
    activeDisasterEvent: null,
    summaryCards: [],
    barangaySummary: [],
    commonSectors: [],
    lowStockItems: [],
    totalDistributions: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const loadDashboard = async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const response = await fetchDescriptiveAnalytics();
        setDashboardData(response);
      } catch (error) {
        setErrorMessage(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();
  }, []);

  if (isLoading) {
    return (
      <>
        <PageHeader
          eyebrow="Dashboard"
          title="DESCRIPTIVE ANALYTICS"
          description="Loading current descriptive summary for the active disaster event."
        />
        <section style={shellStyles.card}>
          <p style={shellStyles.mutedText}>Loading dashboard data...</p>
        </section>
      </>
    );
  }

  if (errorMessage) {
    return (
      <>
        <PageHeader
          eyebrow="Dashboard"
          title="DESCRIPTIVE ANALYTICS"
          description="Descriptive summary blocks for households, evacuees, sectors, stock alerts, and distribution activity."
        />
        <section style={shellStyles.card}>
          <p style={{ ...shellStyles.mutedText, color: "#a14d58" }}>
            {errorMessage}
          </p>
        </section>
      </>
    );
  }

  const activeEventLabel = dashboardData.activeDisasterEvent
    ? `${dashboardData.activeDisasterEvent.event_code} - ${dashboardData.activeDisasterEvent.title}`
    : "No active disaster event";

  const isEmpty = !dashboardData.activeDisasterEvent;

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="DESCRIPTIVE ANALYTICS"
        description="Thesis-demo friendly overview of current evacuee, sector, inventory, and distribution summaries."
      />

      <section style={shellStyles.card}>
        <p
          style={{
            margin: 0,
            color: "#6b8298",
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Active Disaster Event
        </p>
        <h3
          style={{
            margin: "10px 0 0",
            color: "#17324d",
            fontSize: "24px",
          }}
        >
          {activeEventLabel}
        </h3>
      </section>

      <SummaryCards cards={dashboardData.summaryCards} isEmpty={isEmpty} />

      {!isEmpty ? (
        <>
          <BarangaySummaryChart
            items={dashboardData.barangaySummary}
            commonSectors={dashboardData.commonSectors}
          />
          <InventoryAlertsPanel
            lowStockItems={dashboardData.lowStockItems}
            totalDistributions={dashboardData.totalDistributions}
          />
        </>
      ) : null}
    </>
  );
};

export default DescriptiveAnalyticsPage;
