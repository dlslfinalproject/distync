import React, { useEffect, useMemo, useState } from "react";
import { FaHandHolding } from "react-icons/fa6";
import BarangayDashboardOverview from "../../components/barangay-dashboard/BarangayDashboardOverview";
import PageHeader from "../../components/layout/PageHeader";
import StubClaimConfirmModal from "../../components/stubs/StubClaimConfirmModal";
import StubSearchBar from "../../components/stubs/StubSearchBar";
import StubResultsTable from "../../components/stubs/StubResultsTable";
import StubSummaryCards from "../../components/stubs/StubSummaryCards";
import { useAuth } from "../../context/AuthContext";
import { useBarangayDashboard } from "../../features/barangay-dashboard/useBarangayDashboard";
import { useStubDashboard } from "../../features/stubs/useStubDashboard";
import { claimStub } from "../../features/stubs/stubService";
import { fetchMswdoSectors } from "../../features/mswdo-masterlist/mswdoMasterlistService";
import { shellStyles } from "../../components/layout/BarangayLayout";

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
      String(value || "")
        .toLowerCase()
        .includes(normalizedSearchTerm),
    );
  });
};

const isEndedDisasterEvent = (event, eventScope) => {
  const status = String(event?.status || "").toUpperCase();
  return eventScope === "ended" || status === "CLOSED" || status === "ARCHIVED";
};

const StubDistributionPage = () => {
  const { authenticatedUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [filtersByScope, setFiltersByScope] = useState({
    active: {
      sectorNames: [],
      stubStatus: "",
    },
    ended: {
      sectorNames: [],
      stubStatus: "",
    },
  });
  const [sectorOptions, setSectorOptions] = useState([]);
  const [claimingStubId, setClaimingStubId] = useState("");
  const [claimErrorMessage, setClaimErrorMessage] = useState("");
  const [pendingClaimStubId, setPendingClaimStubId] = useState("");
  const [selectedStubIds, setSelectedStubIds] = useState([]);
  const [isBulkClaimConfirmOpen, setIsBulkClaimConfirmOpen] = useState(false);

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


  const isSelectedEventEnded = isEndedDisasterEvent(selectedEvent, eventScope);

  const filteredRows = useMemo(() => {
    const searchedRows = getFilteredRows(stubRows, searchTerm);
    const currentFilters = filtersByScope[eventScope] || {
      sectorNames: [],
      stubStatus: "",
    };

    return searchedRows.filter((row) => {
      const matchesStatus =
        !currentFilters.stubStatus || row.status === currentFilters.stubStatus;

      if (!matchesStatus) {
        return false;
      }

      if (currentFilters.sectorNames.length === 0) {
        return true;
      }

      const rowSectorNames = getSectorNames(row.sectors_text);

      return currentFilters.sectorNames.some((sectorName) =>
        rowSectorNames.includes(sectorName),
      );
    });
  }, [eventScope, filtersByScope, searchTerm, stubRows]);

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

  useEffect(() => {
    if (isSelectedEventEnded) {
      setSelectedStubIds([]);
      setPendingClaimStubId("");
      setIsBulkClaimConfirmOpen(false);
    }
  }, [isSelectedEventEnded, selectedEvent?.id]);

  const currentFilters = filtersByScope[eventScope] || {
    sectorNames: [],
    stubStatus: "",
  };

  const stubStatusOptions = [
    { value: "ISSUED", label: "Unclaimed" },
    { value: "CLAIMED", label: "Claimed" },
  ];

  const toggleSectorFilter = (sectorName) => {
    setFiltersByScope((currentValues) => ({
      ...currentValues,
      [eventScope]: {
        ...currentValues[eventScope],
        sectorNames: currentValues[eventScope].sectorNames.includes(sectorName)
          ? currentValues[eventScope].sectorNames.filter(
              (value) => value !== sectorName,
            )
          : [...currentValues[eventScope].sectorNames, sectorName],
      },
    }));
  };

  const setStubStatusFilter = (stubStatus) => {
    setFiltersByScope((currentValues) => ({
      ...currentValues,
      [eventScope]: {
        ...currentValues[eventScope],
        stubStatus,
      },
    }));
  };

  const clearFilters = () => {
    setFiltersByScope((currentValues) => ({
      ...currentValues,
      [eventScope]: {
        sectorNames: [],
        stubStatus: "",
      },
    }));
  };

  const handleToggleSelect = (stubId) => {
    if (isSelectedEventEnded) {
      return;
    }

    setSelectedStubIds((currentValues) =>
      currentValues.includes(stubId)
        ? currentValues.filter((id) => id !== stubId)
        : [...currentValues, stubId],
    );
  };

  const handleSelectAll = () => {
    if (isSelectedEventEnded) {
      setSelectedStubIds([]);
      return;
    }

    const selectableStubIds = filteredRows
      .filter((row) => row.status === "ISSUED")
      .map((row) => row.id);

    const areAllSelected =
      selectableStubIds.length > 0 &&
      selectableStubIds.every((id) => selectedStubIds.includes(id));

    setSelectedStubIds(areAllSelected ? [] : selectableStubIds);
  };

  const handleOpenBulkClaimConfirmation = () => {
    if (isSelectedEventEnded || !selectedStubIds.length || claimingStubId) {
      return;
    }

    setClaimErrorMessage("");
    setIsBulkClaimConfirmOpen(true);
  };

  const handleOpenClaimConfirmation = (stubId) => {
    if (isSelectedEventEnded || claimingStubId) {
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
    setIsBulkClaimConfirmOpen(false);
  };

  const handleConfirmClaim = async () => {
    if (isSelectedEventEnded || claimingStubId) {
      return;
    }

    setClaimErrorMessage("");

    if (isBulkClaimConfirmOpen && selectedStubIds.length > 0) {
      setClaimingStubId("bulk");

      try {
        await Promise.all(
          selectedStubIds.map((stubId) =>
            claimStub({
              stubId,
              userId: authenticatedUser?.id || "",
              overrideBarangayId: allowFallback ? overrideBarangayId : "",
            }),
          ),
        );

        reloadDashboard();
        setSelectedStubIds([]);
        setIsBulkClaimConfirmOpen(false);
      } catch (error) {
        setClaimErrorMessage(
          error.message || "Unable to mark the selected stubs as claimed.",
        );
      } finally {
        setClaimingStubId("");
      }

      return;
    }

    if (!pendingClaimStubId) {
      return;
    }

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

      {hasSelectedEvent && !isLoadingStubDashboard && !stubDashboardErrorMessage ? (
        <StubSummaryCards cards={summaryCards} />
      ) : null}

      <section
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1 }}>
          <StubSearchBar
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            onSearchSubmit={() => {}}
            sectorOptions={sectorOptions}
            selectedSectorNames={currentFilters.sectorNames}
            stubStatusOptions={stubStatusOptions}
            selectedStubStatus={currentFilters.stubStatus}
            onToggleSector={toggleSectorFilter}
            onSelectStubStatus={setStubStatusFilter}
            onClearFilters={clearFilters}
            filterScopeKey={eventScope}
          />
        </div>
      </section>

      {!isSelectedEventEnded && selectedStubIds.length > 0 ? (
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
              {selectedStubIds.length} selected
            </p>

            <button
              type="button"
              onClick={handleOpenBulkClaimConfirmation}
              disabled={Boolean(claimingStubId)}
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
                cursor: claimingStubId ? "not-allowed" : "pointer",
                opacity: claimingStubId ? 0.7 : 1,
              }}
              title="Mark Selected as Claimed"
            >
              <FaHandHolding size={18} />
            </button>
          </div>
        </section>
      ) : null}

      <StubResultsTable
        rows={filteredRows}
        isLoading={isLoadingStubDashboard}
        errorMessage={stubDashboardErrorMessage}
        hasSelectedEvent={hasSelectedEvent}
        claimingStubId={claimingStubId}
        claimErrorMessage={claimErrorMessage}
        onClaimStub={handleOpenClaimConfirmation}
        isClaimReadOnly={isSelectedEventEnded}
        selectedStubIds={selectedStubIds}
        onToggleSelect={handleToggleSelect}
        onSelectAll={handleSelectAll}
      />

      <StubClaimConfirmModal
        isOpen={Boolean(pendingClaimStubId) || isBulkClaimConfirmOpen}
        isSubmitting={Boolean(claimingStubId)}
        onCancel={handleCancelClaim}
        onConfirm={handleConfirmClaim}
        selectedCount={isBulkClaimConfirmOpen ? selectedStubIds.length : 1}
      />
    </>
  );
};

export default StubDistributionPage;