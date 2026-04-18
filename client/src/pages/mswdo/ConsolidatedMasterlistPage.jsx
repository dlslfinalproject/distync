import React, { useState } from "react";
import { FiChevronDown, FiDownload } from "react-icons/fi";
import RegisterFamilyModal from "../../components/household-registration/RegisterFamilyModal";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import MasterlistDepartureConfirmModal from "../../components/masterlist/MasterlistDepartureConfirmModal";
import MasterlistTable from "../../components/masterlist/MasterlistTable";
import BarangayBarChart from "../../components/mswdo-analytics/BarangayBarChart";
import BarangayStatusBreakdownChart from "../../components/mswdo-analytics/BarangayStatusBreakdownChart";
import DistributionPieChart from "../../components/mswdo-analytics/DistributionPieChart";
import MswdoSummaryCards from "../../components/mswdo-masterlist/MswdoSummaryCards";
import { useHouseholdRegistrationForm } from "../../features/household-registration/useHouseholdRegistrationForm";
import { departHousehold } from "../../features/masterlist/masterlistService";
import { exportConsolidatedMasterlist } from "../../features/mswdo-masterlist/mswdoMasterlistService";
import { useMswdoMasterlist } from "../../features/mswdo-masterlist/useMswdoMasterlist";

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
    evacueesPerBarangay,
    familiesPerBarangay,
    admittedVsDepartedDistribution,
    barangayBreakdown,
    isLoadingFilters,
    isLoadingMasterlist,
    isLoadingDashboard,
    errorMessage,
    dashboardErrorMessage,
    hasDashboardData,
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

  const activeEventLabel = selectedDisasterEvent
    ? `${selectedDisasterEvent.event_code} - ${selectedDisasterEvent.title}`
    : "No disaster event selected";
  const hasRowsToExport = displayedRows.length > 0;
  const isAllBarangaysMode = !selectedBarangayId;

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
      await departHousehold({ householdId: pendingDepartureHouseholdId });
      setPendingDepartureHouseholdId(null);
      reloadMasterlist();
    } catch (error) {
      window.alert(error.message || "Failed to record household departure.");
    } finally {
      setIsRecordingDeparture(false);
    }
  };

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
      window.alert("No masterlist data is available to export for the current filters.");
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
      {/* Header */}
      <PageHeader title="EVACUEE MASTERLIST" />

      {/* Tabs Section */}
      <div style={{ display: "flex", gap: "24px", margin: "20px 0", borderBottom: "1px solid #d3dce6" }}>
        {["active", "ended"].map((tab) => (
          <div
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "8px 0",
              cursor: "pointer",
              fontWeight: activeTab === tab ? 700 : 500,
              color: activeTab === tab ? "#17324d" : "#8a9eb1",
              borderBottom: activeTab === tab ? "3px solid #17324d" : "3px solid transparent",
            }}
          >
            {tab === "active" ? "ACTIVE EVENTS" : "ENDED EVENTS"}
          </div>
        ))}
      </div>

      {/* Top Control Panel */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "20px", flexWrap: "wrap" }}>
        {/* Active Disaster Event Dropdown */}
        <select
          value={selectedDisasterEventId || ""}
          onChange={(e) => setSelectedDisasterEventId(e.target.value)}
          style={{
            flex: 1,
            minWidth: "220px",
            padding: "10px 12px",
            borderRadius: "10px",
            border: "1px solid #d3dfec",
            fontSize: "14px",
          }}
        >
          <option value="">-- Select Active Disaster Event --</option>
          {disasterEvents.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.title}
            </option>
          ))}
        </select>

        {/* Effective Barangay Card */}
        <div
          style={{
            flex: 1,
            minWidth: "200px",
            backgroundColor: "#f8fbfe",
            borderRadius: "12px",
            padding: "12px 16px",
            fontSize: "14px",
            color: "#334155",
          }}
        >
          {selectedBarangayId
            ? barangays.find((b) => b.id === selectedBarangayId)?.name
            : "All Barangays (Consolidated)"}
        </div>

        {/* Barangay Filter Dropdown */}
        <select
          value={selectedBarangayId || ""}
          onChange={(e) => setSelectedBarangayId(e.target.value)}
          style={{
            flex: 1,
            minWidth: "220px",
            padding: "10px 12px",
            borderRadius: "10px",
            border: "1px solid #d3dfec",
            fontSize: "14px",
          }}
        >
          <option value="">All Barangays</option>
          {barangays.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {/* Event Information Card */}
      {selectedDisasterEvent && (
        <div
          style={{
            borderRadius: "16px",
            background: "#f8fafc",
            padding: "16px 20px",
            marginBottom: "20px",
          }}
        >
          <h3 style={{ margin: "0 0 8px", fontWeight: 700 }}>{activeEventLabel}</h3>
          <div style={{ display: "flex", gap: "16px", fontSize: "14px", color: "#334155" }}>
            <span>{selectedDisasterEvent.start_date} - {selectedDisasterEvent.end_date}</span>
            <span>Status: {selectedDisasterEvent.status}</span>
          </div>
        </div>
      )}

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

      {/* Search and Actions Row */}
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
        <input
          type="text"
          placeholder="Search family head, address, or sectors"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: 1,
            minWidth: "220px",
            padding: "10px 12px",
            borderRadius: "10px",
            border: "1px solid #d3dfec",
            fontSize: "14px",
          }}
        />
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            style={{
              border: "1px solid #d3dfec",
              background: "#f8fbfe",
              padding: "10px 14px",
              borderRadius: "10px",
              cursor: "pointer",
            }}
          >
            Filter
          </button>
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setIsExportMenuOpen((currentValue) => !currentValue)}
              disabled={!selectedDisasterEventId || Boolean(exportingFormat)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                border: "1px solid #c9d8e8",
                background: "#f8fbfe",
                color: "#24496e",
                fontWeight: 700,
                padding: "10px 14px",
                borderRadius: "10px",
                cursor:
                  !selectedDisasterEventId || exportingFormat ? "not-allowed" : "pointer",
                opacity: !selectedDisasterEventId || exportingFormat ? 0.7 : 1,
              }}
            >
              <FiDownload size={16} />
              {exportingFormat
                ? `Exporting ${exportingFormat.toUpperCase()}...`
                : "Export"}
              <FiChevronDown size={16} />
            </button>

            {isExportMenuOpen && !exportingFormat ? (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  minWidth: "180px",
                  backgroundColor: "#ffffff",
                  border: "1px solid #d6e2ef",
                  borderRadius: "14px",
                  boxShadow: "0 18px 36px rgba(27, 50, 77, 0.16)",
                  padding: "8px",
                  zIndex: 20,
                }}
              >
                {[
                  { key: "pdf", label: "Export PDF" },
                  { key: "excel", label: "Export Excel" },
                  { key: "csv", label: "Export CSV" },
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => handleExport(option.key)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      border: "none",
                      background: "transparent",
                      color: "#1f3b57",
                      fontSize: "14px",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      cursor: "pointer",
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
              background: "#0c4a6e",
              color: "#fff",
              fontWeight: 600,
              padding: "10px 16px",
              borderRadius: "10px",
              cursor: "pointer",
            }}
          >
            {isAllBarangaysMode ? "Register Family" : "Register Family"}
          </button>
        </div>
      </div>

      {/* Table Section */}
      <section style={{ ...shellStyles.card, overflow: "hidden" }}>
        <h4 style={{ marginBottom: "12px", fontWeight: 700 }}>Registered Family</h4>
        <div style={{ width: "100%", overflowX: "auto" }}>
          <MasterlistTable
            rows={displayedRows}
            hasSelectedEvent={Boolean(selectedDisasterEventId)}
            isLoading={isLoadingFilters || isLoadingMasterlist}
            errorMessage={errorMessage}
            onMarkDeparted={handleOpenDepartureConfirmation}
          />
        </div>
      </section>

      {!selectedDisasterEvent ? null : isLoadingDashboard ? (
        <section style={shellStyles.card}>
          <h3 style={{ marginTop: 0, color: "#17324d" }}>Loading Descriptive Analytics</h3>
          <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
            Preparing the MSWDO descriptive analytics and chart breakdowns...
          </p>
        </section>
      ) : dashboardErrorMessage ? (
        <section style={shellStyles.card}>
          <h3 style={{ marginTop: 0, color: "#17324d" }}>Analytics Error</h3>
          <p style={{ ...shellStyles.mutedText, marginTop: "10px", color: "#a14d58" }}>
            {dashboardErrorMessage}
          </p>
        </section>
      ) : !hasDashboardData ? (
        <section style={shellStyles.card}>
          <h3 style={{ marginTop: 0, color: "#17324d" }}>No Descriptive Analytics Data</h3>
          <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
            No analytics data is available for the selected disaster event and barangay filter.
          </p>
        </section>
      ) : (
        <>
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
              data={evacueesPerBarangay}
              dataKey="value"
              color="#4f86be"
            />
            <BarangayBarChart
              title="Families per Barangay"
              description="Active household counts by barangay for the selected disaster event view."
              data={familiesPerBarangay}
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
            <DistributionPieChart
              title="Admitted vs Departed Distribution"
              description="Latest-log-per-evacuee distribution of currently admitted versus departed evacuees."
              data={admittedVsDepartedDistribution}
              emptyMessage="No admitted or departed breakdown is available for this view."
            />
            <BarangayStatusBreakdownChart data={barangayBreakdown} />
          </div>
        </>
      )}

      <MasterlistDepartureConfirmModal
        isOpen={Boolean(pendingDepartureHouseholdId)}
        isSubmitting={isRecordingDeparture}
        onCancel={handleCloseDepartureConfirmation}
        onConfirm={handleConfirmDeparture}
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
