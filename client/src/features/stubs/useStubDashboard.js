import { useEffect, useMemo, useRef, useState } from "react";
import { fetchBarangayStubDashboard } from "./stubService";
import { getPendingLocalStubRows } from "./stubOfflineRows";
import { getVisibleSyncQueueEntries } from "../../offline/syncQueue.js";
import {
  sortPresentedStubRows,
  withStubPresentationStatus,
} from "./stubPresentation.js";
import {
  matchesStubStatusFilter,
  normalizeStubStatusFilter,
} from "./stubStatusFilters.js";
import {
  canUseOfflineStubCacheFallback,
  getCachedStubRowsForScope,
} from "./stubCache";
import { deriveStubDashboardMetrics } from "./stubDashboardOfflineMetrics.js";
import { matchesStubSectorFilter } from "./stubSectorFilters.js";
import { useDashboardRevalidation } from "../../utils/dashboardRevalidation";

const emptyMetrics = {
  total_issued_stubs: 0,
  claimed_stubs: 0,
  unclaimed_stubs: 0,
  beneficiary_families: 0,
};

const emptyDashboard = {
  assigned_barangay: null,
  assigned_barangay_id: null,
  is_dev_override: false,
  disaster_event: null,
  metrics: emptyMetrics,
  count: 0,
  data: [],
  pagination: null,
};

const createDefaultPagination = (page = 1, pageSize = 25) => ({
  page,
  pageSize,
  totalItems: 0,
  totalPages: 0,
  hasPreviousPage: false,
  hasNextPage: false,
});

const offlineStubCacheWarmRequests = new Map();

const buildOfflineStubCacheWarmKey = ({
  userId,
  disasterEventId,
  barangayId,
}) => [userId, disasterEventId, barangayId].filter(Boolean).join("|");

const getFriendlyStubDashboardErrorMessage = (error) => {
  if (error?.code === "NO_ASSIGNED_BARANGAY") {
    return "No assigned barangay. Please contact administrator.";
  }

  if (error?.code === "INVALID_OVERRIDE_BARANGAY") {
    return "The selected fallback barangay is not available.";
  }

  if (error?.code === "BARANGAY_OVERRIDE_NOT_ALLOWED") {
    return "Fallback barangay selection is not available in this mode.";
  }

  if (error?.code === "NO_STUB_EVENT_DATA") {
    return "No data available for this barangay and selected disaster event.";
  }

  return "Unable to load the stub dashboard.";
};

const filterOfflineStubRows = (rows, { search = "", status = "all", selectedSectorIds = [] } = {}) => {
  const normalizedSearch = String(search || "").trim().toLowerCase();
  const normalizedStatus = normalizeStubStatusFilter(status);

  return rows.filter((row) => {
    if (!matchesStubStatusFilter(row.presentation_status || row.status, normalizedStatus)) {
      return false;
    }

    if (!matchesStubSectorFilter(row, selectedSectorIds)) {
      return false;
    }

    if (!normalizedSearch) return true;
    return [
      row.family_head_name,
      row.sectors_text,
      row.display_stub_no,
      row.stub_sequence_no,
    ].some((value) => String(value || "").toLowerCase().includes(normalizedSearch));
  });
};

export const useStubDashboard = ({
  userId,
  disasterEventId,
  overrideBarangayId,
  allowFallback,
  assignedBarangayId,
  sectorOptions = [],
  page = 1,
  pageSize = 25,
  search = "",
  status = "all",
  selectedSectorIds = [],
  sortOrder = "oldest",
}) => {
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [pendingLocalRows, setPendingLocalRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const backgroundReloadRef = useRef(false);
  const hasLoadedDataRef = useRef(false);
  const reloadDashboard = (options = {}) => {
    backgroundReloadRef.current = Boolean(options?.background);
    setReloadKey((currentValue) => currentValue + 1);
  };

  useDashboardRevalidation(
    () => {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        return;
      }

      reloadDashboard({ background: true });
    },
    { enabled: Boolean(disasterEventId && (userId || overrideBarangayId)) },
  );

  useEffect(() => {
    const hasScopedBarangayContext = Boolean(userId || overrideBarangayId);

    if (!disasterEventId || !hasScopedBarangayContext) {
      setDashboard(emptyDashboard);
      setIsLoading(false);
      setIsRefreshing(false);
      hasLoadedDataRef.current = false;
      setErrorMessage("");
      return;
    }

    let isMounted = true;

    const loadDashboard = async () => {
      const isBackgroundReload = backgroundReloadRef.current;
      backgroundReloadRef.current = false;
      const preserveExistingData =
        isBackgroundReload && hasLoadedDataRef.current;

      setIsLoading(true);
      setIsRefreshing(preserveExistingData);
      setErrorMessage("");

      try {
        const response = await fetchBarangayStubDashboard({
          userId: userId || null,
          disasterEventId,
          overrideBarangayId: allowFallback ? overrideBarangayId || null : null,
          page,
          pageSize,
          search,
          status,
          sectorIds: selectedSectorIds,
          sectorOptions,
          sortOrder,
        });

        if (isMounted) {
          const serverResponseRows = Array.isArray(response.data) ? response.data : [];
          const scopedBarangayId =
            response.assigned_barangay_id ||
            overrideBarangayId ||
            assignedBarangayId ||
            null;
          const syncQueueEntries = await getVisibleSyncQueueEntries();
          const serverRows = sortPresentedStubRows(
            serverResponseRows.map((row) =>
              withStubPresentationStatus(row, syncQueueEntries, {
                disasterEventId,
                barangayId: scopedBarangayId,
              }),
            ),
          );
          const localRows = await getPendingLocalStubRows({
            disasterEventId,
            barangayId: scopedBarangayId,
            sectorOptions,
            existingHouseholdIds: serverRows.map(
              (row) => row.household?.id || row.household_id,
            ),
          });

          setDashboard({
            assigned_barangay: response.assigned_barangay || null,
            assigned_barangay_id: response.assigned_barangay_id || null,
            is_dev_override: Boolean(response.is_dev_override),
            disaster_event: response.disaster_event || null,
            metrics: response.metrics || emptyMetrics,
            count: response.count || 0,
            data: serverRows,
            pagination:
              response.pagination || createDefaultPagination(page, pageSize),
          });
          setPendingLocalRows(
            sortPresentedStubRows(
              localRows.map((row) =>
                withStubPresentationStatus(row, syncQueueEntries, {
                  disasterEventId,
                  barangayId: scopedBarangayId,
                }),
              ),
            ),
          );
          hasLoadedDataRef.current = true;
        }

        const scopedBarangayId =
          response.assigned_barangay?.id ||
          response.assigned_barangay_id ||
          overrideBarangayId ||
          assignedBarangayId ||
          null;
        const warmKey = buildOfflineStubCacheWarmKey({
          userId: userId || "anonymous",
          disasterEventId,
          barangayId: scopedBarangayId,
        });

        if (
          scopedBarangayId &&
          warmKey &&
          !offlineStubCacheWarmRequests.has(warmKey)
        ) {
          const warmRequest = (async () => {
            // Cache the complete scoped dataset so QR scans are not limited
            // to the currently visible page.
            await fetchBarangayStubDashboard({
              userId: userId || null,
              disasterEventId,
              overrideBarangayId: allowFallback
                ? overrideBarangayId || null
                : null,
            });
            return null;
          })().catch(() => {
            offlineStubCacheWarmRequests.delete(warmKey);
            return null;
          });

          offlineStubCacheWarmRequests.set(warmKey, warmRequest);
          await warmRequest;
        }
      } catch (error) {
        if (isMounted) {
          if (preserveExistingData) {
            setErrorMessage("");
            return;
          }

          const scopedBarangayId = overrideBarangayId || assignedBarangayId || null;
          const pendingRows = await getPendingLocalStubRows({
            disasterEventId,
            barangayId: scopedBarangayId,
            sectorOptions,
          });
          const cachedRows = canUseOfflineStubCacheFallback(error)
            ? await getCachedStubRowsForScope({
                disasterEventId,
                currentBarangayId: scopedBarangayId,
              })
            : [];
          const syncQueueEntries = await getVisibleSyncQueueEntries();
          const presentedRows = sortPresentedStubRows(
            [...pendingRows, ...cachedRows].map((row) =>
              withStubPresentationStatus(row, syncQueueEntries, {
                disasterEventId,
                barangayId: scopedBarangayId,
              }),
            ),
          );
          const filteredRows = filterOfflineStubRows(presentedRows, {
            search,
            status,
            selectedSectorIds,
          });
          const totalItems = filteredRows.length;
          const totalPages = totalItems > 0 ? Math.ceil(totalItems / pageSize) : 0;
          const safePage = totalPages > 0 ? Math.min(page, totalPages) : 1;

          setDashboard({
            ...emptyDashboard,
            metrics: deriveStubDashboardMetrics(presentedRows),
            count: totalItems,
            data: filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize),
            pagination: {
              page: safePage,
              pageSize,
              totalItems,
              totalPages,
              hasPreviousPage: safePage > 1,
              hasNextPage: safePage < totalPages,
            },
          });
          // Legacy contract: offline rows are intentionally moved into dashboard data
          // before client-side filtering and page slicing (setPendingLocalRows([...pendingRows, ...cachedRows])).
          setPendingLocalRows([]);
          setErrorMessage(
            pendingRows.length > 0 || cachedRows.length > 0
              ? ""
              : getFriendlyStubDashboardErrorMessage(error),
          );
          hasLoadedDataRef.current = presentedRows.length > 0;
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    };

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [
    allowFallback,
    assignedBarangayId,
    disasterEventId,
    overrideBarangayId,
    page,
    pageSize,
    reloadKey,
    sectorOptions,
    search,
    selectedSectorIds,
    sortOrder,
    status,
    userId,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleSyncQueueUpdated = () => {
      reloadDashboard({ background: true });
    };

    window.addEventListener("distync-sync-queue-updated", handleSyncQueueUpdated);

    return () => {
      window.removeEventListener(
        "distync-sync-queue-updated",
        handleSyncQueueUpdated,
      );
    };
  }, []);

  const summaryCards = useMemo(() => {
    return [
      {
        label: "Total Issued Stubs",
        value: dashboard.metrics.total_issued_stubs || 0,
      },
      {
        label: "Beneficiary Families",
        value: dashboard.metrics.beneficiary_families || 0,
      },
      {
        label: "Claimed Stubs",
        value: dashboard.metrics.claimed_stubs || 0,
      },
      {
        label: "For Claim Stubs",
        value: dashboard.metrics.unclaimed_stubs || 0,
      },
    ];
  }, [dashboard.metrics]);

  return {
    rows: [...pendingLocalRows, ...dashboard.data],
    summaryCards,
    pagination: dashboard.pagination || createDefaultPagination(page, pageSize),
    isLoading,
    isInitialLoading: isLoading && !isRefreshing,
    isRefreshing,
    errorMessage,
    hasData: dashboard.data.length > 0,
    reloadDashboard,
  };
};
