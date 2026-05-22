import { useEffect, useMemo, useState } from "react";
import {
  cacheRegistrationSectors,
} from "../household-registration/householdRegistrationService";
import { fetchMswdoSectors } from "../mswdo-masterlist/mswdoMasterlistService";
import {
  buildQueuedHouseholdRow,
  getFilteredRows,
  getSectorNames,
} from "./barangayMasterlistUi";
import { buildSyncDescriptor, findSyncEntry } from "../../offline/syncStatus";
import { subscribeToSyncUpdates } from "../../offline/syncService";

export const useBarangayMasterlistSync = ({
  rows,
  syncQueueEntries,
  selectedEvent,
  assignedBarangay,
  searchTerm,
  eventScope,
  reloadMasterlist,
}) => {
  const [selectedSectorNamesByScope, setSelectedSectorNamesByScope] = useState({
    active: [],
    ended: [],
  });
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
          entry.actionKey === "HOUSEHOLD_REGISTER" &&
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

  const selectedSectorNames = selectedSectorNamesByScope[eventScope] || [];

  const filteredRows = useMemo(() => {
    const searchedRows = getFilteredRows(rowsWithSyncStatus, searchTerm);

    if (selectedSectorNames.length === 0) {
      return searchedRows;
    }

    return searchedRows.filter((row) => {
      const rowSectorNames = getSectorNames(row.sectors_text);

      return selectedSectorNames.some((sectorName) =>
        rowSectorNames.includes(sectorName),
      );
    });
  }, [rowsWithSyncStatus, searchTerm, selectedSectorNames]);

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
        cacheRegistrationSectors(Array.isArray(sectors) ? sectors : []);
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

  const toggleSectorFilter = (sectorName) => {
    setSelectedSectorNamesByScope((currentFilters) => ({
      ...currentFilters,
      [eventScope]: currentFilters[eventScope].includes(sectorName)
        ? currentFilters[eventScope].filter((value) => value !== sectorName)
        : [...currentFilters[eventScope], sectorName],
    }));
  };

  const clearSectorFilters = () => {
    setSelectedSectorNamesByScope((currentFilters) => ({
      ...currentFilters,
      [eventScope]: [],
    }));
  };

  return {
    sectorOptions,
    selectedSectorNames,
    filteredRows,
    toggleSectorFilter,
    clearSectorFilters,
  };
};
