import React from "react";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import DisasterEventDetailModal from "../../components/disaster-events/DisasterEventDetailModal";
import DisasterEventFilters from "../../components/disaster-events/DisasterEventFilters";
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
    const nextEndDate = window.prompt(
      "Enter a new end date for this event (YYYY-MM-DD):",
    );

    if (!nextEndDate) {
      return;
    }

    await extendEvent(eventId, nextEndDate);
  };

  const handleEndEvent = async (eventId) => {
    const confirmed = window.confirm(
      "End this disaster event and mark it as CLOSED?",
    );

    if (!confirmed) {
      return;
    }

    await endEvent(eventId);
  };

  const selectedFilterLabel =
    selectedFilter === filterOptions.active
      ? "Active Events"
      : selectedFilter === filterOptions.closed
        ? "Closed Events"
        : "All Events";

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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <DisasterEventFilters
            selectedFilter={selectedFilter}
            onSelectFilter={setSelectedFilter}
          />

          <div
            style={{
              padding: "12px 14px",
              borderRadius: "14px",
              backgroundColor: "#f8fbfe",
              border: "1px solid #d7e2ef",
              color: "#60738a",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            Showing: {selectedFilterLabel}
          </div>
        </div>

        {successMessage ? (
          <div
            style={{
              marginTop: "18px",
              padding: "14px 16px",
              borderRadius: "14px",
              backgroundColor: "#edf8f1",
              border: "1px solid #cfe8d7",
              color: "#2f6c47",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            {successMessage}
          </div>
        ) : null}
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
