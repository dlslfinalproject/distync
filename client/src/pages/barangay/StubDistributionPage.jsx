import React, { useMemo, useState } from "react";
import BarangayDashboardOverview from "../../components/barangay-dashboard/BarangayDashboardOverview";
import PageHeader from "../../components/layout/PageHeader";
import StubClaimConfirmModal from "../../components/stubs/StubClaimConfirmModal";
import StubSearchBar from "../../components/stubs/StubSearchBar";
import StubResultsTable from "../../components/stubs/StubResultsTable";
import { useAuth } from "../../context/AuthContext";
import { useBarangayDashboard } from "../../features/barangay-dashboard/useBarangayDashboard";
import { useStubDashboard } from "../../features/stubs/useStubDashboard";
import { claimStub } from "../../features/stubs/stubService";

const getFilteredRows = (rows, searchTerm) => {
  if (!searchTerm.trim()) {
    return rows;
  }

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  return rows.filter((row) => {
    const searchableValues = [
      row.household?.family_head_name,
      row.stub_sequence_no,
      row.stub_no,
      row.serial_no,
      row.sectors_text,
      row.status,
    ];

    return searchableValues.some((value) =>
      String(value || "").toLowerCase().includes(normalizedSearchTerm),
    );
  });
};

const StubDistributionPage = () => {
  const { authenticatedUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [claimingStubId, setClaimingStubId] = useState("");
  const [claimErrorMessage, setClaimErrorMessage] = useState("");
  const [pendingClaimStubId, setPendingClaimStubId] = useState("");

  const {
    accessMode,
    allowFallback,
    eventScope,
    selectedDisasterEventId,
    overrideBarangayId,
    assignedBarangay,
    availableEvents,
    selectedEvent,
    devBarangayOptions,
    isLoading,
    errorMessage,
    errorCode,
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

  const {
    rows: stubRows,
    summaryCards,
    isLoading: isLoadingStubDashboard,
    errorMessage: stubDashboardErrorMessage,
    hasData: hasStubData,
    reloadDashboard,
  } = useStubDashboard({
    userId: authenticatedUser?.id || "",
    disasterEventId: selectedEvent?.id || "",
    overrideBarangayId,
    allowFallback,
  });

  const filteredRows = useMemo(() => {
    return getFilteredRows(stubRows, searchTerm);
  }, [searchTerm, stubRows]);

  const handleOpenClaimConfirmation = (stubId) => {
    if (claimingStubId) {
      return;
    }

    setClaimErrorMessage("");
    setPendingClaimStubId(stubId);
  };

  const handleCancelClaim = () => {
    if (claimingStubId) {
      return;
    }

    setPendingClaimStubId("");
  };

  const handleConfirmClaim = async () => {
    if (!pendingClaimStubId || claimingStubId) {
      return;
    }

    setClaimErrorMessage("");
    setClaimingStubId(pendingClaimStubId);

    try {
      await claimStub({
        stubId: pendingClaimStubId,
        userId: authenticatedUser?.id || "",
        overrideBarangayId: allowFallback ? overrideBarangayId : "",
      });
      reloadDashboard();
      setPendingClaimStubId("");
    } catch (error) {
      setClaimErrorMessage(
        error.message || "Unable to mark the stub as claimed.",
      );
    } finally {
      setClaimingStubId("");
    }
  };

  return (
    <>
      <PageHeader title="RELIEF GOODS DISTRIBUTION" />

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
        isLoading={isLoading || isLoadingStubDashboard}
        errorMessage={errorMessage}
        errorCode={errorCode}
        hasSelectedEvent={hasSelectedEvent}
        hasEvents={hasEvents}
        hasData={hasSelectedEvent ? hasStubData : hasData}
        hasAssignedBarangay={hasAssignedBarangay}
        isDevOverride={isDevOverride}
        setEventScope={setEventScope}
        setSelectedDisasterEventId={setSelectedDisasterEventId}
        setOverrideBarangayId={setOverrideBarangayId}
      />

      <section style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}>
          <StubSearchBar
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            onSearchSubmit={() => {}}
          />
        </div>
      </section>

      <StubResultsTable
        rows={filteredRows}
        isLoading={isLoadingStubDashboard}
        errorMessage={stubDashboardErrorMessage}
        hasSelectedEvent={hasSelectedEvent}
        claimingStubId={claimingStubId}
        claimErrorMessage={claimErrorMessage}
        onClaimStub={handleOpenClaimConfirmation}
      />

      <StubClaimConfirmModal
        isOpen={Boolean(pendingClaimStubId)}
        isSubmitting={Boolean(claimingStubId)}
        onCancel={handleCancelClaim}
        onConfirm={handleConfirmClaim}
      />
    </>
  );
};

export default StubDistributionPage;
