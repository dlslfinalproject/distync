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

const STUB_DASHBOARD_MEMORY_CACHE_LIMIT = 24;
const stubDashboardDataCache = new Map();

const buildStubDashboardRequestKey = ({
  userId,
  disasterEventId,
  overrideBarangayId,
  allowFallback,
  assignedBarangayId,
  page,
  pageSize,
  search,
  status,
  selectedSectorIds,
  sortOrder,
}) =>
  JSON.stringify({
    role: "barangay",
    userId: String(userId || ""),
    disasterEventId: String(disasterEventId || ""),
    overrideBarangayId: String(overrideBarangayId || ""),
    allowFallback: Boolean(allowFallback),
    assignedBarangayId: String(assignedBarangayId || ""),
    page,
    pageSize,
    search: search || "",
    status: status || "all",
    selectedSectorIds: Array.isArray(selectedSectorIds)
      ? selectedSectorIds
      : [],
    sortOrder: sortOrder || "",
  });

const getStubDashboardCacheEntry = (requestKey) => {
  const entry = stubDashboardDataCache.get(requestKey);

  if (!entry) {
    return null;
  }

  stubDashboardDataCache.delete(requestKey);
  stubDashboardDataCache.set(requestKey, entry);
  return entry;
};

const setStubDashboardCacheEntry = (requestKey, entry) => {
  stubDashboardDataCache.delete(requestKey);
  stubDashboardDataCache.set(requestKey, entry);

  while (stubDashboardDataCache.size > STUB_DASHBOARD_MEMORY_CACHE_LIMIT) {
    const oldestRequestKey = stubDashboardDataCache.keys().next().value;
    stubDashboardDataCache.delete(oldestRequestKey);
  }
};

const getSectorOptionsKey = (sectorOptions) =>
  JSON.stringify(Array.isArray(sectorOptions) ? sectorOptions : []);

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
  const requestKey = buildStubDashboardRequestKey({
    userId,
    disasterEventId,
    overrideBarangayId,
    allowFallback,
    assignedBarangayId,
    page,
    pageSize,
    search,
    status,
    selectedSectorIds,
    sortOrder,
  });
  const sectorOptionsKey = useMemo(
    () => getSectorOptionsKey(sectorOptions),
    [sectorOptions],
  );
  const sectorOptionsDependencyKey =
    Array.isArray(selectedSectorIds) && selectedSectorIds.length > 0
      ? sectorOptionsKey
      : "";
  const initialCacheEntry = getStubDashboardCacheEntry(requestKey);
  const [dashboard, setDashboard] = useState(
    initialCacheEntry?.dashboard || emptyDashboard,
  );
  const [pendingLocalRows, setPendingLocalRows] = useState(
    initialCacheEntry?.pendingLocalRows || [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const backgroundReloadRef = useRef(false);
  const hasLoadedDataRef = useRef(Boolean(initialCacheEntry));
  const lastSuccessfulRequestKeyRef = useRef(
    initialCacheEntry ? requestKey : "",
  );
  const dataContextKeyRef = useRef(requestKey);
  const hasRunRequestRef = useRef(false);
  const sectorOptionsDependencyKeyRef = useRef(sectorOptionsDependencyKey);
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
    const cacheEntry = getStubDashboardCacheEntry(requestKey);
    const isNewRequestContext =
      !hasRunRequestRef.current || dataContextKeyRef.current !== requestKey;
    hasRunRequestRef.current = true;
    dataContextKeyRef.current = requestKey;
    const sectorOptionsChanged =
      sectorOptionsDependencyKeyRef.current !== sectorOptionsDependencyKey;
    sectorOptionsDependencyKeyRef.current = sectorOptionsDependencyKey;

    if (isNewRequestContext) {
      setDashboard(cacheEntry?.dashboard || emptyDashboard);
      setPendingLocalRows(cacheEntry?.pendingLocalRows || []);
      hasLoadedDataRef.current = Boolean(cacheEntry);
      lastSuccessfulRequestKeyRef.current = cacheEntry ? requestKey : "";
      setErrorMessage("");
    }

    const isBackgroundReload = backgroundReloadRef.current;
    backgroundReloadRef.current = false;
    const preserveExistingData =
      (isNewRequestContext && Boolean(cacheEntry)) ||
      (isBackgroundReload &&
        hasLoadedDataRef.current &&
        lastSuccessfulRequestKeyRef.current === requestKey) ||
      (sectorOptionsChanged &&
        Array.isArray(selectedSectorIds) &&
        selectedSectorIds.length > 0 &&
        hasLoadedDataRef.current &&
        lastSuccessfulRequestKeyRef.current === requestKey);

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
      if (!preserveExistingData) {
        setIsLoading(true);
      } else {
        setIsLoading(false);
      }
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

        const serverResponseRows = Array.isArray(response.data) ? response.data : [];
        const dataScopedBarangayId =
          response.assigned_barangay_id ||
          overrideBarangayId ||
          assignedBarangayId ||
          null;
        const syncQueueEntries = await getVisibleSyncQueueEntries();
        const serverRows = sortPresentedStubRows(
          serverResponseRows.map((row) =>
            withStubPresentationStatus(row, syncQueueEntries, {
              disasterEventId,
              barangayId: dataScopedBarangayId,
            }),
          ),
        );
        const localRows = await getPendingLocalStubRows({
          disasterEventId,
          barangayId: dataScopedBarangayId,
          sectorOptions,
          existingHouseholdIds: serverRows.map(
            (row) => row.household?.id || row.household_id,
          ),
        });

        const nextDashboard = {
          assigned_barangay: response.assigned_barangay || null,
          assigned_barangay_id: response.assigned_barangay_id || null,
          is_dev_override: Boolean(response.is_dev_override),
          disaster_event: response.disaster_event || null,
          metrics: response.metrics || emptyMetrics,
          count: response.count || 0,
          data: serverRows,
          pagination:
            response.pagination || createDefaultPagination(page, pageSize),
        };
        const nextPendingLocalRows = sortPresentedStubRows(
          localRows.map((row) =>
            withStubPresentationStatus(row, syncQueueEntries, {
              disasterEventId,
              barangayId: dataScopedBarangayId,
            }),
          ),
        );
        setStubDashboardCacheEntry(requestKey, {
          dashboard: nextDashboard,
          pendingLocalRows: nextPendingLocalRows,
        });

        if (isMounted) {
          setDashboard({
            ...nextDashboard,
            data: serverRows,
          });
          setPendingLocalRows(nextPendingLocalRows);
          hasLoadedDataRef.current = true;
          lastSuccessfulRequestKeyRef.current = requestKey;
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

          const fallbackDashboard = {
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
          };
          setStubDashboardCacheEntry(requestKey, {
            dashboard: fallbackDashboard,
            pendingLocalRows: [],
          });
          setDashboard(fallbackDashboard);
          // Legacy contract: offline rows are intentionally moved into dashboard data
          // before client-side filtering and page slicing (setPendingLocalRows([...pendingRows, ...cachedRows])).
          setPendingLocalRows([]);
          setErrorMessage(
            pendingRows.length > 0 || cachedRows.length > 0
              ? ""
              : getFriendlyStubDashboardErrorMessage(error),
          );
          hasLoadedDataRef.current = presentedRows.length > 0;
          lastSuccessfulRequestKeyRef.current = requestKey;
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
    requestKey,
    sectorOptionsDependencyKey,
    search,
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

  const cacheEntryForRender = getStubDashboardCacheEntry(requestKey);
  const isCurrentDataContext = dataContextKeyRef.current === requestKey;
  const visibleDashboard = isCurrentDataContext
    ? dashboard
    : cacheEntryForRender?.dashboard || emptyDashboard;
  const visiblePendingLocalRows = isCurrentDataContext
    ? pendingLocalRows
    : cacheEntryForRender?.pendingLocalRows || [];
  const visibleIsLoading = isCurrentDataContext
    ? isLoading
    : !cacheEntryForRender;
  const visibleIsRefreshing = isCurrentDataContext
    ? isRefreshing
    : Boolean(cacheEntryForRender);
  const visibleErrorMessage = isCurrentDataContext ? errorMessage : "";

  const summaryCards = useMemo(() => {
    return [
      {
        label: "Total Issued Stubs",
        value: visibleDashboard.metrics.total_issued_stubs || 0,
      },
      {
        label: "Beneficiary Families",
        value: visibleDashboard.metrics.beneficiary_families || 0,
      },
      {
        label: "Claimed Stubs",
        value: visibleDashboard.metrics.claimed_stubs || 0,
      },
      {
        label: "For Claim Stubs",
        value: visibleDashboard.metrics.unclaimed_stubs || 0,
      },
    ];
  }, [visibleDashboard.metrics]);

  return {
    rows: [...visiblePendingLocalRows, ...visibleDashboard.data],
    summaryCards,
    pagination:
      visibleDashboard.pagination || createDefaultPagination(page, pageSize),
    isLoading: visibleIsLoading,
    isInitialLoading: visibleIsLoading && !visibleIsRefreshing,
    isRefreshing: visibleIsRefreshing,
    errorMessage: visibleErrorMessage,
    hasData: visibleDashboard.data.length > 0,
    reloadDashboard,
  };
};
