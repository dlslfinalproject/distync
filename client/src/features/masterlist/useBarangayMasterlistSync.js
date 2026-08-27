import { useEffect, useMemo, useState } from "react";
import {
  cacheRegistrationSectors,
  fetchSectors,
} from "../household-registration/householdRegistrationService";
import {
  buildQueuedHouseholdRow,
} from "./barangayMasterlistUi";
import { buildSyncDescriptor, findSyncEntry } from "../../offline/syncStatus";
import { subscribeToSyncUpdates } from "../../offline/syncService";
import {
  buildMasterlistFilterSectorOptions,
} from "../../utils/registrationOptions";

export const useBarangayMasterlistSync = ({
  rows,
  syncQueueEntries,
  selectedEvent,
  assignedBarangay,
  reloadMasterlist,
}) => {
  const [sectorOptions, setSectorOptions] = useState([]);

  const rowsWithSyncStatus = useMemo(() => {
    const syncedRows = rows.map((row) => {
      const matchingEntry = findSyncEntry(syncQueueEntries, (entry) => {
        if (
          entry.entityType !== "HOUSEHOLD" ||
          !["barangay-households", "barangay-masterlist"].includes(entry.moduleName)
        ) {
          return false;
        }

        return (
          entry.entityServerId === row.household_id ||
          entry.entityLocalId === row.household_id
        );
      });

      return {
        ...row,
        sync_status: buildSyncDescriptor(matchingEntry).status,
        is_local_only: false,
      };
    });

    const optimisticRows = syncQueueEntries
      .filter((entry) => {
        return (
          entry.moduleName === "barangay-households" &&
          ["HOUSEHOLD_REGISTER", "HOUSEHOLD_RE_ADMISSION"].includes(
            entry.actionKey,
          ) &&
          entry.payload?.disaster_event_id === selectedEvent?.id &&
          entry.payload?.barangay_id === assignedBarangay?.id &&
          !syncedRows.some(
            (row) =>
              row.household_id === entry.entityServerId ||
              row.household_id === entry.entityLocalId,
          )
        );
      })
      .map((entry) => buildQueuedHouseholdRow(entry, assignedBarangay?.name || ""));

    return [...optimisticRows, ...syncedRows];
  }, [
    assignedBarangay?.id,
    assignedBarangay?.name,
    rows,
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
