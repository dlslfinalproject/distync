import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchSyncStatusSummary } from "../../features/sync/syncHistoryService";
import { LOCAL_SYNC_STATUS } from "../../offline/db";
import {
  getDistyncServiceWorkerStatusSnapshot,
  refreshDistyncServiceWorkerStatus,
  subscribeToDistyncServiceWorkerStatus,
} from "../../pwa/registerServiceWorker";
import {
  buildSystemInformationViewModel,
  SERVICE_WORKER_STATUSES,
  SYSTEM_CONNECTION_STATUSES,
} from "./systemInformationModel";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const HEALTH_ENDPOINT = `${API_BASE_URL}/api/v1/health`;

const DEFAULT_SUMMARY = {
  conflictCount: undefined,
  lastSuccessfulSyncAt: undefined,
};

const getQueueCount = (syncEntries, status) =>
  syncEntries.filter((entry) => entry?.status === status).length;

export const useSystemInformation = ({
  roleCode,
  syncEntries,
  formatDateTime,
}) => {
  const [connectionStatus, setConnectionStatus] = useState(() =>
    typeof navigator === "undefined" || navigator.onLine
      ? SYSTEM_CONNECTION_STATUSES.CHECKING
      : SYSTEM_CONNECTION_STATUSES.OFFLINE,
  );
  const [summary, setSummary] = useState(DEFAULT_SUMMARY);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [serviceWorkerStatus, setServiceWorkerStatus] = useState(() =>
    getDistyncServiceWorkerStatusSnapshot().status ||
    SERVICE_WORKER_STATUSES.CHECKING,
  );
  const refreshInFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshInFlightRef.current) {
      return;
    }

    refreshInFlightRef.current = true;
    setIsRefreshing(true);

    try {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setConnectionStatus(SYSTEM_CONNECTION_STATUSES.OFFLINE);
        setSummary(DEFAULT_SUMMARY);
        return;
      }

      setConnectionStatus(SYSTEM_CONNECTION_STATUSES.CHECKING);

      const healthResponse = await fetch(HEALTH_ENDPOINT, { cache: "no-store" });

      if (!healthResponse.ok) {
        setConnectionStatus(SYSTEM_CONNECTION_STATUSES.LIMITED);
        setSummary(DEFAULT_SUMMARY);
        return;
      }

      setConnectionStatus(SYSTEM_CONNECTION_STATUSES.ONLINE);

      try {
        const response = await fetchSyncStatusSummary();
        const payload = response?.data || {};

        setSummary({
          conflictCount:
            Number.isFinite(payload.conflictCount) ? payload.conflictCount : 0,
          lastSuccessfulSyncAt:
            payload.lastSuccessfulSyncAt === null
              ? null
              : payload.lastSuccessfulSyncAt || undefined,
        });
      } catch (_error) {
        setSummary(DEFAULT_SUMMARY);
      }
    } catch (_error) {
      setConnectionStatus(SYSTEM_CONNECTION_STATUSES.LIMITED);
      setSummary(DEFAULT_SUMMARY);
    } finally {
      await refreshDistyncServiceWorkerStatus();
      setServiceWorkerStatus(getDistyncServiceWorkerStatusSnapshot().status);
      setIsLoading(false);
      setIsRefreshing(false);
      refreshInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleOnline = () => {
      void refresh();
    };
    const handleOffline = () => {
      setConnectionStatus(SYSTEM_CONNECTION_STATUSES.OFFLINE);
    };
    const handleSyncFeedback = () => {
      void refresh();
    };
    const handleQueueUpdated = () => {
      void refresh();
    };
    const handleWindowFocus = () => {
      if (document.visibilityState !== "hidden") {
        void refresh();
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("distync-sync-feedback", handleSyncFeedback);
    window.addEventListener("distync-sync-queue-updated", handleQueueUpdated);
    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("distync-sync-feedback", handleSyncFeedback);
      window.removeEventListener(
        "distync-sync-queue-updated",
        handleQueueUpdated,
      );
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refresh]);

  useEffect(() => {
    return subscribeToDistyncServiceWorkerStatus((snapshot) => {
      setServiceWorkerStatus(snapshot.status || SERVICE_WORKER_STATUSES.CHECKING);
    });
  }, []);

  return useMemo(
    () =>
      buildSystemInformationViewModel({
        roleCode,
        connectionStatus,
        serviceWorkerStatus,
        pendingCount: getQueueCount(syncEntries, LOCAL_SYNC_STATUS.PENDING),
        failedCount: getQueueCount(syncEntries, LOCAL_SYNC_STATUS.FAILED),
        conflictCount: summary.conflictCount,
        lastSuccessfulSyncAt: summary.lastSuccessfulSyncAt,
        formatDateTime,
        loading: isLoading,
        refresh,
        isRefreshing,
      }),
    [
      connectionStatus,
      formatDateTime,
      isLoading,
      isRefreshing,
      refresh,
      roleCode,
      serviceWorkerStatus,
      summary.conflictCount,
      summary.lastSuccessfulSyncAt,
      syncEntries,
    ],
  );
};
