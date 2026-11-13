import { useEffect, useRef, useState } from "react";
import { ROLE_CODES } from "../../utils/roleSession.js";
import {
  getMayorInventoryCacheScope,
  getMayorInventoryCacheSnapshot,
} from "../../offline/mayorInventoryCache.js";
import {
  getMayorInventoryPreparation,
  MAYOR_INVENTORY_PREPARATION_STATUS,
  prepareMayorInventoryOfflineData,
} from "../../offline/mayorInventoryPreparation.js";
import { mayorInventoryReconnectCoordinator } from "../../offline/mayorInventoryReconnectCoordinator.js";

export const useMayorInventoryOfflinePreparation = ({
  enabled = true,
  userId = "",
  roleCode = ROLE_CODES.MAYOR,
} = {}) => {
  const [readiness, setReadiness] = useState(
    MAYOR_INVENTORY_PREPARATION_STATUS.NOT_PREPARED,
  );
  const [diagnostics, setDiagnostics] = useState(null);
  const [hasCompleteCache, setHasCompleteCache] = useState(false);
  const [revision, setRevision] = useState(0);
  const refreshRequestedRef = useRef(false);
  const explicitRetryRef = useRef(false);
  const reconnectGenerationRef = useRef(null);

  useEffect(() => {
    if (!enabled || roleCode !== ROLE_CODES.MAYOR || !userId) {
      setReadiness(MAYOR_INVENTORY_PREPARATION_STATUS.NOT_PREPARED);
      setDiagnostics(null);
      setHasCompleteCache(false);
      reconnectGenerationRef.current = null;
      return undefined;
    }

    const scope = getMayorInventoryCacheScope();
    const scopeKey = mayorInventoryReconnectCoordinator.buildScopeKey(scope);
    if (reconnectGenerationRef.current?.scopeKey !== scopeKey) {
      reconnectGenerationRef.current = null;
    }

    let mounted = true;
    const run = async () => {
      const [preparation, cache] = await Promise.all([
        getMayorInventoryPreparation(),
        getMayorInventoryCacheSnapshot(),
      ]);

      if (!mounted) {
        return;
      }

      setHasCompleteCache(Boolean(cache));
      if (preparation) {
        setDiagnostics(preparation);
      }

      const isOffline =
        typeof navigator !== "undefined" && navigator.onLine === false;
      const lifecycleRequiresRefresh =
        Boolean(scope) &&
        mayorInventoryReconnectCoordinator.hasPendingPreparation(scope);
      const explicitRetry = explicitRetryRef.current;
      const shouldRefreshOnline =
        !isOffline &&
        (refreshRequestedRef.current ||
          explicitRetry ||
          lifecycleRequiresRefresh ||
          preparation?.status ===
            MAYOR_INVENTORY_PREPARATION_STATUS.NEEDS_REFRESH);

      // Readiness is derived from an actual complete cache read, not merely
      // from a flag left behind by an interrupted preparation run.
      if (cache && !shouldRefreshOnline) {
        setReadiness(
          preparation?.status === MAYOR_INVENTORY_PREPARATION_STATUS.NEEDS_REFRESH
            ? MAYOR_INVENTORY_PREPARATION_STATUS.NEEDS_REFRESH
            : MAYOR_INVENTORY_PREPARATION_STATUS.READY,
        );
        return;
      }

      if (isOffline) {
        setReadiness(
          cache
            ? preparation?.status ===
              MAYOR_INVENTORY_PREPARATION_STATUS.NEEDS_REFRESH
              ? MAYOR_INVENTORY_PREPARATION_STATUS.NEEDS_REFRESH
              : MAYOR_INVENTORY_PREPARATION_STATUS.READY
            : MAYOR_INVENTORY_PREPARATION_STATUS.NOT_READY,
        );
        return;
      }

      setReadiness(MAYOR_INVENTORY_PREPARATION_STATUS.PREPARING);

      try {
        const requestToken =
          reconnectGenerationRef.current ||
          (lifecycleRequiresRefresh
            ? mayorInventoryReconnectCoordinator.getCurrentGeneration(scope)
            : null);
        const result = await mayorInventoryReconnectCoordinator.requestCompleteGeneration({
          scope,
          token: requestToken,
          force: explicitRetry,
          requireFresh:
            !cache ||
            preparation?.status ===
              MAYOR_INVENTORY_PREPARATION_STATUS.NEEDS_REFRESH,
          waitForSync: Boolean(requestToken?.waitForSync),
          run: () => prepareMayorInventoryOfflineData({ userId }),
        });

        if (mounted) {
          if (result?.stale) {
            // A sync invalidation crossed the preparation boundary. Let the
            // next effect run the current generation instead of treating the
            // older graph as post-sync authority.
            refreshRequestedRef.current = true;
            reconnectGenerationRef.current =
              mayorInventoryReconnectCoordinator.getCurrentGeneration(scope);
            setReadiness(MAYOR_INVENTORY_PREPARATION_STATUS.PREPARING);
            setRevision((value) => value + 1);
            return;
          }

          setDiagnostics(result?.diagnostics || preparation || null);
          const verifiedCache = await getMayorInventoryCacheSnapshot();
          if (!mounted) {
            return;
          }
          setHasCompleteCache(Boolean(verifiedCache));
          refreshRequestedRef.current = false;
          explicitRetryRef.current = false;
          reconnectGenerationRef.current = null;
          const resultStatus =
            result?.status || MAYOR_INVENTORY_PREPARATION_STATUS.READY;
          const hasVerifiedReadyResult =
            result?.skipped
              ? Boolean(verifiedCache)
              : result?.verifiedCompleteGraph === true &&
                Boolean(verifiedCache);
          setReadiness(
            resultStatus === MAYOR_INVENTORY_PREPARATION_STATUS.READY &&
              !hasVerifiedReadyResult
              ? verifiedCache
                ? MAYOR_INVENTORY_PREPARATION_STATUS.NEEDS_REFRESH
                : MAYOR_INVENTORY_PREPARATION_STATUS.NOT_READY
              : resultStatus,
          );
        }
      } catch (_error) {
        if (mounted) {
          // A page load and the preparation job can finish concurrently. Read
          // the cache again before surfacing a failure so a verified write
          // always wins over an earlier request error.
          const cacheAfterFailure = await getMayorInventoryCacheSnapshot();
          if (!mounted) {
            return;
          }

          setHasCompleteCache(Boolean(cacheAfterFailure));
          explicitRetryRef.current = false;
          setReadiness(
            cacheAfterFailure
              ? MAYOR_INVENTORY_PREPARATION_STATUS.NEEDS_REFRESH
              : preparation?.previous_complete_cache
                ? MAYOR_INVENTORY_PREPARATION_STATUS.NEEDS_REFRESH
                : MAYOR_INVENTORY_PREPARATION_STATUS.NOT_READY,
          );
        }
      }
    };

    const handleLifecycleEvent = (event) => {
      if (!mounted || !event) {
        return;
      }

      if (event.type === "online") {
        if (!event.isNewReconnect) {
          return;
        }

        reconnectGenerationRef.current =
          mayorInventoryReconnectCoordinator.beginReconnectGeneration(scope);
        refreshRequestedRef.current = true;
        setRevision((value) => value + 1);
        return;
      }

      if (
        event.type !== "invalidated" ||
        event.scopeKey !== scopeKey
      ) {
        return;
      }

      reconnectGenerationRef.current =
        mayorInventoryReconnectCoordinator.getCurrentGeneration(scope);
      refreshRequestedRef.current = true;
      setRevision((value) => value + 1);
    };

    const unsubscribeLifecycle =
      mayorInventoryReconnectCoordinator.subscribe(handleLifecycleEvent);

    const handlePreparationUpdate = (event) => {
      if (!mounted || !event.detail) {
        return;
      }

      const scope = event.detail.scope;
      if (scope?.userId && scope.userId !== userId) {
        return;
      }

      setDiagnostics(event.detail);
      if (event.detail.status) {
        setReadiness(event.detail.status);
      }

      void getMayorInventoryCacheSnapshot().then((cache) => {
        if (mounted) {
          setHasCompleteCache(Boolean(cache));
        }
      });
    };

    void run();
    if (typeof window !== "undefined") {
      window.addEventListener(
        "distync-offline-preparation-updated",
        handlePreparationUpdate,
      );
    }

    return () => {
      mounted = false;
      unsubscribeLifecycle();
      if (typeof window !== "undefined") {
        window.removeEventListener(
          "distync-offline-preparation-updated",
          handlePreparationUpdate,
        );
      }
    };
  }, [enabled, revision, roleCode, userId]);

  return {
    readiness,
    diagnostics,
    // NEEDS_REFRESH and PREPARING can still have a verified complete prior
    // snapshot. Keep supported offline work available while surfacing the
    // refresh state to the user; block only when the actual cache is absent.
    isReady: hasCompleteCache,
    hasCompleteCache,
    retry: () => {
      explicitRetryRef.current = true;
      refreshRequestedRef.current = true;
      setRevision((value) => value + 1);
    },
  };
};
