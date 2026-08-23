import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { LOCAL_SYNC_STATUS } from "../../offline/db.js";
import {
  getVisibleSyncQueueEntries,
} from "../../offline/syncQueue.js";
import {
  initializeSyncService,
  subscribeToSyncUpdates,
} from "../../offline/syncService.js";
import {
  getSyncHealthPresentation,
} from "../../offline/syncStatus.js";
import { fetchSyncStatusSummary } from "./syncHistoryService.js";

const getCount = (entries, status) =>
  entries.filter((entry) => entry.status === status).length;

export const useBarangaySyncHealth = ({
  syncEntries,
  isSyncEntriesLoading = false,
} = {}) => {
  const liveSyncEntries = useLiveQuery(
    () =>
      Array.isArray(syncEntries)
        ? Promise.resolve(syncEntries)
        : getVisibleSyncQueueEntries(),
    [syncEntries],
    null,
  );
  const [statusSummary, setStatusSummary] = useState(null);
  const [statusError, setStatusError] = useState(false);
  const refreshPromiseRef = useRef(null);

  const queueEntries = Array.isArray(syncEntries)
    ? syncEntries
    : liveSyncEntries || [];
  const isQueueLoading =
    isSyncEntriesLoading ||
    (!Array.isArray(syncEntries) && liveSyncEntries === null);

  const refreshStatusSummary = useCallback(async () => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setStatusError(true);
      return null;
    }

    const request = fetchSyncStatusSummary()
      .then((response) => {
        if (response?.backendReachable === false) {
          throw new Error("Sync status is unavailable");
        }

        setStatusSummary({
          conflictCount: Number.isFinite(response?.conflictCount)
            ? response.conflictCount
            : 0,
          lastSuccessfulSyncAt: response?.lastSuccessfulSyncAt || null,
        });
        setStatusError(false);
        return response;
      })
      .catch(() => {
        setStatusError(true);
        return null;
      })
      .finally(() => {
        refreshPromiseRef.current = null;
      });

    refreshPromiseRef.current = request;
    return request;
  }, []);

  useEffect(() => {
    initializeSyncService();
    void refreshStatusSummary();

    const unsubscribe = subscribeToSyncUpdates(() => {
      void refreshStatusSummary();
    });

    return () => unsubscribe();
  }, [refreshStatusSummary]);

  const counts = useMemo(() => {
    const pendingCount = getCount(queueEntries, LOCAL_SYNC_STATUS.PENDING);
    const failedCount = getCount(queueEntries, LOCAL_SYNC_STATUS.FAILED);
    const localConflictCount = getCount(queueEntries, LOCAL_SYNC_STATUS.CONFLICT);
    const serverConflictCount = Number.isFinite(statusSummary?.conflictCount)
      ? statusSummary.conflictCount
      : 0;

    return {
      pending: pendingCount,
      failed: failedCount,
      conflicts: Math.max(localConflictCount, serverConflictCount),
    };
  }, [queueEntries, statusSummary?.conflictCount]);

  const presentation = useMemo(
    () =>
      getSyncHealthPresentation({
        ...counts,
        isLoading: isQueueLoading || (statusSummary === null && !statusError),
        hasError: statusError && Object.values(counts).every((count) => count === 0),
      }),
    [counts, isQueueLoading, statusError, statusSummary],
  );

  return {
    queueEntries,
    ...counts,
    lastSuccessfulSyncAt: statusSummary?.lastSuccessfulSyncAt || null,
    isLoading: isQueueLoading || (statusSummary === null && !statusError),
    hasError: statusError,
    presentation,
    refreshStatusSummary,
  };
};
