import React, { useEffect, useMemo, useState } from "react";
import { FiFileText, FiFilter, FiUserPlus } from "react-icons/fi";
import { MdDoorFront } from "react-icons/md";
import RegisterFamilyModal from "../../components/household-registration/RegisterFamilyModal";
import PageHeader, { pageHeaderStyles } from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import MasterlistDepartureConfirmModal from "../../components/masterlist/MasterlistDepartureConfirmModal";
import MasterlistTable from "../../components/masterlist/MasterlistTable";
import MswdoSummaryCards from "../../components/mswdo-masterlist/MswdoSummaryCards";
import SearchBar from "../../components/shared/SearchBar";
import StatusPill from "../../components/shared/StatusPill";
import { useAuth } from "../../context/AuthContext";
import { useHouseholdRegistrationForm } from "../../features/household-registration/useHouseholdRegistrationForm";
import {
  departHousehold,
  formatDateTime,
} from "../../features/masterlist/masterlistService";
import { exportConsolidatedMasterlist } from "../../features/mswdo-masterlist/mswdoMasterlistService";
import { useMswdoMasterlist } from "../../features/mswdo-masterlist/useMswdoMasterlist";

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

const noticeModalStyles = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(18, 34, 51, 0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    zIndex: 1200,
  },
  modal: {
    width: "100%",
    maxWidth: "440px",
    backgroundColor: "#ffffff",
    borderRadius: "20px",
    padding: "28px",
    boxShadow: "0 24px 48px rgba(20, 48, 78, 0.2)",
  },
  title: {
    margin: 0,
    color: "#17324d",
    fontSize: "22px",
  },
  message: {
    margin: "12px 0 0",
    color: "#5d7188",
    fontSize: "15px",
    lineHeight: 1.6,
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    marginTop: "24px",
  },
};

const filterPanelStyles = {
  panel: {
    position: "absolute",
    right: 0,
    top: "48px",
    width: "min(380px, 90vw)",
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
  list: {
    display: "grid",
    gap: "10px",
    maxHeight: "240px",
    overflowY: "auto",
    marginTop: "14px",
    padding: "4px",
  },
  option: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    color: "#1f405f",
    fontSize: "14px",
  },
  actions: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    marginTop: "18px",
  },
};

const tabButtonStyles = (isActive) => ({
  padding: "12px 24px",
  border: "none",
  background: "none",
  fontSize: "14px",
  fontWeight: 700,
  textTransform: "uppercase",
  color: isActive ? "#17324d" : "#6b8298",
  borderBottom: isActive ? "3px solid #17324d" : "3px solid transparent",
  cursor: "pointer",
});

const formatDisplayDate = (value) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-PH", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(value));
};

const formatReliefPeriod = (event) => {
  if (!event) return "-";

  const start = formatDisplayDate(event.start_date);

  if (!event.end_date && event.status === "ACTIVE") {
    return `${start} - Ongoing`;
  }

  if (event.end_date) {
    return `${start} - ${formatDisplayDate(event.end_date)}`;
  }

  return start;
};

const getEndedEventDateTimeText = (event) => {
  if (!event || event.status === "ACTIVE") {
    return "-";
  }

  return formatDateTime(event.updated_at || event.end_date);
};

const eventIncludesBarangay = (event, barangayId) => {
  if (!barangayId) {
    return true;
  }

  return (event.affected_barangays || []).some(
    (barangay) => barangay.id === barangayId,
  );
};

const getScopedDisasterEvents = ({ events, activeTab, barangayId }) => {
  const statusByTab = activeTab === "active" ? "ACTIVE" : "CLOSED";

  return events.filter(
    (event) =>
      event.status === statusByTab && eventIncludesBarangay(event, barangayId),
  );
};

const ExportNoticeModal = ({ isOpen, message, onClose }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div style={noticeModalStyles.overlay}>
      <div style={noticeModalStyles.modal}>
        <h3 style={noticeModalStyles.title}>Export Unavailable</h3>
        <p style={noticeModalStyles.message}>{message}</p>

        <div style={noticeModalStyles.actions}>
          <button
            type="button"
            onClick={onClose}
            style={pageHeaderStyles.primaryButton}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

const ConsolidatedEvacueeMasterlist = () => {
  const { authenticatedUser } = useAuth();
  const {
    disasterEvents,
    barangays,
    sectors,
    selectedDisasterEventId,
    selectedBarangayId,
    selectedSectorIds,
    selectedDisasterEvent,
    searchTerm,
    displayedRows,
    summaryMetrics,
    isLoadingFilters,
    isLoadingMasterlist,
    isLoadingDashboard,
    errorMessage,
    dashboardErrorMessage,
    setSelectedDisasterEventId,
    setSelectedBarangayId,
    setSelectedSectorIds,
    setSearchTerm,
    reloadMasterlist,
  } = useMswdoMasterlist();

  const [activeTab, setActiveTab] = useState("active"); // 'active' | 'ended'
  const [pendingDepartureHouseholdId, setPendingDepartureHouseholdId] = useState(null);
  const [isBulkDepartureConfirmOpen, setIsBulkDepartureConfirmOpen] = useState(false);
  const [isRecordingDeparture, setIsRecordingDeparture] = useState(false);
  const [selectedHouseholds, setSelectedHouseholds] = useState([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [exportingFormat, setExportingFormat] = useState("");
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [registrationSuccessMessage, setRegistrationSuccessMessage] = useState("");
  const [attendanceActionMessage, setAttendanceActionMessage] = useState("");
  const [exportNoticeMessage, setExportNoticeMessage] = useState("");

  const activeEventLabel = selectedDisasterEvent
    ? `${selectedDisasterEvent.event_code} - ${selectedDisasterEvent.title}`
    : "No disaster event selected";
  const hasRowsToExport = displayedRows.length > 0;
  const canRegisterFamily = activeTab === "active";
  const isEndedView = activeTab === "ended";
  const endedEventDateTimeText = getEndedEventDateTimeText(selectedDisasterEvent);
  const hasActiveSectorFilters = selectedSectorIds.length > 0;
  const scopedDisasterEvents = useMemo(() => {
    return getScopedDisasterEvents({
      events: disasterEvents,
      activeTab,
      barangayId: selectedBarangayId,
    });
  }, [activeTab, disasterEvents, selectedBarangayId]);

  const selectedBarangayLabel = selectedBarangayId
    ? barangays.find((barangay) => barangay.id === selectedBarangayId)?.name
    : "All Barangays";

  const toggleSectorFilter = (sectorId) => {
    setSelectedSectorIds((currentSectorIds) =>
      currentSectorIds.includes(sectorId)
        ? currentSectorIds.filter((id) => id !== sectorId)
        : [...currentSectorIds, sectorId],
    );
  };

  const registrationForm = useHouseholdRegistrationForm({
    isOpen: isRegisterModalOpen,
    defaultBarangayId: selectedBarangayId || "",
    defaultBarangayName: selectedBarangayLabel || "",
    defaultDisasterEventId: selectedDisasterEventId || "",
    lockBarangaySelection: true,
    hideBarangaySelection: true,
    scopeNonResidentEvacuationCentersToBarangay: true,
    registeredBy: authenticatedUser?.id || null,
    onSuccess: (response) => {
      setRegistrationSuccessMessage(
        response?.message || "Household registered successfully",
      );
      reloadMasterlist();
    },
  });

  const handleToggleSelect = (householdId) => {
    setSelectedHouseholds((currentValues) =>
      currentValues.includes(householdId)
        ? currentValues.filter((id) => id !== householdId)
        : [...currentValues, householdId],
    );
  };

  const handleSelectAll = () => {
    if (isEndedView) {
      setSelectedHouseholds([]);
      return;
    }

    const selectableHouseholdIds = displayedRows
      .filter((row) => !row.departure_time_value && row.can_record_departure)
      .map((row) => row.household_id);

    const areAllSelected =
      selectableHouseholdIds.length > 0 &&
      selectableHouseholdIds.every((id) => selectedHouseholds.includes(id));

    setSelectedHouseholds(areAllSelected ? [] : selectableHouseholdIds);
  };

  const handleOpenBulkDepartureConfirmation = () => {
    if (isEndedView || !selectedHouseholds.length || isRecordingDeparture) {
      return;
    }

    setIsBulkDepartureConfirmOpen(true);
  };

  const handleOpenDepartureConfirmation = (householdId) => {
    if (isEndedView || isRecordingDeparture) {
      return;
    }

    setPendingDepartureHouseholdId(householdId);
  };

  const handleCloseDepartureConfirmation = () => {
    if (isRecordingDeparture) {
      return;
    }

    setPendingDepartureHouseholdId(null);
    setIsBulkDepartureConfirmOpen(false);
  };

  const handleConfirmDeparture = async () => {
    if (isRecordingDeparture) {
      return;
    }

    setIsRecordingDeparture(true);

    try {
      if (isBulkDepartureConfirmOpen && selectedHouseholds.length > 0) {
        await Promise.all(
          selectedHouseholds.map((householdId) =>
            departHousehold({ householdId }),
          ),
        );

        setAttendanceActionMessage("Selected households marked as departed");
        setSelectedHouseholds([]);
        setIsBulkDepartureConfirmOpen(false);
        reloadMasterlist();
      } else {
        if (!pendingDepartureHouseholdId) {
          return;
        }

        const response = await departHousehold({
          householdId: pendingDepartureHouseholdId,
        });
        setAttendanceActionMessage(
          response.message || "Household departure recorded successfully",
        );
        setPendingDepartureHouseholdId(null);
        reloadMasterlist();
      }
    } catch (error) {
      setAttendanceActionMessage(
        error.message || "Failed to record household departure.",
      );
    } finally {
      setIsRecordingDeparture(false);
    }
  };

  const handleEventScopeChange = (nextTab) => {
    setActiveTab(nextTab);

    const nextEvents = getScopedDisasterEvents({
      events: disasterEvents,
      activeTab: nextTab,
      barangayId: selectedBarangayId,
    });

    if (nextEvents.length === 0) {
      setSelectedDisasterEventId("");
      return;
    }

    if (!nextEvents.some((event) => event.id === selectedDisasterEventId)) {
      setSelectedDisasterEventId(nextEvents[0].id);
    }
  };

  useEffect(() => {
    if (isLoadingFilters) {
      return;
    }

    if (scopedDisasterEvents.length === 0) {
      if (selectedDisasterEventId) {
        setSelectedDisasterEventId("");
      }

      return;
    }

    if (
      !scopedDisasterEvents.some((event) => event.id === selectedDisasterEventId)
    ) {
      setSelectedDisasterEventId(scopedDisasterEvents[0].id);
    }
  }, [
    isLoadingFilters,
    scopedDisasterEvents,
    selectedDisasterEventId,
    setSelectedDisasterEventId,
  ]);

  useEffect(() => {
    setSelectedHouseholds([]);
  }, [activeTab, selectedBarangayId, selectedDisasterEventId]);

  useEffect(() => {
    if (selectedDisasterEvent?.status === "ACTIVE" && activeTab !== "active") {
      setActiveTab("active");
    }

    if (selectedDisasterEvent?.status === "CLOSED" && activeTab !== "ended") {
      setActiveTab("ended");
    }
  }, [activeTab, selectedDisasterEvent?.status]);

  const handleOpenRegisterModal = () => {
    if (!selectedDisasterEventId) {
      window.alert("Select a disaster event before registering a family.");
      return;
    }

    if (!selectedBarangayId) {
      setExportNoticeMessage(
        "Select one barangay before registering a family. Registration cannot use the All Barangays view.",
      );
      return;
    }

    setRegistrationSuccessMessage("");
    setIsRegisterModalOpen(true);
  };

  const handleExport = async (format) => {
    if (!selectedDisasterEventId) {
      window.alert("Select a disaster event before exporting the masterlist.");
      return;
    }

    if (!hasRowsToExport) {
      setIsExportMenuOpen(false);
      setExportNoticeMessage(
        "No masterlist data is available to export for the current filters.",
      );
      return;
    }

    setExportingFormat(format);
    setIsExportMenuOpen(false);

    try {
      const file = await exportConsolidatedMasterlist({
        disasterEventId: selectedDisasterEventId,
        barangayId: selectedBarangayId || null,
        search: searchTerm,
        sectorIds: selectedSectorIds,
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
      window.alert(
        format === "pdf"
          ? "Unable to export the masterlist as PDF."
          : format === "excel"
            ? "Unable to export the masterlist as Excel."
            : "Unable to export the masterlist as CSV.",
      );
    } finally {
      setExportingFormat("");
    }
  };

  return (
    <>
      <PageHeader title="EVACUEE MASTERLIST MANAGEMENT" actions={[]} />

      <section style={shellStyles.card}>
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #d6e2ef",
            marginBottom: "24px",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => handleEventScopeChange("active")}
            style={tabButtonStyles(activeTab === "active")}
          >
            Active Events
          </button>
          <button
            type="button"
            onClick={() => handleEventScopeChange("ended")}
            style={tabButtonStyles(activeTab === "ended")}
          >
            Ended Events
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            alignItems: "end",
          }}
        >
          <div>
            <label htmlFor="mswdo-masterlist-event" style={filterStyles.label}>
              {activeTab === "active" ? "Active" : "Ended"} Disaster Event
            </label>
            <select
              id="mswdo-masterlist-event"
              value={selectedDisasterEventId || ""}
              onChange={(event) => setSelectedDisasterEventId(event.target.value)}
              disabled={isLoadingFilters || scopedDisasterEvents.length === 0}
              style={filterStyles.field}
            >
              <option value="">
                {selectedBarangayId && scopedDisasterEvents.length === 0
                  ? `No ${activeTab === "active" ? "active" : "ended"} events for this barangay`
                  : `Select ${activeTab === "active" ? "active" : "ended"} disaster event`}
              </option>
              {scopedDisasterEvents.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.event_code} - {event.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="mswdo-masterlist-barangay" style={filterStyles.label}>
              Barangay
            </label>
            <select
              id="mswdo-masterlist-barangay"
              value={selectedBarangayId || ""}
              onChange={(event) => setSelectedBarangayId(event.target.value)}
              disabled={isLoadingFilters}
              style={filterStyles.field}
            >
              <option value="">All Barangays</option>
              {barangays.map((barangay) => (
                <option key={barangay.id} value={barangay.id}>
                  {barangay.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section style={shellStyles.card}>
        <div
          style={{
            border: "1px solid #d6e2ef",
            borderRadius: "16px",
            padding: "18px 20px",
            backgroundColor: "#f8fbfe",
          }}
        >
          <p
            style={{
              margin: 0,
              color: "#17324d",
              fontSize: "18px",
              fontWeight: 800,
            }}
          >
            {activeEventLabel}
          </p>

          <div
            style={{
              display: "flex",
              gap: "24px",
              marginTop: "14px",
              flexWrap: "wrap",
              color: "#334155",
            }}
          >
            <span>Period: {formatReliefPeriod(selectedDisasterEvent)}</span>
            <StatusPill status={selectedDisasterEvent?.status} />
          </div>
        </div>

        {isLoadingFilters ? (
          <p style={{ ...shellStyles.mutedText, marginTop: "16px" }}>
            Loading MSWDO masterlist filters...
          </p>
        ) : !selectedDisasterEvent ? (
          <p style={{ ...shellStyles.mutedText, marginTop: "16px" }}>
            Select a disaster event to load the consolidated masterlist.
          </p>
      ) : null}
    </section>

      {selectedDisasterEvent && !isLoadingDashboard && !dashboardErrorMessage ? (
        <MswdoSummaryCards summary={summaryMetrics} />
      ) : null}

      {registrationSuccessMessage ? (
        <section style={shellStyles.card}>
          <p style={{ margin: 0, color: "#2f6c47", fontWeight: 700 }}>
            {registrationSuccessMessage}
          </p>
        </section>
      ) : null}

      {attendanceActionMessage ? (
        <section style={shellStyles.card}>
          <p style={{ margin: 0, color: "#24496e", fontWeight: 700 }}>
            {attendanceActionMessage}
          </p>
        </section>
      ) : null}

      {selectedHouseholds.length > 0 ? (
        <section style={shellStyles.card}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <p style={{ margin: 0, fontWeight: 700, color: "#24496e" }}>
              {selectedHouseholds.length} selected
            </p>

            <button
              type="button"
              onClick={handleOpenBulkDepartureConfirmation}
              disabled={isRecordingDeparture}
              style={{
                border: "1px solid #c6d8ea",
                borderRadius: "12px",
                width: "40px",
                height: "40px",
                backgroundColor: "#f7fbfe",
                color: "#24496e",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: isRecordingDeparture ? "not-allowed" : "pointer",
                opacity: isRecordingDeparture ? 0.7 : 1,
              }}
              title="Mark Selected as Departed"
            >
              <MdDoorFront size={18} />
            </button>
          </div>
        </section>
      ) : null}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          margin: "20px 0",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <SearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search family head, address, or sectors"
        />

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setIsFilterOpen((currentValue) => !currentValue)}
              style={{
                ...pageHeaderStyles.secondaryButton,
                display: "flex",
                alignItems: "center",
                gap: "8px",
                backgroundColor: hasActiveSectorFilters ? "#e5f1fb" : undefined,
                color: hasActiveSectorFilters ? "#24496e" : undefined,
              }}
            >
              <FiFilter size={16} />
              {hasActiveSectorFilters
                ? `Filter (${selectedSectorIds.length})`
                : "Filter"}
            </button>

            {isFilterOpen ? (
              <div style={filterPanelStyles.panel}>
                <h3 style={filterPanelStyles.title}>Filter by Sector</h3>
                <div style={filterPanelStyles.list}>
                  {sectors.length > 0 ? (
                    sectors.map((sector) => (
                      <label key={sector.id} style={filterPanelStyles.option}>
                        <input
                          type="checkbox"
                          checked={selectedSectorIds.includes(sector.id)}
                          onChange={() => toggleSectorFilter(sector.id)}
                        />
                        <span>{sector.name}</span>
                      </label>
                    ))
                  ) : (
                    <p style={{ ...shellStyles.mutedText, margin: 0 }}>
                      No sectors are available.
                    </p>
                  )}
                </div>

                <div style={filterPanelStyles.actions}>
                  <button
                    type="button"
                    onClick={() => setSelectedSectorIds([])}
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

          {canRegisterFamily ? (
            <button
              type="button"
              onClick={handleOpenRegisterModal}
              disabled={!selectedBarangayId}
              title={
                selectedBarangayId
                  ? "Register a family under the selected barangay"
                  : "Select one barangay before registering a family"
              }
              style={{
                ...pageHeaderStyles.primaryButton,
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: selectedBarangayId ? "pointer" : "not-allowed",
                opacity: selectedBarangayId ? 1 : 0.65,
              }}
            >
              <FiUserPlus size={16} />
              Register Family
            </button>
          ) : null}

          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setIsExportMenuOpen((currentValue) => !currentValue)}
              disabled={!selectedDisasterEventId || Boolean(exportingFormat)}
              style={{
                border: "1px solid #c6d8ea",
                borderRadius: "14px",
                padding: "12px 18px",
                backgroundColor: "#f8fbfe",
                color: "#2a4c6f",
                fontSize: "14px",
                fontWeight: 700,
                cursor:
                  !selectedDisasterEventId || exportingFormat ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                opacity: !selectedDisasterEventId || exportingFormat ? 0.7 : 1,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                <FiFileText size={16} />
              </span>
              {exportingFormat
                ? `Exporting ${exportingFormat.toUpperCase()}...`
                : "Export"}
            </button>

            {isExportMenuOpen && !exportingFormat ? (
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
            ) : null}
          </div>
        </div>
      </div>

      <MasterlistTable
        rows={displayedRows}
        hasSelectedEvent={Boolean(selectedDisasterEventId)}
        isLoading={isLoadingFilters || isLoadingMasterlist}
        errorMessage={errorMessage}
        onMarkDeparted={handleOpenDepartureConfirmation}
        isDepartureReadOnly={isEndedView}
        departureReadOnlyText={endedEventDateTimeText}
        selectedHouseholds={selectedHouseholds}
        onToggleSelect={handleToggleSelect}
        onSelectAll={handleSelectAll}
      />

      <MasterlistDepartureConfirmModal
        isOpen={Boolean(pendingDepartureHouseholdId) || isBulkDepartureConfirmOpen}
        isSubmitting={isRecordingDeparture}
        onCancel={handleCloseDepartureConfirmation}
        onConfirm={handleConfirmDeparture}
        selectedCount={isBulkDepartureConfirmOpen ? selectedHouseholds.length : 1}
      />

      <ExportNoticeModal
        isOpen={Boolean(exportNoticeMessage)}
        message={exportNoticeMessage}
        onClose={() => setExportNoticeMessage("")}
      />

      <RegisterFamilyModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        form={registrationForm}
      />
    </>
  );
};

export default ConsolidatedEvacueeMasterlist;
