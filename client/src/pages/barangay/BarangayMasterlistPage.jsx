import React, { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import PageHeader from "../../components/layout/PageHeader";
import BarangayDashboardOverview from "../../components/barangay-dashboard/BarangayDashboardOverview";
import HouseholdArchiveConfirmModal from "../../components/masterlist/HouseholdArchiveConfirmModal";
import MasterlistDepartureConfirmModal from "../../components/masterlist/MasterlistDepartureConfirmModal";
import HouseholdDetailModal from "../../components/masterlist/HouseholdDetailModal";
import MasterlistSelectionBar from "../../components/masterlist/MasterlistSelectionBar";
import MasterlistStatusMessages from "../../components/masterlist/MasterlistStatusMessages";
import MasterlistTable from "../../components/masterlist/MasterlistTable";
import MasterlistToolbar from "../../components/masterlist/MasterlistToolbar";
import FeedbackToast from "../../components/shared/FeedbackToast";
import RegisterFamilyModal from "../../components/household-registration/RegisterFamilyModal";
import MswdoExportModal from "../../components/mswdo-masterlist/MswdoExportModal";
import { useAuth } from "../../context/AuthContext";
import { useBarangayDashboard } from "../../features/barangay-dashboard/useBarangayDashboard";
import { useHouseholdRegistrationForm } from "../../features/household-registration/useHouseholdRegistrationForm";
import { useMasterlist } from "../../features/masterlist/masterlistHooks";
import {
  departHousehold,
  exportBarangayMasterlist,
  fetchHouseholdDetails,
  restoreHousehold,
  MASTERLIST_SORT_OPTIONS,
  fetchMasterlist,
} from "../../features/masterlist/masterlistService";
import {
  formatEventEndedDateTime,
  isEndedDisasterEvent,
} from "../../features/masterlist/barangayMasterlistUi";
import { useBarangayMasterlistSync } from "../../features/masterlist/useBarangayMasterlistSync";
import {
  cacheRegistrationActiveDisasterEvents,
  cacheRegistrationBarangays,
  cacheRegistrationEvacuationCentersByBarangay,
  cacheSelectedDisasterEvent,
  cacheSelectedDisasterEventId,
  fetchEvacuationCentersByBarangay,
} from "../../features/household-registration/householdRegistrationService";
import { buildActiveCrossEventInfoMessage } from "../../features/household-registration/crossEventInformation";
import { getVisibleSyncQueueEntries } from "../../offline/syncQueue";
import {
  buildExportSuccessMessage,
  downloadExportFile,
  resolveExportErrorMessage,
} from "../../utils/exportHelpers";
import db from "../../offline/db.js";

const BarangayMasterlistPage = () => {
  const { authenticatedUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [recordStatus, setRecordStatus] = useState("active");
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [registrationSuccessMessage, setRegistrationSuccessMessage] =
    useState("");
  const [attendanceActionMessage, setAttendanceActionMessage] = useState("");
  const [pendingDepartureHouseholdId, setPendingDepartureHouseholdId] =
    useState("");
  const [pendingDepartureHouseholdDetails, setPendingDepartureHouseholdDetails] =
    useState(null);
  const [pendingBulkDepartureHouseholds, setPendingBulkDepartureHouseholds] =
    useState([]);
  const [isLoadingDepartureHouseholdDetails, setIsLoadingDepartureHouseholdDetails] =
    useState(false);
  const [viewingHouseholdId, setViewingHouseholdId] = useState("");
  const [editingHouseholdId, setEditingHouseholdId] = useState("");
  const [householdDetails, setHouseholdDetails] = useState(null);
  const [editingHouseholdDetails, setEditingHouseholdDetails] = useState(null);
  const [isLoadingHouseholdDetails, setIsLoadingHouseholdDetails] =
    useState(false);
  const [isLoadingEditHouseholdDetails, setIsLoadingEditHouseholdDetails] =
    useState(false);
  const [householdDetailsErrorMessage, setHouseholdDetailsErrorMessage] =
    useState("");
  const [editHouseholdErrorMessage, setEditHouseholdErrorMessage] =
    useState("");
  const [isBulkDepartureConfirmOpen, setIsBulkDepartureConfirmOpen] =
    useState(false);
  const [isRecordingDeparture, setIsRecordingDeparture] = useState(false);
  const [pendingRestoreHouseholdId, setPendingRestoreHouseholdId] = useState("");
  const [pendingRestoreHouseholdDetails, setPendingRestoreHouseholdDetails] =
    useState(null);
  const [isLoadingRestoreHouseholdDetails, setIsLoadingRestoreHouseholdDetails] =
    useState(false);
  const [isRestoringHousehold, setIsRestoringHousehold] = useState(false);
  const [selectedHouseholds, setSelectedHouseholds] = useState([]);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportingFormat, setExportingFormat] = useState("");
  const [selectedExportFormat, setSelectedExportFormat] = useState("csv");
  const [selectedExportDisasterEventId, setSelectedExportDisasterEventId] =
    useState("");
  const [selectedExportRecordStatus, setSelectedExportRecordStatus] =
    useState("active");
  const [selectedExportSortOrder, setSelectedExportSortOrder] =
    useState("newest");
  const [selectedExportSectorIds, setSelectedExportSectorIds] = useState([]);
  const [availableExportSectorIds, setAvailableExportSectorIds] = useState([]);
  const [exportValidationErrors, setExportValidationErrors] = useState({
    sectors: "",
    barangays: "",
  });
  const [exportFeedback, setExportFeedback] = useState({
    type: "",
    message: "",
  });
  const syncQueueEntries =
    useLiveQuery(() => getVisibleSyncQueueEntries(), [], []) || [];

  const {
    accessMode,
    allowFallback,
    eventScope,
    selectedDisasterEventId,
    overrideBarangayId,
    assignedBarangay,
    availableEvents,
    selectedEvent,
    summaryCards,
    devBarangayOptions,
    isLoading: isLoadingDashboard,
    errorMessage: dashboardErrorMessage,
    errorCode: dashboardErrorCode,
    hasData,
    hasAssignedBarangay,
    hasSelectedEvent,
    hasEvents,
    isDevOverride,
    setEventScope,
    setSelectedDisasterEventId,
    setOverrideBarangayId,
  } = useBarangayDashboard({
    userId: authenticatedUser?.id || "",
  });

  const { data, isLoading, errorMessage, reloadMasterlist } = useMasterlist({
    disasterEventId: selectedEvent?.id || "",
    barangayId: assignedBarangay?.id || "",
    recordStatus,
  });

  const isSelectedEventEnded = isEndedDisasterEvent(selectedEvent, eventScope);
  const selectedEventEndedText = formatEventEndedDateTime(
    isSelectedEventEnded
      ? selectedEvent?.ended_at ||
          selectedEvent?.updated_at ||
          selectedEvent?.end_date
      : null,
  );

  const registrationForm = useHouseholdRegistrationForm({
    isOpen: isRegisterModalOpen,
    defaultBarangayId: assignedBarangay?.id || "",
    defaultBarangayName: assignedBarangay?.name || "",
    defaultDisasterEventId: selectedEvent?.id || "",
    lockBarangaySelection: true,
    hideBarangaySelection: true,
    restrictNonResidentToEvacCenter: true,
    scopeNonResidentEvacuationCentersToBarangay: true,
    registeredBy: authenticatedUser?.id || null,
    localHouseholdDuplicateCandidates: data.rows,
    onSuccess: (response) => {
      setRegistrationSuccessMessage(
        response?.message || "Household registered successfully",
      );
      setAttendanceActionMessage(
        buildActiveCrossEventInfoMessage(response, selectedEvent),
      );
      reloadMasterlist();
    },
  });

  const editHouseholdForm = useHouseholdRegistrationForm({
    isOpen: Boolean(editingHouseholdId),
    mode: "edit",
    initialHouseholdDetails: editingHouseholdDetails,
    defaultBarangayId: assignedBarangay?.id || "",
    defaultBarangayName: assignedBarangay?.name || "",
    defaultDisasterEventId: selectedEvent?.id || "",
    lockBarangaySelection: true,
    hideBarangaySelection: true,
    restrictNonResidentToEvacCenter: true,
    scopeNonResidentEvacuationCentersToBarangay: true,
    registeredBy: authenticatedUser?.id || null,
    onSuccess: (response) => {
      setRegistrationSuccessMessage(
        response?.message || "Household updated successfully",
      );
      setAttendanceActionMessage("");
      reloadMasterlist();
    },
  });

  const {
    sectorOptions,
    selectedSectorIds,
    selectedSortOrder,
    filteredRows,
    toggleSectorFilter,
    clearSectorFilters,
    setSelectedSortOrder,
  } = useBarangayMasterlistSync({
    rows: data.rows,
    syncQueueEntries,
    selectedEvent,
    assignedBarangay,
    searchTerm,
    eventScope,
    reloadMasterlist,
  });

  const pendingDepartureRow = filteredRows.find(
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
  const pendingRestoreRow = filteredRows.find(
    (row) => row.household_id === pendingRestoreHouseholdId,
  );
  const pendingRestoreFamilyHeadName = pendingRestoreHouseholdDetails?.household
    ? [
        pendingRestoreHouseholdDetails.household.family_head_first_name,
        pendingRestoreHouseholdDetails.household.family_head_middle_name,
        pendingRestoreHouseholdDetails.household.family_head_last_name,
        pendingRestoreHouseholdDetails.household.family_head_suffix,
      ]
        .filter(Boolean)
        .join(" ")
    : pendingRestoreRow?.family_head_name || "";
  const pendingRestoreFamilyHeadPhotoUrl =
    pendingRestoreHouseholdDetails?.household?.family_head_photo_url || "";
  const pendingRestoreVariant = pendingRestoreRow?.is_non_admitted_resident
    ? "admit"
    : "readmit";
  const selectedExportBarangayIds = assignedBarangay?.id
    ? [assignedBarangay.id]
    : [];

  useEffect(() => {
    let isMounted = true;

    const loadAvailableExportSectors = async () => {
      if (
        !isExportModalOpen ||
        !selectedExportDisasterEventId ||
        !assignedBarangay?.id
      ) {
        if (isMounted) {
          setAvailableExportSectorIds([]);
        }
        return;
      }

      try {
        const payload = await fetchMasterlist({
          disasterEventId: selectedExportDisasterEventId,
          barangayId: assignedBarangay.id,
          recordStatus: selectedExportRecordStatus,
        });

        if (!isMounted) {
          return;
        }

        const nextSectorIds = (payload.rows || []).flatMap(
          (row) => row.sector_codes || [],
        );

        setAvailableExportSectorIds([...new Set(nextSectorIds)]);
      } catch (_error) {
        if (isMounted) {
          setAvailableExportSectorIds([]);
        }
      }
    };

    loadAvailableExportSectors();

    return () => {
      isMounted = false;
    };
  }, [
    assignedBarangay?.id,
    isExportModalOpen,
    selectedExportDisasterEventId,
    selectedExportRecordStatus,
  ]);

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
    if (!isExportModalOpen) {
      setExportValidationErrors({ sectors: "", barangays: "" });
      return;
    }

    if (selectedExportSectorIds.length > 0) {
      setExportValidationErrors((currentErrors) => ({
        ...currentErrors,
        sectors: "",
      }));
    }
  }, [isExportModalOpen, selectedExportSectorIds.length]);

  useEffect(() => {
    const activeEvents = availableEvents.filter(
      (event) => String(event.status || "").toUpperCase() === "ACTIVE",
    );

    if (activeEvents.length > 0) {
      cacheRegistrationActiveDisasterEvents(activeEvents);
    }

    if (selectedEvent?.id) {
      cacheSelectedDisasterEvent(selectedEvent);
      cacheSelectedDisasterEventId(selectedEvent.id);
    }

    if (assignedBarangay?.id) {
      cacheRegistrationBarangays([
        {
          id: assignedBarangay.id,
          name: assignedBarangay.name,
          code: assignedBarangay.code,
        },
      ]);
    }
  }, [
    assignedBarangay?.code,
    assignedBarangay?.id,
    assignedBarangay?.name,
    availableEvents,
    selectedEvent?.id,
  ]);

  useEffect(() => {
    let isMounted = true;

    const prefetchEvacuationCenters = async () => {
      if (
        !assignedBarangay?.id ||
        typeof navigator === "undefined" ||
        !navigator.onLine
      ) {
        return;
      }

      try {
        const centers = await fetchEvacuationCentersByBarangay(assignedBarangay.id);

        if (isMounted && Array.isArray(centers) && centers.length > 0) {
          cacheRegistrationEvacuationCentersByBarangay(
            assignedBarangay.id,
            centers,
          );
        }
      } catch (_error) {
        // Keep this silent. The modal has its own fallback messaging.
      }
    };

    prefetchEvacuationCenters();

    return () => {
      isMounted = false;
    };
  }, [assignedBarangay?.id]);

  useEffect(() => {
    if (isSelectedEventEnded) {
      setSelectedHouseholds([]);
      setPendingDepartureHouseholdId("");
      setPendingDepartureHouseholdDetails(null);
      setPendingBulkDepartureHouseholds([]);
      setIsLoadingDepartureHouseholdDetails(false);
      setIsBulkDepartureConfirmOpen(false);
    }
  }, [isSelectedEventEnded, selectedEvent?.id]);

  useEffect(() => {
    if (eventScope === "ended") {
      setRecordStatus("all");
      return;
    }

    setRecordStatus("active");
  }, [eventScope]);

  const handleToggleSelect = (householdId) => {
    if (isSelectedEventEnded) {
      return;
    }

    setSelectedHouseholds((currentValues) =>
      currentValues.includes(householdId)
        ? currentValues.filter((id) => id !== householdId)
        : [...currentValues, householdId],
    );
  };

  const handleSelectAll = () => {
    if (isSelectedEventEnded) {
      setSelectedHouseholds([]);
      return;
    }

    const selectableHouseholdIds = filteredRows
      .filter((row) => !row.departure_time_value && row.can_record_departure)
      .map((row) => row.household_id);

    const areAllSelected =
      selectableHouseholdIds.length > 0 &&
      selectableHouseholdIds.every((id) => selectedHouseholds.includes(id));

    setSelectedHouseholds(areAllSelected ? [] : selectableHouseholdIds);
  };

  const handleOpenBulkDepartureConfirmation = async () => {
    if (
      isSelectedEventEnded ||
      !selectedHouseholds.length ||
      isRecordingDeparture
    ) {
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

    const selectedRows = filteredRows.filter((row) =>
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
        const fallbackRow = selectedRows.find((row) => row.household_id === householdId);
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
    if (isSelectedEventEnded || isRecordingDeparture) {
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

  const handleCancelDeparture = () => {
    if (isRecordingDeparture) {
      return;
    }

    setPendingDepartureHouseholdId("");
    setPendingDepartureHouseholdDetails(null);
    setPendingBulkDepartureHouseholds([]);
    setIsLoadingDepartureHouseholdDetails(false);
    setIsBulkDepartureConfirmOpen(false);
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

  const handleEditHouseholdFromDetails = async (householdId) => {
    handleCloseHouseholdDetails();
    await handleOpenEditHousehold(householdId);
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

  const handleConfirmDeparture = async () => {
    if (isSelectedEventEnded || isRecordingDeparture) {
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
        setPendingDepartureHouseholdId("");
        setPendingDepartureHouseholdDetails(null);
        setPendingBulkDepartureHouseholds([]);
        setIsLoadingDepartureHouseholdDetails(false);
        reloadMasterlist();
      }
    } catch (error) {
      setAttendanceActionMessage(
        error.message || "Failed to record household departure",
      );
    } finally {
      setIsRecordingDeparture(false);
    }
  };

  const handleOpenExportModal = () => {
    setSelectedExportDisasterEventId(selectedEvent?.id || "");
    setSelectedExportFormat("csv");
    setSelectedExportRecordStatus(isSelectedEventEnded ? "archived" : recordStatus);
    setSelectedExportSortOrder(selectedSortOrder);
    setSelectedExportSectorIds(
      selectedSectorIds.length ? selectedSectorIds : availableExportSectorIds,
    );
    setExportValidationErrors({ sectors: "", barangays: "" });
    setExportFeedback({ type: "", message: "" });
    setIsExportModalOpen(true);
  };

  const handleExport = async (format) => {
    if (!selectedExportDisasterEventId || !assignedBarangay?.id) {
      setExportFeedback({
        type: "error",
        message: "Select a disaster event before exporting the masterlist.",
      });
      return;
    }

    if (selectedExportSectorIds.length === 0) {
      setExportValidationErrors({
        sectors: "Select at least one sector.",
        barangays: "",
      });
      return;
    }

    setExportingFormat(format);
    setIsExportModalOpen(false);

    try {
      const selectedExportSourceSectorIds = selectedExportSectorIds
        .map((sectorId) =>
          sectorOptions.find((sector) => sector.id === sectorId)?.source_sector_id,
        )
        .filter(Boolean);

      const file = await exportBarangayMasterlist({
        disasterEventId: selectedExportDisasterEventId,
        barangayId: assignedBarangay.id,
        recordStatus: selectedExportRecordStatus,
        sortOrder: selectedExportSortOrder,
        sectorIds: selectedExportSourceSectorIds,
        format,
      });

      downloadExportFile(file);
      setExportFeedback({
        type: "success",
        message: buildExportSuccessMessage("Barangay masterlist report"),
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

      <BarangayDashboardOverview
        accessMode={accessMode}
        allowFallback={allowFallback}
        eventScope={eventScope}
        selectedDisasterEventId={selectedDisasterEventId}
        overrideBarangayId={overrideBarangayId}
        assignedBarangay={assignedBarangay}
        availableEvents={availableEvents}
        selectedEvent={selectedEvent}
        summaryCards={summaryCards}
        devBarangayOptions={devBarangayOptions}
        isLoading={isLoadingDashboard}
        errorMessage={dashboardErrorMessage}
        errorCode={dashboardErrorCode}
        hasSelectedEvent={hasSelectedEvent}
        hasEvents={hasEvents}
        hasData={hasData}
        hasAssignedBarangay={hasAssignedBarangay}
        isDevOverride={isDevOverride}
        setEventScope={setEventScope}
        setSelectedDisasterEventId={setSelectedDisasterEventId}
        setOverrideBarangayId={setOverrideBarangayId}
      />

      <MasterlistStatusMessages
        successMessage={registrationSuccessMessage}
        infoMessage={attendanceActionMessage}
        errorMessage={editHouseholdErrorMessage}
      />

      <MasterlistToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        onOpenRegisterFamily={() => setIsRegisterModalOpen(true)}
        hideRegisterButton={eventScope === "ended" || !hasSelectedEvent}
        recordStatus={recordStatus}
        onRecordStatusChange={setRecordStatus}
        sectorOptions={sectorOptions}
        selectedSectorIds={selectedSectorIds}
        selectedSortOrder={selectedSortOrder}
        onSortOrderChange={setSelectedSortOrder}
        onToggleSector={toggleSectorFilter}
        onClearFilters={clearSectorFilters}
        filterScopeKey={eventScope}
        exportingFormat={exportingFormat}
        onOpenExport={handleOpenExportModal}
        disableExportButton={!hasSelectedEvent}
        hideRecordStatus={isSelectedEventEnded}
      />

      {!isSelectedEventEnded ? (
        <MasterlistSelectionBar
          selectedCount={selectedHouseholds.length}
          isSubmitting={isRecordingDeparture}
          onConfirmDeparture={handleOpenBulkDepartureConfirmation}
        />
      ) : null}

      <MasterlistTable
        rows={filteredRows}
        isLoading={isLoading}
        errorMessage={errorMessage}
        hasSelectedEvent={hasSelectedEvent}
        onMarkDeparted={handleOpenDepartureConfirmation}
        onViewHousehold={handleOpenHouseholdDetails}
        onEditHousehold={handleOpenEditHousehold}
        onRestoreHousehold={handleOpenRestoreHousehold}
        isDepartureReadOnly={isSelectedEventEnded}
        departureReadOnlyText={selectedEventEndedText}
        selectedHouseholds={selectedHouseholds}
        onToggleSelect={handleToggleSelect}
        onSelectAll={handleSelectAll}
        showAddressColumn={false}
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

      <MasterlistDepartureConfirmModal
        isOpen={
          Boolean(pendingDepartureHouseholdId) || isBulkDepartureConfirmOpen
        }
        isSubmitting={isRecordingDeparture}
        isLoadingHouseholdDetails={isLoadingDepartureHouseholdDetails}
        onCancel={handleCancelDeparture}
        onConfirm={handleConfirmDeparture}
        selectedCount={
          isBulkDepartureConfirmOpen ? selectedHouseholds.length : 1
        }
        familyHeadName={pendingDepartureFamilyHeadName}
        familyHeadPhotoUrl={pendingDepartureFamilyHeadPhotoUrl}
        selectedHouseholdsPreview={pendingBulkDepartureHouseholds}
      />

      <HouseholdDetailModal
        isOpen={Boolean(viewingHouseholdId)}
        isLoading={isLoadingHouseholdDetails}
        errorMessage={householdDetailsErrorMessage}
        householdDetails={householdDetails}
        onClose={handleCloseHouseholdDetails}
        onEditHousehold={
          isSelectedEventEnded ? undefined : handleEditHouseholdFromDetails
        }
        showAdministrativeMetadata={false}
        showDataPrivacyAcknowledgement={true}
      />

      <HouseholdArchiveConfirmModal
        isOpen={Boolean(pendingRestoreHouseholdId)}
        isSubmitting={isRestoringHousehold}
        isLoadingHouseholdDetails={isLoadingRestoreHouseholdDetails}
        familyHeadName={pendingRestoreFamilyHeadName}
        familyHeadPhotoUrl={pendingRestoreFamilyHeadPhotoUrl}
        onCancel={handleCancelRestoreHousehold}
        onConfirm={handleConfirmRestoreHousehold}
        mode="restore"
        restoreVariant={pendingRestoreVariant}
      />

      <MswdoExportModal
        isOpen={isExportModalOpen}
        title="Evacuee Masterlist Report"
        isSubmitting={Boolean(exportingFormat)}
        disasterEvents={availableEvents}
        barangays={assignedBarangay ? [assignedBarangay] : []}
        sectors={sectorOptions}
        selectedDisasterEventId={selectedExportDisasterEventId}
        selectedBarangayIds={selectedExportBarangayIds}
        selectedRecordStatus={selectedExportRecordStatus}
        selectedSortOrder={selectedExportSortOrder}
        selectedSectorIds={selectedExportSectorIds}
        availableSectorIds={availableExportSectorIds}
        availableBarangayIds={selectedExportBarangayIds}
        selectedFormat={selectedExportFormat}
        validationErrors={exportValidationErrors}
        onClose={() => {
          if (!exportingFormat) {
            setIsExportModalOpen(false);
          }
        }}
        onSubmit={() => handleExport(selectedExportFormat)}
        onDisasterEventChange={setSelectedExportDisasterEventId}
        onBarangayToggle={() => {}}
        onSelectAllBarangays={() => {}}
        onClearBarangays={() => {}}
        onRecordStatusChange={setSelectedExportRecordStatus}
        onSortOrderChange={setSelectedExportSortOrder}
        onSectorToggle={(sectorId) => {
          setSelectedExportSectorIds((currentValues) => {
            const nextValues = currentValues.includes(sectorId)
              ? currentValues.filter((id) => id !== sectorId)
              : [...currentValues, sectorId];

            if (nextValues.length > 0) {
              setExportValidationErrors((currentErrors) => ({
                ...currentErrors,
                sectors: "",
              }));
            }

            return nextValues;
          });
        }}
        onClearSectors={() => setSelectedExportSectorIds([])}
        onFormatChange={setSelectedExportFormat}
        sortOptions={MASTERLIST_SORT_OPTIONS}
        hideBarangaySelection
        hideRecordStatusSelection={isSelectedEventEnded}
      />

      <FeedbackToast
        type={exportFeedback.type}
        message={exportFeedback.message}
        onClose={() => setExportFeedback({ type: "", message: "" })}
      />
    </>
  );
};

export default BarangayMasterlistPage;
