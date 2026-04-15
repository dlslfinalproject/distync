import React from "react";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import DisasterEventDetailModal from "../../components/disaster-events/DisasterEventDetailModal";
import DisasterEventFormModal from "../../components/disaster-events/DisasterEventFormModal";
import DisasterEventsTable from "../../components/disaster-events/DisasterEventsTable";
import { useDisasterEvents } from "../../features/disaster-events/useDisasterEvents";

const DisasterEventsPage = () => {
  const {
    selectedFilter,
    setSelectedFilter,
    filterOptions,
    events,
    barangays,
    selectedEvent,
    isLoading,
    isDetailLoading,
    isSubmitting,
    errorMessage,
    detailErrorMessage,
    formErrorMessage,
    successMessage,
    isCreateModalOpen,
    isDetailModalOpen,
    openCreateModal,
    closeCreateModal,
    openDetailModal,
    closeDetailModal,
    submitCreateEvent,
    extendEvent,
    endEvent,
  } = useDisasterEvents();

  const handleExtendEvent = async (eventId) => {
    const nextEndDate = window.prompt("Enter a new end date (YYYY-MM-DD):");
    if (!nextEndDate) return;
    await extendEvent(eventId, nextEndDate);
  };

  const handleEndEvent = async (eventId) => {
    const confirmed = window.confirm("End this disaster event and mark it as ENDED?");
    if (!confirmed) return;
    await endEvent(eventId);
  };

  // Helper for Tab Styling
  const getTabStyle = (filterKey) => ({
    padding: "12px 24px",
    border: "none",
    background: "none",
    fontSize: "14px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: selectedFilter === filterKey ? "#17324d" : "#6b8298",
    borderBottom: selectedFilter === filterKey ? "3px solid #17324d" : "3px solid transparent",
    cursor: "pointer",
    transition: "all 0.2s ease",
  });

  const selectedFilterLabel = 
    selectedFilter === filterOptions.active ? "Active Events" : 
    selectedFilter === filterOptions.closed ? "Ended Events" : "All Disaster Events";

  return (
    <>
      <PageHeader
        title="DISASTER EVENT MANAGEMENT"
        actions={[
          {
            label: "Create Disaster Event",
            onClick: openCreateModal,
          },
        ]}
      />

      <section style={shellStyles.card}>
        {/* Tab Selection Logic */}
        <div style={{ display: "flex", borderBottom: "1px solid #d6e2ef", marginBottom: "24px", gap: "8px" }}>
          <button 
            onClick={() => setSelectedFilter(filterOptions.active)} 
            style={getTabStyle(filterOptions.active)}
          >
            Active Events
          </button>
          <button 
            onClick={() => setSelectedFilter(filterOptions.closed)} 
            style={getTabStyle(filterOptions.closed)}
          >
            Ended Events
          </button>
          <button 
            onClick={() => setSelectedFilter(filterOptions.all)} 
            style={getTabStyle(filterOptions.all)}
          >
            All Events
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: 0, color: "#6b8298", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Event Workspace
            </p>
            <h3 style={{ margin: "10px 0 0", color: "#17324d", fontSize: "24px" }}>
              {selectedFilterLabel}
            </h3>
          </div>

          <div
            style={{
              padding: "12px 18px",
              borderRadius: "14px",
              backgroundColor: "#f8fbfe",
              border: "1px solid #d7e2ef",
              color: "#60738a",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            Total Count: {events.length.toString().padStart(2, "0")}
          </div>
        </div>

        {successMessage && (
          <div style={{ marginTop: "18px", padding: "14px 16px", borderRadius: "14px", backgroundColor: "#edf8f1", border: "1px solid #cfe8d7", color: "#2f6c47", fontSize: "14px", fontWeight: 600 }}>
            {successMessage}
          </div>
        )}
      </section>

      <DisasterEventsTable
        rows={events}
        isLoading={isLoading}
        errorMessage={errorMessage}
        onViewEvent={openDetailModal}
        onExtendEvent={handleExtendEvent}
        onEndEvent={handleEndEvent}
      />

      <DisasterEventFormModal
        isOpen={isCreateModalOpen}
        barangays={barangays}
        isSubmitting={isSubmitting}
        errorMessage={formErrorMessage}
        onClose={closeCreateModal}
        onSubmit={submitCreateEvent}
      />

      <DisasterEventDetailModal
        isOpen={isDetailModalOpen}
        eventData={selectedEvent}
        isLoading={isDetailLoading}
        errorMessage={detailErrorMessage}
        onClose={closeDetailModal}
      />
    </>
  );
};

export default DisasterEventsPage;