import React, { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { FaHandHolding } from "react-icons/fa6";
import { FiPrinter } from "react-icons/fi";
import { MdQrCodeScanner } from "react-icons/md";
import PageHeader, { pageHeaderStyles } from "../../components/layout/PageHeader";
import {
  pageSpacingStyles,
  shellStyles,
} from "../../components/layout/BarangayLayout";
import FeedbackToast from "../../components/shared/FeedbackToast";
import StatusPill from "../../components/shared/StatusPill";
import StubClaimConfirmModal from "../../components/stubs/StubClaimConfirmModal";
import StubDetailModal from "../../components/stubs/StubDetailModal";
import MswdoStubResultsTable from "../../components/stubs/MswdoStubResultsTable";
import StubQrScanErrorModal from "../../components/stubs/StubQrScanErrorModal";
import StubPrintSheetModal from "../../components/stubs/StubPrintSheetModal";
import StubQrScanModal from "../../components/stubs/StubQrScanModal";
import StubSearchBar from "../../components/stubs/StubSearchBar";
import StubSummaryCards from "../../components/stubs/StubSummaryCards";
import { useAuth } from "../../context/AuthContext";
import {
  claimStub,
  fetchStubDetails,
  verifyStub,
} from "../../features/stubs/stubService";
import { useMswdoStubDistribution } from "../../features/stubs/useMswdoStubDistribution";
import db from "../../offline/db.js";
import { buildSyncDescriptor, findSyncEntry } from "../../offline/syncStatus";
import { subscribeToSyncUpdates } from "../../offline/syncService";
import { getVisibleSyncQueueEntries } from "../../offline/syncQueue";
import { buildMasterlistFilterSectorOptions } from "../../utils/registrationOptions";
import { STATUS_FILTERS } from "../../features/stubs/stubStatusFilters";
import {
  QR_SCAN_ERROR_CODES,
  createQrScanError,
  createWrongBarangayQrScanError,
  createWrongEventQrScanError,
} from "../../features/stubs/stubQrScanErrors";
import { readOperationalDisasterEventScope } from "../../features/disaster-events/operationalDisasterEventSelection";
import { ROLE_CODES } from "../../utils/roleSession";

const DEFAULT_STUB_STATUS = STATUS_FILTERS.ALL;
const DEFAULT_STUB_SORT_ORDER = "oldest";
const QR_SCAN_COOLDOWN_MS = 1800;

const filterStyles = {
  field: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1px solid #cfddeb",
    backgroundColor: "#f8fbfe",
    color: "#1f3b57",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  label: {
    display: "block",
    marginBottom: "8px",
    color: "#5f7892",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
};

const tabButtonStyles = (isActive) => ({
  padding: "12px 24px",
  border: "none",
  background: "none",
  fontSize: "14px",
  fontWeight: 700,
  textTransform: "uppercase",
  color: isActive ? "#17324d" : "#6b8298",
  borderBottom: isActive ? "3px solid #17324d" : "3px solid transparent",
  cursor: "pointer",
});

const formatDisplayDate = (value) => {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-PH", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(value));
};

const formatReliefPeriod = (event) => {
  if (!event) return "-";

  const start = formatDisplayDate(event.start_date);

  if (!event.end_date && event.status === "ACTIVE") {
    return `${start} - Ongoing`;
  }

  if (event.end_date) {
    return `${start} - ${formatDisplayDate(event.end_date)}`;
  }

  return start;
};

const formatDisasterEventTitle = (event) =>
  String(event?.title || "").trim() || "No disaster event selected";

const stubStatusOptions = [
  { value: STATUS_FILTERS.CLAIMED, label: "Claimed" },
  { value: STATUS_FILTERS.UNCLAIMED, label: "For Claim" },
];

const getStubSortTime = (row) => {
  const timestamp =
    row.queue_time_in || row.qr_generated_at || row.issued_at || row.created_at || "";
  const parsedTime = timestamp ? new Date(timestamp).getTime() : 0;

  if (Number.isFinite(parsedTime) && parsedTime > 0) {
    return parsedTime;
  }

  return Number(row.stub_sequence_no || row.stub_number || 0);
};

const sortStubRows = (rows, sortOrder = DEFAULT_STUB_SORT_ORDER) =>
  [...rows].sort((left, right) => {
    if (sortOrder === "az" || sortOrder === "za") {
      const leftName = String(left.family_head_name || "");
      const rightName = String(right.family_head_name || "");
      const comparison = leftName.localeCompare(rightName);

      return sortOrder === "za" ? -comparison : comparison;
    }

    const leftTime = getStubSortTime(left);
    const rightTime = getStubSortTime(right);

    return sortOrder === "oldest" ? leftTime - rightTime : rightTime - leftTime;
  });

const buildStubPrintRoute = ({
  stubIds = [],
  eventId = "",
  barangayId = "",
  status = "",
  sortOrder = "",
}) => {
  const searchParams = new URLSearchParams();

  if (stubIds.length > 0) {
    searchParams.set("stubIds", stubIds.join(","));
  }

  if (eventId) {
    searchParams.set("eventId", eventId);
  }

  if (barangayId) {
    searchParams.set("barangayId", barangayId);
  }

  if (status) {
    searchParams.set("status", status);
  }

  if (sortOrder) {
    searchParams.set("sort_order", sortOrder);
  }

  return `/mswdo/print/stubs?${searchParams.toString()}`;
};

const getStubReferenceNumber = (stubDetails, verification) =>
  verification?.data?.details?.stubNumber ||
  stubDetails?.display_stub_no ||
  stubDetails?.stub_no ||
  "";

const buildQrScanErrorDetails = (verification, stubDetails) => {
  return {
    ...((verification?.data?.details && typeof verification.data.details === "object")
      ? verification.data.details
      : {}),
    stubNumber: getStubReferenceNumber(stubDetails, verification) || undefined,
    claimedAt:
      verification?.data?.details?.claimedAt ||
      stubDetails?.distribution_transaction?.received_at ||
      stubDetails?.distribution_transaction?.distribution_date ||
      stubDetails?.claimed_at ||
      undefined,
    claimedByName:
      verification?.data?.details?.claimedByName ||
      stubDetails?.distribution_transaction?.claimed_by_name ||
      undefined,
    reliefPackName:
      verification?.data?.details?.reliefPackName ||
      stubDetails?.distribution_transaction?.relief_pack_template_name ||
      stubDetails?.relief_pack_name ||
      undefined,
  };
};

const StubDistributionPage = () => {
  const { authenticatedUser } = useAuth();
  const {
    disasterEvents,
    barangays,
    allBarangays,
    sectors,
    selectedDisasterEventId,
    selectedBarangayId,
    selectedDisasterEvent,
    searchTerm,
    displayedRows,
    summaryCards,
    isLoadingFilters,
    isLoadingData,
    isEventSelectionResolved,
    errorMessage,
    hasSelectedEvent,
    hasSelectedBarangay,
    setSelectedDisasterEventId,
    setSelectedBarangayId,
    setSelectedSectorIds,
    setSelectedStubStatus,
    setSearchTerm,
    reloadDashboard,
  } = useMswdoStubDistribution({
    userId: authenticatedUser?.id || "",
  });

  const [activeTab, setActiveTab] = useState(
    () =>
      readOperationalDisasterEventScope({
        roleCode: ROLE_CODES.MSWDO,
        userId: authenticatedUser?.id || "",
      }) || "active",
  );
  const [claimingStubId, setClaimingStubId] = useState("");
  const [claimErrorMessage, setClaimErrorMessage] = useState("");
  const [pendingClaimStubId, setPendingClaimStubId] = useState("");
  const [pendingClaimStubDetails, setPendingClaimStubDetails] = useState(null);
  const [isLoadingPendingClaimStubDetails, setIsLoadingPendingClaimStubDetails] =
    useState(false);
  const [selectedStubDetails, setSelectedStubDetails] = useState(null);
  const [isStubDetailModalOpen, setIsStubDetailModalOpen] = useState(false);
  const [isLoadingStubDetails, setIsLoadingStubDetails] = useState(false);
  const [stubDetailsErrorMessage, setStubDetailsErrorMessage] = useState("");
  const [selectedStubIds, setSelectedStubIds] = useState([]);
  const [isBulkClaimConfirmOpen, setIsBulkClaimConfirmOpen] = useState(false);
  const [isPrintSheetModalOpen, setIsPrintSheetModalOpen] = useState(false);
  const [isQrScanModalOpen, setIsQrScanModalOpen] = useState(false);
  const [isResolvingScannedQr, setIsResolvingScannedQr] = useState(false);
  const [scanToast, setScanToast] = useState({
    message: "",
    type: "info",
    title: "",
  });
  const [scannerHelperMessage, setScannerHelperMessage] = useState("");
  const [qrScanErrorState, setQrScanErrorState] = useState(null);
  const [scanCooldownState, setScanCooldownState] = useState({
    value: "",
    until: 0,
  });
  const [filtersByTab, setFiltersByTab] = useState({
    active: {
      sectorIds: [],
      stubStatus: DEFAULT_STUB_STATUS,
      sortOrder: DEFAULT_STUB_SORT_ORDER,
    },
    ended: {
      sectorIds: [],
      stubStatus: DEFAULT_STUB_STATUS,
      sortOrder: DEFAULT_STUB_SORT_ORDER,
    },
  });
  const syncQueueEntries =
    useLiveQuery(() => getVisibleSyncQueueEntries(), [], []) || [];

  const selectedSectorIds = filtersByTab[activeTab]?.sectorIds || [];
  const selectedStubStatus =
    filtersByTab[activeTab]?.stubStatus ?? DEFAULT_STUB_STATUS;
  const selectedSortOrder =
    filtersByTab[activeTab]?.sortOrder ?? DEFAULT_STUB_SORT_ORDER;
  const displayedRowsWithSyncStatus = useMemo(() => {
    return sortStubRows(displayedRows, selectedSortOrder).map((row) => {
      const matchingEntry = findSyncEntry(syncQueueEntries, (entry) => {
        if (entry.moduleName !== "stubs") {
          return false;
        }

        return (
          entry.entityServerId === row.id ||
          entry.entityLocalId === row.id ||
          entry.payload?.stub_id === row.id
        );
      });

      return {
        ...row,
        sync_status: row.is_local_only
          ? row.sync_status
          : buildSyncDescriptor(matchingEntry).status,
      };
    });
  }, [displayedRows, selectedSortOrder, syncQueueEntries]);
  const selectedClaimRows = useMemo(() => {
    const selectedStubIdSet = new Set(selectedStubIds);

    return displayedRowsWithSyncStatus.filter((row) =>
      selectedStubIdSet.has(row.id),
    );
  }, [displayedRowsWithSyncStatus, selectedStubIds]);

  const scopedDisasterEvents = useMemo(() => {
    const allowedStatuses =
      activeTab === "active" ? ["ACTIVE"] : ["CLOSED", "ARCHIVED"];

    return disasterEvents.filter((event) => allowedStatuses.includes(event.status));
  }, [activeTab, disasterEvents]);

  const activeEventLabel = formatDisasterEventTitle(selectedDisasterEvent);
  const isEndedView = activeTab === "ended";
  const sectorFilterOptions = useMemo(
    () =>
      buildMasterlistFilterSectorOptions(sectors).map((sector) => ({
        ...sector,
        id: sector.source_sector_id || sector.id,
      })),
    [sectors],
  );

  useEffect(() => {
    if (isLoadingFilters || !isEventSelectionResolved) {
      return;
    }

    if (
      selectedDisasterEvent?.status === "ACTIVE" &&
      activeTab !== "active"
    ) {
      setActiveTab("active");
    }

    if (
      ["CLOSED", "ARCHIVED"].includes(selectedDisasterEvent?.status) &&
      activeTab !== "ended"
    ) {
      setActiveTab("ended");
    }
  }, [
    activeTab,
    isEventSelectionResolved,
    isLoadingFilters,
    selectedDisasterEvent?.status,
  ]);

  useEffect(() => {
    setSelectedSectorIds(selectedSectorIds);
    setSelectedStubStatus(selectedStubStatus);
  }, [
    selectedSectorIds,
    selectedStubStatus,
    setSelectedSectorIds,
    setSelectedStubStatus,
  ]);

  useEffect(() => {
    setSelectedStubIds([]);
    setPendingClaimStubId("");
    setPendingClaimStubDetails(null);
    setIsBulkClaimConfirmOpen(false);
    setClaimErrorMessage("");
    setIsQrScanModalOpen(false);
    setQrScanErrorState(null);
    setScannerHelperMessage("");
    setScanCooldownState({ value: "", until: 0 });
  }, [activeTab, selectedBarangayId, selectedDisasterEventId]);

  useEffect(() => {
    const visibleStubIds = new Set(displayedRowsWithSyncStatus.map((row) => row.id));
    setSelectedStubIds((currentValues) =>
      currentValues.filter((stubId) => visibleStubIds.has(stubId)),
    );
  }, [displayedRowsWithSyncStatus]);

  useEffect(() => {
    const unsubscribe = subscribeToSyncUpdates(() => {
      if (typeof navigator !== "undefined" && navigator.onLine) {
        reloadDashboard();
      }
    });

    return () => unsubscribe();
  }, [reloadDashboard]);

  const toggleSectorFilter = (sectorId) => {
    setFiltersByTab((currentFilters) => ({
      ...currentFilters,
      [activeTab]: {
        ...currentFilters[activeTab],
        sectorIds: currentFilters[activeTab].sectorIds.includes(sectorId)
          ? currentFilters[activeTab].sectorIds.filter((id) => id !== sectorId)
          : [...currentFilters[activeTab].sectorIds, sectorId],
      },
    }));
  };

  const clearFilters = () => {
    setFiltersByTab((currentFilters) => ({
      ...currentFilters,
      [activeTab]: {
        sectorIds: [],
        stubStatus: DEFAULT_STUB_STATUS,
        sortOrder: DEFAULT_STUB_SORT_ORDER,
      },
    }));
  };

  const setSortOrderFilter = (sortOrder) => {
    setFiltersByTab((currentFilters) => ({
      ...currentFilters,
      [activeTab]: {
        ...currentFilters[activeTab],
        sortOrder,
      },
    }));
  };

  const handleEventScopeChange = (nextTab) => {
    setActiveTab(nextTab);

    const allowedStatuses =
      nextTab === "active" ? ["ACTIVE"] : ["CLOSED", "ARCHIVED"];
    const nextEvents = disasterEvents.filter((event) =>
      allowedStatuses.includes(event.status),
    );

    if (nextEvents.length === 0) {
      setSelectedDisasterEventId("");
      return;
    }

    if (!nextEvents.some((event) => event.id === selectedDisasterEventId)) {
      setSelectedDisasterEventId(nextEvents[0].id);
    }
  };

  const handleToggleSelect = (stubId) => {
    if (isEndedView) {
      return;
    }

    setSelectedStubIds((currentValues) =>
      currentValues.includes(stubId)
        ? currentValues.filter((id) => id !== stubId)
        : [...currentValues, stubId],
    );
  };

  const handleSelectAll = () => {
    if (isEndedView) {
      setSelectedStubIds([]);
      return;
    }

    const selectableStubIds = displayedRowsWithSyncStatus
      .filter((row) => row.status === "ISSUED")
      .map((row) => row.id);

    const areAllSelected =
      selectableStubIds.length > 0 &&
      selectableStubIds.every((id) => selectedStubIds.includes(id));

    setSelectedStubIds(areAllSelected ? [] : selectableStubIds);
  };

  const handleOpenBulkClaimConfirmation = () => {
    if (isEndedView || !selectedStubIds.length || claimingStubId) {
      return;
    }

    if (selectedStubIds.length === 1) {
      handleOpenClaimConfirmation(selectedStubIds[0]);
      return;
    }

    setClaimErrorMessage("");
    setPendingClaimStubId("");
    setPendingClaimStubDetails(null);
    setIsBulkClaimConfirmOpen(true);
  };

  const handleOpenClaimConfirmation = (stubId) => {
    if (isEndedView || claimingStubId) {
      return;
    }

    setClaimErrorMessage("");
    setIsBulkClaimConfirmOpen(false);
    setPendingClaimStubId(stubId);
    setPendingClaimStubDetails(null);
  };

  useEffect(() => {
    if (!pendingClaimStubId || isBulkClaimConfirmOpen) {
      setPendingClaimStubDetails(null);
      setIsLoadingPendingClaimStubDetails(false);
      return;
    }

    let isMounted = true;

    const loadPendingClaimStubDetails = async () => {
      setIsLoadingPendingClaimStubDetails(true);

      try {
        const stubDetails = await fetchStubDetails(pendingClaimStubId);

        if (isMounted) {
          setPendingClaimStubDetails(stubDetails);
        }
      } catch (error) {
        if (isMounted) {
          setClaimErrorMessage(
            error.message || "Unable to load the selected stub details.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingPendingClaimStubDetails(false);
        }
      }
    };

    loadPendingClaimStubDetails();

    return () => {
      isMounted = false;
    };
  }, [isBulkClaimConfirmOpen, pendingClaimStubId]);

  const handleCancelClaim = () => {
    if (claimingStubId) {
      return;
    }

    setPendingClaimStubId("");
    setPendingClaimStubDetails(null);
    setIsBulkClaimConfirmOpen(false);
  };

  const handleConfirmClaim = async () => {
    if (isEndedView || claimingStubId) {
      return;
    }

    setClaimErrorMessage("");

    if (isBulkClaimConfirmOpen && selectedStubIds.length > 0) {
      setClaimingStubId("bulk");

      try {
        await Promise.all(
          selectedStubIds.map((stubId) => {
            const row =
              filteredRows.find((candidate) => candidate.id === stubId) ||
              stubRows.find((candidate) => candidate.id === stubId);

            return claimStub({
              stubId,
              barangayId: selectedBarangayId,
              disasterEventId: row?.disaster_event?.id || row?.disaster_event_id || "",
            });
          }),
        );

        reloadDashboard();
        setSelectedStubIds([]);
        setIsBulkClaimConfirmOpen(false);
        setPendingClaimStubDetails(null);
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
        barangayId: selectedBarangayId,
        disasterEventId:
          pendingClaimStubDetails?.disaster_event?.id ||
          stubRows.find((row) => row.id === pendingClaimStubId)?.disaster_event?.id ||
          stubRows.find((row) => row.id === pendingClaimStubId)?.disaster_event_id ||
          "",
      });
      reloadDashboard();
      setPendingClaimStubId("");
      setPendingClaimStubDetails(null);
    } catch (error) {
      setClaimErrorMessage(error.message || "Unable to mark the stub as claimed.");
    } finally {
      setClaimingStubId("");
    }
  };

  const openStubPrintPage = (printUrl) => {
    window.open(printUrl, "_blank", "noopener,noreferrer");
  };

  const handleOpenStubDetails = async (row) => {
    if (!row?.id) {
      return;
    }

    setIsStubDetailModalOpen(true);
    setIsLoadingStubDetails(true);
    setSelectedStubDetails(null);
    setStubDetailsErrorMessage("");

    try {
      const details = await fetchStubDetails(row.id);
      setSelectedStubDetails(details);
    } catch (error) {
      setStubDetailsErrorMessage(
        error.message || "Unable to load the selected stub details.",
      );
    } finally {
      setIsLoadingStubDetails(false);
    }
  };

  const handleCloseStubDetails = () => {
    setIsStubDetailModalOpen(false);
    setSelectedStubDetails(null);
    setStubDetailsErrorMessage("");
    setIsLoadingStubDetails(false);
  };

  const handlePrintStubSheet = ({
    disasterEventId,
    barangayId,
    stubStatus,
    orderList,
  }) => {
    setIsPrintSheetModalOpen(false);
    openStubPrintPage(
      buildStubPrintRoute({
        eventId: disasterEventId,
        barangayId,
        status: stubStatus,
        sortOrder: orderList,
      }),
    );
  };

  const openQrScanError = (error, scannedQrValue) => {
    setQrScanErrorState({
      error,
      scannedQrValue,
    });
  };

  const handleCloseQrScanner = () => {
    setIsQrScanModalOpen(false);
    setIsResolvingScannedQr(false);
    setQrScanErrorState(null);
    setScannerHelperMessage("");
    setScanCooldownState({
      value: "",
      until: 0,
    });
  };

  const handleDismissQrScanError = () => {
    const blockedQrValue = qrScanErrorState?.scannedQrValue || "";

    setQrScanErrorState(null);
    setScannerHelperMessage("Ready to scan another QR stub.");

    if (!blockedQrValue) {
      setScanCooldownState({
        value: "",
        until: 0,
      });
      return;
    }

    setScanCooldownState({
      value: blockedQrValue,
      until: Date.now() + QR_SCAN_COOLDOWN_MS,
    });
  };

  const handleScannedQr = async (qrCodeValue) => {
    if (isEndedView || isResolvingScannedQr) {
      return;
    }

    setIsResolvingScannedQr(true);
    setClaimErrorMessage("");
    setScannerHelperMessage("");

    try {
      const verification = await verifyStub({ qrCodeValue });
      const resolvedStubId = verification?.data?.stub?.id;

      if (!resolvedStubId) {
        throw createQrScanError({
          code: QR_SCAN_ERROR_CODES.INVALID_QR_STUB,
          message: "QR lookup did not return a valid stub record.",
        });
      }

      const stubDetails = await fetchStubDetails(resolvedStubId);
      const stubEventId = stubDetails?.disaster_event?.id || "";
      const stubBarangayId = stubDetails?.barangay?.id || "";

      if (stubEventId !== selectedDisasterEventId) {
        throw createWrongEventQrScanError({
          stubNumber: getStubReferenceNumber(stubDetails, verification) || undefined,
        });
      }

      if (stubBarangayId !== selectedBarangayId) {
        throw createWrongBarangayQrScanError({
          stubNumber: getStubReferenceNumber(stubDetails, verification) || undefined,
        });
      }

      if (!verification?.data?.is_claimable || stubDetails?.status !== "ISSUED") {
        throw createQrScanError({
          code:
            verification?.data?.code ||
            (stubDetails?.status === "CLAIMED"
              ? QR_SCAN_ERROR_CODES.STUB_ALREADY_CLAIMED
              : QR_SCAN_ERROR_CODES.STUB_UNAVAILABLE),
          message:
            verification?.data?.reason ||
            verification?.message ||
            "This QR stub has already been claimed or is not claimable.",
          details: buildQrScanErrorDetails(verification, stubDetails),
        });
      }

      setPendingClaimStubId(resolvedStubId);
      setPendingClaimStubDetails(stubDetails);
      setIsBulkClaimConfirmOpen(false);
      setSelectedStubIds([]);
      setIsQrScanModalOpen(false);
      setScanToast({
        type: "success",
        title: "QR Verified",
        message: "QR stub verified successfully. Please confirm relief distribution.",
      });
    } catch (error) {
      openQrScanError(error, qrCodeValue);
    } finally {
      setIsResolvingScannedQr(false);
    }
  };

  return (
    <>
      <PageHeader title="RELIEF GOODS DISTRIBUTION" actions={[]} />

      <section className="mswdo-stub-scope-card" style={shellStyles.card}>
        <div
          className="mswdo-stub-tabs"
          style={{
            display: "flex",
            borderBottom: "1px solid #d6e2ef",
            marginBottom: "24px",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => handleEventScopeChange("active")}
            style={tabButtonStyles(activeTab === "active")}
          >
            Active Events
          </button>
          <button
            type="button"
            onClick={() => handleEventScopeChange("ended")}
            style={tabButtonStyles(activeTab === "ended")}
          >
            Ended Events
          </button>
        </div>

        <div
          className="mswdo-stub-filter-grid"
          style={pageSpacingStyles.filterGrid}
        >
          <div className="mswdo-stub-filter-field">
            <label htmlFor="mswdo-stub-event" style={filterStyles.label}>
              {activeTab === "active" ? "Active" : "Ended"} Disaster Event
            </label>
            <select
              id="mswdo-stub-event"
              value={selectedDisasterEventId || ""}
              onChange={(event) => setSelectedDisasterEventId(event.target.value)}
              disabled={isLoadingFilters || scopedDisasterEvents.length === 0}
              style={filterStyles.field}
            >
              <option value="">
                Select {activeTab === "active" ? "active" : "ended"} disaster event
              </option>
              {scopedDisasterEvents.map((event) => (
                <option key={event.id} value={event.id}>
                  {formatDisasterEventTitle(event)}
                </option>
              ))}
            </select>
          </div>

          <div className="mswdo-stub-filter-field">
            <label htmlFor="mswdo-stub-barangay" style={filterStyles.label}>
              Barangay
            </label>
            <select
              id="mswdo-stub-barangay"
              value={selectedBarangayId}
              onChange={(event) => setSelectedBarangayId(event.target.value)}
              disabled={
                isLoadingFilters ||
                !selectedDisasterEventId ||
                barangays.length === 0
              }
              style={filterStyles.field}
            >
              <option value="">
                {selectedDisasterEventId
                  ? "Select affected barangay"
                  : "Select disaster event first"}
              </option>
              {barangays.map((barangay) => (
                <option key={barangay.id} value={barangay.id}>
                  {barangay.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="mswdo-stub-event-summary-card" style={shellStyles.card}>
        <div
          className="mswdo-stub-event-summary"
          style={{
            border: "1px solid #d6e2ef",
            borderRadius: "16px",
            padding: "18px 20px",
            backgroundColor: "#f8fbfe",
          }}
        >
          <p
            className="mswdo-stub-event-title"
            style={{
              margin: 0,
              color: "#17324d",
              fontSize: "18px",
              fontWeight: 800,
            }}
          >
            {activeEventLabel}
          </p>

          <div
            className="mswdo-stub-event-meta"
            style={{
              display: "flex",
              gap: "24px",
              marginTop: "14px",
              flexWrap: "wrap",
              color: "#334155",
            }}
          >
            <span>Period: {formatReliefPeriod(selectedDisasterEvent)}</span>
            <StatusPill status={selectedDisasterEvent?.status} />
          </div>
        </div>

        {isLoadingFilters ? (
          <p style={{ ...shellStyles.mutedText, marginTop: "16px" }}>
            Loading MSWDO stub distribution filters...
          </p>
        ) : !hasSelectedEvent ? (
          <p style={{ ...shellStyles.mutedText, marginTop: "16px" }}>
            Select a disaster event to load the relief goods distribution page.
          </p>
        ) : !hasSelectedBarangay ? (
          <p style={{ ...shellStyles.mutedText, marginTop: "16px" }}>
            Select a barangay to view stub progress for the selected disaster event.
          </p>
        ) : null}
      </section>

      {hasSelectedEvent &&
      hasSelectedBarangay &&
      !isLoadingData &&
      !errorMessage ? (
        <StubSummaryCards cards={summaryCards} />
      ) : null}

      <section>
        <StubSearchBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          onSearchSubmit={() => {}}
          sectorOptions={sectorFilterOptions}
          selectedSectorNames={selectedSectorIds}
          stubStatusOptions={stubStatusOptions}
          selectedStubStatus={selectedStubStatus}
          selectedSortOrder={selectedSortOrder}
          onToggleSector={toggleSectorFilter}
          onSelectStubStatus={(stubStatus) =>
            setFiltersByTab((currentFilters) => ({
              ...currentFilters,
              [activeTab]: {
                ...currentFilters[activeTab],
                stubStatus,
              },
            }))
          }
          onSortOrderChange={setSortOrderFilter}
          onClearFilters={clearFilters}
          filterScopeKey={`${activeTab}-${selectedDisasterEventId}-${selectedBarangayId}`}
          actions={
            <>
              <button
                type="button"
                onClick={() => setIsPrintSheetModalOpen(true)}
                disabled={!hasSelectedEvent || !hasSelectedBarangay}
                style={{
                  ...pageHeaderStyles.secondaryButton,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  opacity: !hasSelectedEvent || !hasSelectedBarangay ? 0.7 : 1,
                }}
              >
                <FiPrinter size={16} />
                Print
              </button>
              {!isEndedView ? (
                <button
                  type="button"
                  onClick={() => setIsQrScanModalOpen(true)}
                  disabled={
                    !hasSelectedEvent ||
                    !hasSelectedBarangay ||
                    isResolvingScannedQr
                  }
                  style={{
                    ...pageHeaderStyles.primaryButton,
                    opacity:
                      !hasSelectedEvent ||
                      !hasSelectedBarangay ||
                      isResolvingScannedQr
                        ? 0.7
                        : 1,
                  }}
                >
                  <MdQrCodeScanner size={18} />
                  Scan QR
                </button>
              ) : null}
            </>
          }
        />
      </section>

      {!isEndedView && selectedStubIds.length > 0 ? (
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

      <MswdoStubResultsTable
        rows={displayedRowsWithSyncStatus}
        isLoading={isLoadingData}
        errorMessage={errorMessage}
        hasSelectedEvent={hasSelectedEvent}
        hasSelectedBarangay={hasSelectedBarangay}
        claimingStubId={claimingStubId}
        claimErrorMessage={claimErrorMessage}
        onClaimStub={handleOpenClaimConfirmation}
        onViewStub={handleOpenStubDetails}
        isClaimReadOnly={isEndedView}
        selectedStubIds={selectedStubIds}
        onToggleSelect={handleToggleSelect}
        onSelectAll={handleSelectAll}
      />

      <StubClaimConfirmModal
        isOpen={Boolean(pendingClaimStubId) || isBulkClaimConfirmOpen}
        isSubmitting={Boolean(claimingStubId)}
        isLoadingStubDetails={isLoadingPendingClaimStubDetails}
        onCancel={handleCancelClaim}
        onConfirm={handleConfirmClaim}
        selectedCount={isBulkClaimConfirmOpen ? selectedStubIds.length : 1}
        selectedStubs={selectedClaimRows}
        stubDetails={pendingClaimStubDetails}
      />

      <StubDetailModal
        isOpen={isStubDetailModalOpen}
        isLoading={isLoadingStubDetails}
        errorMessage={stubDetailsErrorMessage}
        stubDetails={selectedStubDetails}
        onClose={handleCloseStubDetails}
      />

      <StubPrintSheetModal
        isOpen={isPrintSheetModalOpen}
        disasterEvents={scopedDisasterEvents}
        barangays={allBarangays}
        selectedDisasterEventId={selectedDisasterEventId}
        selectedBarangayId={selectedBarangayId}
        showBarangaySelection
        onClose={() => setIsPrintSheetModalOpen(false)}
        onPrint={handlePrintStubSheet}
      />

      <StubQrScanModal
        isOpen={isQrScanModalOpen}
        isProcessing={isResolvingScannedQr}
        isInteractionBlocked={Boolean(qrScanErrorState)}
        blockedQrValue={scanCooldownState.value}
        blockedQrUntil={scanCooldownState.until}
        helperMessage={scannerHelperMessage}
        onClose={handleCloseQrScanner}
        onScan={handleScannedQr}
      />

      <StubQrScanErrorModal
        isOpen={Boolean(qrScanErrorState)}
        error={qrScanErrorState?.error || null}
        onTryAgain={handleDismissQrScanError}
        onCloseScanner={handleCloseQrScanner}
      />

      <FeedbackToast
        message={scanToast.message}
        type={scanToast.type}
        title={scanToast.title}
        onClose={() => setScanToast({ message: "", type: "info", title: "" })}
      />
    </>
  );
};

export default StubDistributionPage;
