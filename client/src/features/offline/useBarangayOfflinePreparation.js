import { useEffect, useState } from "react";
import {
  getOfflinePreparation,
  OFFLINE_PREPARATION_STATUS,
  prepareBarangayOfflineData,
} from "../../offline/offlinePreparation.js";

export const useBarangayOfflinePreparation = ({ enabled = true, userId = "", eventId = "", barangayId = "" }) => {
  const [readiness, setReadiness] = useState(OFFLINE_PREPARATION_STATUS.NOT_PREPARED);
  const [onlineRevision, setOnlineRevision] = useState(0);
  useEffect(() => {
    if (!enabled || !userId || !eventId || !barangayId) {
      setReadiness(OFFLINE_PREPARATION_STATUS.NOT_PREPARED);
      return undefined;
    }
    let mounted = true;
    const scope = { eventId, barangayId };
    const prepare = async () => {
      const entry = await getOfflinePreparation(scope);
      if (entry?.status === OFFLINE_PREPARATION_STATUS.READY) {
        if (mounted) setReadiness(OFFLINE_PREPARATION_STATUS.READY);
        return;
      }
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        if (mounted) setReadiness(OFFLINE_PREPARATION_STATUS.PARTIAL);
        return;
      }
      if (mounted) setReadiness(OFFLINE_PREPARATION_STATUS.PREPARING);
      prepareBarangayOfflineData({ ...scope, userId })
        .then((result) => { if (mounted) setReadiness(result?.status || OFFLINE_PREPARATION_STATUS.READY); })
        .catch(() => { if (mounted) setReadiness(OFFLINE_PREPARATION_STATUS.PARTIAL); });
    };
    prepare();
    const handleOnline = () => setOnlineRevision((revision) => revision + 1);
    if (typeof window !== "undefined") window.addEventListener("online", handleOnline);
    return () => {
      mounted = false;
      if (typeof window !== "undefined") window.removeEventListener("online", handleOnline);
    };
  }, [barangayId, enabled, eventId, onlineRevision, userId]);
  return { readiness, isReady: readiness === OFFLINE_PREPARATION_STATUS.READY };
};
