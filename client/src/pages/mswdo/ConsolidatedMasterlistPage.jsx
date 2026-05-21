import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiFileText, FiFilter, FiUserPlus } from "react-icons/fi";
import { MdDoorFront } from "react-icons/md";
import RegisterFamilyModal from "../../components/household-registration/RegisterFamilyModal";
import PageHeader, { pageHeaderStyles } from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import HouseholdArchiveConfirmModal from "../../components/masterlist/HouseholdArchiveConfirmModal";
import HouseholdDetailModal from "../../components/masterlist/HouseholdDetailModal";
import MasterlistDepartureConfirmModal from "../../components/masterlist/MasterlistDepartureConfirmModal";
import MasterlistTable from "../../components/masterlist/MasterlistTable";
import MswdoSummaryCards from "../../components/mswdo-masterlist/MswdoSummaryCards";
import ExportModal from "../../components/shared/ExportModal";
import FeedbackToast from "../../components/shared/FeedbackToast";
import SearchBar from "../../components/shared/SearchBar";
import StatusPill from "../../components/shared/StatusPill";
import { useAuth } from "../../context/AuthContext";
import { useHouseholdRegistrationForm } from "../../features/household-registration/useHouseholdRegistrationForm";
import {
  archiveHousehold,
  departHousehold,
  fetchHouseholdDetails,
  formatDateTime,
} from "../../features/masterlist/masterlistService";
import { exportConsolidatedMasterlist } from "../../features/mswdo-masterlist/mswdoMasterlistService";
import { useMswdoMasterlist } from "../../features/mswdo-masterlist/useMswdoMasterlist";
import {
  buildExportSuccessMessage,
  COMMON_EXPORT_FORMAT_OPTIONS,
  downloadExportFile,
  NO_EXPORT_DATA_MESSAGE,
  resolveExportErrorMessage,
} from "../../utils/exportHelpers";

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
    overflow: "hidden",
    boxSizing: "border-box",
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
    overflowY: "auto",
    flex: "1 1 auto",
    minHeight: 0,
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
    marginTop: "auto",
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

const ConsolidatedEvacueeMasterlist = () => {
  const { authenticatedUser } = useAuth();
  const {
    disasterEvents,
    barangays,
    sectors,
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
  const [sectorFiltersByTab, setSectorFiltersByTab] = useState({
    active: [],
    ended: [],
  });
  const [filterPanelPosition, setFilterPanelPosition] = useState({
    top: 0,
    left: 0,
    maxHeight: 320,
  });
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportingFormat, setExportingFormat] = useState("");
  const [selectedExportFormat, setSelectedExportFormat] = useState("csv");
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [registrationSuccessMessage, setRegistrationSuccessMessage] = useState("");
  const [attendanceActionMessage, setAttendanceActionMessage] = useState("");
  const [householdDetails, setHouseholdDetails] = useState(null);
  const [viewingHouseholdId, setViewingHouseholdId] = useState("");
  const [editingHouseholdId, setEditingHouseholdId] = useState("");
  const [editingHouseholdDetails, setEditingHouseholdDetails] = useState(null);
  const [isLoadingHouseholdDetails, setIsLoadingHouseholdDetails] =
    useState(false);
  const [isLoadingEditHouseholdDetails, setIsLoadingEditHouseholdDetails] =
    useState(false);
  const [householdDetailsErrorMessage, setHouseholdDetailsErrorMessage] =
    useState("");
  const [editHouseholdErrorMessage, setEditHouseholdErrorMessage] =
    useState("");
  const [pendingArchiveHouseholdId, setPendingArchiveHouseholdId] = useState("");
  const [archiveRemarks, setArchiveRemarks] = useState("");
  const [isArchivingHousehold, setIsArchivingHousehold] = useState(false);
  const [exportFeedback, setExportFeedback] = useState({
    type: "",
    message: "",
  });
  const filterButtonRef = useRef(null);
  const filterPanelRef = useRef(null);

  const selectedSectorIds = sectorFiltersByTab[activeTab] || [];

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
    setSectorFiltersByTab((currentFilters) => ({
      ...currentFilters,
      [activeTab]: currentFilters[activeTab].includes(sectorId)
        ? currentFilters[activeTab].filter((id) => id !== sectorId)
        : [...currentFilters[activeTab], sectorId],
    }));
  };

  const clearSectorFilters = () => {
    setSectorFiltersByTab((currentFilters) => ({
      ...currentFilters,
      [activeTab]: [],
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

  const editHouseholdForm = useHouseholdRegistrationForm({
    isOpen: Boolean(editingHouseholdId),
    mode: "edit",
    initialHouseholdDetails: editingHouseholdDetails,
    defaultBarangayId: selectedBarangayId || "",
    defaultBarangayName: selectedBarangayLabel || "",
    defaultDisasterEventId: selectedDisasterEventId || "",
    lockBarangaySelection: false,
    hideBarangaySelection: false,
    scopeNonResidentEvacuationCentersToBarangay: true,
    registeredBy: authenticatedUser?.id || null,
    onSuccess: (response) => {
      setRegistrationSuccessMessage(
        response?.message || "Household updated successfully",
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
    setSelectedSectorIds(selectedSectorIds);
  }, [selectedSectorIds, setSelectedSectorIds]);

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
  }, [activeTab, isFilterOpen, selectedSectorIds.length]);

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
    setSelectedHouseholds([]);
  }, [activeTab, selectedBarangayId, selectedDisasterEventId]);

  useEffect(() => {
    setIsFilterOpen(false);
  }, [activeTab, selectedBarangayId, selectedDisasterEventId]);

  useEffect(() => {
    if (selectedDisasterEvent?.status === "ACTIVE" && activeTab !== "active") {
      setActiveTab("active");
    }

    if (selectedDisasterEvent?.status === "CLOSED" && activeTab !== "ended") {
      setActiveTab("ended");
    }
  }, [activeTab, selectedDisasterEvent?.status]);

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
  }, [isFilterOpen, selectedSectorIds.length]);

  const handleOpenRegisterModal = () => {
    if (!selectedDisasterEventId) {
      window.alert("Select a disaster event before registering a family.");
      return;
    }

    if (!selectedBarangayId) {
      setExportFeedback({
        type: "error",
        message:
          "Select one barangay before registering a family. Registration cannot use the All Barangays view.",
      });
      return;
    }

    setRegistrationSuccessMessage("");
    setIsRegisterModalOpen(true);
  };

  const handleOpenHouseholdDetails = async (householdId) => {
    setViewingHouseholdId(householdId);
    setIsLoadingHouseholdDetails(true);
    setHouseholdDetails(null);
    setHouseholdDetailsErrorMessage("");

    try {
      const details = await fetchHouseholdDetails(householdId);
      setHouseholdDetails(details);
    } catch (error) {
      setHouseholdDetailsErrorMessage(
        error.message || "Failed to load household details.",
      );
    } finally {
      setIsLoadingHouseholdDetails(false);
    }
  };

  const handleCloseHouseholdDetails = () => {
    setViewingHouseholdId("");
    setHouseholdDetails(null);
    setHouseholdDetailsErrorMessage("");
    setIsLoadingHouseholdDetails(false);
  };

  const handleOpenEditHousehold = async (householdId) => {
    setEditHouseholdErrorMessage("");
    setEditingHouseholdId("");
    setEditingHouseholdDetails(null);
    setIsLoadingEditHouseholdDetails(true);

    try {
      const details = await fetchHouseholdDetails(householdId);
      setEditingHouseholdDetails(details);
      setEditingHouseholdId(householdId);
    } catch (error) {
      setEditHouseholdErrorMessage(
        error.message || "Failed to load household details for editing.",
      );
    } finally {
      setIsLoadingEditHouseholdDetails(false);
    }
  };

  const handleEditHouseholdFromDetails = async (householdId) => {
    handleCloseHouseholdDetails();
    await handleOpenEditHousehold(householdId);
  };

  const handleCloseEditHousehold = () => {
    setEditingHouseholdId("");
    setEditingHouseholdDetails(null);
    setEditHouseholdErrorMessage("");
    setIsLoadingEditHouseholdDetails(false);
  };

  const handleOpenArchiveHousehold = (householdId) => {
    setPendingArchiveHouseholdId(householdId);
    setArchiveRemarks("");
  };

  const handleCancelArchiveHousehold = () => {
    if (isArchivingHousehold) {
      return;
    }

    setPendingArchiveHouseholdId("");
    setArchiveRemarks("");
  };

  const handleConfirmArchiveHousehold = async () => {
    if (!pendingArchiveHouseholdId || isArchivingHousehold) {
      return;
    }

    setIsArchivingHousehold(true);

    try {
      const response = await archiveHousehold({
        householdId: pendingArchiveHouseholdId,
        archiveRemarks,
      });

      setRegistrationSuccessMessage(
        response.message || "Household archived successfully",
      );
      setPendingArchiveHouseholdId("");
      setArchiveRemarks("");
      reloadMasterlist();
    } catch (error) {
      setAttendanceActionMessage(
        error.message || "Failed to archive household",
      );
    } finally {
      setIsArchivingHousehold(false);
    }
  };

  const handleExport = async (format) => {
    if (!selectedDisasterEventId) {
      setExportFeedback({
        type: "error",
        message: "Select a disaster event before exporting the masterlist.",
      });
      return;
    }

    if (!hasRowsToExport) {
      setIsExportModalOpen(false);
      setExportFeedback({
        type: "error",
        message: NO_EXPORT_DATA_MESSAGE,
      });
      return;
    }

    setExportingFormat(format);
    setIsExportModalOpen(false);

    try {
      const file = await exportConsolidatedMasterlist({
        disasterEventId: selectedDisasterEventId,
        barangayId: selectedBarangayId || null,
        search: searchTerm,
        sectorIds: selectedSectorIds,
        format,
      });

      downloadExportFile(file);
      setExportFeedback({
        type: "success",
        message: buildExportSuccessMessage("MSWDO masterlist report"),
      });
    } catch (error) {
      setExportFeedback({
        type: "error",
        message: resolveExportErrorMessage(
          error,
          "Unable to export the masterlist.",
        ),
      });
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

      {editHouseholdErrorMessage ? (
        <section style={shellStyles.card}>
          <p style={{ margin: 0, color: "#a14d58", fontWeight: 700 }}>
            {editHouseholdErrorMessage}
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
        <div style={{ flex: 1 }}>
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search family head, address, or sectors"
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
              {hasActiveSectorFilters
                ? `Filter (${selectedSectorIds.length})`
                : "Filter"}
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
                <h3 style={filterPanelStyles.title}>Filter by Sector</h3>
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

                <div style={filterPanelStyles.actions}>
                  <button
                    type="button"
                    onClick={clearSectorFilters}
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
              onClick={() => {
                setSelectedExportFormat("csv");
                setExportFeedback({ type: "", message: "" });
                setIsExportModalOpen(true);
              }}
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
          </div>
        </div>
      </div>

      <MasterlistTable
        rows={displayedRows}
        hasSelectedEvent={Boolean(selectedDisasterEventId)}
        isLoading={isLoadingFilters || isLoadingMasterlist}
        errorMessage={errorMessage}
        onMarkDeparted={handleOpenDepartureConfirmation}
        onViewHousehold={handleOpenHouseholdDetails}
        onEditHousehold={handleOpenEditHousehold}
        onArchiveHousehold={handleOpenArchiveHousehold}
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

      <ExportModal
        isOpen={isExportModalOpen}
        title="Export MSWDO Report"
        description="Choose the masterlist report format to generate."
        reportOptions={[
          {
            value: "MSWDO_MASTERLIST",
            label: "Consolidated Evacuee Masterlist",
          },
        ]}
        formatOptions={COMMON_EXPORT_FORMAT_OPTIONS}
        selectedReportType="MSWDO_MASTERLIST"
        selectedFormat={selectedExportFormat}
        isSubmitting={Boolean(exportingFormat)}
        onReportTypeChange={() => {}}
        onFormatChange={setSelectedExportFormat}
        onClose={() => {
          if (!exportingFormat) {
            setIsExportModalOpen(false);
          }
        }}
        onSubmit={() => handleExport(selectedExportFormat)}
      />

      <RegisterFamilyModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        form={registrationForm}
      />

      <RegisterFamilyModal
        isOpen={Boolean(editingHouseholdId)}
        onClose={handleCloseEditHousehold}
        form={editHouseholdForm}
      />

      <HouseholdDetailModal
        isOpen={Boolean(viewingHouseholdId)}
        isLoading={isLoadingHouseholdDetails}
        errorMessage={householdDetailsErrorMessage}
        householdDetails={householdDetails}
        onClose={handleCloseHouseholdDetails}
        onEditHousehold={handleEditHouseholdFromDetails}
      />

      <HouseholdArchiveConfirmModal
        isOpen={Boolean(pendingArchiveHouseholdId)}
        isSubmitting={isArchivingHousehold}
        archiveRemarks={archiveRemarks}
        onChangeArchiveRemarks={setArchiveRemarks}
        onCancel={handleCancelArchiveHousehold}
        onConfirm={handleConfirmArchiveHousehold}
      />

      <FeedbackToast
        type={exportFeedback.type}
        message={exportFeedback.message}
        onClose={() => setExportFeedback({ type: "", message: "" })}
      />
    </>
  );
};

export default ConsolidatedEvacueeMasterlist;
