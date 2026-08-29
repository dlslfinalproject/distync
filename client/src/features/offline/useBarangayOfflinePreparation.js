import { useEffect, useState } from "react";
import { getOfflinePreparation, OFFLINE_PREPARATION_STATUS, prepareBarangayOfflineData } from "../../offline/offlinePreparation.js";

export const useBarangayOfflinePreparation = ({ enabled = true, userId = "", eventId = "", barangayId = "", context = {} }) => {
  const [readiness, setReadiness] = useState(OFFLINE_PREPARATION_STATUS.NOT_PREPARED);
  const [diagnostics, setDiagnostics] = useState(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled || !userId || !eventId || !barangayId) {
      setReadiness(OFFLINE_PREPARATION_STATUS.NOT_PREPARED);
      return undefined;
    }
    let mounted = true;
    const scope = { eventId, barangayId };
    const run = async () => {
      const existing = await getOfflinePreparation(scope);
      if (mounted && existing) setDiagnostics(existing);
      if (existing?.status === OFFLINE_PREPARATION_STATUS.READY) {
        if (mounted) setReadiness(OFFLINE_PREPARATION_STATUS.READY);
        return;
      }
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        if (mounted) setReadiness(OFFLINE_PREPARATION_STATUS.PARTIAL);
        return;
      }
      if (mounted) setReadiness(OFFLINE_PREPARATION_STATUS.PREPARING);
      try {
        const result = await prepareBarangayOfflineData({ ...scope, userId, context });
        if (mounted) setReadiness(result?.status || OFFLINE_PREPARATION_STATUS.READY);
      } catch (_error) {
        if (mounted) setReadiness(OFFLINE_PREPARATION_STATUS.PARTIAL);
      }
    };
    const update = (event) => { if (mounted) { setDiagnostics(event.detail || null); if (event.detail?.status) setReadiness(event.detail.status); } };
    const online = () => setRevision((value) => value + 1);
    run();
    if (typeof window !== "undefined") {
      window.addEventListener("online", online);
      window.addEventListener("distync-offline-preparation-updated", update);
    }
    return () => {
      mounted = false;
      if (typeof window !== "undefined") {
        window.removeEventListener("online", online);
        window.removeEventListener("distync-offline-preparation-updated", update);
      }
    };
  }, [barangayId, context, enabled, eventId, revision, userId]);
  return { readiness, diagnostics, isReady: readiness === OFFLINE_PREPARATION_STATUS.READY, retry: () => setRevision((value) => value + 1) };
};
