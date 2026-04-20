import React, { useEffect, useMemo, useState } from "react";
import { FaHandHolding } from "react-icons/fa6";
import { FiFileText, FiFilter } from "react-icons/fi";
import PageHeader, { pageHeaderStyles } from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import SearchBar from "../../components/shared/SearchBar";
import StatusPill from "../../components/shared/StatusPill";
import StubClaimConfirmModal from "../../components/stubs/StubClaimConfirmModal";
import MswdoStubResultsTable from "../../components/stubs/MswdoStubResultsTable";
import StubSummaryCards from "../../components/stubs/StubSummaryCards";
import { claimStub } from "../../features/stubs/stubService";
import { useMswdoStubDistribution } from "../../features/stubs/useMswdoStubDistribution";

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

const getStatusLabel = (status) => {
  if (status === "CLAIMED") {
    return "Claimed";
  }

  if (status === "ISSUED") {
    return "Unclaimed";
  }

  return status || "-";
};

const buildCsvCell = (value) => {
  return `"${String(value || "").replace(/"/g, '""')}"`;
};

const downloadCsvFile = (rows, eventCode, barangayName) => {
  const header = [
    "Family Head",
    "Address",
    "Stub Number",
    "Sectors",
    "Status",
  ];

  const csvRows = rows.map((row) => [
    row.family_head_name,
    row.address,
    row.stub_number,
    row.sectors_text,
    getStatusLabel(row.status),
  ]);

  const csvContent = [header, ...csvRows]
    .map((cells) => cells.map(buildCsvCell).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const downloadUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const safeEventCode = (eventCode || "event").replace(/[^a-z0-9-_]+/gi, "-");
  const safeBarangayName = (barangayName || "barangay").replace(
    /[^a-z0-9-_]+/gi,
    "-",
  );

  anchor.href = downloadUrl;
  anchor.download = `stub-distribution-${safeEventCode}-${safeBarangayName}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(downloadUrl);
};

const StubDistributionPage = () => {
  const {
    disasterEvents,
    barangays,
    selectedDisasterEventId,
    selectedBarangayId,
    selectedDisasterEvent,
    selectedBarangay,
    searchTerm,
    displayedRows,
    summaryCards,
    isLoadingFilters,
    isLoadingData,
    errorMessage,
    hasSelectedEvent,
    hasSelectedBarangay,
    setSelectedDisasterEventId,
    setSelectedBarangayId,
    setSearchTerm,
    reloadDashboard,
  } = useMswdoStubDistribution();

  const [activeTab, setActiveTab] = useState("active");
  const [claimingStubId, setClaimingStubId] = useState("");
  const [claimErrorMessage, setClaimErrorMessage] = useState("");
  const [pendingClaimStubId, setPendingClaimStubId] = useState("");
  const [selectedStubIds, setSelectedStubIds] = useState([]);
  const [isBulkClaimConfirmOpen, setIsBulkClaimConfirmOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const scopedDisasterEvents = useMemo(() => {
    const allowedStatuses =
      activeTab === "active" ? ["ACTIVE"] : ["CLOSED", "ARCHIVED"];

    return disasterEvents.filter((event) => allowedStatuses.includes(event.status));
  }, [activeTab, disasterEvents]);

  const activeEventLabel = selectedDisasterEvent
    ? `${selectedDisasterEvent.event_code} - ${selectedDisasterEvent.title}`
    : "No disaster event selected";

  useEffect(() => {
    if (
      selectedDisasterEvent?.status === "ACTIVE" &&
      activeTab !== "active"
    ) {
      setActiveTab("active");
    }

    if (
      ["CLOSED", "ARCHIVED"].includes(selectedDisasterEvent?.status) &&
      activeTab !== "ended"
    ) {
      setActiveTab("ended");
    }
  }, [activeTab, selectedDisasterEvent?.status]);

  useEffect(() => {
    setSelectedStubIds([]);
    setPendingClaimStubId("");
    setIsBulkClaimConfirmOpen(false);
    setClaimErrorMessage("");
  }, [selectedBarangayId, selectedDisasterEventId]);

  const handleEventScopeChange = (nextTab) => {
    setActiveTab(nextTab);

    const allowedStatuses =
      nextTab === "active" ? ["ACTIVE"] : ["CLOSED", "ARCHIVED"];
    const nextEvents = disasterEvents.filter((event) =>
      allowedStatuses.includes(event.status),
    );

    if (nextEvents.length === 0) {
      setSelectedDisasterEventId("");
      return;
    }

    if (!nextEvents.some((event) => event.id === selectedDisasterEventId)) {
      setSelectedDisasterEventId(nextEvents[0].id);
    }
  };

  const handleToggleSelect = (stubId) => {
    setSelectedStubIds((currentValues) =>
      currentValues.includes(stubId)
        ? currentValues.filter((id) => id !== stubId)
        : [...currentValues, stubId],
    );
  };

  const handleSelectAll = () => {
    const selectableStubIds = displayedRows
      .filter((row) => row.status === "ISSUED")
      .map((row) => row.id);

    const areAllSelected =
      selectableStubIds.length > 0 &&
      selectableStubIds.every((id) => selectedStubIds.includes(id));

    setSelectedStubIds(areAllSelected ? [] : selectableStubIds);
  };

  const handleOpenBulkClaimConfirmation = () => {
    if (!selectedStubIds.length || claimingStubId) {
      return;
    }

    setClaimErrorMessage("");
    setIsBulkClaimConfirmOpen(true);
  };

  const handleOpenClaimConfirmation = (stubId) => {
    if (claimingStubId) {
      return;
    }

    setClaimErrorMessage("");
    setPendingClaimStubId(stubId);
  };

  const handleCancelClaim = () => {
    if (claimingStubId) {
      return;
    }

    setPendingClaimStubId("");
    setIsBulkClaimConfirmOpen(false);
  };

  const handleConfirmClaim = async () => {
    if (claimingStubId) {
      return;
    }

    setClaimErrorMessage("");

    if (isBulkClaimConfirmOpen && selectedStubIds.length > 0) {
      setClaimingStubId("bulk");

      try {
        await Promise.all(
          selectedStubIds.map((stubId) =>
            claimStub({
              stubId,
              userId: "",
              overrideBarangayId: selectedBarangayId,
            }),
          ),
        );

        reloadDashboard();
        setSelectedStubIds([]);
        setIsBulkClaimConfirmOpen(false);
      } catch (error) {
        setClaimErrorMessage(
          error.message || "Unable to mark the selected stubs as claimed.",
        );
      } finally {
        setClaimingStubId("");
      }

      return;
    }

    if (!pendingClaimStubId) {
      return;
    }

    setClaimingStubId(pendingClaimStubId);

    try {
      await claimStub({
        stubId: pendingClaimStubId,
        userId: "",
        overrideBarangayId: selectedBarangayId,
      });
      reloadDashboard();
      setPendingClaimStubId("");
    } catch (error) {
      setClaimErrorMessage(error.message || "Unable to mark the stub as claimed.");
    } finally {
      setClaimingStubId("");
    }
  };

  const handleExport = () => {
    if (!selectedDisasterEventId) {
      window.alert("Select a disaster event before exporting stub records.");
      return;
    }

    if (!selectedBarangayId) {
      window.alert("Select a barangay before exporting stub records.");
      return;
    }

    if (!displayedRows.length) {
      window.alert("No stub records are available to export for the current filters.");
      return;
    }

    setIsExporting(true);

    try {
      downloadCsvFile(
        displayedRows,
        selectedDisasterEvent?.event_code || "event",
        selectedBarangay?.name || "barangay",
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <PageHeader title="RELIEF GOODS DISTRIBUTION" actions={[]} />

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
            <label htmlFor="mswdo-stub-event" style={filterStyles.label}>
              {activeTab === "active" ? "Active" : "Ended"} Disaster Event
            </label>
            <select
              id="mswdo-stub-event"
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
            <label htmlFor="mswdo-stub-barangay" style={filterStyles.label}>
              Barangay
            </label>
            <select
              id="mswdo-stub-barangay"
              value={selectedBarangayId}
              onChange={(event) => setSelectedBarangayId(event.target.value)}
              disabled={isLoadingFilters}
              style={filterStyles.field}
            >
              <option value="">Select barangay</option>
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
            Loading MSWDO stub distribution filters...
          </p>
        ) : !hasSelectedEvent ? (
          <p style={{ ...shellStyles.mutedText, marginTop: "16px" }}>
            Select a disaster event to load the relief goods distribution page.
          </p>
        ) : !hasSelectedBarangay ? (
          <p style={{ ...shellStyles.mutedText, marginTop: "16px" }}>
            Select a barangay to view stub progress for the selected disaster event.
          </p>
        ) : null}
      </section>

      {hasSelectedEvent &&
      hasSelectedBarangay &&
      !isLoadingData &&
      !errorMessage ? (
        <StubSummaryCards cards={summaryCards} />
      ) : null}

      <section
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1 }}>
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search family head, address, stub number, or sectors"
          />
        </div>

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

          <button
            type="button"
            onClick={handleExport}
            disabled={
              !hasSelectedEvent ||
              !hasSelectedBarangay ||
              !displayedRows.length ||
              isExporting
            }
            style={{
              border: "1px solid #c6d8ea",
              borderRadius: "14px",
              padding: "12px 18px",
              backgroundColor: "#f8fbfe",
              color: "#2a4c6f",
              fontSize: "14px",
              fontWeight: 700,
              cursor:
                !hasSelectedEvent ||
                !hasSelectedBarangay ||
                !displayedRows.length ||
                isExporting
                  ? "not-allowed"
                  : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              opacity:
                !hasSelectedEvent ||
                !hasSelectedBarangay ||
                !displayedRows.length ||
                isExporting
                  ? 0.7
                  : 1,
            }}
          >
            <FiFileText size={16} />
            {isExporting ? "Exporting..." : "Export"}
          </button>
        </div>
      </section>

      {selectedStubIds.length > 0 ? (
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
              {selectedStubIds.length} selected
            </p>

            <button
              type="button"
              onClick={handleOpenBulkClaimConfirmation}
              disabled={Boolean(claimingStubId)}
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
                cursor: claimingStubId ? "not-allowed" : "pointer",
                opacity: claimingStubId ? 0.7 : 1,
              }}
              title="Mark Selected as Claimed"
            >
              <FaHandHolding size={18} />
            </button>
          </div>
        </section>
      ) : null}

      <MswdoStubResultsTable
        rows={displayedRows}
        isLoading={isLoadingData}
        errorMessage={errorMessage}
        hasSelectedEvent={hasSelectedEvent}
        hasSelectedBarangay={hasSelectedBarangay}
        claimingStubId={claimingStubId}
        claimErrorMessage={claimErrorMessage}
        onClaimStub={handleOpenClaimConfirmation}
        selectedStubIds={selectedStubIds}
        onToggleSelect={handleToggleSelect}
        onSelectAll={handleSelectAll}
      />

      <StubClaimConfirmModal
        isOpen={Boolean(pendingClaimStubId) || isBulkClaimConfirmOpen}
        isSubmitting={Boolean(claimingStubId)}
        onCancel={handleCancelClaim}
        onConfirm={handleConfirmClaim}
        selectedCount={isBulkClaimConfirmOpen ? selectedStubIds.length : 1}
      />
    </>
  );
};

export default StubDistributionPage;
