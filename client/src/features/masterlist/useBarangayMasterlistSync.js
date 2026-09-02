import { useEffect, useMemo, useState } from "react";
import {
  cacheRegistrationSectors,
  fetchSectors,
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

export const useBarangayMasterlistSync = ({
  rows,
  syncQueueEntries,
  selectedEvent,
  assignedBarangay,
  recordStatus,
  sortOrder,
  reloadMasterlist,
}) => {
  // HOUSEHOLD_RE_ADMISSION remains an optimistic Active occurrence.
  const [sectorOptions, setSectorOptions] = useState([]);

  const rowsWithSyncStatus = useMemo(() => {
    const syncedRows = rows.map((row) => ({
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
      assignedBarangayId: assignedBarangay?.id,
      assignedBarangayName: assignedBarangay?.name || "",
      sortOrder,
    });
  }, [
    assignedBarangay?.id,
    assignedBarangay?.name,
    rows,
    recordStatus,
    sortOrder,
    selectedEvent?.id,
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
    const unsubscribe = subscribeToSyncUpdates(() => {
      if (typeof navigator !== "undefined" && navigator.onLine) {
        reloadMasterlist();
      }
    });

    return () => unsubscribe();
  }, [reloadMasterlist]);

  return {
    sectorOptions,
    filteredRows,
  };
};
