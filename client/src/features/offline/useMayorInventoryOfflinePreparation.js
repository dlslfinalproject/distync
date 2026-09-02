import { useEffect, useState } from "react";
import { ROLE_CODES } from "../../utils/roleSession.js";
import {
  getMayorInventoryCacheSnapshot,
} from "../../offline/mayorInventoryCache.js";
import {
  getMayorInventoryPreparation,
  MAYOR_INVENTORY_PREPARATION_STATUS,
  prepareMayorInventoryOfflineData,
} from "../../offline/mayorInventoryPreparation.js";

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

  useEffect(() => {
    if (!enabled || roleCode !== ROLE_CODES.MAYOR || !userId) {
      setReadiness(MAYOR_INVENTORY_PREPARATION_STATUS.NOT_PREPARED);
      setDiagnostics(null);
      setHasCompleteCache(false);
      return undefined;
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

      // Readiness is derived from an actual complete cache read, not merely
      // from a flag left behind by an interrupted preparation run.
      if (cache) {
        setReadiness(
          preparation?.status === MAYOR_INVENTORY_PREPARATION_STATUS.NEEDS_REFRESH
            ? MAYOR_INVENTORY_PREPARATION_STATUS.NEEDS_REFRESH
            : MAYOR_INVENTORY_PREPARATION_STATUS.READY,
        );
        return;
      }

      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setReadiness(MAYOR_INVENTORY_PREPARATION_STATUS.NOT_READY);
        return;
      }

      setReadiness(MAYOR_INVENTORY_PREPARATION_STATUS.PREPARING);

      try {
        const result = await prepareMayorInventoryOfflineData({ userId });
        if (mounted) {
          setDiagnostics(result?.diagnostics || null);
          const verifiedCache = await getMayorInventoryCacheSnapshot();
          if (!mounted) {
            return;
          }
          setHasCompleteCache(Boolean(verifiedCache));
          setReadiness(
            result?.status || MAYOR_INVENTORY_PREPARATION_STATUS.READY,
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

    const handleOnline = () => setRevision((value) => value + 1);

    void run();
    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
      window.addEventListener(
        "distync-offline-preparation-updated",
        handlePreparationUpdate,
      );
    }

    return () => {
      mounted = false;
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
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
    retry: () => setRevision((value) => value + 1),
  };
};
