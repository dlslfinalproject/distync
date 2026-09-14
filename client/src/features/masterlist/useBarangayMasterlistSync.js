import { useEffect, useMemo, useState } from "react";
import {
  cacheRegistrationSectors,
  fetchSectors,
  getCachedRegistrationReferenceData,
} from "../household-registration/householdRegistrationService";
import {
  getLatestHouseholdLifecycleEntry,
  resolveEffectiveMasterlistRows,
} from "./barangayMasterlistUi";
import { filterMasterlistRows } from "./masterlistService";
import { buildSyncDescriptor } from "../../offline/syncStatus";
import { subscribeToSyncUpdates } from "../../offline/syncService";
import {
  buildMasterlistFilterSectorOptions,
} from "../../utils/registrationOptions";

const REMOTE_MASTERLIST_REVALIDATION_INTERVAL_MS = 60 * 1000;

export const useBarangayMasterlistSync = ({
  rows,
  syncQueueEntries,
  selectedEvent,
  assignedBarangay,
  recordStatus,
  sortOrder,
  reloadMasterlist,
  cachedMasterlistRows = [],
  isOffline = false,
  page = 1,
  pageSize = 25,
  search = "",
  sectorIds = [],
}) => {
  // HOUSEHOLD_RE_ADMISSION remains an optimistic Active occurrence.
  const [sectorOptions, setSectorOptions] = useState(() => {
    const cachedSectors = getCachedRegistrationReferenceData().sectors;
    const sectors = Array.isArray(cachedSectors?.data)
      ? cachedSectors.data
      : Array.isArray(cachedSectors)
        ? cachedSectors
        : [];
    return buildMasterlistFilterSectorOptions(sectors);
  });

  const sourceRows = useMemo(() => {
    if (isOffline) {
      return cachedMasterlistRows.length > 0
        ? cachedMasterlistRows
        : Array.isArray(rows)
          ? rows
          : [];
    }

    const rowsByHouseholdId = new Map(
      (Array.isArray(rows) ? rows : [])
        .filter((row) => row?.household_id)
        .map((row) => [String(row.household_id), row]),
    );

    return [...rowsByHouseholdId.values()];
  }, [cachedMasterlistRows, isOffline, rows]);

  const rowsWithSyncStatus = useMemo(() => {
    const syncedRows = sourceRows.map((row) => ({
      ...row,
      sync_status: buildSyncDescriptor(
        getLatestHouseholdLifecycleEntry(syncQueueEntries, row),
      ).status,
      is_local_only: false,
    }));

    return resolveEffectiveMasterlistRows({
      rows: syncedRows,
      syncQueueEntries,
      recordStatus,
      selectedEventId: selectedEvent?.id,
      selectedEventTitle:
        selectedEvent?.disaster_event_title ||
        selectedEvent?.title ||
        selectedEvent?.name ||
        "",
      assignedBarangayId: assignedBarangay?.id,
      assignedBarangayName: assignedBarangay?.name || "",
      sectorOptions,
      sortOrder,
    });
  }, [
    assignedBarangay?.id,
    assignedBarangay?.name,
    sourceRows,
    recordStatus,
    sortOrder,
    sectorOptions,
    selectedEvent?.id,
    selectedEvent?.disaster_event_title,
    selectedEvent?.title,
    selectedEvent?.name,
    syncQueueEntries,
  ]);

  const filteredRows = useMemo(() => {
    const locallyFilteredRows = filterMasterlistRows({
      rows: rowsWithSyncStatus,
      search,
      sectorIds,
      sectorOptions,
    });

    if (!isOffline) {
      return locallyFilteredRows;
    }

    const safePage = Math.max(Number(page) || 1, 1);
    const safePageSize = Math.max(Number(pageSize) || 25, 1);
    const startIndex = (safePage - 1) * safePageSize;

    return locallyFilteredRows.slice(startIndex, startIndex + safePageSize);
  }, [
    isOffline,
    page,
    pageSize,
    rowsWithSyncStatus,
    search,
    sectorIds,
    sectorOptions,
  ]);

  const offlinePagination = useMemo(() => {
    if (!isOffline) {
      return null;
    }

    const locallyFilteredRows = filterMasterlistRows({
      rows: rowsWithSyncStatus,
      search,
      sectorIds,
      sectorOptions,
    });
    const safePage = Math.max(Number(page) || 1, 1);
    const safePageSize = Math.max(Number(pageSize) || 25, 1);
    const totalItems = locallyFilteredRows.length;
    const totalPages = Math.ceil(totalItems / safePageSize);

    return {
      page: safePage,
      pageSize: safePageSize,
      totalItems,
      totalPages,
      hasPreviousPage: safePage > 1,
      hasNextPage: safePage < totalPages,
    };
  }, [
    isOffline,
    page,
    pageSize,
    rowsWithSyncStatus,
    search,
    sectorIds,
    sectorOptions,
  ]);

  useEffect(() => {
    let isMounted = true;

    const loadSectors = async () => {
      try {
        const sectorsPayload = await fetchSectors();
        const sectors = Array.isArray(sectorsPayload?.data)
          ? sectorsPayload.data
          : Array.isArray(sectorsPayload)
            ? sectorsPayload
            : [];

        if (!isMounted) {
          return;
        }

        const normalizedSectors = buildMasterlistFilterSectorOptions(
          Array.isArray(sectors) ? sectors : [],
        );

        setSectorOptions(normalizedSectors);
        cacheRegistrationSectors(normalizedSectors);
      } catch (_error) {
        if (isMounted) {
          const cachedSectors = getCachedRegistrationReferenceData().sectors;
          const sectors = Array.isArray(cachedSectors?.data)
            ? cachedSectors.data
            : Array.isArray(cachedSectors)
              ? cachedSectors
              : [];
          setSectorOptions(buildMasterlistFilterSectorOptions(sectors));
        }
      }
    };

    loadSectors();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const isRevalidationAllowed = () =>
      typeof navigator === "undefined" ||
      (navigator.onLine !== false &&
        typeof document !== "undefined" &&
        document.visibilityState !== "hidden");

    const revalidate = () => {
      if (isRevalidationAllowed()) {
        reloadMasterlist();
      }
    };

    const unsubscribe = subscribeToSyncUpdates(revalidate);
    const intervalId = window.setInterval(
      revalidate,
      REMOTE_MASTERLIST_REVALIDATION_INTERVAL_MS,
    );
    window.addEventListener("online", revalidate);
    window.addEventListener("focus", revalidate);
    const documentObject = typeof document !== "undefined" ? document : null;
    documentObject?.addEventListener("visibilitychange", revalidate);

    return () => {
      unsubscribe();
      window.clearInterval(intervalId);
      window.removeEventListener("online", revalidate);
      window.removeEventListener("focus", revalidate);
      documentObject?.removeEventListener("visibilitychange", revalidate);
    };
  }, [reloadMasterlist]);

  return {
    sectorOptions,
    filteredRows,
    offlinePagination,
  };
};
