import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { FaHandHolding } from "react-icons/fa6";
import { FiFileText, FiFilter, FiPrinter } from "react-icons/fi";
import PageHeader, { pageHeaderStyles } from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import SearchBar from "../../components/shared/SearchBar";
import StatusPill from "../../components/shared/StatusPill";
import StubClaimConfirmModal from "../../components/stubs/StubClaimConfirmModal";
import MswdoStubResultsTable from "../../components/stubs/MswdoStubResultsTable";
import StubSummaryCards from "../../components/stubs/StubSummaryCards";
import { claimStub, fetchStubDetails } from "../../features/stubs/stubService";
import { useMswdoStubDistribution } from "../../features/stubs/useMswdoStubDistribution";
import db from "../../offline/db";
import { buildSyncDescriptor, findSyncEntry } from "../../offline/syncStatus";
import { subscribeToSyncUpdates } from "../../offline/syncService";

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

const filterPanelStyles = {
  panel: {
    position: "fixed",
    width: "min(380px, calc(100vw - 32px))",
    backgroundColor: "#ffffff",
    border: "1px solid #d6e2ef",
    borderRadius: "18px",
    boxShadow: "0 18px 36px rgba(31, 64, 95, 0.16)",
    padding: "18px",
    zIndex: 1200,
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    overflowY: "auto",
    boxSizing: "border-box",
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
  list: {
    display: "grid",
    gap: "10px",
    overflow: "visible",
    paddingRight: "4px",
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

const FILTER_PANEL_GAP = 12;
const FILTER_PANEL_VIEWPORT_PADDING = 16;
const MIN_FILTER_PANEL_HEIGHT = 220;

const getFilterPanelPosition = ({ triggerRect, panelHeight }) => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const constrainedPanelWidth = Math.min(
    380,
    viewportWidth - FILTER_PANEL_VIEWPORT_PADDING * 2,
  );
  const safePanelHeight = Math.max(panelHeight || 0, MIN_FILTER_PANEL_HEIGHT);
  const spaceBelow =
    viewportHeight - triggerRect.bottom - FILTER_PANEL_VIEWPORT_PADDING;
  const spaceAbove = triggerRect.top - FILTER_PANEL_VIEWPORT_PADDING;
  const shouldOpenBelow =
    spaceBelow >= MIN_FILTER_PANEL_HEIGHT || spaceBelow >= spaceAbove;

  let left = triggerRect.right - constrainedPanelWidth;
  left = Math.min(
    Math.max(left, FILTER_PANEL_VIEWPORT_PADDING),
    viewportWidth - constrainedPanelWidth - FILTER_PANEL_VIEWPORT_PADDING,
  );

  if (shouldOpenBelow) {
    const top = Math.max(
      FILTER_PANEL_VIEWPORT_PADDING,
      triggerRect.bottom + FILTER_PANEL_GAP,
    );
    const availableHeight =
      viewportHeight - top - FILTER_PANEL_VIEWPORT_PADDING;

    return {
      top,
      left,
      maxHeight: Math.max(availableHeight, 0),
    };
  }

  const maxHeight = Math.max(
    triggerRect.top - FILTER_PANEL_GAP - FILTER_PANEL_VIEWPORT_PADDING,
    0,
  );
  const top = Math.max(
    FILTER_PANEL_VIEWPORT_PADDING,
    triggerRect.top - FILTER_PANEL_GAP - Math.min(safePanelHeight, maxHeight),
  );

  return {
    top,
    left,
    maxHeight,
  };
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

const stubStatusOptions = [
  { value: "ISSUED", label: "Unclaimed" },
  { value: "CLAIMED", label: "Claimed" },
];

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

const buildStubPrintRoute = ({
  stubIds = [],
  eventId = "",
  barangayId = "",
  status = "",
}) => {
  const searchParams = new URLSearchParams();

  if (stubIds.length > 0) {
    searchParams.set("stubIds", stubIds.join(","));
  }

  if (eventId) {
    searchParams.set("eventId", eventId);
  }

  if (barangayId) {
    searchParams.set("barangayId", barangayId);
  }

  if (status) {
    searchParams.set("status", status);
  }

  return `/mswdo/print/stubs?${searchParams.toString()}`;
};

const StubDistributionPage = () => {
  const {
    disasterEvents,
    barangays,
    sectors,
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
    setSelectedSectorIds,
    setSelectedStubStatus,
    setSearchTerm,
    reloadDashboard,
  } = useMswdoStubDistribution();

  const [activeTab, setActiveTab] = useState("active");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [claimingStubId, setClaimingStubId] = useState("");
  const [claimErrorMessage, setClaimErrorMessage] = useState("");
  const [pendingClaimStubId, setPendingClaimStubId] = useState("");
  const [pendingClaimStubDetails, setPendingClaimStubDetails] = useState(null);
  const [isLoadingPendingClaimStubDetails, setIsLoadingPendingClaimStubDetails] =
    useState(false);
  const [selectedStubIds, setSelectedStubIds] = useState([]);
  const [isBulkClaimConfirmOpen, setIsBulkClaimConfirmOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [filtersByTab, setFiltersByTab] = useState({
    active: {
      sectorIds: [],
      stubStatus: "",
    },
    ended: {
      sectorIds: [],
      stubStatus: "",
    },
  });
  const [filterPanelPosition, setFilterPanelPosition] = useState({
    top: 0,
    left: 0,
    maxHeight: 320,
  });
  const filterButtonRef = useRef(null);
  const filterPanelRef = useRef(null);
  const syncQueueEntries =
    useLiveQuery(() => db.syncQueue.toArray(), [], []) || [];

  const selectedSectorIds = filtersByTab[activeTab]?.sectorIds || [];
  const selectedStubStatus = filtersByTab[activeTab]?.stubStatus || "";
  const displayedRowsWithSyncStatus = useMemo(() => {
    return displayedRows.map((row) => {
      const matchingEntry = findSyncEntry(syncQueueEntries, (entry) => {
        if (entry.moduleName !== "stubs") {
          return false;
        }

        return (
          entry.entityServerId === row.id ||
          entry.entityLocalId === row.id ||
          entry.payload?.stub_id === row.id
        );
      });

      return {
        ...row,
        sync_status: buildSyncDescriptor(matchingEntry).status,
      };
    });
  }, [displayedRows, syncQueueEntries]);

  const scopedDisasterEvents = useMemo(() => {
    const allowedStatuses =
      activeTab === "active" ? ["ACTIVE"] : ["CLOSED", "ARCHIVED"];

    return disasterEvents.filter((event) => allowedStatuses.includes(event.status));
  }, [activeTab, disasterEvents]);

  const activeEventLabel = selectedDisasterEvent
    ? `${selectedDisasterEvent.event_code} - ${selectedDisasterEvent.title}`
    : "No disaster event selected";
  const isEndedView = activeTab === "ended";
  const activeFilterCount =
    selectedSectorIds.length + (selectedStubStatus ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0;

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
    setSelectedSectorIds(selectedSectorIds);
    setSelectedStubStatus(selectedStubStatus);
  }, [
    selectedSectorIds,
    selectedStubStatus,
    setSelectedSectorIds,
    setSelectedStubStatus,
  ]);

  useEffect(() => {
    setSelectedStubIds([]);
    setPendingClaimStubId("");
    setPendingClaimStubDetails(null);
    setIsBulkClaimConfirmOpen(false);
    setClaimErrorMessage("");
  }, [activeTab, selectedBarangayId, selectedDisasterEventId]);

  useEffect(() => {
    if (!isFilterOpen) {
      return;
    }

    updateFilterPanelPosition();

    const handleWindowChange = () => {
      updateFilterPanelPosition();
    };

    window.addEventListener("resize", handleWindowChange);
    window.addEventListener("scroll", handleWindowChange, true);

    return () => {
      window.removeEventListener("resize", handleWindowChange);
      window.removeEventListener("scroll", handleWindowChange, true);
    };
  }, [activeTab, isFilterOpen, activeFilterCount]);

  useEffect(() => {
    if (!isFilterOpen) {
      return;
    }

    const handleOutsideClick = (event) => {
      if (
        filterPanelRef.current?.contains(event.target) ||
        filterButtonRef.current?.contains(event.target)
      ) {
        return;
      }

      setIsFilterOpen(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isFilterOpen]);

  useEffect(() => {
    setIsFilterOpen(false);
  }, [activeTab, selectedBarangayId, selectedDisasterEventId]);

  useEffect(() => {
    if (!isFilterOpen) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      updateFilterPanelPosition();
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [isFilterOpen, activeFilterCount]);

  useEffect(() => {
    const visibleStubIds = new Set(displayedRowsWithSyncStatus.map((row) => row.id));
    setSelectedStubIds((currentValues) =>
      currentValues.filter((stubId) => visibleStubIds.has(stubId)),
    );
  }, [displayedRowsWithSyncStatus]);

  useEffect(() => {
    const unsubscribe = subscribeToSyncUpdates(() => {
      if (typeof navigator !== "undefined" && navigator.onLine) {
        reloadDashboard();
      }
    });

    return () => unsubscribe();
  }, [reloadDashboard]);

  const toggleSectorFilter = (sectorId) => {
    setFiltersByTab((currentFilters) => ({
      ...currentFilters,
      [activeTab]: {
        ...currentFilters[activeTab],
        sectorIds: currentFilters[activeTab].sectorIds.includes(sectorId)
          ? currentFilters[activeTab].sectorIds.filter((id) => id !== sectorId)
          : [...currentFilters[activeTab].sectorIds, sectorId],
      },
    }));
  };

  const clearFilters = () => {
    setFiltersByTab((currentFilters) => ({
      ...currentFilters,
      [activeTab]: {
        sectorIds: [],
        stubStatus: "",
      },
    }));
  };

  const updateFilterPanelPosition = () => {
    if (!filterButtonRef.current) {
      return;
    }

    const triggerRect = filterButtonRef.current.getBoundingClientRect();
    const panelHeight = filterPanelRef.current?.getBoundingClientRect().height || 0;

    setFilterPanelPosition(getFilterPanelPosition({ triggerRect, panelHeight }));
  };

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
    if (isEndedView) {
      return;
    }

    setSelectedStubIds((currentValues) =>
      currentValues.includes(stubId)
        ? currentValues.filter((id) => id !== stubId)
        : [...currentValues, stubId],
    );
  };

  const handleSelectAll = () => {
    if (isEndedView) {
      setSelectedStubIds([]);
      return;
    }

    const selectableStubIds = displayedRowsWithSyncStatus
      .filter((row) => row.status === "ISSUED")
      .map((row) => row.id);

    const areAllSelected =
      selectableStubIds.length > 0 &&
      selectableStubIds.every((id) => selectedStubIds.includes(id));

    setSelectedStubIds(areAllSelected ? [] : selectableStubIds);
  };

  const handleOpenBulkClaimConfirmation = () => {
    if (isEndedView || !selectedStubIds.length || claimingStubId) {
      return;
    }

    setClaimErrorMessage("");
    setPendingClaimStubId("");
    setPendingClaimStubDetails(null);
    setIsBulkClaimConfirmOpen(true);
  };

  const handleOpenClaimConfirmation = (stubId) => {
    if (isEndedView || claimingStubId) {
      return;
    }

    setClaimErrorMessage("");
    setIsBulkClaimConfirmOpen(false);
    setPendingClaimStubId(stubId);
    setPendingClaimStubDetails(null);
  };

  useEffect(() => {
    if (!pendingClaimStubId || isBulkClaimConfirmOpen) {
      setPendingClaimStubDetails(null);
      setIsLoadingPendingClaimStubDetails(false);
      return;
    }

    let isMounted = true;

    const loadPendingClaimStubDetails = async () => {
      setIsLoadingPendingClaimStubDetails(true);

      try {
        const stubDetails = await fetchStubDetails(pendingClaimStubId);

        if (isMounted) {
          setPendingClaimStubDetails(stubDetails);
        }
      } catch (error) {
        if (isMounted) {
          setClaimErrorMessage(
            error.message || "Unable to load the selected stub details.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingPendingClaimStubDetails(false);
        }
      }
    };

    loadPendingClaimStubDetails();

    return () => {
      isMounted = false;
    };
  }, [isBulkClaimConfirmOpen, pendingClaimStubId]);

  const handleCancelClaim = () => {
    if (claimingStubId) {
      return;
    }

    setPendingClaimStubId("");
    setPendingClaimStubDetails(null);
    setIsBulkClaimConfirmOpen(false);
  };

  const handleConfirmClaim = async () => {
    if (isEndedView || claimingStubId) {
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
        setPendingClaimStubDetails(null);
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
      setPendingClaimStubDetails(null);
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

    if (!displayedRowsWithSyncStatus.length) {
      window.alert("No stub records are available to export for the current filters.");
      return;
    }

    setIsExporting(true);

    try {
      downloadCsvFile(
        displayedRowsWithSyncStatus,
        selectedDisasterEvent?.event_code || "event",
        selectedBarangay?.name || "barangay",
      );
    } finally {
      setIsExporting(false);
    }
  };

  const openStubPrintPage = (printUrl) => {
    const printWindow = window.open(printUrl, "_blank", "noopener,noreferrer");

    if (!printWindow) {
      window.alert("Allow pop-ups to open the printable stub page.");
    }
  };

  const handlePrintSingleStub = (row) => {
    if (!row?.id) {
      window.alert("No printable stub data is available for the selected record.");
      return;
    }

    openStubPrintPage(
      buildStubPrintRoute({
        stubIds: [row.id],
      }),
    );
  };

  const handlePrintIssuedStubs = () => {
    const issuedRows = displayedRowsWithSyncStatus.filter((row) => row.status === "ISSUED");

    if (!issuedRows.length) {
      window.alert("No issued stubs are available to print.");
      return;
    }

    if (!selectedDisasterEventId || !selectedBarangayId) {
      window.alert("Select an active disaster event and barangay before printing.");
      return;
    }

    openStubPrintPage(
      buildStubPrintRoute({
        eventId: selectedDisasterEventId,
        barangayId: selectedBarangayId,
        status: "ISSUED",
      }),
    );
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
          <div>
            <button
              ref={filterButtonRef}
              type="button"
              onClick={() => setIsFilterOpen((currentValue) => !currentValue)}
              style={{
                ...pageHeaderStyles.secondaryButton,
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <FiFilter size={16} />
              {hasActiveFilters ? `Filter (${activeFilterCount})` : "Filter"}
            </button>

            {isFilterOpen ? (
              <div
                ref={filterPanelRef}
                style={{
                  ...filterPanelStyles.panel,
                  top: filterPanelPosition.top,
                  left: filterPanelPosition.left,
                  maxHeight: filterPanelPosition.maxHeight,
                }}
              >
                <h3 style={filterPanelStyles.title}>Filter Stub Records</h3>

                <label style={filterPanelStyles.field}>
                  <span style={filterPanelStyles.label}>Stub Status</span>
                  <select
                    value={selectedStubStatus}
                    onChange={(event) =>
                      setFiltersByTab((currentFilters) => ({
                        ...currentFilters,
                        [activeTab]: {
                          ...currentFilters[activeTab],
                          stubStatus: event.target.value,
                        },
                      }))
                    }
                    style={filterPanelStyles.select}
                  >
                    <option value="">All Stub Statuses</option>
                    {stubStatusOptions.map((statusOption) => (
                      <option key={statusOption.value} value={statusOption.value}>
                        {statusOption.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div style={filterPanelStyles.field}>
                  <span style={filterPanelStyles.label}>Sector</span>
                  <div style={filterPanelStyles.list}>
                    {sectors.length > 0 ? (
                      sectors.map((sector) => (
                      <label key={sector.id} style={filterPanelStyles.option}>
                        <input
                          type="checkbox"
                          checked={selectedSectorIds.includes(sector.id)}
                          onChange={() => toggleSectorFilter(sector.id)}
                          style={{ accentColor: "#2f6499" }}
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
                </div>

                <div style={filterPanelStyles.actions}>
                  <button
                    type="button"
                    onClick={clearFilters}
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

          <button
            type="button"
            onClick={handleExport}
            disabled={
              !hasSelectedEvent ||
              !hasSelectedBarangay ||
              !displayedRowsWithSyncStatus.length ||
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
                !displayedRowsWithSyncStatus.length ||
                isExporting
                  ? "not-allowed"
                  : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              opacity:
                !hasSelectedEvent ||
                !hasSelectedBarangay ||
                !displayedRowsWithSyncStatus.length ||
                isExporting
                  ? 0.7
                  : 1,
            }}
          >
            <FiFileText size={16} />
            {isExporting ? "Exporting..." : "Export"}
          </button>

          {activeTab === "active" ? (
            <button
              type="button"
              onClick={handlePrintIssuedStubs}
              disabled={
                !hasSelectedEvent ||
                !hasSelectedBarangay ||
                !displayedRowsWithSyncStatus.some((row) => row.status === "ISSUED")
              }
              style={{
                ...pageHeaderStyles.secondaryButton,
                display: "flex",
                alignItems: "center",
                gap: "8px",
                opacity:
                  !hasSelectedEvent ||
                  !hasSelectedBarangay ||
                  !displayedRowsWithSyncStatus.some((row) => row.status === "ISSUED")
                    ? 0.7
                    : 1,
              }}
            >
              <FiPrinter size={16} />
              Print Issued Stubs
            </button>
          ) : null}
        </div>
      </section>

      {!isEndedView && selectedStubIds.length > 0 ? (
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
        rows={displayedRowsWithSyncStatus}
        isLoading={isLoadingData}
        errorMessage={errorMessage}
        hasSelectedEvent={hasSelectedEvent}
        hasSelectedBarangay={hasSelectedBarangay}
        claimingStubId={claimingStubId}
        claimErrorMessage={claimErrorMessage}
        onClaimStub={handleOpenClaimConfirmation}
        onPrintStub={handlePrintSingleStub}
        isClaimReadOnly={isEndedView}
        selectedStubIds={selectedStubIds}
        onToggleSelect={handleToggleSelect}
        onSelectAll={handleSelectAll}
      />

      <StubClaimConfirmModal
        isOpen={Boolean(pendingClaimStubId) || isBulkClaimConfirmOpen}
        isSubmitting={Boolean(claimingStubId)}
        isLoadingStubDetails={isLoadingPendingClaimStubDetails}
        onCancel={handleCancelClaim}
        onConfirm={handleConfirmClaim}
        selectedCount={isBulkClaimConfirmOpen ? selectedStubIds.length : 1}
        stubDetails={pendingClaimStubDetails}
      />
    </>
  );
};

export default StubDistributionPage;
