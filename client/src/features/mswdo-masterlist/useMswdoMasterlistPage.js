import { useEffect, useMemo, useRef, useState } from "react";
import { useHouseholdRegistrationForm } from "../household-registration/useHouseholdRegistrationForm";
import {
  archiveHousehold,
  departHousehold,
  fetchHouseholdDetails,
  formatDateTime,
  restoreHousehold,
} from "../masterlist/masterlistService";
import { exportConsolidatedMasterlist } from "./mswdoMasterlistService";
import {
  formatReliefPeriod,
  getEndedEventDateTimeText,
  getFilterPanelPosition,
  getScopedDisasterEvents,
} from "./mswdoMasterlistUi";
import { useMswdoMasterlist } from "./useMswdoMasterlist";
import {
  buildExportSuccessMessage,
  downloadExportFile,
  NO_EXPORT_DATA_MESSAGE,
  resolveExportErrorMessage,
} from "../../utils/exportHelpers";

export const useMswdoMasterlistPage = ({ authenticatedUser }) => {
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

  const [activeTab, setActiveTab] = useState("active");
  const [pendingDepartureHouseholdId, setPendingDepartureHouseholdId] =
    useState(null);
  const [isBulkDepartureConfirmOpen, setIsBulkDepartureConfirmOpen] =
    useState(false);
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
  const [registrationSuccessMessage, setRegistrationSuccessMessage] =
    useState("");
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
  const [pendingArchiveHouseholdId, setPendingArchiveHouseholdId] =
    useState("");
  const [archiveRemarks, setArchiveRemarks] = useState("");
  const [isArchivingHousehold, setIsArchivingHousehold] = useState(false);
  const [pendingRestoreHouseholdId, setPendingRestoreHouseholdId] =
    useState("");
  const [restoreRemarks, setRestoreRemarks] = useState("");
  const [isRestoringHousehold, setIsRestoringHousehold] = useState(false);
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
  const reliefPeriodText = formatReliefPeriod(selectedDisasterEvent);
  const hasRowsToExport = displayedRows.length > 0;
  const canRegisterFamily = activeTab === "active";
  const isEndedView = activeTab === "ended";
  const endedEventDateTimeText = getEndedEventDateTimeText(
    selectedDisasterEvent,
    formatDateTime,
  );
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

  const handleOpenRestoreHousehold = (householdId) => {
    setPendingRestoreHouseholdId(householdId);
    setRestoreRemarks("");
  };

  const handleCancelRestoreHousehold = () => {
    if (isRestoringHousehold) {
      return;
    }

    setPendingRestoreHouseholdId("");
    setRestoreRemarks("");
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

  const handleConfirmRestoreHousehold = async () => {
    if (!pendingRestoreHouseholdId || isRestoringHousehold) {
      return;
    }

    setIsRestoringHousehold(true);

    try {
      const response = await restoreHousehold({
        householdId: pendingRestoreHouseholdId,
        restoreRemarks,
      });

      setRegistrationSuccessMessage(
        response.message || "Household restored successfully",
      );
      setPendingRestoreHouseholdId("");
      setRestoreRemarks("");
      reloadMasterlist();
    } catch (error) {
      setAttendanceActionMessage(
        error.message || "Failed to restore household",
      );
    } finally {
      setIsRestoringHousehold(false);
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

  return {
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
    activeTab,
    pendingDepartureHouseholdId,
    isBulkDepartureConfirmOpen,
    isRecordingDeparture,
    selectedHouseholds,
    isFilterOpen,
    filterPanelPosition,
    isExportModalOpen,
    exportingFormat,
    selectedExportFormat,
    isRegisterModalOpen,
    registrationSuccessMessage,
    attendanceActionMessage,
    householdDetails,
    viewingHouseholdId,
    editingHouseholdId,
    isLoadingHouseholdDetails,
    householdDetailsErrorMessage,
    editHouseholdErrorMessage,
    pendingArchiveHouseholdId,
    archiveRemarks,
    isArchivingHousehold,
    pendingRestoreHouseholdId,
    restoreRemarks,
    isRestoringHousehold,
    exportFeedback,
    filterButtonRef,
    filterPanelRef,
    selectedSectorIds,
    activeEventLabel,
    reliefPeriodText,
    canRegisterFamily,
    isEndedView,
    endedEventDateTimeText,
    hasActiveSectorFilters,
    scopedDisasterEvents,
    registrationForm,
    editHouseholdForm,
    setSelectedDisasterEventId,
    setSelectedBarangayId,
    setSearchTerm,
    setSelectedExportFormat,
    setArchiveRemarks,
    setRestoreRemarks,
    setExportFeedback,
    setIsExportModalOpen,
    setIsFilterOpen,
    handleEventScopeChange,
    handleToggleSelect,
    handleSelectAll,
    handleOpenBulkDepartureConfirmation,
    handleOpenDepartureConfirmation,
    handleCloseDepartureConfirmation,
    handleConfirmDeparture,
    handleOpenRegisterModal,
    handleOpenHouseholdDetails,
    handleCloseHouseholdDetails,
    handleOpenEditHousehold,
    handleEditHouseholdFromDetails,
    handleCloseEditHousehold,
    handleOpenArchiveHousehold,
    handleCancelArchiveHousehold,
    handleConfirmArchiveHousehold,
    handleOpenRestoreHousehold,
    handleCancelRestoreHousehold,
    handleConfirmRestoreHousehold,
    handleExport,
    toggleSectorFilter,
    clearSectorFilters,
  };
};
