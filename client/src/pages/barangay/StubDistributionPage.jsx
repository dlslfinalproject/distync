import React, { useEffect, useMemo, useState } from "react";
import { FaHandHolding } from "react-icons/fa6";
import { FiPrinter, FiX } from "react-icons/fi";
import { MdQrCodeScanner } from "react-icons/md";
import BarangayDashboardOverview from "../../components/barangay-dashboard/BarangayDashboardOverview";
import PageHeader, { pageHeaderStyles } from "../../components/layout/PageHeader";
import FeedbackToast from "../../components/shared/FeedbackToast";
import FormModalShell from "../../components/shared/FormModalShell";
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
import { getStubClaimErrorDialog } from "../../features/stubs/stubClaimErrors";
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
import {
  compareOfflineEventIdentity,
  compareOfflineIdentity,
  OFFLINE_QR_IDENTITY_RESULTS,
  isRecognizedStubQrValue,
} from "../../features/stubs/offlineQrValidation";
import {
  getCachedStubDetailsByQrValue,
  upsertOfflineStubSnapshots,
} from "../../features/stubs/stubCache";

const DEFAULT_STUB_STATUS = STATUS_FILTERS.ALL;
const DEFAULT_STUB_SORT_ORDER = "oldest";
const DEFAULT_STUB_PAGE_SIZE = 25;
const QR_SCAN_COOLDOWN_MS = 1800;

const claimErrorModalBodyStyles = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  padding: "4px 0 0",
};

const claimErrorIconStyles = {
  width: "48px",
  height: "48px",
  borderRadius: "999px",
  backgroundColor: "#fee2e2",
  color: "#c53030",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "28px",
  lineHeight: 1,
  marginBottom: "14px",
};

const claimErrorTitleStyles = {
  margin: 0,
  color: "#1f2937",
  fontSize: "18px",
  fontWeight: 700,
};

const claimErrorMessageStyles = {
  margin: "12px 0 0",
  color: "#6b7280",
  fontSize: "14px",
  lineHeight: 1.6,
  maxWidth: "320px",
  overflowWrap: "anywhere",
};

const claimErrorButtonStyles = {
  width: "100%",
  minHeight: "40px",
  border: "none",
  borderRadius: "8px",
  backgroundColor: "#c53030",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 700,
  cursor: "pointer",
};

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
  !row?.is_claim_pending &&
  row?.sync_status !== "PENDING" &&
  row?.sync_status !== "CONFLICT" &&
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

const OFFLINE_VERIFICATION_MESSAGE =
  "The information required to verify this QR is not available on this device. Reconnect to the internet and try again.";

const createOfflineVerificationUnavailableError = () =>
  createQrScanError({
    code: QR_SCAN_ERROR_CODES.OFFLINE_VERIFICATION_UNAVAILABLE,
    message: OFFLINE_VERIFICATION_MESSAGE,
  });

const getStubEventId = (stubDetails) =>
  stubDetails?.disaster_event_id || stubDetails?.disaster_event?.id || "";

const getStubBarangayId = (stubDetails) =>
  stubDetails?.barangay_id || stubDetails?.barangay?.id || "";

const isOfflineQueuedClaimResult = (result) =>
  result?.data?.status === "PENDING_SYNC";

const setOfflineClaimSavedToast = (setToast) => {
  setToast({
    type: "success",
    title: "Distribution saved offline",
    message: "This transaction will synchronize when connectivity is restored.",
  });
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
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_STUB_PAGE_SIZE);
  const [sectorOptions, setSectorOptions] = useState([]);
  const [claimingStubId, setClaimingStubId] = useState("");
  const [claimErrorMessage, setClaimErrorMessage] = useState("");
  const [claimErrorDialog, setClaimErrorDialog] = useState(null);
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
  const fallbackBarangayId = authenticatedUser?.default_barangay_id || "";

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
    isContextResolved: isBarangayContextResolved,
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
    fallbackBarangayId,
  });

  const currentFilters = filtersByScope[eventScope] || {
    sectorNames: [],
    stubStatus: DEFAULT_STUB_STATUS,
    sortOrder: DEFAULT_STUB_SORT_ORDER,
  };

  const {
    rows: stubRows,
    summaryCards,
    pagination: stubPagination,
    isLoading: isLoadingStubDashboard,
    errorMessage: stubDashboardErrorMessage,
    hasData: hasStubData,
    reloadDashboard,
  } = useStubDashboard({
    userId: authenticatedUser?.id || "",
    disasterEventId: selectedDisasterEventId || selectedEvent?.id || "",
    overrideBarangayId,
    allowFallback,
    assignedBarangayId: assignedBarangay?.id || fallbackBarangayId || "",
    sectorOptions,
    page: currentPage,
    pageSize,
    search: searchTerm,
    status: currentFilters.stubStatus,
    selectedSectorIds: currentFilters.sectorNames,
    sortOrder: currentFilters.sortOrder || DEFAULT_STUB_SORT_ORDER,
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

    return matchingRows;
  }, [eventScope, filtersByScope, searchTerm, stubRows]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedStubIds([]);
  }, [
    currentFilters.sectorNames,
    currentFilters.sortOrder,
    currentFilters.stubStatus,
    eventScope,
    pageSize,
    searchTerm,
    selectedEvent?.id,
  ]);

  useEffect(() => {
    const totalPages = Number(stubPagination?.totalPages || 0);

    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, stubPagination?.totalPages]);

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
        const stubDetails = await fetchStubDetails(pendingClaimStubId, {
          currentBarangayId: selectedBarangayForPrintId,
        });

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

  const handleDismissClaimErrorDialog = () => {
    setClaimErrorDialog(null);
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
        const claimResults = await Promise.allSettled(
          claimableSelectedStubIds.map((stubId) => {
            const row = stubRows.find((candidate) => candidate.id === stubId);

            return claimStub({
              stubId,
              userId: authenticatedUser?.id || "",
              overrideBarangayId: allowFallback ? overrideBarangayId : "",
              disasterEventId: row?.disaster_event?.id || row?.disaster_event_id || "",
              disasterEventTitle:
                row?.disaster_event?.title || row?.disaster_event?.name || "",
            });
          }),
        );
        const rejectedClaim = claimResults.find(
          (result) => result.status === "rejected",
        );

        if (rejectedClaim) {
          const fulfilledStubIds = claimResults
            .map((result, index) =>
              result.status === "fulfilled" ? claimableSelectedStubIds[index] : "",
            )
            .filter(Boolean);

          if (fulfilledStubIds.length > 0) {
            reloadDashboard();
            setSelectedStubIds((currentValues) =>
              currentValues.filter((stubId) => !fulfilledStubIds.includes(stubId)),
            );
          }

          setIsBulkClaimConfirmOpen(false);
          setPendingClaimStubDetails(null);
          setClaimErrorDialog(
            getStubClaimErrorDialog(
              rejectedClaim.reason,
              "Unable to mark one or more selected stubs as claimed.",
            ),
          );
          return;
        }

        reloadDashboard();
        setSelectedStubIds([]);
        setIsBulkClaimConfirmOpen(false);
        setPendingClaimStubDetails(null);

        if (
          claimResults.some(
            (result) =>
              result.status === "fulfilled" &&
              isOfflineQueuedClaimResult(result.value),
          )
        ) {
          setOfflineClaimSavedToast(setScanToast);
        }
      } catch (error) {
        setIsBulkClaimConfirmOpen(false);
        setPendingClaimStubDetails(null);
        setClaimErrorDialog(
          getStubClaimErrorDialog(
            error,
            "Unable to mark the selected stubs as claimed.",
          ),
        );
      } finally {
        setClaimingStubId("");
      }

      return;
    }

    if (!pendingClaimStubId) {
      return;
    }

    const pendingClaimRow =
      stubRows.find((row) => row.id === pendingClaimStubId) ||
      pendingClaimStubDetails;

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
      const claimResult = await claimStub({
        stubId: pendingClaimStubId,
        userId: authenticatedUser?.id || "",
        overrideBarangayId: allowFallback ? overrideBarangayId : "",
        disasterEventId:
          pendingClaimStubDetails?.disaster_event?.id ||
          pendingClaimRow?.disaster_event?.id ||
          pendingClaimRow?.disaster_event_id ||
          "",
        disasterEventTitle:
          pendingClaimStubDetails?.disaster_event?.title ||
          pendingClaimStubDetails?.disaster_event?.name ||
          pendingClaimRow?.disaster_event?.title ||
          pendingClaimRow?.disaster_event?.name ||
          "",
      });
      reloadDashboard();
      setPendingClaimStubId("");
      setPendingClaimStubDetails(null);

      if (isOfflineQueuedClaimResult(claimResult)) {
        setOfflineClaimSavedToast(setScanToast);
      }
    } catch (error) {
      setPendingClaimStubId("");
      setPendingClaimStubDetails(null);
      setClaimErrorDialog(getStubClaimErrorDialog(error));
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

  const selectedBarangayForPrintId =
    assignedBarangay?.id || overrideBarangayId || fallbackBarangayId || "";

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
    const isOffline =
      typeof navigator !== "undefined" && navigator.onLine === false;

    try {
      let verification = null;
      let stubDetails = null;
      let resolvedStubId = "";

      if (isOffline && !isRecognizedStubQrValue(qrCodeValue)) {
        throw createQrScanError({
          code: QR_SCAN_ERROR_CODES.INVALID_QR_STUB,
          message:
            "The scanned QR code is not recognized as a valid DISTYNC relief stub.",
        });
      }

      if (isOffline) {
        stubDetails = await getCachedStubDetailsByQrValue(qrCodeValue, {
          currentBarangayId: selectedBarangayForPrintId,
        });

        if (!stubDetails) {
          throw createQrScanError({
            code: QR_SCAN_ERROR_CODES.STUB_NOT_AVAILABLE_OFFLINE,
            message:
              OFFLINE_VERIFICATION_MESSAGE,
          });
        }

        resolvedStubId = stubDetails.id;
      } else {
        verification = await verifyStub({ qrCodeValue });
        resolvedStubId = verification?.data?.stub?.id || "";

        if (!resolvedStubId) {
          throw createQrScanError({
            code: QR_SCAN_ERROR_CODES.INVALID_QR_STUB,
            message: "QR lookup did not return a valid stub record.",
          });
        }

        stubDetails = await fetchStubDetails(resolvedStubId, {
          currentBarangayId: selectedBarangayForPrintId,
        });
        await upsertOfflineStubSnapshots([stubDetails]);
      }
      if (!resolvedStubId) {
        throw isOffline
          ? createOfflineVerificationUnavailableError()
          : createQrScanError({
              code: QR_SCAN_ERROR_CODES.INVALID_QR_STUB,
              message: "QR lookup did not return a valid stub record.",
            });
      }

      const stubEventId = getStubEventId(stubDetails);
      const selectedEventId = selectedDisasterEventId || selectedEvent?.id || "";
      const eventIdentityResult = compareOfflineEventIdentity({
        selectedEventId,
        stubEventId,
      });

      if (eventIdentityResult === OFFLINE_QR_IDENTITY_RESULTS.UNAVAILABLE) {
        throw isOffline
          ? createOfflineVerificationUnavailableError()
          : createQrScanError({
              code: QR_SCAN_ERROR_CODES.STUB_UNAVAILABLE,
              message: "The stub event could not be verified.",
            });
      }

      if (eventIdentityResult === OFFLINE_QR_IDENTITY_RESULTS.MISMATCH) {
        throw createWrongEventQrScanError({
          stubNumber: getStubReferenceNumber(stubDetails, verification) || undefined,
        });
      }

      const barangayIdentityResult = compareOfflineIdentity({
        expectedId: selectedBarangayForPrintId,
        actualId: getStubBarangayId(stubDetails),
      });

      if (barangayIdentityResult === OFFLINE_QR_IDENTITY_RESULTS.UNAVAILABLE) {
        throw isOffline
          ? createOfflineVerificationUnavailableError()
          : createWrongBarangayQrScanError({
              stubNumber: getStubReferenceNumber(stubDetails, verification) || undefined,
            });
      }

      if (barangayIdentityResult === OFFLINE_QR_IDENTITY_RESULTS.MISMATCH) {
        throw createWrongBarangayQrScanError({
          stubNumber: getStubReferenceNumber(stubDetails, verification) || undefined,
        });
      }

      const localClaimStatus = String(stubDetails?.sync_status || "").toUpperCase();

      if (localClaimStatus === "PENDING" || stubDetails?.is_claim_pending) {
        throw createQrScanError({
          code: QR_SCAN_ERROR_CODES.STUB_CLAIM_PENDING,
          message:
            "This relief stub already has a pending offline claim on this device. Wait for synchronization before trying again.",
          details: buildQrScanErrorDetails(verification, stubDetails),
        });
      }

      if (localClaimStatus === "CONFLICT") {
        throw createQrScanError({
          code: QR_SCAN_ERROR_CODES.STUB_CLAIM_CONFLICT,
          message:
            "This relief stub has a synchronization conflict and cannot be claimed again until it is reviewed.",
          details: buildQrScanErrorDetails(verification, stubDetails),
        });
      }

      if (stubDetails?.household?.is_active === false) {
        throw createQrScanError({
          code: QR_SCAN_ERROR_CODES.HOUSEHOLD_ARCHIVED,
          message:
            "This household is archived and cannot receive a new relief distribution.",
          details: buildQrScanErrorDetails(verification, stubDetails),
        });
      }

      const qrStatus = String(stubDetails?.qr_status || "").toUpperCase();

      if (qrStatus && qrStatus !== "ACTIVE") {
        throw createQrScanError({
          code: QR_SCAN_ERROR_CODES.QR_INACTIVE,
          message:
            "This QR reference is inactive and cannot be used for relief distribution.",
          details: buildQrScanErrorDetails(verification, stubDetails),
        });
      }

      if (
        (verification && !verification?.data?.is_claimable) ||
        stubDetails?.status !== "ISSUED"
      ) {
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
        title: isOffline ? "QR Verified — Offline" : "QR Verified",
        message: isOffline
          ? "This stub matches the current disaster event. Confirm the distribution to save it offline."
          : "QR stub verified successfully. Please confirm relief distribution.",
      });
    } catch (error) {
      const knownQrErrorCode = Object.values(QR_SCAN_ERROR_CODES).includes(
        String(error?.code || "").trim().toUpperCase(),
      );
      openQrScanError(
        isOffline && !knownQrErrorCode
          ? createOfflineVerificationUnavailableError()
          : error,
        qrCodeValue,
      );
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
      const details = await fetchStubDetails(row.id, {
        currentBarangayId: selectedBarangayForPrintId,
      });
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
        isContextResolved={isBarangayContextResolved}
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
        pagination={stubPagination}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
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

      <FormModalShell
        isOpen={Boolean(claimErrorDialog)}
        maxWidth="420px"
        zIndex={1700}
        bodyStyle={{ marginTop: 0 }}
        footer={
          <button
            type="button"
            onClick={handleDismissClaimErrorDialog}
            style={claimErrorButtonStyles}
          >
            OK
          </button>
        }
      >
        <div style={claimErrorModalBodyStyles} role="alert" aria-live="assertive">
          <div aria-hidden="true" style={claimErrorIconStyles}>
            <FiX />
          </div>
          <p style={claimErrorTitleStyles}>
            {claimErrorDialog?.title || "Unable to Process Claim"}
          </p>
          <p style={claimErrorMessageStyles}>
            {claimErrorDialog?.message || "Unable to mark the stub as claimed."}
          </p>
        </div>
      </FormModalShell>

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
