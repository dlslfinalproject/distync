import { useEffect, useRef, useState } from "react";
import {
  fetchMasterlist,
  buildCachedMasterlistResult,
  sortMasterlistRows,
} from "./masterlistService";
import { getCachedMasterlistRows } from "../../offline/masterlistCache.js";
import {
  getSyncQueueActorContext,
  isSyncQueueActorContextCurrent,
} from "../../offline/syncQueue.js";
import {
  activateMasterlistMemoryOwner,
  buildMasterlistRequestKey,
  getMasterlistCacheEntry,
  isMasterlistMemoryOwnerCurrent,
  selectMasterlistFallbackData,
  setMasterlistCacheEntry,
} from "./masterlistMemoryCache.mjs";

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
  const actorContext = getSyncQueueActorContext();
  const ownerKey = activateMasterlistMemoryOwner(actorContext);
  const requestKey = buildMasterlistRequestKey({
    actorContext,
    disasterEventId,
    barangayId,
    recordStatus,
    page,
    pageSize,
    search,
    sectorIds,
    sortOrder,
  });
  const initialCacheEntry = getMasterlistCacheEntry(requestKey);
  const [data, setData] = useState(
    initialCacheEntry?.data || emptyData,
  );
  const [isLoading, setIsLoading] = useState(
    () => Boolean(disasterEventId && !initialCacheEntry),
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [isAuthoritative, setIsAuthoritative] = useState(
    Boolean(initialCacheEntry?.isAuthoritative),
  );
  const [reloadKey, setReloadKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const backgroundReloadRef = useRef(false);
  const lastSuccessfulDataRef = useRef(initialCacheEntry?.data || null);
  const lastSuccessfulRequestKeyRef = useRef(
    initialCacheEntry ? requestKey : "",
  );
  const dataContextKeyRef = useRef(requestKey);
  const hasRunRequestRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    const isActiveRequest = () =>
      isMounted &&
      isMasterlistMemoryOwnerCurrent(ownerKey) &&
      isSyncQueueActorContextCurrent(actorContext);

    const loadMasterlist = async () => {
      const cacheEntry = getMasterlistCacheEntry(requestKey);
      const isNewRequestContext =
        !hasRunRequestRef.current || dataContextKeyRef.current !== requestKey;
      hasRunRequestRef.current = true;
      dataContextKeyRef.current = requestKey;

      if (isNewRequestContext) {
        setData(cacheEntry?.data || emptyData);
        setIsAuthoritative(Boolean(cacheEntry?.isAuthoritative));
        lastSuccessfulDataRef.current = cacheEntry?.data || null;
        lastSuccessfulRequestKeyRef.current = cacheEntry ? requestKey : "";
        setErrorMessage("");
        setInfoMessage("");
      }

      const isBackgroundReload = backgroundReloadRef.current;
      backgroundReloadRef.current = false;
      const preserveExistingData =
        (isNewRequestContext && Boolean(cacheEntry)) ||
        (isBackgroundReload &&
          Boolean(lastSuccessfulDataRef.current) &&
          lastSuccessfulRequestKeyRef.current === requestKey);

      if (!disasterEventId) {
        setData(emptyData);
        setIsAuthoritative(false);
        setErrorMessage("");
        setInfoMessage("");
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (!preserveExistingData) {
        setIsLoading(true);
      } else {
        setIsLoading(false);
      }
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

        if (!isActiveRequest()) return;

        setMasterlistCacheEntry(requestKey, {
          data: result,
          isAuthoritative: true,
        });

        if (isMounted) {
          setData(result);
          setIsAuthoritative(true);
          lastSuccessfulDataRef.current = result;
          lastSuccessfulRequestKeyRef.current = requestKey;
          setInfoMessage("");
        }
      } catch (error) {
        if (isActiveRequest()) {
          const isOffline =
            typeof navigator !== "undefined" && navigator.onLine === false;
          const cachedMasterlistRows = await getCachedMasterlistRows({
            disasterEventId,
            barangayId,
          });
          if (!isActiveRequest()) return;
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
          const fallbackData = selectMasterlistFallbackData({
            requestKey,
            cachedData,
            lastSuccessfulData: lastSuccessfulDataRef.current,
            lastSuccessfulRequestKey: lastSuccessfulRequestKeyRef.current,
          });

          if (fallbackData) {
            setMasterlistCacheEntry(requestKey, {
              data: fallbackData,
              isAuthoritative: false,
            });
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
        if (isActiveRequest()) {
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
    sortOrder,
    ownerKey,
  ]);

  const cacheEntryForRender = getMasterlistCacheEntry(requestKey);
  const isCurrentDataContext = dataContextKeyRef.current === requestKey;
  const visibleData = isCurrentDataContext
    ? data
    : cacheEntryForRender?.data || emptyData;
  const visibleIsAuthoritative = isCurrentDataContext
    ? isAuthoritative
    : Boolean(cacheEntryForRender?.isAuthoritative);
  const visibleIsLoading = isCurrentDataContext
    ? isLoading
    : !cacheEntryForRender;
  const visibleIsRefreshing = isCurrentDataContext
    ? isRefreshing
    : Boolean(cacheEntryForRender);

  return {
    data: visibleData,
    isLoading: visibleIsLoading,
    errorMessage: isCurrentDataContext ? errorMessage : "",
    infoMessage: isCurrentDataContext ? infoMessage : "",
    isAuthoritative: visibleIsAuthoritative,
    isInitialLoading: visibleIsLoading && !visibleIsRefreshing,
    isRefreshing: visibleIsRefreshing,
    reloadMasterlist: (options = {}) => {
      backgroundReloadRef.current = Boolean(options?.background);
      setReloadKey((currentValue) => currentValue + 1);
    },
  };
};
