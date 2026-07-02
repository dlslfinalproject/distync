import React, { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import PageHeader from "../../components/layout/PageHeader";
import BarangayDashboardOverview from "../../components/barangay-dashboard/BarangayDashboardOverview";
import MasterlistDepartureConfirmModal from "../../components/masterlist/MasterlistDepartureConfirmModal";
import HouseholdArchiveConfirmModal from "../../components/masterlist/HouseholdArchiveConfirmModal";
import HouseholdDetailModal from "../../components/masterlist/HouseholdDetailModal";
import MasterlistSelectionBar from "../../components/masterlist/MasterlistSelectionBar";
import MasterlistStatusMessages from "../../components/masterlist/MasterlistStatusMessages";
import MasterlistTable from "../../components/masterlist/MasterlistTable";
import MasterlistToolbar from "../../components/masterlist/MasterlistToolbar";
import RegisterFamilyModal from "../../components/household-registration/RegisterFamilyModal";
import { useAuth } from "../../context/AuthContext";
import { useBarangayDashboard } from "../../features/barangay-dashboard/useBarangayDashboard";
import { useHouseholdRegistrationForm } from "../../features/household-registration/useHouseholdRegistrationForm";
import { useMasterlist } from "../../features/masterlist/masterlistHooks";
import {
  archiveHousehold,
  departHousehold,
  fetchHouseholdDetails,
  restoreHousehold,
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
import db from "../../offline/db";

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
  const [pendingArchiveHouseholdId, setPendingArchiveHouseholdId] = useState("");
  const [archiveRemarks, setArchiveRemarks] = useState("");
  const [isArchivingHousehold, setIsArchivingHousehold] = useState(false);
  const [pendingRestoreHouseholdId, setPendingRestoreHouseholdId] = useState("");
  const [restoreRemarks, setRestoreRemarks] = useState("");
  const [isRestoringHousehold, setIsRestoringHousehold] = useState(false);
  const [selectedHouseholds, setSelectedHouseholds] = useState([]);
  const syncQueueEntries =
    useLiveQuery(() => db.syncQueue.toArray(), [], []) || [];

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
      reloadMasterlist();
    },
  });

  const {
    sectorOptions,
    selectedSectorNames,
    filteredRows,
    toggleSectorFilter,
    clearSectorFilters,
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

  const handleOpenBulkDepartureConfirmation = () => {
    if (
      isSelectedEventEnded ||
      !selectedHouseholds.length ||
      isRecordingDeparture
    ) {
      return;
    }

    setIsBulkDepartureConfirmOpen(true);
  };

  const handleOpenDepartureConfirmation = async (householdId) => {
    if (isSelectedEventEnded || isRecordingDeparture) {
      return;
    }

    setPendingDepartureHouseholdId(householdId);
    setPendingDepartureHouseholdDetails(null);
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

  return (
    <>
      <PageHeader title="EVACUEE MASTERLIST" actions={[]} />

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
        selectedSectorNames={selectedSectorNames}
        onToggleSector={toggleSectorFilter}
        onClearFilters={clearSectorFilters}
        filterScopeKey={eventScope}
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
        onArchiveHousehold={handleOpenArchiveHousehold}
        onRestoreHousehold={handleOpenRestoreHousehold}
        isDepartureReadOnly={isSelectedEventEnded}
        departureReadOnlyText={selectedEventEndedText}
        selectedHouseholds={selectedHouseholds}
        onToggleSelect={handleToggleSelect}
        onSelectAll={handleSelectAll}
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

      <HouseholdArchiveConfirmModal
        isOpen={Boolean(pendingRestoreHouseholdId)}
        isSubmitting={isRestoringHousehold}
        archiveRemarks={restoreRemarks}
        onChangeArchiveRemarks={setRestoreRemarks}
        onCancel={handleCancelRestoreHousehold}
        onConfirm={handleConfirmRestoreHousehold}
        mode="restore"
      />
    </>
  );
};

export default BarangayMasterlistPage;
