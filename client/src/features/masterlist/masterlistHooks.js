import { useEffect, useRef, useState } from "react";
import {
  fetchMasterlist,
  buildCachedMasterlistResult,
  sortMasterlistRows,
} from "./masterlistService";
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
  const [infoMessage, setInfoMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const lastSuccessfulDataRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const loadMasterlist = async () => {
      if (!disasterEventId) {
        setData(emptyData);
        setErrorMessage("");
        setInfoMessage("");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage("");
      setInfoMessage("");

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
          setInfoMessage("");
        }
      } catch (error) {
        if (isMounted) {
          const isOffline =
            typeof navigator !== "undefined" && navigator.onLine === false;
          const cachedMasterlistRows = await getCachedMasterlistRows({
            disasterEventId,
            barangayId,
          });
          const cachedData = buildCachedMasterlistResult({
            cachedRows: cachedMasterlistRows,
            disasterEventId,
            barangayId,
            recordStatus,
            page,
            pageSize,
            search,
            sectorIds,
            sortOrder,
          });
          if (cachedData) {
            cachedData.rows = sortMasterlistRows(cachedData.rows, sortOrder);
          }
          const fallbackData =
            cachedData || lastSuccessfulDataRef.current || null;

          if (fallbackData) {
            setData(fallbackData);
            lastSuccessfulDataRef.current = fallbackData;
            setErrorMessage("");
            setInfoMessage(isOffline ? "" : error.message || "Showing the last saved Masterlist.");
          } else {
            setData(emptyData);
            setInfoMessage("");
            setErrorMessage(
              isOffline
                ? "Offline Data Not Ready: no saved Masterlist is available for this event and Barangay."
                : error.message || "Failed to load masterlist",
            );
          }
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
    infoMessage,
    reloadMasterlist: () => setReloadKey((currentValue) => currentValue + 1),
  };
};
