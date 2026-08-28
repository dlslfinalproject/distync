import { useEffect, useRef, useState } from "react";
import { fetchMasterlist, sortMasterlistRows } from "./masterlistService";
import { getCachedMasterlistRows } from "../../offline/masterlistCache.js";

const emptyData = {
  disasterEvent: null,
  summary: {
    registeredFamilies: 0,
    totalMembers: 0,
    withAttendance: 0,
  },
  rows: [],
  pagination: null,
};

export const useMasterlist = ({
  disasterEventId,
  barangayId,
  recordStatus,
  page,
  pageSize,
  search,
  sectorIds,
  sortOrder,
}) => {
  const [data, setData] = useState(emptyData);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const lastSuccessfulDataRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const loadMasterlist = async () => {
      if (!disasterEventId) {
        setData(emptyData);
        setErrorMessage("");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage("");

      try {
        const result = await fetchMasterlist({
          disasterEventId,
          barangayId,
          recordStatus,
          page,
          pageSize,
          search,
          sectorIds,
          sortOrder,
        });

        if (isMounted) {
          setData(result);
          lastSuccessfulDataRef.current = result;
        }
      } catch (error) {
        if (isMounted) {
          const isOffline =
            typeof navigator !== "undefined" && navigator.onLine === false;
          let fallbackData = null;
          if (isOffline) {
            const cachedRows = await getCachedMasterlistRows({ disasterEventId, barangayId });
            const filteredRows = cachedRows.filter((row) => {
              const isActive = row.is_operationally_active !== false;
              const statusMatches = recordStatus === "all" || (recordStatus === "active" ? isActive : !isActive);
              const query = search.trim().toLowerCase();
              const searchMatches = !query || `${row.family_head_name} ${row.address}`.toLowerCase().includes(query);
              const sectorMatches = !sectorIds.length || sectorIds.some((id) => (row.sector_ids || []).includes(id));
              return statusMatches && searchMatches && sectorMatches;
            });
            const sortedRows = sortMasterlistRows(filteredRows, sortOrder);
            const totalPages = pageSize ? Math.ceil(sortedRows.length / pageSize) : 1;
            fallbackData = {
              disasterEvent: { id: disasterEventId },
              summary: { registeredFamilies: sortedRows.length, totalMembers: sortedRows.reduce((sum, row) => sum + (row.members_count || 0), 0), withAttendance: 0 },
              rows: pageSize ? sortedRows.slice((page - 1) * pageSize, page * pageSize) : sortedRows,
              pagination: { page, pageSize, totalItems: sortedRows.length, totalPages, hasPreviousPage: page > 1, hasNextPage: page < totalPages },
            };
          }
          setData(fallbackData || (isOffline && lastSuccessfulDataRef.current ? lastSuccessfulDataRef.current : emptyData));
          setErrorMessage(error.message || "Failed to load masterlist");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadMasterlist();

    return () => {
      isMounted = false;
    };
  }, [
    barangayId,
    disasterEventId,
    page,
    pageSize,
    recordStatus,
    reloadKey,
    search,
    sectorIds,
    sortOrder,
  ]);

  return {
    data,
    isLoading,
    errorMessage,
    reloadMasterlist: () => setReloadKey((currentValue) => currentValue + 1),
  };
};
