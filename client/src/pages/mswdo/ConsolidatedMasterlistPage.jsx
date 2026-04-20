import React, { useEffect, useMemo, useState } from "react";
import { FiFileText, FiFilter, FiUserPlus } from "react-icons/fi";
import RegisterFamilyModal from "../../components/household-registration/RegisterFamilyModal";
import PageHeader, { pageHeaderStyles } from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import MasterlistDepartureConfirmModal from "../../components/masterlist/MasterlistDepartureConfirmModal";
import MasterlistTable from "../../components/masterlist/MasterlistTable";
import MswdoSummaryCards from "../../components/mswdo-masterlist/MswdoSummaryCards";
import SearchBar from "../../components/shared/SearchBar";
import StatusPill from "../../components/shared/StatusPill";
import { useHouseholdRegistrationForm } from "../../features/household-registration/useHouseholdRegistrationForm";
import { departHousehold } from "../../features/masterlist/masterlistService";
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
  const {
    disasterEvents,
    barangays,
    selectedDisasterEventId,
    selectedBarangayId,
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
    setSearchTerm,
    reloadMasterlist,
  } = useMswdoMasterlist();

  const [activeTab, setActiveTab] = useState("active"); // 'active' | 'ended'
  const [pendingDepartureHouseholdId, setPendingDepartureHouseholdId] = useState(null);
  const [isRecordingDeparture, setIsRecordingDeparture] = useState(false);
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
  const isAllBarangaysMode = !selectedBarangayId;
  const scopedDisasterEvents = useMemo(() => {
    const statusByTab = activeTab === "active" ? "ACTIVE" : "CLOSED";

    return disasterEvents.filter((event) => event.status === statusByTab);
  }, [activeTab, disasterEvents]);

  const selectedBarangayLabel = selectedBarangayId
    ? barangays.find((barangay) => barangay.id === selectedBarangayId)?.name
    : "All Barangays";

  const registrationForm = useHouseholdRegistrationForm({
    isOpen: isRegisterModalOpen,
    defaultBarangayId: selectedBarangayId || "",
    defaultDisasterEventId: selectedDisasterEventId || "",
    onSuccess: (response) => {
      setRegistrationSuccessMessage(
        response?.message || "Household registered successfully",
      );
      reloadMasterlist();
    },
  });

  const handleOpenDepartureConfirmation = (householdId) => {
    if (isRecordingDeparture) {
      return;
    }

    setPendingDepartureHouseholdId(householdId);
  };

  const handleCloseDepartureConfirmation = () => {
    if (isRecordingDeparture) {
      return;
    }

    setPendingDepartureHouseholdId(null);
  };

  const handleConfirmDeparture = async () => {
    if (!pendingDepartureHouseholdId) {
      return;
    }

    setIsRecordingDeparture(true);

    try {
      const response = await departHousehold({ householdId: pendingDepartureHouseholdId });
      setAttendanceActionMessage(
        response.message || "Household departure recorded successfully",
      );
      setPendingDepartureHouseholdId(null);
      reloadMasterlist();
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

    const nextStatus = nextTab === "active" ? "ACTIVE" : "CLOSED";
    const nextEvents = disasterEvents.filter((event) => event.status === nextStatus);

    if (nextEvents.length === 0) {
      setSelectedDisasterEventId("");
      return;
    }

    if (!nextEvents.some((event) => event.id === selectedDisasterEventId)) {
      setSelectedDisasterEventId(nextEvents[0].id);
    }
  };

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
      <PageHeader title="EVACUEE MASTERLIST" actions={[]} />

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
                Select {activeTab === "active" ? "active" : "ended"} disaster event
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

          <div>
            <label style={filterStyles.label}>Current Scope</label>
            <div
              style={{
                ...filterStyles.field,
                display: "flex",
                alignItems: "center",
                minHeight: "48px",
                fontWeight: 700,
                color: "#17324d",
              }}
            >
              {isAllBarangaysMode
                ? "All Barangays (Consolidated)"
                : selectedBarangayLabel}
            </div>
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
            <span>Barangay Scope: {selectedBarangayLabel}</span>
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
          <button
            type="button"
            style={{
              ...pageHeaderStyles.secondaryButton,
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <FiFilter size={16} />
            Filter
          </button>

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

          <button
            type="button"
            onClick={handleOpenRegisterModal}
            style={{
              ...pageHeaderStyles.primaryButton,
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <FiUserPlus size={16} />
            Register Family
          </button>
        </div>
      </div>

      <MasterlistTable
        rows={displayedRows}
        hasSelectedEvent={Boolean(selectedDisasterEventId)}
        isLoading={isLoadingFilters || isLoadingMasterlist}
        errorMessage={errorMessage}
        onMarkDeparted={handleOpenDepartureConfirmation}
      />

      <MasterlistDepartureConfirmModal
        isOpen={Boolean(pendingDepartureHouseholdId)}
        isSubmitting={isRecordingDeparture}
        onCancel={handleCloseDepartureConfirmation}
        onConfirm={handleConfirmDeparture}
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
