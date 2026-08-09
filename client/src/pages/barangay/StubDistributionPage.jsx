import React, { useEffect, useMemo, useState } from "react";
import { FaHandHolding } from "react-icons/fa6";
import { FiPrinter } from "react-icons/fi";
import { MdQrCodeScanner } from "react-icons/md";
import BarangayDashboardOverview from "../../components/barangay-dashboard/BarangayDashboardOverview";
import PageHeader, { pageHeaderStyles } from "../../components/layout/PageHeader";
import FeedbackToast from "../../components/shared/FeedbackToast";
import StubClaimConfirmModal from "../../components/stubs/StubClaimConfirmModal";
import StubDetailModal from "../../components/stubs/StubDetailModal";
import StubQrScanErrorModal from "../../components/stubs/StubQrScanErrorModal";
import StubPrintSheetModal from "../../components/stubs/StubPrintSheetModal";
import StubQrScanModal from "../../components/stubs/StubQrScanModal";
import StubSearchBar from "../../components/stubs/StubSearchBar";
import StubResultsTable from "../../components/stubs/StubResultsTable";
import StubSummaryCards from "../../components/stubs/StubSummaryCards";
import { useAuth } from "../../context/AuthContext";
import { useBarangayDashboard } from "../../features/barangay-dashboard/useBarangayDashboard";
import { useStubDashboard } from "../../features/stubs/useStubDashboard";
import {
  claimStub,
  fetchStubDetails,
  verifyStub,
} from "../../features/stubs/stubService";
import { fetchMswdoSectors } from "../../features/mswdo-masterlist/mswdoMasterlistService";
import { shellStyles } from "../../components/layout/BarangayLayout";
import { buildMasterlistFilterSectorOptions } from "../../utils/registrationOptions";
import { getCanonicalSectorCodeFromText } from "../../utils/sectorDisplay";
import {
  matchesStubStatusFilter,
  normalizeStubStatusFilter,
  STATUS_FILTERS,
} from "../../features/stubs/stubStatusFilters";
import {
  QR_SCAN_ERROR_CODES,
  createQrScanError,
  createWrongBarangayQrScanError,
  createWrongEventQrScanError,
} from "../../features/stubs/stubQrScanErrors";

const DEFAULT_STUB_STATUS = STATUS_FILTERS.ALL;
const DEFAULT_STUB_SORT_ORDER = "oldest";
const QR_SCAN_COOLDOWN_MS = 1800;

const getSectorCodes = (sectorsText) => {
  if (!sectorsText || sectorsText === "-") {
    return [];
  }

  return String(sectorsText)
    .split(",")
    .map((sectorName) => getCanonicalSectorCodeFromText(sectorName))
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
      row.sectors_text,
      row.display_stub_no,
      row.stub_sequence_no,
    ];

    return searchableValues.some((value) =>
      String(value || "")
        .toLowerCase()
        .includes(normalizedSearchTerm),
    );
  });
};

const getStubSortTime = (row) => {
  const timestamp =
    row.queue_time_in || row.qr_generated_at || row.issued_at || row.created_at || "";
  const parsedTime = timestamp ? new Date(timestamp).getTime() : 0;

  if (Number.isFinite(parsedTime) && parsedTime > 0) {
    return parsedTime;
  }

  return Number(row.stub_sequence_no || 0);
};

const sortStubRows = (rows, sortOrder = DEFAULT_STUB_SORT_ORDER) =>
  [...rows].sort((left, right) => {
    if (sortOrder === "az" || sortOrder === "za") {
      const leftName = String(left.household?.family_head_name || "");
      const rightName = String(right.household?.family_head_name || "");
      const comparison = leftName.localeCompare(rightName);

      return sortOrder === "za" ? -comparison : comparison;
    }

    const leftTime = getStubSortTime(left);
    const rightTime = getStubSortTime(right);

    return sortOrder === "oldest" ? leftTime - rightTime : rightTime - leftTime;
  });

const isEndedDisasterEvent = (event, eventScope) => {
  const status = String(event?.status || "").toUpperCase();
  return eventScope === "ended" || status === "CLOSED" || status === "ARCHIVED";
};

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

  return `/barangay/print/stubs?${searchParams.toString()}`;
};

const getStubReferenceNumber = (stubDetails, verification) =>
  verification?.data?.details?.stubNumber ||
  stubDetails?.display_stub_no ||
  stubDetails?.stub_no ||
  "";

const isArchivedStubHousehold = (stubLike) =>
  stubLike?.household?.is_active === false;

const isSelectableClaimStubRow = (row) =>
  row?.status === "ISSUED" &&
  !row?.is_local_only &&
  !isArchivedStubHousehold(row);

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
  const [searchTerm, setSearchTerm] = useState("");
  const [filtersByScope, setFiltersByScope] = useState({
    active: {
      sectorNames: [],
      stubStatus: DEFAULT_STUB_STATUS,
      sortOrder: DEFAULT_STUB_SORT_ORDER,
    },
    ended: {
      sectorNames: [],
      stubStatus: DEFAULT_STUB_STATUS,
      sortOrder: DEFAULT_STUB_SORT_ORDER,
    },
  });
  const [sectorOptions, setSectorOptions] = useState([]);
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
    assignedBarangayId: assignedBarangay?.id || "",
    sectorOptions,
  });


  const isSelectedEventEnded = isEndedDisasterEvent(selectedEvent, eventScope);

  const filteredRows = useMemo(() => {
    const searchedRows = getFilteredRows(stubRows, searchTerm);
    const currentFilters = filtersByScope[eventScope] || {
      sectorNames: [],
      stubStatus: DEFAULT_STUB_STATUS,
      sortOrder: DEFAULT_STUB_SORT_ORDER,
    };
    const normalizedStubStatus = normalizeStubStatusFilter(
      currentFilters.stubStatus,
    );

    const matchingRows = searchedRows.filter((row) => {
      const matchesStatus = matchesStubStatusFilter(
        row.status,
        normalizedStubStatus,
      );

      if (!matchesStatus) {
        return false;
      }

      if (currentFilters.sectorNames.length === 0) {
        return true;
      }

      const rowSectorNames = getSectorCodes(row.sectors_text);

      return currentFilters.sectorNames.some((sectorName) =>
        rowSectorNames.includes(sectorName),
      );
    });

    return sortStubRows(
      matchingRows,
      currentFilters.sortOrder || DEFAULT_STUB_SORT_ORDER,
    );
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
          buildMasterlistFilterSectorOptions(
            Array.isArray(sectors) ? sectors : [],
          ),
        );
      } catch (_error) {
        if (isMounted) {
          setSectorOptions(buildMasterlistFilterSectorOptions([]));
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
      setPendingClaimStubDetails(null);
      setIsBulkClaimConfirmOpen(false);
      setIsQrScanModalOpen(false);
      setQrScanErrorState(null);
      setScannerHelperMessage("");
      setScanCooldownState({ value: "", until: 0 });
    }
  }, [isSelectedEventEnded, selectedEvent?.id]);

  const currentFilters = filtersByScope[eventScope] || {
    sectorNames: [],
    stubStatus: DEFAULT_STUB_STATUS,
    sortOrder: DEFAULT_STUB_SORT_ORDER,
  };

  const stubStatusOptions = [
    { value: STATUS_FILTERS.CLAIMED, label: "Claimed" },
    { value: STATUS_FILTERS.UNCLAIMED, label: "For Claim" },
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
        stubStatus: DEFAULT_STUB_STATUS,
        sortOrder: DEFAULT_STUB_SORT_ORDER,
      },
    }));
  };

  const setSortOrderFilter = (sortOrder) => {
    setFiltersByScope((currentValues) => ({
      ...currentValues,
      [eventScope]: {
        ...currentValues[eventScope],
        sortOrder,
      },
    }));
  };

  const handleToggleSelect = (stubId) => {
    if (isSelectedEventEnded) {
      return;
    }

    const selectedRow =
      filteredRows.find((row) => row.id === stubId) ||
      stubRows.find((row) => row.id === stubId);

    if (!isSelectableClaimStubRow(selectedRow)) {
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
      .filter((row) => isSelectableClaimStubRow(row))
      .map((row) => row.id);

    const areAllSelected =
      selectableStubIds.length > 0 &&
      selectableStubIds.every((id) => selectedStubIds.includes(id));

    setSelectedStubIds(areAllSelected ? [] : selectableStubIds);
  };

  useEffect(() => {
    if (isSelectedEventEnded) {
      return;
    }

    const selectableStubIds = new Set(
      stubRows
        .filter((row) => isSelectableClaimStubRow(row))
        .map((row) => row.id),
    );

    setSelectedStubIds((currentValues) => {
      const nextValues = currentValues.filter((stubId) =>
        selectableStubIds.has(stubId),
      );

      return nextValues.length === currentValues.length
        ? currentValues
        : nextValues;
    });
  }, [isSelectedEventEnded, stubRows]);

  const handleOpenBulkClaimConfirmation = () => {
    if (isSelectedEventEnded || !selectedStubIds.length || claimingStubId) {
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
    if (isSelectedEventEnded || claimingStubId) {
      return;
    }

    const selectedRow =
      filteredRows.find((row) => row.id === stubId) ||
      stubRows.find((row) => row.id === stubId);

    if (!isSelectableClaimStubRow(selectedRow)) {
      setClaimErrorMessage(
        isArchivedStubHousehold(selectedRow)
          ? "This household is archived and cannot receive a new relief distribution."
          : "Only active unclaimed stubs can be marked as claimed.",
      );
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
    if (isSelectedEventEnded || claimingStubId) {
      return;
    }

    setClaimErrorMessage("");

    if (isBulkClaimConfirmOpen && selectedStubIds.length > 0) {
      const claimableSelectedStubIds = selectedStubIds.filter((stubId) => {
        const row = stubRows.find((candidate) => candidate.id === stubId);
        return isSelectableClaimStubRow(row);
      });

      if (!claimableSelectedStubIds.length) {
        setClaimErrorMessage(
          "This household is archived and cannot receive a new relief distribution.",
        );
        return;
      }

      setClaimingStubId("bulk");

      try {
        await Promise.all(
          claimableSelectedStubIds.map((stubId) =>
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

    const pendingClaimRow = stubRows.find((row) => row.id === pendingClaimStubId);

    if (!isSelectableClaimStubRow(pendingClaimRow)) {
      setClaimErrorMessage(
        isArchivedStubHousehold(pendingClaimRow)
          ? "This household is archived and cannot receive a new relief distribution."
          : "Only active unclaimed stubs can be marked as claimed.",
      );
      setPendingClaimStubId("");
      setPendingClaimStubDetails(null);
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
      setPendingClaimStubDetails(null);
    } catch (error) {
      setClaimErrorMessage(
        error.message || "Unable to mark the stub as claimed.",
      );
    } finally {
      setClaimingStubId("");
    }
  };

  const selectedClaimRows = useMemo(() => {
    const selectedStubIdSet = new Set(selectedStubIds);

    return filteredRows.filter((row) => selectedStubIdSet.has(row.id));
  }, [filteredRows, selectedStubIds]);

  const openStubPrintPage = (printUrl) => {
    window.open(printUrl, "_blank", "noopener,noreferrer");
  };

  const selectedBarangayForPrintId = assignedBarangay?.id || overrideBarangayId || "";

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
    if (isSelectedEventEnded || isResolvingScannedQr) {
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

      if (stubEventId !== selectedEvent?.id) {
        throw createWrongEventQrScanError({
          stubNumber: getStubReferenceNumber(stubDetails, verification) || undefined,
        });
      }

      if (stubBarangayId !== selectedBarangayForPrintId) {
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
            selectedSortOrder={
              currentFilters.sortOrder || DEFAULT_STUB_SORT_ORDER
            }
            onToggleSector={toggleSectorFilter}
            onSelectStubStatus={setStubStatusFilter}
            onSortOrderChange={setSortOrderFilter}
            onClearFilters={clearFilters}
            filterScopeKey={eventScope}
            actions={
              <>
                <button
                  type="button"
                  onClick={() => setIsPrintSheetModalOpen(true)}
                  disabled={!hasSelectedEvent || !selectedBarangayForPrintId}
                  style={{
                    ...pageHeaderStyles.secondaryButton,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    opacity:
                      !hasSelectedEvent || !selectedBarangayForPrintId ? 0.7 : 1,
                  }}
                >
                  <FiPrinter size={16} />
                  Print
                </button>
                {!isSelectedEventEnded ? (
                  <button
                    type="button"
                    onClick={() => setIsQrScanModalOpen(true)}
                    disabled={
                      !hasSelectedEvent ||
                      !selectedBarangayForPrintId ||
                      isResolvingScannedQr
                    }
                    style={{
                      ...pageHeaderStyles.primaryButton,
                      opacity:
                        !hasSelectedEvent ||
                        !selectedBarangayForPrintId ||
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
        onViewStub={handleOpenStubDetails}
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
        disasterEvents={availableEvents}
        barangays={assignedBarangay ? [assignedBarangay] : []}
        selectedDisasterEventId={selectedEvent?.id || selectedDisasterEventId}
        selectedBarangayId={selectedBarangayForPrintId}
        showBarangaySelection={false}
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
