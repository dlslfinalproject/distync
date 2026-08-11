import { useEffect, useMemo, useState } from "react";
import {
  cacheRegistrationSectors,
  fetchSectors,
} from "../household-registration/householdRegistrationService";
import {
  buildQueuedHouseholdRow,
  getFilteredRows,
} from "./barangayMasterlistUi";
import {
  sortMasterlistRows,
} from "./masterlistService";
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
  searchTerm,
  eventScope,
  reloadMasterlist,
}) => {
  const [selectedSectorIdsByScope, setSelectedSectorIdsByScope] = useState({
    active: [],
    ended: [],
  });
  const [sortOrderByScope, setSortOrderByScope] = useState({
    active: "newest",
    ended: "newest",
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

  const selectedSectorIds = selectedSectorIdsByScope[eventScope] || [];
  const selectedSortOrder = sortOrderByScope[eventScope] || "newest";

  const filteredRows = useMemo(() => {
    const searchedRows = getFilteredRows(rowsWithSyncStatus, searchTerm);
    const sectorScopedRows =
      selectedSectorIds.length === 0
        ? searchedRows
        : searchedRows.filter((row) => {
            return selectedSectorIds.some((sectorId) =>
              (row.sector_codes || []).includes(sectorId),
            );
          });

    return sortMasterlistRows(sectorScopedRows, selectedSortOrder);
  }, [rowsWithSyncStatus, searchTerm, selectedSectorIds, selectedSortOrder]);

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

  const toggleSectorFilter = (sectorId) => {
    setSelectedSectorIdsByScope((currentFilters) => ({
      ...currentFilters,
      [eventScope]: currentFilters[eventScope].includes(sectorId)
        ? currentFilters[eventScope].filter((value) => value !== sectorId)
        : [...currentFilters[eventScope], sectorId],
    }));
  };

  const clearSectorFilters = () => {
    setSelectedSectorIdsByScope((currentFilters) => ({
      ...currentFilters,
      [eventScope]: [],
    }));
    setSortOrderByScope((currentValues) => ({
      ...currentValues,
      [eventScope]: "newest",
    }));
  };

  const setSelectedSortOrder = (value) => {
    setSortOrderByScope((currentValues) => ({
      ...currentValues,
      [eventScope]: value || "newest",
    }));
  };

  return {
    sectorOptions,
    selectedSectorIds,
    selectedSortOrder,
    filteredRows,
    toggleSectorFilter,
    clearSectorFilters,
    setSelectedSortOrder,
  };
};
