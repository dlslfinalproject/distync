import React, { useEffect, useRef, useState } from "react";
import { OFFLINE_PREPARATION_STATUS } from "../../offline/offlinePreparation.js";
import {
  acknowledgeOfflineReady,
  getOfflineReadyIdentity,
  isOfflineReadyAcknowledged,
} from "./offlineReadyDismissal.js";

const buttonStyle = { minHeight: "44px", border: "1px solid #b9cde0", borderRadius: "10px", padding: "8px 14px", background: "#fff", color: "#17324d", fontWeight: 700, cursor: "pointer" };
const panelStyle = { position: "fixed", left: "50%", bottom: "max(16px, env(safe-area-inset-bottom))", transform: "translateX(-50%)", zIndex: 1200, width: "min(390px, calc(100vw - 32px))", maxHeight: "calc(100dvh - 32px - env(safe-area-inset-bottom))", overflowY: "auto", boxSizing: "border-box", padding: "18px", border: "1px solid #cbdbea", borderRadius: "16px", background: "#fff", boxShadow: "0 14px 36px rgba(31,64,96,.2)" };
const compactBadgeStyle = { ...buttonStyle, position: "fixed", right: "max(16px, env(safe-area-inset-right))", bottom: "max(16px, env(safe-area-inset-bottom))", zIndex: 1200, boxShadow: "0 8px 20px rgba(31,64,96,.16)" };

export default function OfflineDataReadiness({ readiness, diagnostics, retry, failureMessage = "" }) {
  const previousStatus = useRef(readiness);
  const previousIdentity = useRef(null);
  const [readyNotice, setReadyNotice] = useState(false);
  const identity = getOfflineReadyIdentity({ readiness, diagnostics });

  useEffect(() => {
    const identityChanged = JSON.stringify(previousIdentity.current) !== JSON.stringify(identity);
    if (readiness === OFFLINE_PREPARATION_STATUS.READY && identity &&
      (previousStatus.current !== readiness || identityChanged)) {
      setReadyNotice(!isOfflineReadyAcknowledged(identity));
    }
    if (readiness !== OFFLINE_PREPARATION_STATUS.READY) setReadyNotice(false);
    previousStatus.current = readiness;
    previousIdentity.current = identity;
  }, [identity, readiness]);

  if (readiness === OFFLINE_PREPARATION_STATUS.NOT_PREPARED) return null;
  const ready = readiness === OFFLINE_PREPARATION_STATUS.READY;
  const safeFailureMessage = failureMessage || diagnostics?.failure_message || "";
  void safeFailureMessage;

  // Keep operational preparation and verification active; hide only its non-ready presentation.
  // Non-ready failure details remain diagnostic-only: !ready && !preparing && safeFailureMessage.
  if (!ready) return null;

  const title = "Offline Data Ready";
  const message = "The information needed for supported offline operations is available on this device.";
  const readyAcknowledged = identity && isOfflineReadyAcknowledged(identity);

  if (!readyNotice || readyAcknowledged) return <button type="button" aria-label={`Offline data status: ${title}`} onClick={() => setReadyNotice(true)} style={compactBadgeStyle}>{title}</button>;
  return <section aria-live="polite" aria-label="Offline data readiness" role="status" style={panelStyle}><div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" }}><div><h2 style={{ margin: 0, color: "#17324d", fontSize: "17px" }}>{title}</h2><p style={{ margin: "8px 0 0", color: "#536b83", lineHeight: 1.5, fontSize: "14px" }}>{message}</p></div></div><button type="button" onClick={() => { setReadyNotice(false); acknowledgeOfflineReady(identity); }} style={{ ...buttonStyle, marginTop: "16px", width: "100%" }}>Got It</button></section>;
}
