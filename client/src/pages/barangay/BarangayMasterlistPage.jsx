import React, { useMemo, useState } from "react";
import PageHeader from "../../components/layout/PageHeader";
import BarangayDashboardOverview from "../../components/barangay-dashboard/BarangayDashboardOverview";
import { shellStyles } from "../../components/layout/BarangayLayout";
import MasterlistDepartureConfirmModal from "../../components/masterlist/MasterlistDepartureConfirmModal";
import MasterlistTable from "../../components/masterlist/MasterlistTable";
import MasterlistToolbar from "../../components/masterlist/MasterlistToolbar";
import RegisterFamilyModal from "../../components/household-registration/RegisterFamilyModal";
import { useAuth } from "../../context/AuthContext";
import { useBarangayDashboard } from "../../features/barangay-dashboard/useBarangayDashboard";
import { useHouseholdRegistrationForm } from "../../features/household-registration/useHouseholdRegistrationForm";
import { useMasterlist } from "../../features/masterlist/masterlistHooks";
import { departHousehold } from "../../features/masterlist/masterlistService";

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
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [registrationSuccessMessage, setRegistrationSuccessMessage] = useState("");
  const [attendanceActionMessage, setAttendanceActionMessage] = useState("");
  const [pendingDepartureHouseholdId, setPendingDepartureHouseholdId] = useState("");
  const [isRecordingDeparture, setIsRecordingDeparture] = useState(false);

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
    defaultDisasterEventId: selectedEvent?.id || "",
    onSuccess: (response) => {
      setRegistrationSuccessMessage(
        response?.message || "Household registered successfully",
      );
      reloadMasterlist();
    },
  });

  const filteredRows = useMemo(() => {
    return getFilteredRows(data.rows, searchTerm);
  }, [data.rows, searchTerm]);

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
  };

  const handleConfirmDeparture = async () => {
    if (!pendingDepartureHouseholdId || isRecordingDeparture) {
      return;
    }

    setIsRecordingDeparture(true);

    try {
      const response = await departHousehold({
        householdId: pendingDepartureHouseholdId,
      });
      setAttendanceActionMessage(
        response.message || "Household departure recorded successfully",
      );
      reloadMasterlist();
      setPendingDepartureHouseholdId("");
    } catch (error) {
      setAttendanceActionMessage(
        error.message || "Failed to record household departure",
      );
    }
    finally {
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
      />

      <MasterlistTable
        rows={filteredRows}
        isLoading={isLoading}
        errorMessage={errorMessage}
        hasSelectedEvent={hasSelectedEvent}
        onMarkDeparted={handleOpenDepartureConfirmation}
      />

      <RegisterFamilyModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        form={registrationForm}
      />

      <MasterlistDepartureConfirmModal
        isOpen={Boolean(pendingDepartureHouseholdId)}
        isSubmitting={isRecordingDeparture}
        onCancel={handleCancelDeparture}
        onConfirm={handleConfirmDeparture}
      />
    </>
  );
};

export default BarangayMasterlistPage;
