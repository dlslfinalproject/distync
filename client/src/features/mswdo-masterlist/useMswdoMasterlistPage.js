import { useEffect, useMemo, useRef, useState } from "react";
import { useHouseholdRegistrationForm } from "../household-registration/useHouseholdRegistrationForm";
import {
  departHousehold,
  fetchHouseholdDetails,
  formatDateTime,
  isOperationallyActiveHousehold,
  restoreHousehold,
} from "../masterlist/masterlistService";
import {
  exportConsolidatedMasterlist,
  fetchConsolidatedMasterlist,
} from "./mswdoMasterlistService";
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
  resolveExportErrorMessage,
} from "../../utils/exportHelpers";
import { MASTERLIST_SORT_OPTIONS } from "../masterlist/masterlistService";
import { getCanonicalMemberSectorCode } from "../../utils/registrationOptions";

export const useMswdoMasterlistPage = ({ authenticatedUser }) => {
  const {
    disasterEvents,
    barangays,
    sectors,
    selectedDisasterEventId,
    selectedBarangayId,
    selectedDisasterEvent,
    searchTerm,
    recordStatus,
    selectedSortOrder,
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
    setSelectedSortOrder,
    setSearchTerm,
    setRecordStatus,
    reloadMasterlist,
  } = useMswdoMasterlist();

  const [activeTab, setActiveTab] = useState("active");
  const [pendingDepartureHouseholdId, setPendingDepartureHouseholdId] =
    useState(null);
  const [pendingDepartureHouseholdDetails, setPendingDepartureHouseholdDetails] =
    useState(null);
  const [pendingBulkDepartureHouseholds, setPendingBulkDepartureHouseholds] =
    useState([]);
  const [isLoadingDepartureHouseholdDetails, setIsLoadingDepartureHouseholdDetails] =
    useState(false);
  const [isBulkDepartureConfirmOpen, setIsBulkDepartureConfirmOpen] =
    useState(false);
  const [isRecordingDeparture, setIsRecordingDeparture] = useState(false);
  const [selectedHouseholds, setSelectedHouseholds] = useState([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [sectorFiltersByTab, setSectorFiltersByTab] = useState({
    active: [],
    ended: [],
  });
  const [sortOrderByTab, setSortOrderByTab] = useState({
    active: "newest",
    ended: "newest",
  });
  const [recordStatusByTab, setRecordStatusByTab] = useState({
    active: "active",
    ended: "all",
  });
  const [filterPanelPosition, setFilterPanelPosition] = useState({
    top: 0,
    left: 0,
    maxHeight: 320,
  });
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportingFormat, setExportingFormat] = useState("");
  const [selectedExportFormat, setSelectedExportFormat] = useState("csv");
  const [selectedExportDisasterEventId, setSelectedExportDisasterEventId] =
    useState("");
  const [selectedExportBarangayIds, setSelectedExportBarangayIds] = useState([]);
  const [selectedExportRecordStatus, setSelectedExportRecordStatus] =
    useState("active");
  const [selectedExportSortOrder, setSelectedExportSortOrder] =
    useState("newest");
  const [selectedExportSectorIds, setSelectedExportSectorIds] = useState([]);
  const [availableExportSectorIds, setAvailableExportSectorIds] = useState([]);
  const [availableExportBarangayIds, setAvailableExportBarangayIds] = useState([]);
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
  const [pendingRestoreHouseholdId, setPendingRestoreHouseholdId] =
    useState("");
  const [pendingRestoreHouseholdDetails, setPendingRestoreHouseholdDetails] =
    useState(null);
  const [isLoadingRestoreHouseholdDetails, setIsLoadingRestoreHouseholdDetails] =
    useState(false);
  const [isRestoringHousehold, setIsRestoringHousehold] = useState(false);
  const [exportFeedback, setExportFeedback] = useState({
    type: "",
    message: "",
  });
  const filterButtonRef = useRef(null);
  const filterPanelRef = useRef(null);

  const selectedSectorIds = sectorFiltersByTab[activeTab] || [];
  const selectedSortOrderByTab = sortOrderByTab[activeTab] || "newest";
  const selectedRecordStatus = recordStatusByTab[activeTab] || "active";
  const activeEventLabel = selectedDisasterEvent
    ? `${selectedDisasterEvent.event_code} - ${selectedDisasterEvent.title}`
    : "No disaster event selected";
  const reliefPeriodText = formatReliefPeriod(selectedDisasterEvent);
  const canRegisterFamily = activeTab === "active";
  const isEndedView = activeTab === "ended";
  const endedEventDateTimeText = getEndedEventDateTimeText(
    selectedDisasterEvent,
    formatDateTime,
  );
  const hasActiveSectorFilters = selectedSectorIds.length > 0;
  const hasNonDefaultSort = selectedSortOrderByTab !== "newest";
  const scopedDisasterEvents = useMemo(() => {
    return getScopedDisasterEvents({
      events: disasterEvents,
      activeTab,
      barangayId: selectedBarangayId,
    });
  }, [activeTab, disasterEvents, selectedBarangayId]);
  const selectableBarangays = useMemo(() => {
    if (!selectedDisasterEvent) {
      return barangays;
    }

    const affectedBarangayIds = Array.isArray(
      selectedDisasterEvent.affected_barangays,
    )
      ? selectedDisasterEvent.affected_barangays
          .map((barangay) => barangay?.id)
          .filter(Boolean)
      : [];

    if (affectedBarangayIds.length === 0) {
      return barangays;
    }

    return barangays.filter((barangay) => affectedBarangayIds.includes(barangay.id));
  }, [barangays, selectedDisasterEvent]);
  const selectedExportDisasterEvent = useMemo(
    () =>
      disasterEvents.find((event) => event.id === selectedExportDisasterEventId) ||
      null,
    [disasterEvents, selectedExportDisasterEventId],
  );

  const selectedBarangayLabel = selectedBarangayId
    ? barangays.find((barangay) => barangay.id === selectedBarangayId)?.name
    : "All Barangays";
  const pendingDepartureRow = displayedRows.find(
    (row) => row.household_id === pendingDepartureHouseholdId,
  );
  const pendingDepartureFamilyHeadName = pendingDepartureHouseholdDetails?.household
    ? [
        pendingDepartureHouseholdDetails.household.family_head_first_name,
        pendingDepartureHouseholdDetails.household.family_head_middle_name,
        pendingDepartureHouseholdDetails.household.family_head_last_name,
        pendingDepartureHouseholdDetails.household.family_head_suffix,
      ]
        .filter(Boolean)
        .join(" ")
    : pendingDepartureRow?.family_head_name || "";
  const pendingDepartureFamilyHeadPhotoUrl =
    pendingDepartureHouseholdDetails?.household?.family_head_photo_url || "";

  const registrationForm = useHouseholdRegistrationForm({
    isOpen: isRegisterModalOpen,
    defaultBarangayId: selectedBarangayId || "",
    defaultBarangayName: selectedBarangayId ? selectedBarangayLabel || "" : "",
    defaultDisasterEventId: selectedDisasterEventId || "",
    lockBarangaySelection: false,
    hideBarangaySelection: false,
    restrictNonResidentToEvacCenter: true,
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
    restrictNonResidentToEvacCenter: true,
    scopeNonResidentEvacuationCentersToBarangay: true,
    registeredBy: authenticatedUser?.id || null,
    onSuccess: (response) => {
      setRegistrationSuccessMessage(
        response?.message || "Household updated successfully",
      );
      reloadMasterlist();
    },
  });

  useEffect(() => {
    if (!selectedExportDisasterEvent) {
      if (selectedExportBarangayIds.length > 0) {
        setSelectedExportBarangayIds([]);
      }
      return;
    }

    const affectedBarangayIds = Array.isArray(
      selectedExportDisasterEvent.affected_barangays,
    )
      ? selectedExportDisasterEvent.affected_barangays
          .map((barangay) => barangay?.id)
          .filter(Boolean)
      : [];

    setSelectedExportBarangayIds((currentIds) =>
      currentIds.filter((barangayId) => affectedBarangayIds.includes(barangayId)),
    );
  }, [selectedExportBarangayIds.length, selectedExportDisasterEvent]);

  useEffect(() => {
    let isMounted = true;

    const loadAvailableExportOptions = async () => {
      if (!isExportModalOpen || !selectedExportDisasterEventId) {
        if (isMounted) {
          setAvailableExportSectorIds([]);
          setAvailableExportBarangayIds([]);
        }
        return;
      }

      try {
        const payload = await fetchConsolidatedMasterlist({
          disasterEventId: selectedExportDisasterEventId,
          barangayId: null,
          recordStatus: "all",
        });

        if (!isMounted) {
          return;
        }

        const scopedHouseholds =
          selectedExportRecordStatus === "archived"
            ? (payload.data || []).filter(
                (household) => !isOperationallyActiveHousehold(household),
              )
            : selectedExportRecordStatus === "all"
              ? payload.data || []
              : (payload.data || []).filter(isOperationallyActiveHousehold);

        const nextSectorIds = [
          ...scopedHouseholds.flatMap((household) => [
            ...(household.household_sectors || []).map((sector) =>
              getCanonicalMemberSectorCode(sector.code),
            ),
            ...(household.members || []).flatMap((member) =>
              (member.sectors || []).map((sector) =>
                getCanonicalMemberSectorCode(sector.code),
              ),
            ),
          ]),
        ].filter(Boolean);
        const nextBarangayIds = scopedHouseholds
          .map((household) => household?.barangay?.id)
          .filter(Boolean);

        setAvailableExportSectorIds([...new Set(nextSectorIds)]);
        setAvailableExportBarangayIds([...new Set(nextBarangayIds)]);
      } catch (_error) {
        if (isMounted) {
          setAvailableExportSectorIds([]);
          setAvailableExportBarangayIds([]);
        }
      }
    };

    loadAvailableExportOptions();

    return () => {
      isMounted = false;
    };
  }, [isExportModalOpen, selectedExportDisasterEventId, selectedExportRecordStatus]);

  useEffect(() => {
    setSelectedExportSectorIds((currentIds) =>
      currentIds.filter((sectorId) => availableExportSectorIds.includes(sectorId)),
    );
  }, [availableExportSectorIds]);

  useEffect(() => {
    setSelectedExportBarangayIds((currentIds) =>
      currentIds.filter((barangayId) =>
        availableExportBarangayIds.includes(barangayId),
      ),
    );
  }, [availableExportBarangayIds]);

  const handleExportDisasterEventChange = (nextEventId) => {
    setSelectedExportDisasterEventId(nextEventId);

    const nextEvent = disasterEvents.find((event) => event.id === nextEventId);
    const nextAffectedBarangayIds = Array.isArray(nextEvent?.affected_barangays)
      ? nextEvent.affected_barangays
          .map((barangay) => barangay?.id)
          .filter(Boolean)
      : [];

    setSelectedExportBarangayIds(nextAffectedBarangayIds);
  };

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
    setSortOrderByTab((currentValues) => ({
      ...currentValues,
      [activeTab]: "newest",
    }));
  };

  const setTabSortOrder = (value) => {
    setSortOrderByTab((currentValues) => ({
      ...currentValues,
      [activeTab]: value || "newest",
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

  const handleOpenBulkDepartureConfirmation = async () => {
    if (isEndedView || !selectedHouseholds.length || isRecordingDeparture) {
      return;
    }

    setPendingDepartureHouseholdId("");
    setPendingDepartureHouseholdDetails(null);
    setPendingBulkDepartureHouseholds([]);
    setIsLoadingDepartureHouseholdDetails(true);
    setIsBulkDepartureConfirmOpen(true);

    const selectedRows = displayedRows.filter((row) =>
      selectedHouseholds.includes(row.household_id),
    );

    try {
      const detailResults = await Promise.allSettled(
        selectedHouseholds.map((householdId) => fetchHouseholdDetails(householdId)),
      );

      const previewItems = selectedHouseholds.map((householdId, index) => {
        const detailValue =
          detailResults[index]?.status === "fulfilled"
            ? detailResults[index].value
            : null;
        const fallbackRow = selectedRows.find(
          (row) => row.household_id === householdId,
        );
        const detailHousehold = detailValue?.household || null;
        const familyHeadName = detailHousehold
          ? [
              detailHousehold.family_head_first_name,
              detailHousehold.family_head_middle_name,
              detailHousehold.family_head_last_name,
              detailHousehold.family_head_suffix,
            ]
              .filter(Boolean)
              .join(" ")
          : fallbackRow?.family_head_name || "";

        return {
          household_id: householdId,
          family_head_name: familyHeadName,
          family_head_photo_url: detailHousehold?.family_head_photo_url || "",
        };
      });

      setPendingBulkDepartureHouseholds(previewItems);
    } catch (_error) {
      setPendingBulkDepartureHouseholds(
        selectedRows.map((row) => ({
          household_id: row.household_id,
          family_head_name: row.family_head_name || "",
          family_head_photo_url: "",
        })),
      );
    } finally {
      setIsLoadingDepartureHouseholdDetails(false);
    }
  };

  const handleOpenDepartureConfirmation = async (householdId) => {
    if (isEndedView || isRecordingDeparture) {
      return;
    }

    setIsBulkDepartureConfirmOpen(false);
    setPendingDepartureHouseholdId(householdId);
    setPendingDepartureHouseholdDetails(null);
    setPendingBulkDepartureHouseholds([]);
    setIsLoadingDepartureHouseholdDetails(true);

    try {
      const details = await fetchHouseholdDetails(householdId);
      setPendingDepartureHouseholdDetails(details);
    } catch (_error) {
      setPendingDepartureHouseholdDetails(null);
    } finally {
      setIsLoadingDepartureHouseholdDetails(false);
    }
  };

  const handleCloseDepartureConfirmation = () => {
    if (isRecordingDeparture) {
      return;
    }

    setPendingDepartureHouseholdId(null);
    setPendingDepartureHouseholdDetails(null);
    setPendingBulkDepartureHouseholds([]);
    setIsLoadingDepartureHouseholdDetails(false);
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
        setPendingBulkDepartureHouseholds([]);
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
        setPendingDepartureHouseholdDetails(null);
        setPendingBulkDepartureHouseholds([]);
        setIsLoadingDepartureHouseholdDetails(false);
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
    if (!selectedBarangayId) {
      return;
    }

    const isSelectedBarangayVisible = selectableBarangays.some(
      (barangay) => barangay.id === selectedBarangayId,
    );

    if (!isSelectedBarangayVisible) {
      setSelectedBarangayId("");
    }
  }, [selectableBarangays, selectedBarangayId, setSelectedBarangayId]);

  useEffect(() => {
    setSelectedSectorIds(selectedSectorIds);
  }, [selectedSectorIds, setSelectedSectorIds]);

  useEffect(() => {
    setSelectedSortOrder(selectedSortOrderByTab);
  }, [selectedSortOrderByTab, setSelectedSortOrder]);

  useEffect(() => {
    setRecordStatus(selectedRecordStatus);
  }, [selectedRecordStatus, setRecordStatus]);

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
    setIsFilterOpen(false);
  }, [activeTab, selectedBarangayId, selectedDisasterEventId]);

  useEffect(() => {
    setSelectedHouseholds([]);
    setPendingDepartureHouseholdId(null);
    setPendingDepartureHouseholdDetails(null);
    setPendingBulkDepartureHouseholds([]);
    setIsLoadingDepartureHouseholdDetails(false);
    setIsBulkDepartureConfirmOpen(false);
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

    setRegistrationSuccessMessage("");
    setIsRegisterModalOpen(true);
  };

  const handleCloseRegisterModal = () => {
    setIsRegisterModalOpen(false);
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

  const handleOpenRestoreHousehold = async (householdId) => {
    setPendingRestoreHouseholdId(householdId);
    setPendingRestoreHouseholdDetails(null);
    setIsLoadingRestoreHouseholdDetails(true);

    try {
      const details = await fetchHouseholdDetails(householdId);
      setPendingRestoreHouseholdDetails(details);
    } catch (_error) {
      setPendingRestoreHouseholdDetails(null);
    } finally {
      setIsLoadingRestoreHouseholdDetails(false);
    }
  };

  const handleRecordStatusChange = (nextRecordStatus) => {
    setRecordStatusByTab((currentValue) => ({
      ...currentValue,
      [activeTab]: nextRecordStatus,
    }));
  };

  const handleCancelRestoreHousehold = () => {
    if (isRestoringHousehold) {
      return;
    }

    setPendingRestoreHouseholdId("");
    setPendingRestoreHouseholdDetails(null);
    setIsLoadingRestoreHouseholdDetails(false);
  };

  const handleConfirmRestoreHousehold = async () => {
    if (!pendingRestoreHouseholdId || isRestoringHousehold) {
      return;
    }

    setIsRestoringHousehold(true);

    try {
      const response = await restoreHousehold({
        householdId: pendingRestoreHouseholdId,
      });

      setRegistrationSuccessMessage(
        response.message || "Household return recorded successfully",
      );
      setPendingRestoreHouseholdId("");
      setPendingRestoreHouseholdDetails(null);
      setIsLoadingRestoreHouseholdDetails(false);
      reloadMasterlist();
    } catch (error) {
      setAttendanceActionMessage(
        error.message || "Failed to record household return",
      );
    } finally {
      setIsRestoringHousehold(false);
    }
  };

  const handleExport = async (format) => {
    if (!selectedExportDisasterEventId) {
      setExportFeedback({
        type: "error",
        message: "Select a disaster event before exporting the masterlist.",
      });
      return;
    }

    if (selectedExportBarangayIds.length === 0) {
      setExportFeedback({
        type: "error",
        message: "Select at least one barangay before exporting the masterlist.",
      });
      return;
    }

    setExportingFormat(format);
    setIsExportModalOpen(false);

    try {
      const selectedExportSourceSectorIds = selectedExportSectorIds
        .map(
          (sectorCode) =>
            sectors.find((sector) => sector.id === sectorCode)?.source_sector_id ||
            null,
        )
        .filter(Boolean);

      const file = await exportConsolidatedMasterlist({
        disasterEventId: selectedExportDisasterEventId,
        barangayIds: selectedExportBarangayIds,
        search: "",
        recordStatus: selectedExportRecordStatus,
        sortOrder: selectedExportSortOrder,
        sectorIds: selectedExportSourceSectorIds,
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
    recordStatus,
    displayedRows,
    summaryMetrics,
    isLoadingFilters,
    isLoadingMasterlist,
    isLoadingDashboard,
    errorMessage,
    dashboardErrorMessage,
    activeTab,
    pendingDepartureHouseholdId,
    pendingDepartureHouseholdDetails,
    pendingBulkDepartureHouseholds,
    isLoadingDepartureHouseholdDetails,
    isBulkDepartureConfirmOpen,
    isRecordingDeparture,
    selectedHouseholds,
    isFilterOpen,
    filterPanelPosition,
    isExportModalOpen,
    exportingFormat,
    selectedExportFormat,
    selectedExportDisasterEventId,
    selectedExportBarangayIds,
    selectedExportRecordStatus,
    selectedExportSortOrder,
    selectedExportSectorIds,
    availableExportSectorIds,
    availableExportBarangayIds,
    isRegisterModalOpen,
    registrationSuccessMessage,
    attendanceActionMessage,
    householdDetails,
    viewingHouseholdId,
    editingHouseholdId,
    isLoadingHouseholdDetails,
    householdDetailsErrorMessage,
    editHouseholdErrorMessage,
    pendingRestoreHouseholdId,
    pendingRestoreHouseholdDetails,
    isLoadingRestoreHouseholdDetails,
    isRestoringHousehold,
    exportFeedback,
    filterButtonRef,
    filterPanelRef,
    selectedSectorIds,
    selectedSortOrder: selectedSortOrderByTab,
    selectedRecordStatus,
    activeEventLabel,
    reliefPeriodText,
    pendingDepartureFamilyHeadName,
    pendingDepartureFamilyHeadPhotoUrl,
    canRegisterFamily,
    isEndedView,
    endedEventDateTimeText,
    hasActiveSectorFilters,
    hasNonDefaultSort,
    scopedDisasterEvents,
    selectableBarangays,
    registrationForm,
    editHouseholdForm,
    setSelectedDisasterEventId,
    setSelectedBarangayId,
    setSearchTerm,
    setRecordStatus,
    setSelectedExportFormat,
    setSelectedExportDisasterEventId,
    setSelectedExportBarangayIds,
    setSelectedExportRecordStatus,
    setSelectedExportSortOrder,
    setSelectedExportSectorIds,
    setExportFeedback,
    setIsExportModalOpen,
    setIsFilterOpen,
    setTabSortOrder,
    handleExportDisasterEventChange,
    handleEventScopeChange,
    handleRecordStatusChange,
    handleToggleSelect,
    handleSelectAll,
    handleOpenBulkDepartureConfirmation,
    handleOpenDepartureConfirmation,
    handleCloseDepartureConfirmation,
    handleConfirmDeparture,
    handleOpenRegisterModal,
    handleCloseRegisterModal,
    handleOpenHouseholdDetails,
    handleCloseHouseholdDetails,
    handleOpenEditHousehold,
    handleEditHouseholdFromDetails,
    handleCloseEditHousehold,
    handleOpenRestoreHousehold,
    handleCancelRestoreHousehold,
    handleConfirmRestoreHousehold,
    handleExport,
    toggleSectorFilter,
    clearSectorFilters,
    exportSortOptions: MASTERLIST_SORT_OPTIONS,
  };
};
