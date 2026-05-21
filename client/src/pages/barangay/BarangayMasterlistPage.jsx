import React, { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import PageHeader from "../../components/layout/PageHeader";
import BarangayDashboardOverview from "../../components/barangay-dashboard/BarangayDashboardOverview";
import { shellStyles } from "../../components/layout/BarangayLayout";
import MasterlistDepartureConfirmModal from "../../components/masterlist/MasterlistDepartureConfirmModal";
import HouseholdArchiveConfirmModal from "../../components/masterlist/HouseholdArchiveConfirmModal";
import EvacuationCorrectionModal from "../../components/masterlist/EvacuationCorrectionModal";
import HouseholdDetailModal from "../../components/masterlist/HouseholdDetailModal";
import MasterlistTable from "../../components/masterlist/MasterlistTable";
import MasterlistToolbar from "../../components/masterlist/MasterlistToolbar";
import RegisterFamilyModal from "../../components/household-registration/RegisterFamilyModal";
import { useAuth } from "../../context/AuthContext";
import { useBarangayDashboard } from "../../features/barangay-dashboard/useBarangayDashboard";
import { useHouseholdRegistrationForm } from "../../features/household-registration/useHouseholdRegistrationForm";
import { useMasterlist } from "../../features/masterlist/masterlistHooks";
import {
  archiveHousehold,
  correctEvacuationLog,
  departHousehold,
  fetchHouseholdDetails,
  formatDateTime,
} from "../../features/masterlist/masterlistService";
import {
  cacheRegistrationActiveDisasterEvents,
  cacheRegistrationBarangays,
  cacheRegistrationEvacuationCentersByBarangay,
  cacheRegistrationSectors,
  cacheSelectedDisasterEvent,
  cacheSelectedDisasterEventId,
  fetchEvacuationCentersByBarangay,
} from "../../features/household-registration/householdRegistrationService";
import { fetchMswdoSectors } from "../../features/mswdo-masterlist/mswdoMasterlistService";
import { MdDoorFront } from "react-icons/md";
import db from "../../offline/db";
import {
  buildSyncDescriptor,
  findSyncEntry,
} from "../../offline/syncStatus";
import { subscribeToSyncUpdates } from "../../offline/syncService";

const getSectorNames = (sectorsText) => {
  if (!sectorsText || sectorsText === "-") {
    return [];
  }

  return String(sectorsText)
    .split(",")
    .map((sectorName) => sectorName.trim())
    .filter(Boolean);
};

const getFilteredRows = (rows, searchTerm) => {
  if (!searchTerm.trim()) return rows;
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  return rows.filter((row) => {
    const searchableValues = [
      row.family_head_name,
      row.address,
      row.sectors_text,
      row.attendance_status_text,
      row.arrival_time_text,
      row.departure_time_text,
    ];
    return searchableValues.some((value) =>
      String(value).toLowerCase().includes(normalizedSearchTerm),
    );
  });
};

const buildFamilyHeadName = (familyHead = {}) => {
  return [
    familyHead.first_name,
    familyHead.middle_name,
    familyHead.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
};

const buildQueuedHouseholdRow = (entry, assignedBarangayName) => {
  const familyHeadName = buildFamilyHeadName(entry.payload?.family_head);
  const currentAddress =
    entry.payload?.current_address_details ||
    assignedBarangayName ||
    "Pending local address";
  const departureTimestamp =
    entry.actionKey === "HOUSEHOLD_DEPART" ? entry.clientTimestamp : null;

  return {
    household_id: entry.entityLocalId || entry.id,
    family_head_name: familyHeadName || "Pending household",
    address: currentAddress,
    members_count: Array.isArray(entry.payload?.members)
      ? entry.payload.members.length
      : 0,
    sectors_text: "-",
    arrival_time_text: formatDateTime(entry.clientTimestamp),
    departure_time_value: departureTimestamp,
    departure_time_text: departureTimestamp ? formatDateTime(departureTimestamp) : "-",
    can_record_departure: false,
    is_local_only: true,
    sync_status: entry.status,
    sync_entry_id: entry.id,
  };
};


const isEndedDisasterEvent = (event, eventScope) => {
  const status = String(event?.status || "").toUpperCase();
  return eventScope === "ended" || status === "CLOSED" || status === "ARCHIVED";
};


const formatEventEndedDateTime = (value) => {
  if (!value) {
    return "-";
  }

  const normalizedValue = String(value).trim();
  const isDateOnlyValue = /^\d{4}-\d{2}-\d{2}$/.test(normalizedValue);
  const parsedDate = new Date(
    isDateOnlyValue ? `${normalizedValue}T00:00:00` : normalizedValue,
  );

  if (Number.isNaN(parsedDate.getTime())) {
    return "-";
  }

  if (isDateOnlyValue) {
    return new Intl.DateTimeFormat("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(parsedDate);
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsedDate);
};

const BarangayMasterlistPage = () => {
  const { authenticatedUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [recordStatus, setRecordStatus] = useState("active");
  const [selectedSectorNamesByScope, setSelectedSectorNamesByScope] = useState({
    active: [],
    ended: [],
  });
  const [sectorOptions, setSectorOptions] = useState([]);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [registrationSuccessMessage, setRegistrationSuccessMessage] =
    useState("");
  const [attendanceActionMessage, setAttendanceActionMessage] = useState("");
  const [pendingDepartureHouseholdId, setPendingDepartureHouseholdId] =
    useState("");
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
  const [isEvacuationCorrectionOpen, setIsEvacuationCorrectionOpen] =
    useState(false);
  const [isSubmittingEvacuationCorrection, setIsSubmittingEvacuationCorrection] =
    useState(false);
  const [evacuationCorrectionForm, setEvacuationCorrectionForm] = useState({
    evacuation_center_id: "",
    status: "PRESENT",
    correction_remarks: "",
  });
  const [evacuationCorrectionCenters, setEvacuationCorrectionCenters] = useState(
    [],
  );
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

  const rowsWithSyncStatus = useMemo(() => {
    const syncedRows = data.rows.map((row) => {
      const matchingEntry = findSyncEntry(syncQueueEntries, (entry) => {
        if (
          entry.entityType !== "HOUSEHOLD" ||
          !["barangay-households", "barangay-masterlist"].includes(entry.moduleName)
        ) {
          return false;
        }

        return (
          entry.entityServerId === row.household_id ||
          entry.entityLocalId === row.household_id
        );
      });

      return {
        ...row,
        sync_status: buildSyncDescriptor(matchingEntry).status,
        is_local_only: false,
      };
    });

    const optimisticRows = syncQueueEntries
      .filter((entry) => {
        return (
          entry.moduleName === "barangay-households" &&
          entry.actionKey === "HOUSEHOLD_REGISTER" &&
          entry.payload?.disaster_event_id === selectedEvent?.id &&
          entry.payload?.barangay_id === assignedBarangay?.id &&
          !syncedRows.some(
            (row) =>
              row.household_id === entry.entityServerId ||
              row.household_id === entry.entityLocalId,
          )
        );
      })
      .map((entry) => buildQueuedHouseholdRow(entry, assignedBarangay?.name || ""));

    return [...optimisticRows, ...syncedRows];
  }, [assignedBarangay?.id, assignedBarangay?.name, data.rows, selectedEvent?.id, syncQueueEntries]);

  const filteredRows = useMemo(() => {
    const searchedRows = getFilteredRows(rowsWithSyncStatus, searchTerm);
    const selectedSectorNames = selectedSectorNamesByScope[eventScope] || [];

    if (selectedSectorNames.length === 0) {
      return searchedRows;
    }

    return searchedRows.filter((row) => {
      const rowSectorNames = getSectorNames(row.sectors_text);

      return selectedSectorNames.some((sectorName) =>
        rowSectorNames.includes(sectorName),
      );
    });
  }, [eventScope, rowsWithSyncStatus, searchTerm, selectedSectorNamesByScope]);

  useEffect(() => {
    let isMounted = true;

    const loadSectors = async () => {
      try {
        const sectors = await fetchMswdoSectors();

        if (!isMounted) {
          return;
        }

        setSectorOptions(
          (Array.isArray(sectors) ? sectors : [])
            .map((sector) => String(sector.name || "").trim())
            .filter(Boolean)
            .sort((left, right) => left.localeCompare(right)),
        );
        cacheRegistrationSectors(Array.isArray(sectors) ? sectors : []);
      } catch (_error) {
        if (isMounted) {
          setSectorOptions([]);
        }
      }
    };

    loadSectors();

    return () => {
      isMounted = false;
    };
  }, []);

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
    const unsubscribe = subscribeToSyncUpdates(() => {
      if (typeof navigator !== "undefined" && navigator.onLine) {
        reloadMasterlist();
      }
    });

    return () => unsubscribe();
  }, [reloadMasterlist]);


  useEffect(() => {
    if (isSelectedEventEnded) {
      setSelectedHouseholds([]);
      setPendingDepartureHouseholdId("");
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

  const selectedSectorNames = selectedSectorNamesByScope[eventScope] || [];

  const toggleSectorFilter = (sectorName) => {
    setSelectedSectorNamesByScope((currentFilters) => ({
      ...currentFilters,
      [eventScope]: currentFilters[eventScope].includes(sectorName)
        ? currentFilters[eventScope].filter((value) => value !== sectorName)
        : [...currentFilters[eventScope], sectorName],
    }));
  };

  const clearSectorFilters = () => {
    setSelectedSectorNamesByScope((currentFilters) => ({
      ...currentFilters,
      [eventScope]: [],
    }));
  };

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

  const handleOpenDepartureConfirmation = (householdId) => {
    if (isSelectedEventEnded || isRecordingDeparture) {
      return;
    }

    setPendingDepartureHouseholdId(householdId);
  };

  const handleCancelDeparture = () => {
    if (isRecordingDeparture) {
      return;
    }

    setPendingDepartureHouseholdId("");
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

  const handleOpenEvacuationCorrection = async () => {
    const latestAttendance = householdDetails?.latest_attendance || null;

    setEvacuationCorrectionForm({
      evacuation_center_id: latestAttendance?.evacuation_center_id || "",
      status: latestAttendance?.status || "PRESENT",
      correction_remarks: latestAttendance?.remarks || "",
    });
    setEvacuationCorrectionCenters([]);

    if (assignedBarangay?.id) {
      try {
        const centers = await fetchEvacuationCentersByBarangay(assignedBarangay.id);
        setEvacuationCorrectionCenters(Array.isArray(centers) ? centers : []);
      } catch (_error) {
        setEvacuationCorrectionCenters([]);
      }
    }

    setIsEvacuationCorrectionOpen(true);
  };

  const handleCloseEvacuationCorrection = () => {
    if (isSubmittingEvacuationCorrection) {
      return;
    }

    setIsEvacuationCorrectionOpen(false);
    setEvacuationCorrectionForm({
      evacuation_center_id: "",
      status: "PRESENT",
      correction_remarks: "",
    });
    setEvacuationCorrectionCenters([]);
  };

  const handleChangeEvacuationCorrectionField = (fieldName, value) => {
    setEvacuationCorrectionForm((currentValue) => ({
      ...currentValue,
      [fieldName]: value,
    }));
  };

  const handleSubmitEvacuationCorrection = async () => {
    const latestAttendance = householdDetails?.latest_attendance || null;
    const householdId = householdDetails?.household?.id || "";

    if (!latestAttendance?.id || !householdId || isSubmittingEvacuationCorrection) {
      return;
    }

    setIsSubmittingEvacuationCorrection(true);

    try {
      const response = await correctEvacuationLog({
        householdId,
        evacuationLogId: latestAttendance.id,
        evacuationCenterId: evacuationCorrectionForm.evacuation_center_id || null,
        status: evacuationCorrectionForm.status,
        correctionRemarks: evacuationCorrectionForm.correction_remarks,
      });

      setRegistrationSuccessMessage(
        response.message || "Evacuation log corrected successfully",
      );
      const refreshedDetails = await fetchHouseholdDetails(householdId);
      setHouseholdDetails(refreshedDetails);
      handleCloseEvacuationCorrection();
      reloadMasterlist();
    } catch (error) {
      setAttendanceActionMessage(
        error.message || "Failed to correct evacuation log",
      );
    } finally {
      setIsSubmittingEvacuationCorrection(false);
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

      {!isSelectedEventEnded && selectedHouseholds.length > 0 ? (
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

      <MasterlistTable
        rows={filteredRows}
        isLoading={isLoading}
        errorMessage={errorMessage}
        hasSelectedEvent={hasSelectedEvent}
        onMarkDeparted={handleOpenDepartureConfirmation}
        onViewHousehold={handleOpenHouseholdDetails}
        onEditHousehold={handleOpenEditHousehold}
        onArchiveHousehold={handleOpenArchiveHousehold}
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
        onCancel={handleCancelDeparture}
        onConfirm={handleConfirmDeparture}
        selectedCount={
          isBulkDepartureConfirmOpen ? selectedHouseholds.length : 1
        }
      />

      <HouseholdDetailModal
        isOpen={Boolean(viewingHouseholdId)}
        isLoading={isLoadingHouseholdDetails}
        errorMessage={householdDetailsErrorMessage}
        householdDetails={householdDetails}
        onClose={handleCloseHouseholdDetails}
        onEditHousehold={handleEditHouseholdFromDetails}
        onCorrectEvacuation={handleOpenEvacuationCorrection}
      />

      <HouseholdArchiveConfirmModal
        isOpen={Boolean(pendingArchiveHouseholdId)}
        isSubmitting={isArchivingHousehold}
        archiveRemarks={archiveRemarks}
        onChangeArchiveRemarks={setArchiveRemarks}
        onCancel={handleCancelArchiveHousehold}
        onConfirm={handleConfirmArchiveHousehold}
      />

      <EvacuationCorrectionModal
        isOpen={isEvacuationCorrectionOpen}
        isSubmitting={isSubmittingEvacuationCorrection}
        hasAttendanceRecord={Boolean(householdDetails?.latest_attendance?.id)}
        evacuationCenters={evacuationCorrectionCenters}
        form={evacuationCorrectionForm}
        onChange={handleChangeEvacuationCorrectionField}
        onCancel={handleCloseEvacuationCorrection}
        onConfirm={handleSubmitEvacuationCorrection}
      />
    </>
  );
};

export default BarangayMasterlistPage;
