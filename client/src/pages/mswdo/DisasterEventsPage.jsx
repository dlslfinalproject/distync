import React, { useState } from "react";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import DisasterEventDetailModal from "../../components/disaster-events/DisasterEventDetailModal";
import DisasterEventFormModal from "../../components/disaster-events/DisasterEventFormModal";
import DisasterEventsTable from "../../components/disaster-events/DisasterEventsTable";
import { useDisasterEvents } from "../../features/disaster-events/useDisasterEvents";
import DisasterEventExtendModal from "../../components/disaster-events/DisasterEventExtendModal";
import DisasterEventEndModal from "../../components/disaster-events/DisasterEventEndModal";
import { FiFileText } from "react-icons/fi";

const CreateEventIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    style={{ flexShrink: 0 }}
  >
    <path
      d="M12 5V19"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
    <path
      d="M5 12H19"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
  </svg>
);

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
    borderBottom:
      selectedFilter === filterKey
        ? "3px solid #17324d"
        : "3px solid transparent",
    cursor: "pointer",
    transition: "all 0.2s ease",
    whiteSpace: "nowrap",
  });

  return (
    <div
      style={{ flex: 1, minWidth: 0, maxWidth: "100%", overflowX: "hidden" }}
    >
      <PageHeader title="DISASTER EVENT MANAGEMENT" />

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: "12px",
          margin: "16px 0 24px",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={openCreateModal}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            border: "none",
            borderRadius: "14px",
            padding: "12px 18px",
            background: "linear-gradient(135deg, #2f6499 0%, #4c86be 100%)",
            color: "#ffffff",
            fontSize: "14px",
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 12px 24px rgba(58, 97, 141, 0.18)",
          }}
        >
          <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span>
          Create Disaster Event
        </button>

        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExportOpen(!exportOpen);
            }}
            style={{
              border: "1px solid #c6d8ea",
              borderRadius: "14px",
              padding: "12px 18px",
              backgroundColor: "#f8fbfe",
              color: "#2a4c6f",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "2px" }}>
              <FiFileText size={16} />
            </span>
            Export
          </button>

          {exportOpen && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "45px",
                background: "#fff",
                borderRadius: "10px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                padding: "8px",
                minWidth: "160px",
                zIndex: 20,
              }}
            >
              <div
                style={{ padding: "8px", cursor: "pointer" }}
                onClick={() => {
                  console.log("Export CSV");
                  setExportOpen(false);
                }}
              >
                Export as CSV
              </div>

              <div
                style={{ padding: "8px", cursor: "pointer" }}
                onClick={() => {
                  console.log("Export PDF");
                  setExportOpen(false);
                }}
              >
                Export as PDF
              </div>

              <div
                style={{ padding: "8px", cursor: "pointer" }}
                onClick={() => {
                  console.log("Export Excel");
                  setExportOpen(false);
                }}
              >
                Export as Excel
              </div>
            </div>
          )}
        </div>
      </div>

      <section style={{ ...shellStyles.card, boxSizing: "border-box" }}>
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #d6e2ef",
            marginBottom: "24px",
            flexWrap: "wrap",
            gap: "8px",
            overflowX: "auto",
            msOverflowStyle: "none",
            scrollbarWidth: "none",
          }}
        >
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
      </section>

      <section
        style={{
          ...shellStyles.card,
          marginTop: "24px",
          padding: "24px",
          boxSizing: "border-box",
          overflow: "visible",
        }}
      >
        <div style={{ width: "100%" }}>
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
