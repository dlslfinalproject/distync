import React, { useEffect, useMemo, useState } from "react";
import PageHeader from "../../components/layout/PageHeader";
import BarangayDashboardOverview from "../../components/barangay-dashboard/BarangayDashboardOverview";
import { shellStyles } from "../../components/layout/BarangayLayout";
import { pageHeaderStyles } from "../../components/layout/PageHeader";
import MasterlistDepartureConfirmModal from "../../components/masterlist/MasterlistDepartureConfirmModal";
import MasterlistTable from "../../components/masterlist/MasterlistTable";
import MasterlistToolbar from "../../components/masterlist/MasterlistToolbar";
import RegisterFamilyModal from "../../components/household-registration/RegisterFamilyModal";
import { useAuth } from "../../context/AuthContext";
import { useBarangayDashboard } from "../../features/barangay-dashboard/useBarangayDashboard";
import { useHouseholdRegistrationForm } from "../../features/household-registration/useHouseholdRegistrationForm";
import { useMasterlist } from "../../features/masterlist/masterlistHooks";
import { departHousehold } from "../../features/masterlist/masterlistService";
import { fetchMswdoSectors } from "../../features/mswdo-masterlist/mswdoMasterlistService";
import { MdDoorFront } from "react-icons/md";

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

const BarangayMasterlistPage = () => {
  const { authenticatedUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
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
  const [isBulkDepartureConfirmOpen, setIsBulkDepartureConfirmOpen] =
    useState(false);
  const [isRecordingDeparture, setIsRecordingDeparture] = useState(false);
  const [selectedHouseholds, setSelectedHouseholds] = useState([]);

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
  });

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

  const filteredRows = useMemo(() => {
    const searchedRows = getFilteredRows(data.rows, searchTerm);
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
  }, [data.rows, eventScope, searchTerm, selectedSectorNamesByScope]);

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
    setSelectedHouseholds((currentValues) =>
      currentValues.includes(householdId)
        ? currentValues.filter((id) => id !== householdId)
        : [...currentValues, householdId],
    );
  };

  const handleSelectAll = () => {
    const selectableHouseholdIds = filteredRows
      .filter((row) => !row.departure_time_value && row.can_record_departure)
      .map((row) => row.household_id);

    const areAllSelected =
      selectableHouseholdIds.length > 0 &&
      selectableHouseholdIds.every((id) => selectedHouseholds.includes(id));

    setSelectedHouseholds(areAllSelected ? [] : selectableHouseholdIds);
  };

  const handleOpenBulkDepartureConfirmation = () => {
    if (!selectedHouseholds.length || isRecordingDeparture) {
      return;
    }

    setIsBulkDepartureConfirmOpen(true);
  };

  const handleOpenDepartureConfirmation = (householdId) => {
    if (isRecordingDeparture) {
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

      <MasterlistToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        onOpenRegisterFamily={() => setIsRegisterModalOpen(true)}
        hideRegisterButton={eventScope === "ended" || !hasSelectedEvent}
        sectorOptions={sectorOptions}
        selectedSectorNames={selectedSectorNames}
        onToggleSector={toggleSectorFilter}
        onClearFilters={clearSectorFilters}
        filterScopeKey={eventScope}
      />

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

      <MasterlistTable
        rows={filteredRows}
        isLoading={isLoading}
        errorMessage={errorMessage}
        hasSelectedEvent={hasSelectedEvent}
        onMarkDeparted={handleOpenDepartureConfirmation}
        selectedHouseholds={selectedHouseholds}
        onToggleSelect={handleToggleSelect}
        onSelectAll={handleSelectAll}
      />

      <RegisterFamilyModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        form={registrationForm}
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
    </>
  );
};

export default BarangayMasterlistPage;
