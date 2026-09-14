import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { OFFLINE_PREPARATION_STATUS } from "../../offline/offlinePreparation.js";

export const MayorOfflineReadyDismissalContext = createContext(null);
export const useMayorOfflineReadyDismissal = () => useContext(MayorOfflineReadyDismissalContext);

const buttonStyle = { minHeight: "44px", border: "1px solid #b9cde0", borderRadius: "10px", padding: "8px 14px", background: "#fff", color: "#17324d", fontWeight: 700, cursor: "pointer" };
const panelStyle = { position: "fixed", right: "max(16px, env(safe-area-inset-right))", bottom: "max(16px, env(safe-area-inset-bottom))", zIndex: 1200, width: "min(390px, calc(100vw - 32px))", boxSizing: "border-box", padding: "18px", border: "1px solid #cbdbea", borderRadius: "16px", background: "#fff", boxShadow: "0 14px 36px rgba(31,64,96,.2)" };

export default function OfflineDataReadiness({ readiness, diagnostics, retry, failureMessage = "", variant = "barangay" }) {
  const mayorDismissal = useMayorOfflineReadyDismissal();
  const previousStatus = useRef(readiness);
  const [dismissed, setDismissed] = useState(false);
  const [readyNotice, setReadyNotice] = useState(false);

  useEffect(() => {
    if (readiness === OFFLINE_PREPARATION_STATUS.READY && previousStatus.current !== readiness) { setDismissed(false); setReadyNotice(true); }
    if (readiness === OFFLINE_PREPARATION_STATUS.PREPARING) setDismissed(false);
    previousStatus.current = readiness;
  }, [readiness]);

  if (readiness === OFFLINE_PREPARATION_STATUS.NOT_PREPARED) return null;
  const ready = readiness === OFFLINE_PREPARATION_STATUS.READY;
  const preparing = readiness === OFFLINE_PREPARATION_STATUS.PREPARING;
  const previousCache = Boolean(diagnostics?.previousCompleteCache || diagnostics?.previous_complete_cache);
  const isMayorInventory = variant === "mayor-inventory";
  const isBarangayOrMswdo = variant === "barangay" || variant === "mswdo";

  // Keep operational preparation and verification active; hide only its non-ready presentation.
  if (isBarangayOrMswdo && !ready) return null;
  if (isMayorInventory && preparing) return null;

  const title = ready
    ? isMayorInventory
      ? "Offline Data Ready"
      : "Offline Data Ready"
    : previousCache
      ? "Mayor Inventory Needs Refresh"
      : "Mayor Inventory Offline Not Ready";
  const message = ready
    ? isMayorInventory
      ? "The information needed for supported offline operations is available on this device."
      : "The information needed for supported offline operations is available on this device."
    : previousCache
      ? "The previously saved inventory data is still available on this device, but the latest refresh could not be completed."
      : "The complete inventory data is not saved on this device yet. Connect to DISTYNC and prepare offline data before relying on offline stock-in.";
  const safeFailureMessage = failureMessage || diagnostics?.failure_message || "";
  const readyAcknowledged = isMayorInventory && mayorDismissal?.isAcknowledged;

  if (dismissed || (ready && (!readyNotice || readyAcknowledged))) return <button type="button" aria-label={`Offline data status: ${title}`} onClick={() => { setDismissed(false); setReadyNotice(true); }} style={{ ...buttonStyle, position: "fixed", right: "max(16px, env(safe-area-inset-right))", bottom: "max(16px, env(safe-area-inset-bottom))", zIndex: 1200, boxShadow: "0 8px 20px rgba(31,64,96,.16)" }}>{title}</button>;
  return <section aria-live="polite" aria-label="Offline data readiness" role="status" style={panelStyle}><div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" }}><div><h2 style={{ margin: 0, color: "#17324d", fontSize: "17px" }}>{title}</h2><p style={{ margin: "8px 0 0", color: "#536b83", lineHeight: 1.5, fontSize: "14px" }}>{message}</p>{!ready && !preparing && safeFailureMessage ? <p style={{ margin: "8px 0 0", color: "#536b83", lineHeight: 1.5, fontSize: "14px" }}>{safeFailureMessage}</p> : null}</div></div>{ready && readyNotice ? <button type="button" onClick={() => { setReadyNotice(false); setDismissed(true); mayorDismissal?.acknowledge(); }} style={{ ...buttonStyle, marginTop: "16px", width: "100%" }}>Got It</button> : null}{!ready && !preparing ? <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}><button type="button" onClick={retry} style={{ ...buttonStyle, flex: 1 }}>Try Again</button><button type="button" onClick={() => setDismissed(true)} style={{ ...buttonStyle, flex: 1 }}>Close</button></div> : null}</section>;
}
