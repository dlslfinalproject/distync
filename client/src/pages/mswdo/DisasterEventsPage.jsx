import React, { useMemo, useState } from "react";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import DisasterEventDetailModal from "../../components/disaster-events/DisasterEventDetailModal";
import DisasterEventFormModal from "../../components/disaster-events/DisasterEventFormModal";
import DisasterEventsTable from "../../components/disaster-events/DisasterEventsTable";
import { useDisasterEvents } from "../../features/disaster-events/useDisasterEvents";
import DisasterEventExtendModal from "../../components/disaster-events/DisasterEventExtendModal";
import DisasterEventEndModal from "../../components/disaster-events/DisasterEventEndModal";
import SearchBar from "../../components/shared/SearchBar";
import { pageHeaderStyles } from "../../components/layout/PageHeader";
import { FiFileText, FiFilter } from "react-icons/fi";
import { exportDisasterEvents } from "../../features/disaster-events/disasterEventService";

const filterPanelStyles = {
  panel: {
    position: "absolute",
    right: 0,
    top: "48px",
    width: "min(360px, 90vw)",
    backgroundColor: "#ffffff",
    border: "1px solid #d6e2ef",
    borderRadius: "18px",
    boxShadow: "0 18px 36px rgba(31, 64, 95, 0.16)",
    padding: "18px",
    zIndex: 30,
  },
  title: {
    margin: 0,
    color: "#17324d",
    fontSize: "16px",
    fontWeight: 800,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "14px",
  },
  label: {
    color: "#55718b",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  select: {
    minHeight: "42px",
    border: "1px solid #d0ddeb",
    borderRadius: "12px",
    padding: "10px 12px",
    fontSize: "14px",
    color: "#1f405f",
    backgroundColor: "#f8fbfe",
    boxSizing: "border-box",
  },
  actions: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    marginTop: "18px",
  },
};

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
  const [exportingFormat, setExportingFormat] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedDisasterType, setSelectedDisasterType] = useState("");
  const [selectedAffectedBarangayId, setSelectedAffectedBarangayId] =
    useState("");

  const disasterTypeOptions = useMemo(() => {
    return [
      ...new Set(
        events
          .map((event) => String(event.disaster_type || "").trim())
          .filter(Boolean),
      ),
    ].sort((a, b) => a.localeCompare(b));
  }, [events]);

  const hasActiveFilters = Boolean(
    selectedDisasterType || selectedAffectedBarangayId,
  );

  const filteredEvents = events.filter((event) => {
    const search = searchValue.trim().toLowerCase();
    const matchesSearch =
      !search ||
      event.title?.toLowerCase().includes(search) ||
      event.disaster_type?.toLowerCase().includes(search) ||
      event.affected_barangays?.some((b) =>
        (b.name || b).toLowerCase().includes(search),
      );

    const matchesDisasterType =
      !selectedDisasterType ||
      event.disaster_type === selectedDisasterType;

    const matchesAffectedBarangay =
      !selectedAffectedBarangayId ||
      event.affected_barangays?.some(
        (barangay) => barangay.id === selectedAffectedBarangayId,
      );

    return (
      matchesSearch &&
      matchesDisasterType &&
      matchesAffectedBarangay
    );
  });

  const handleOpenExtend = (row) => {
    setSelectedRow(row);
    setExtendModalOpen(true);
  };

  const handleOpenEnd = (row) => {
    setSelectedRow(row);
    setEndModalOpen(true);
  };

  const handleExport = async (format) => {
    if (filteredEvents.length === 0) {
      window.alert("No disaster events are available to export for the current filters.");
      setExportOpen(false);
      return;
    }

    setExportingFormat(format);
    setExportOpen(false);

    try {
      const file = await exportDisasterEvents({
        selectedFilter,
        search: searchValue,
        disasterType: selectedDisasterType,
        affectedBarangayId: selectedAffectedBarangayId,
        format,
      });
      const downloadUrl = window.URL.createObjectURL(file.blob);
      const anchor = document.createElement("a");

      anchor.href = downloadUrl;
      anchor.download = file.filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (_error) {
      window.alert("Unable to export disaster events. Please try again.");
    } finally {
      setExportingFormat("");
    }
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
            disabled={Boolean(exportingFormat)}
            style={{
              border: "1px solid #c6d8ea",
              borderRadius: "14px",
              padding: "12px 18px",
              backgroundColor: "#f8fbfe",
              color: "#2a4c6f",
              fontSize: "14px",
              fontWeight: 700,
              cursor: exportingFormat ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              opacity: exportingFormat ? 0.7 : 1,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "2px" }}>
              <FiFileText size={16} />
            </span>
            {exportingFormat
              ? `Exporting ${exportingFormat.toUpperCase()}...`
              : "Export"}
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
              {[
                { key: "csv", label: "Export as CSV" },
                { key: "pdf", label: "Export as PDF" },
                { key: "excel", label: "Export as Excel" },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => handleExport(option.key)}
                  style={{
                    width: "100%",
                    border: "none",
                    background: "transparent",
                    textAlign: "left",
                    padding: "8px",
                    cursor: "pointer",
                    color: "#1f3b57",
                    fontSize: "14px",
                  }}
                >
                  {option.label}
                </button>
              ))}
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

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginTop: "16px",
          marginBottom: "20px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1 }}>
          <SearchBar
            value={searchValue}
            onChange={setSearchValue}
            placeholder="Search disaster events name, type, or affected barangays"
          />
        </div>

        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setIsFilterOpen((currentValue) => !currentValue)}
            style={{
              ...pageHeaderStyles.secondaryButton,
              backgroundColor: hasActiveFilters ? "#e5f1fb" : undefined,
              color: hasActiveFilters ? "#24496e" : undefined,
            }}
          >
            <FiFilter size={16} />
            {hasActiveFilters ? "Filter Applied" : "Filter"}
          </button>

          {isFilterOpen ? (
            <div style={filterPanelStyles.panel}>
              <h3 style={filterPanelStyles.title}>Filter Disaster Events</h3>

              <label style={filterPanelStyles.field}>
                <span style={filterPanelStyles.label}>Disaster Type</span>
                <select
                  value={selectedDisasterType}
                  onChange={(event) =>
                    setSelectedDisasterType(event.target.value)
                  }
                  style={filterPanelStyles.select}
                >
                  <option value="">All Disaster Types</option>
                  {disasterTypeOptions.map((disasterType) => (
                    <option key={disasterType} value={disasterType}>
                      {disasterType}
                    </option>
                  ))}
                </select>
              </label>

              <label style={filterPanelStyles.field}>
                <span style={filterPanelStyles.label}>Affected Barangay</span>
                <select
                  value={selectedAffectedBarangayId}
                  onChange={(event) =>
                    setSelectedAffectedBarangayId(event.target.value)
                  }
                  style={filterPanelStyles.select}
                >
                  <option value="">All Barangays</option>
                  {barangays.map((barangay) => (
                    <option key={barangay.id} value={barangay.id}>
                      {barangay.name}
                    </option>
                  ))}
                </select>
              </label>

              <div style={filterPanelStyles.actions}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDisasterType("");
                    setSelectedAffectedBarangayId("");
                  }}
                  style={pageHeaderStyles.secondaryButton}
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(false)}
                  style={pageHeaderStyles.primaryButton}
                >
                  Apply
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <section
        style={{
          ...shellStyles.card,
          marginTop: "0",
          padding: "24px",
          boxSizing: "border-box",
          overflow: "visible",
        }}
      >
        <div style={{ width: "100%" }}>
          <DisasterEventsTable
            rows={filteredEvents}
            isLoading={isLoading}
            errorMessage={errorMessage}
            onViewEvent={openDetailModal}
            onExtendEvent={handleOpenExtend}
            onEndEvent={handleOpenEnd}
            validBarangayCount={barangays.length}
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
        isSubmitting={isSubmitting}
      />

      <DisasterEventEndModal
        isOpen={endModalOpen}
        onClose={() => setEndModalOpen(false)}
        onConfirm={endEvent}
        event={selectedRow}
        isSubmitting={isSubmitting}
      />
    </div>
  );
};

export default DisasterEventsPage;
