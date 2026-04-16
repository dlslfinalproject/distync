import React, { useState } from "react";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import DisasterEventDetailModal from "../../components/disaster-events/DisasterEventDetailModal";
import DisasterEventFormModal from "../../components/disaster-events/DisasterEventFormModal";
import DisasterEventsTable from "../../components/disaster-events/DisasterEventsTable";
import { useDisasterEvents } from "../../features/disaster-events/useDisasterEvents";
import DisasterEventExtendModal from "../../components/disaster-events/DisasterEventExtendModal";
import DisasterEventEndModal from "../../components/disaster-events/DisasterEventEndModal";

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

  const [extendModalOpen, setExtendModalOpen] = useState(false);
  const [endModalOpen, setEndModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);

  const handleOpenExtend = (row) => {
    setSelectedRow(row);
    setExtendModalOpen(true);
  };

  const handleOpenEnd = (row) => {
    setSelectedRow(row);
    setEndModalOpen(true);
  };

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
    whiteSpace: "nowrap", // Prevents tabs from wrapping and breaking height
  });

  const selectedFilterLabel =
    selectedFilter === filterOptions.active ? "Active Events" :
      selectedFilter === filterOptions.closed ? "Ended Events" : "All Disaster Events";

  return (
    /* CRITICAL FIX: Use flex: 1 and minWidth 0 to prevent the container 
       from ever being wider than the available space next to the sidebar.
    */
    <div style={{ flex: 1, minWidth: 0, maxWidth: "100%", overflowX: "hidden" }}>
      <PageHeader
        title="DISASTER EVENT MANAGEMENT"
      />

      {/* FILTER & TAB CARD */}
      <section style={{ ...shellStyles.card, boxSizing: "border-box" }}>
        <div style={{
          display: "flex",
          borderBottom: "1px solid #d6e2ef",
          marginBottom: "24px",
          flexWrap: "wrap",
          gap: "8px",
          overflowX: "auto",
          msOverflowStyle: "none", // Hide scrollbar for IE/Edge
          scrollbarWidth: "none"   // Hide scrollbar for Firefox
        }}>
          <button onClick={() => setSelectedFilter(filterOptions.active)} style={getTabStyle(filterOptions.active)}>Active Events</button>
          <button onClick={() => setSelectedFilter(filterOptions.closed)} style={getTabStyle(filterOptions.closed)}>Ended Events</button>
          <button onClick={() => setSelectedFilter(filterOptions.all)} style={getTabStyle(filterOptions.all)}>All Events</button>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end", // ✅ RIGHT ALIGN
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
            position: "relative", // needed for dropdown positioning
          }}
        >
          {/* EXPORT BUTTON */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setExportOpen(!exportOpen)}
              style={{
                padding: "10px 18px",
                borderRadius: "10px",
                backgroundColor: "#f0f4f8",
                color: "#17324d",
                border: "1px solid #d6e2ef",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Export ▾
            </button>

            {/* DROPDOWN */}
            {exportOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "42px",
                  right: 0,
                  background: "#fff",
                  borderRadius: "10px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  padding: "10px",
                  zIndex: 100,
                  minWidth: "160px",
                }}
              >
                <div style={{ padding: "8px", cursor: "pointer" }}>
                  Export as PDF
                </div>
                <div style={{ padding: "8px", cursor: "pointer" }}>
                  Export as Excel
                </div>
                <div style={{ padding: "8px", cursor: "pointer" }}>
                  Export as CSV
                </div>
              </div>
            )}
          </div>

          {/* CREATE BUTTON */}
          <button
            onClick={openCreateModal}
            style={{
              padding: "10px 18px",
              borderRadius: "10px",
              backgroundColor: "#2f5bd3",
              color: "#fff",
              border: "none",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Create Disaster Event
          </button>
        </div>
      </section>

      {/* TABLE CARD - Tightened container with forced internal scroll */}
      <section style={{ ...shellStyles.card, marginTop: "24px", padding: "24px", boxSizing: "border-box", overflow: "hidden" }}>
        <div style={{ width: "100%", maxWidth: "100%", overflowX: "auto" }}>
          <DisasterEventsTable
            rows={events}
            isLoading={isLoading}
            errorMessage={errorMessage}
            onViewEvent={openDetailModal}
            onExtendEvent={handleOpenExtend}
            onEndEvent={handleOpenEnd}
          />
        </div>
      </section>

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

      <DisasterEventExtendModal
        isOpen={extendModalOpen}
        onClose={() => setExtendModalOpen(false)}
        onSubmit={extendEvent}
        event={selectedRow}
      />

      <DisasterEventEndModal
        isOpen={endModalOpen}
        onClose={() => setEndModalOpen(false)}
        onConfirm={endEvent}
        event={selectedRow}
      />
    </div>
  );
};

export default DisasterEventsPage;