import { useEffect, useMemo, useRef, useState } from "react";
import { useHouseholdRegistrationForm } from "../household-registration/useHouseholdRegistrationForm";
import { ROLE_CODES } from "../../utils/roleSession";
import { getActiveCrossEventTitles } from "../household-registration/crossEventInformation";
import {
  departHousehold,
  fetchHouseholdDetails,
  formatDateTime,
  restoreHousehold,
} from "../masterlist/masterlistService";
import {
  exportConsolidatedMasterlist,
  fetchMswdoMasterlistExportMetadata,
} from "./mswdoMasterlistService";
import {
  formatReliefPeriod,
  getEndedEventDateTimeText,
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
import { readOperationalDisasterEventScope } from "../disaster-events/operationalDisasterEventSelection";
import { resolveFamilyHeadPhoto } from "../masterlist/familyHeadPhoto.js";
import { getMswdoOfflineHouseholdDetails } from "./mswdoMasterlistOfflinePhoto.js";

const fetchMswdoDepartureDetails = async ({ householdId, eventId, userId, localDetails = null }) => {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return localDetails || await getMswdoOfflineHouseholdDetails({ userId, eventId, householdId });
  }

  try {
    return await fetchHouseholdDetails(householdId);
  } catch (error) {
    if (typeof navigator === "undefined" || navigator.onLine !== false) {
      throw error;
    }

    const cachedDetails = await getMswdoOfflineHouseholdDetails({
      userId,
      eventId,
      householdId,
    });

    if (!cachedDetails) {
      throw error;
    }

    return cachedDetails;
  }
};

const resolveFamilyHeadName = (record = {}) => {
  const household = record?.household || record || {};
  const members = Array.isArray(record?.members)
    ? record.members
    : Array.isArray(household.members)
      ? household.members
      : [];
  const familyHead = members.find((member) => member?.is_family_head) || {};
  return String(
    household.family_head_name ||
      [
        household.family_head_first_name || familyHead.first_name,
        household.family_head_middle_name || familyHead.middle_name,
        household.family_head_last_name || familyHead.last_name,
        household.family_head_suffix || familyHead.suffix,
      ].filter(Boolean).join(" ") ||
      "",
  ).trim();
};

export const useMswdoMasterlistPage = ({ authenticatedUser }) => {
  const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;
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
    pagination,
    currentPage,
    pageSize,
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
    setCurrentPage,
    setPageSize,
    reloadMasterlist,
  } = useMswdoMasterlist({
    userId: authenticatedUser?.id || "",
  });

  const [activeTab, setActiveTab] = useState(
    () =>
      readOperationalDisasterEventScope({
        roleCode: ROLE_CODES.MSWDO,
        userId: authenticatedUser?.id || "",
      }) || "active",
  );
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
  const [activeCrossEventModalTitles, setActiveCrossEventModalTitles] = useState([]);
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
  const [reAdmissionHouseholdId, setReAdmissionHouseholdId] = useState("");
  const [reAdmissionHouseholdDetails, setReAdmissionHouseholdDetails] =
    useState(null);
  const [reAdmissionSourceArchivedHouseholdId, setReAdmissionSourceArchivedHouseholdId] =
    useState("");
  const [isLoadingReAdmissionHouseholdDetails, setIsLoadingReAdmissionHouseholdDetails] =
    useState(false);
  const reAdmissionRequestSequenceRef = useRef(0);
  const [exportFeedback, setExportFeedback] = useState({
    type: "",
    message: "",
  });
  const selectedSectorIds = sectorFiltersByTab[activeTab] || [];
  const selectedSortOrderByTab = sortOrderByTab[activeTab] || "newest";
  const selectedRecordStatus = recordStatusByTab[activeTab] || "active";
  const activeEventLabel = selectedDisasterEvent
    ? String(selectedDisasterEvent.title || "").trim() || "No disaster event selected"
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
  const getDepartureDisasterEventId = (householdId) => {
    const row = displayedRows.find((candidate) => candidate.household_id === householdId);
    return row?.disaster_event?.id || row?.disaster_event_id || "";
  };
  const pendingDepartureFamilyHeadName = resolveFamilyHeadName(
    pendingDepartureHouseholdDetails,
  ) || pendingDepartureRow?.family_head_name || "";
  const pendingDepartureFamilyHeadPhotoUrl = resolveFamilyHeadPhoto(
    pendingDepartureHouseholdDetails,
    { isOffline: typeof navigator !== "undefined" && navigator.onLine === false },
  );

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
    localHouseholdDuplicateCandidates: displayedRows,
    onSuccess: (response) => {
      setRegistrationSuccessMessage(
        response?.message || "Household registered successfully",
      );
      setAttendanceActionMessage("");
      setActiveCrossEventModalTitles(getActiveCrossEventTitles(response));
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
      setAttendanceActionMessage("");
      setActiveCrossEventModalTitles([]);
      reloadMasterlist();
    },
  });

  const reAdmissionForm = useHouseholdRegistrationForm({
    isOpen: Boolean(reAdmissionHouseholdId),
    mode: "reAdmission",
    initialHouseholdDetails: reAdmissionHouseholdDetails,
    sourceArchivedHouseholdId: reAdmissionSourceArchivedHouseholdId,
    defaultBarangayId: selectedBarangayId || "",
    defaultBarangayName: selectedBarangayId ? selectedBarangayLabel || "" : "",
    defaultDisasterEventId:
      reAdmissionHouseholdDetails?.household?.disaster_event_id ||
      selectedDisasterEventId ||
      "",
    lockBarangaySelection: false,
    hideBarangaySelection: false,
    restrictNonResidentToEvacCenter: true,
    scopeNonResidentEvacuationCentersToBarangay: true,
    registeredBy: authenticatedUser?.id || null,
    onSuccess: (response) => {
      setRegistrationSuccessMessage(
        response?.message || "Household re-admitted successfully",
      );
      setAttendanceActionMessage("");
      setActiveCrossEventModalTitles(getActiveCrossEventTitles(response));
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
        const payload = await fetchMswdoMasterlistExportMetadata({
          disasterEventId: selectedExportDisasterEventId,
          recordStatus: selectedExportRecordStatus,
        });

        if (!isMounted) {
          return;
        }

        const nextSectorIds = (payload.sector_codes || [])
          .map((sectorCode) => getCanonicalMemberSectorCode(sectorCode))
          .filter(Boolean);
        const nextBarangayIds = (payload.barangay_ids || []).filter(Boolean);

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
    setSelectedExportSectorIds((currentIds) => {
      const nextIds = currentIds.filter((sectorId) =>
        availableExportSectorIds.includes(sectorId),
      );

      if (isExportModalOpen && nextIds.length === 0) {
        return availableExportSectorIds;
      }

      return nextIds;
    });
  }, [availableExportSectorIds, isExportModalOpen]);

  useEffect(() => {
    setSelectedExportBarangayIds((currentIds) => {
      const nextIds = currentIds.filter((barangayId) =>
        availableExportBarangayIds.includes(barangayId),
      );

      if (isExportModalOpen && nextIds.length === 0) {
        return availableExportBarangayIds;
      }

      return nextIds;
    });
  }, [availableExportBarangayIds, isExportModalOpen]);

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

    if (selectedHouseholds.length === 1) {
      await handleOpenDepartureConfirmation(selectedHouseholds[0]);
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
        selectedHouseholds.map((householdId) =>
          fetchMswdoDepartureDetails({
            householdId,
            eventId: selectedDisasterEventId,
            userId: authenticatedUser?.id || "",
            localDetails: selectedRows.find((row) => row.household_id === householdId)?.offline_household_details || null,
          }),
        ),
      );

      const previewItems = selectedHouseholds.map((householdId, index) => {
        const detailValue =
          detailResults[index]?.status === "fulfilled"
            ? detailResults[index].value
            : null;
        const fallbackRow = selectedRows.find(
          (row) => row.household_id === householdId,
        );
        const familyHeadName = resolveFamilyHeadName(detailValue) || fallbackRow?.family_head_name || "";

        return {
          household_id: householdId,
          family_head_name: familyHeadName,
          family_head_photo_url: resolveFamilyHeadPhoto(detailValue, { isOffline: typeof navigator !== "undefined" && navigator.onLine === false }),
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
      const details = await fetchMswdoDepartureDetails({
        householdId,
        eventId: selectedDisasterEventId,
        userId: authenticatedUser?.id || "",
        localDetails: displayedRows.find((row) => row.household_id === householdId)?.offline_household_details || null,
      });
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
          selectedHouseholds.map((householdId) => {
            const row = displayedRows.find((candidate) => candidate.household_id === householdId);
            return departHousehold({
              householdId,
              disasterEventId: getDepartureDisasterEventId(householdId),
              barangayId: row?.barangay_id || null,
              disasterEventTitle: selectedDisasterEvent?.title || selectedDisasterEvent?.name || "",
            });
          }),
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
          disasterEventId:
            pendingDepartureHouseholdDetails?.household?.disaster_event_id ||
          pendingDepartureHouseholdDetails?.household?.disaster_event?.id ||
          pendingDepartureRow?.disaster_event?.id ||
          pendingDepartureRow?.disaster_event_id ||
          "",
          barangayId: pendingDepartureRow?.barangay_id || null,
          disasterEventTitle: selectedDisasterEvent?.title || selectedDisasterEvent?.name || "",
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

    if (selectedDisasterEvent?.status === "ACTIVE" && activeTab !== "active") {
      setActiveTab("active");
      return;
    }

    if (
      selectedDisasterEvent?.status === "CLOSED" &&
      activeTab !== "ended"
    ) {
      setActiveTab("ended");
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
    activeTab,
    scopedDisasterEvents,
    selectedDisasterEvent?.status,
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

  const handleOpenRegisterModal = () => {
    if (!selectedDisasterEventId) {
      window.alert("Select a disaster event before registering a family.");
      return;
    }

    setRegistrationSuccessMessage("");
    setAttendanceActionMessage("");
    setActiveCrossEventModalTitles([]);
    setIsRegisterModalOpen(true);
  };

  const handleCloseRegisterModal = () => {
    setIsRegisterModalOpen(false);
  };

  const handleOpenHouseholdDetails = async (selection) => {
    const householdId = selection?.householdId || "";
    const evacuationLogId = selection?.evacuationLogId || null;

    setViewingHouseholdId(householdId);
    setIsLoadingHouseholdDetails(true);
    setHouseholdDetails(null);
    setHouseholdDetailsErrorMessage("");

    try {
      const selectedRow = displayedRows.find(
        (row) => String(row.household_id) === String(householdId),
      );
      const details = isOffline
        ? selectedRow?.offline_household_details ||
          await getMswdoOfflineHouseholdDetails({
            userId: authenticatedUser?.id || "",
            eventId: selectedDisasterEventId,
            householdId,
          })
        : await fetchHouseholdDetails(householdId, { evacuationLogId });
      if (!details) {
        throw new Error(
          isOffline
            ? "Offline household details are not available for this record."
            : "Failed to load household details.",
        );
      }
      setHouseholdDetails(details);
    } catch (error) {
      setHouseholdDetailsErrorMessage(
        isOffline
          ? error.message || "Offline household details are not available for this record."
          : error.message || "Failed to load household details.",
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
      const selectedRow = displayedRows.find(
        (row) => String(row.household_id) === String(householdId),
      );
      const details = isOffline
        ? selectedRow?.offline_household_details ||
          await getMswdoOfflineHouseholdDetails({
            userId: authenticatedUser?.id || "",
            eventId: selectedDisasterEventId,
            householdId,
          })
        : await fetchHouseholdDetails(householdId);
      if (!details) throw new Error("Offline household details are not available for this record.");
      setEditingHouseholdDetails(details);
      setEditingHouseholdId(householdId);
    } catch (error) {
      setEditHouseholdErrorMessage(
        isOffline
          ? error.message || "Offline household details are not available for this record."
          : error.message || "Failed to load household details for editing.",
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
    const sourceArchivedHouseholdId = String(householdId || "").trim();
    const requestSequence = ++reAdmissionRequestSequenceRef.current;
    const selectedRow = displayedRows.find(
      (row) => row.household_id === householdId,
    );

    if (!selectedRow?.is_non_admitted_resident) {
      if (!sourceArchivedHouseholdId) {
        setReAdmissionHouseholdDetails(null);
        setReAdmissionSourceArchivedHouseholdId("");
        setAttendanceActionMessage(
          "The selected household could not be identified. Refresh the masterlist and try again.",
        );
        return;
      }

      setReAdmissionHouseholdId("");
      setReAdmissionHouseholdDetails(null);
      setReAdmissionSourceArchivedHouseholdId(sourceArchivedHouseholdId);
      setIsLoadingReAdmissionHouseholdDetails(true);

      try {
        const details = isOffline
          ? selectedRow?.offline_household_details ||
            await getMswdoOfflineHouseholdDetails({
              userId: authenticatedUser?.id || "",
              eventId: selectedDisasterEventId,
              householdId: sourceArchivedHouseholdId,
            })
          : await fetchHouseholdDetails(sourceArchivedHouseholdId);
        if (!details) throw new Error("Offline household details are not available for this record.");
        const loadedHouseholdId = String(details?.household?.id || "").trim();

        if (requestSequence !== reAdmissionRequestSequenceRef.current) {
          return;
        }

        if (loadedHouseholdId !== sourceArchivedHouseholdId) {
          throw new Error(
            "The selected household occurrence could not be verified for re-admission. Refresh the masterlist and try again.",
          );
        }

        if (details?.household?.is_active !== false) {
          throw new Error(
            "This household is no longer archived. Refresh the masterlist to view the current occurrence.",
          );
        }

        setReAdmissionHouseholdDetails(details);
        setReAdmissionHouseholdId(sourceArchivedHouseholdId);
      } catch (error) {
        if (requestSequence !== reAdmissionRequestSequenceRef.current) {
          return;
        }

        setReAdmissionHouseholdDetails(null);
        setReAdmissionSourceArchivedHouseholdId("");
        setAttendanceActionMessage(
          error.message || "Failed to load household details for re-admission.",
        );
      } finally {
        if (requestSequence === reAdmissionRequestSequenceRef.current) {
          setIsLoadingReAdmissionHouseholdDetails(false);
        }
      }

      return;
    }

    setReAdmissionHouseholdId("");
    setReAdmissionHouseholdDetails(null);
    setReAdmissionSourceArchivedHouseholdId("");
    setIsLoadingReAdmissionHouseholdDetails(false);
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

  const handleCloseReAdmission = () => {
    if (reAdmissionForm.isSubmitting || isLoadingReAdmissionHouseholdDetails) {
      return;
    }

    reAdmissionRequestSequenceRef.current += 1;
    setReAdmissionHouseholdId("");
    setReAdmissionHouseholdDetails(null);
    setReAdmissionSourceArchivedHouseholdId("");
    setIsLoadingReAdmissionHouseholdDetails(false);
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
        response.message || "Household re-admitted successfully",
      );
      setPendingRestoreHouseholdId("");
      setPendingRestoreHouseholdDetails(null);
      setIsLoadingRestoreHouseholdDetails(false);
      reloadMasterlist();
    } catch (error) {
      setAttendanceActionMessage(
        error.message || "Failed to re-admit household",
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
    pagination,
    currentPage,
    pageSize,
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
    activeCrossEventModalTitles,
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
    reAdmissionHouseholdId,
    reAdmissionHouseholdDetails,
    reAdmissionSourceArchivedHouseholdId,
    isLoadingReAdmissionHouseholdDetails,
    exportFeedback,
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
    reAdmissionForm,
    setSelectedDisasterEventId,
    setSelectedBarangayId,
    setSearchTerm,
    setCurrentPage,
    setPageSize,
    setRecordStatus,
    setSelectedExportFormat,
    setSelectedExportDisasterEventId,
    setSelectedExportBarangayIds,
    setSelectedExportRecordStatus,
    setSelectedExportSortOrder,
    setSelectedExportSectorIds,
    setExportFeedback,
    setActiveCrossEventModalTitles,
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
    handleCloseReAdmission,
    handleExport,
    toggleSectorFilter,
    clearSectorFilters,
    exportSortOptions: MASTERLIST_SORT_OPTIONS,
  };
};
