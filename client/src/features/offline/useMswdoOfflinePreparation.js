import { useEffect, useRef, useState } from "react";
import { getSyncQueueActorContext } from "../../offline/syncQueue.js";
import { ROLE_CODES } from "../../utils/roleSession.js";
import {
  getMswdoOfflineScopeKey,
  getMswdoOfflinePreparation,
  getMswdoPreparationFailureMessage,
  prepareMswdoOfflineData,
  readMswdoOfflineSnapshot,
  setCurrentMswdoOfflineScope,
} from "./mswdoOfflinePreparation.js";

export const useMswdoOfflinePreparation = ({ enabled = false, userId = "", eventId = "" } = {}) => {
  const [readiness, setReadiness] = useState("NOT_PREPARED");
  const [diagnostics, setDiagnostics] = useState(null);
  const [revision, setRevision] = useState(0);
  const generationRef = useRef(0);
  const retryScopeRef = useRef(null);
  const actor = getSyncQueueActorContext();
  const currentScopeKey = userId && eventId
    ? getMswdoOfflineScopeKey({ userId, eventId, mode: actor.accessMode })
    : "";
  if (retryScopeRef.current?.scopeKey && retryScopeRef.current.scopeKey !== currentScopeKey) {
    retryScopeRef.current = null;
  }

  useEffect(() => {
    if (!enabled || !userId || !eventId || actor.userId !== userId || actor.roleCode !== ROLE_CODES.MSWDO) {
      setReadiness("NOT_PREPARED");
      return undefined;
    }
    let mounted = true;
    const generation = ++generationRef.current;
    const scopeKey = getMswdoOfflineScopeKey({ userId, eventId, mode: actor.accessMode });
    setCurrentMswdoOfflineScope({ userId, eventId });
    const isCurrent = () => mounted && generationRef.current === generation;
    const explicitRefreshRequested = retryScopeRef.current?.scopeKey === scopeKey;
    const run = async () => {
      const existing = await getMswdoOfflinePreparation({ userId, eventId });
      if (!isCurrent()) return;
      setDiagnostics(existing);
      const snapshot = await readMswdoOfflineSnapshot({ userId, eventId });
      if (!isCurrent()) return;
      if (snapshot) {
        setReadiness(snapshot.status);
      }
      const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;
      if (isOffline) {
        if (!snapshot) {
          setReadiness("NOT_READY");
        }
        return;
      }
      if (snapshot?.status === "READY" && !explicitRefreshRequested) {
        setReadiness("READY");
        return;
      }
      setReadiness("PREPARING");
      try {
        const prepared = await prepareMswdoOfflineData({ userId, eventId, generation });
        if (!isCurrent()) return;
        if (prepared?.stale) {
          setReadiness("PREPARING");
          setRevision((value) => value + 1);
          return;
        }
        setDiagnostics(prepared);
        setReadiness(prepared?.status || "NOT_READY");
      } catch (error) {
        if (isCurrent()) {
          const failed = await getMswdoOfflinePreparation({ userId, eventId });
          if (!isCurrent()) return;
          setDiagnostics(failed || { failure_stage: error?.stage || "PREPARATION_METADATA", failure_message: error?.message || getMswdoPreparationFailureMessage("PREPARATION_METADATA") });
          setReadiness(existing?.previous_complete_cache ? "NEEDS_REFRESH" : "NOT_READY");
        }
      } finally {
        if (isCurrent() && retryScopeRef.current?.scopeKey === scopeKey) {
          retryScopeRef.current = null;
        }
      }
    };
    const update = (event) => {
      if (
        isCurrent() &&
        event.detail?.generation === generation &&
        event.detail?.accessMode === actor.accessMode &&
        event.detail?.userId === userId &&
        event.detail?.roleCode === ROLE_CODES.MSWDO &&
        String(event.detail?.disaster_event_id || "") === String(eventId)
      ) {
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

  const failureStage = diagnostics?.failure_stage || "";
  return {
    readiness,
    diagnostics,
    failureStage,
    failureMessage: diagnostics?.failure_message ||
      (failureStage ? getMswdoPreparationFailureMessage(failureStage) : ""),
    isReady: readiness === "READY",
    retry: () => {
      retryScopeRef.current = { scopeKey: currentScopeKey };
      setRevision((value) => value + 1);
    },
  };
};

