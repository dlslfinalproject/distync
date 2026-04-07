import React from "react";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import MswdoHouseholdDetailModal from "../../components/mswdo-masterlist/MswdoHouseholdDetailModal";
import MswdoMasterlistTable from "../../components/mswdo-masterlist/MswdoMasterlistTable";
import MswdoMasterlistToolbar from "../../components/mswdo-masterlist/MswdoMasterlistToolbar";
import MswdoSummaryCards from "../../components/mswdo-masterlist/MswdoSummaryCards";
import { useMswdoMasterlist } from "../../features/mswdo-masterlist/useMswdoMasterlist";

const ConsolidatedMasterlistPage = () => {
  const {
    disasterEvents,
    barangays,
    selectedDisasterEventId,
    selectedBarangayId,
    selectedDisasterEvent,
    searchTerm,
    displayedRows,
    summary,
    selectedHousehold,
    isDetailOpen,
    isLoadingFilters,
    isLoadingMasterlist,
    errorMessage,
    setSelectedDisasterEventId,
    setSelectedBarangayId,
    setSearchTerm,
    openHouseholdDetail,
    closeHouseholdDetail,
  } = useMswdoMasterlist();

  const activeEventLabel = selectedDisasterEvent
    ? `${selectedDisasterEvent.event_code} - ${selectedDisasterEvent.title}`
    : "No disaster event selected";

  return (
    <>
      <PageHeader
        eyebrow="MSWDO Workspace"
        title="CONSOLIDATED MASTERLIST"
        description="Monitor household records across barangays, review stub and attendance summaries, and inspect household-level details for the selected disaster event."
      />

      <section style={shellStyles.card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div>
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
              Monitoring Context
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
          </div>
          <div
            style={{
              border: "1px solid #d6e2ef",
              borderRadius: "14px",
              padding: "12px 14px",
              backgroundColor: "#f8fbfe",
              color: "#64809a",
              fontSize: "14px",
              minWidth: "240px",
            }}
          >
            {selectedBarangayId
              ? "Barangay filter applied"
              : "Showing all barangays for this event"}
          </div>
        </div>
      </section>

      <MswdoMasterlistToolbar
        disasterEvents={disasterEvents}
        barangays={barangays}
        selectedDisasterEventId={selectedDisasterEventId}
        selectedBarangayId={selectedBarangayId}
        searchTerm={searchTerm}
        isLoadingFilters={isLoadingFilters}
        onDisasterEventChange={setSelectedDisasterEventId}
        onBarangayChange={setSelectedBarangayId}
        onSearchChange={setSearchTerm}
      />

      <MswdoSummaryCards summary={summary} />

      <MswdoMasterlistTable
        rows={displayedRows}
        hasSelectedEvent={Boolean(selectedDisasterEventId)}
        isLoading={isLoadingFilters || isLoadingMasterlist}
        errorMessage={errorMessage}
        onViewHousehold={openHouseholdDetail}
      />

      <MswdoHouseholdDetailModal
        isOpen={isDetailOpen}
        household={selectedHousehold}
        onClose={closeHouseholdDetail}
      />
    </>
  );
};

export default ConsolidatedMasterlistPage;
