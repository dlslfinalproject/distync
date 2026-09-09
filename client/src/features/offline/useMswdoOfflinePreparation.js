import { useEffect, useState } from "react";
import { getSyncQueueActorContext } from "../../offline/syncQueue.js";
import { ROLE_CODES } from "../../utils/roleSession.js";
import {
  getMswdoOfflinePreparation,
  prepareMswdoOfflineData,
  readMswdoOfflineSnapshot,
} from "./mswdoOfflinePreparation.js";

export const useMswdoOfflinePreparation = ({ enabled = false, userId = "", eventId = "" } = {}) => {
  const [readiness, setReadiness] = useState("NOT_PREPARED");
  const [diagnostics, setDiagnostics] = useState(null);
  const [revision, setRevision] = useState(0);
  const actor = getSyncQueueActorContext();

  useEffect(() => {
    if (!enabled || !userId || !eventId || actor.userId !== userId || actor.roleCode !== ROLE_CODES.MSWDO) {
      setReadiness("NOT_PREPARED");
      return undefined;
    }
    let mounted = true;
    const run = async () => {
      const existing = await getMswdoOfflinePreparation({ userId, eventId });
      if (!mounted) return;
      setDiagnostics(existing);
      const snapshot = await readMswdoOfflineSnapshot({ userId, eventId });
      if (snapshot) {
        setReadiness(snapshot.status);
        if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      } else if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setReadiness("NOT_READY");
        return;
      }
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      setReadiness("PREPARING");
      try {
        const prepared = await prepareMswdoOfflineData({ userId, eventId });
        if (mounted) { setDiagnostics(prepared); setReadiness(prepared?.status || "NOT_READY"); }
      } catch (_error) {
        if (mounted) setReadiness(existing?.previous_complete_cache ? "NEEDS_REFRESH" : "NOT_READY");
      }
    };
    const update = (event) => {
      if (mounted && event.detail?.userId === userId && event.detail?.disaster_event_id === eventId) {
        setDiagnostics(event.detail); setReadiness(event.detail.status || "NOT_READY");
      }
    };
    const rerun = () => setRevision((value) => value + 1);
    run();
    window?.addEventListener?.("online", rerun);
    window?.addEventListener?.("distync-mswdo-offline-preparation-updated", update);
    return () => {
      mounted = false;
      window?.removeEventListener?.("online", rerun);
      window?.removeEventListener?.("distync-mswdo-offline-preparation-updated", update);
    };
  }, [actor.accessMode, actor.roleCode, actor.userId, enabled, eventId, revision, userId]);

  return { readiness, diagnostics, isReady: readiness === "READY", retry: () => setRevision((value) => value + 1) };
};

