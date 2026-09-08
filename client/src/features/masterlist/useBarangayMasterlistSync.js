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
    const rowsByHouseholdId = new Map(
      (Array.isArray(cachedMasterlistRows) ? cachedMasterlistRows : [])
        .filter((row) => row?.household_id)
        .map((row) => [String(row.household_id), row]),
    );

    (Array.isArray(rows) ? rows : []).forEach((row) => {
      if (row?.household_id) {
        rowsByHouseholdId.set(String(row.household_id), row);
      }
    });

    return [...rowsByHouseholdId.values()];
  }, [cachedMasterlistRows, rows]);

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
    return rowsWithSyncStatus;
  }, [rowsWithSyncStatus]);

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
  };
};
