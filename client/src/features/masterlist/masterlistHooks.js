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
  const [isAuthoritative, setIsAuthoritative] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const backgroundReloadRef = useRef(false);
  const lastSuccessfulDataRef = useRef(null);
  const lastSuccessfulRequestKeyRef = useRef("");
  const requestKey = JSON.stringify({
    disasterEventId,
    barangayId,
    recordStatus,
    page,
    pageSize,
    search,
    sectorIds: Array.isArray(sectorIds) ? sectorIds : [],
    sortOrder,
  });

  useEffect(() => {
    let isMounted = true;

    const loadMasterlist = async () => {
      const preserveExistingData =
        backgroundReloadRef.current &&
        lastSuccessfulRequestKeyRef.current === requestKey;
      backgroundReloadRef.current = false;

      if (!disasterEventId) {
        setData(emptyData);
        setIsAuthoritative(false);
        setErrorMessage("");
        setInfoMessage("");
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      setIsLoading(true);
      setIsRefreshing(preserveExistingData);
      setIsAuthoritative(false);
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
          setIsAuthoritative(true);
          lastSuccessfulDataRef.current = result;
          lastSuccessfulRequestKeyRef.current = requestKey;
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
            cachedData.rows = sortMasterlistRows(cachedData.rows, sortOrder, {
              recordStatus,
            });
          }
          const fallbackData =
            cachedData || lastSuccessfulDataRef.current || null;

          if (fallbackData) {
            setData(fallbackData);
            setIsAuthoritative(false);
            lastSuccessfulDataRef.current = fallbackData;
            lastSuccessfulRequestKeyRef.current = requestKey;
            setErrorMessage("");
            setInfoMessage(isOffline ? "" : error.message || "Showing the last saved Masterlist.");
          } else {
            setData(emptyData);
            setIsAuthoritative(false);
            lastSuccessfulRequestKeyRef.current = "";
            setInfoMessage("");
            setErrorMessage(
              isOffline
                ? "No saved Masterlist is available for this event and Barangay."
                : error.message || "Failed to load masterlist",
            );
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setIsRefreshing(false);
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
    requestKey,
    search,
    sectorIds,
    sortOrder,
  ]);

  return {
    data,
    isLoading,
    errorMessage,
    infoMessage,
    isAuthoritative,
    isInitialLoading: isLoading && !isRefreshing,
    isRefreshing,
    reloadMasterlist: (options = {}) => {
      backgroundReloadRef.current = Boolean(options?.background);
      setReloadKey((currentValue) => currentValue + 1);
    },
  };
};
