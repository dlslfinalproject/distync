import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { OFFLINE_PREPARATION_STATUS } from "../../offline/offlinePreparation.js";

export const MayorOfflineReadyDismissalContext = createContext(null);

export const useMayorOfflineReadyDismissal = () =>
  useContext(MayorOfflineReadyDismissalContext);

const buttonStyle = { minHeight: "44px", border: "1px solid #b9cde0", borderRadius: "10px", padding: "8px 14px", background: "#fff", color: "#17324d", fontWeight: 700, cursor: "pointer" };
const panelStyle = { position: "fixed", right: "max(16px, env(safe-area-inset-right))", bottom: "max(16px, env(safe-area-inset-bottom))", zIndex: 1200, width: "min(390px, calc(100vw - 32px))", boxSizing: "border-box", padding: "18px", border: "1px solid #cbdbea", borderRadius: "16px", background: "#fff", boxShadow: "0 14px 36px rgba(31,64,96,.2)" };

export default function OfflineDataReadiness({
  readiness,
  diagnostics,
  retry,
  variant = "barangay",
}) {
  const mayorDismissal = useMayorOfflineReadyDismissal();
  const previous = useRef(readiness);
  const [dismissed, setDismissed] = useState(false);
  const [readyNotice, setReadyNotice] = useState(false);
  useEffect(() => {
    if (readiness === OFFLINE_PREPARATION_STATUS.READY && previous.current !== readiness) { setDismissed(false); setReadyNotice(true); }
    if (readiness === OFFLINE_PREPARATION_STATUS.PREPARING) setDismissed(false);
    if (readiness !== OFFLINE_PREPARATION_STATUS.READY) mayorDismissal?.reset();
    previous.current = readiness;
  }, [mayorDismissal, readiness]);
  if (readiness === OFFLINE_PREPARATION_STATUS.NOT_PREPARED) return null;
  const ready = readiness === OFFLINE_PREPARATION_STATUS.READY;
  const preparing = readiness === OFFLINE_PREPARATION_STATUS.PREPARING;
  const previousCache = Boolean(diagnostics?.previousCompleteCache || diagnostics?.previous_complete_cache);
  const isMayorInventory = variant === "mayor-inventory";
  const title = preparing
    ? isMayorInventory
      ? "Preparing Mayor Inventory Offline Data"
      : "Preparing Offline Data"
    : ready
      ? isMayorInventory
        ? "Mayor Inventory Offline Ready"
        : "Offline Data Ready"
      : previousCache
        ? isMayorInventory
          ? "Mayor Inventory Needs Refresh"
          : "Offline Data Needs Refresh"
        : isMayorInventory
          ? "Mayor Inventory Offline Not Ready"
          : "Offline Data Not Ready";
  const message = preparing
    ? isMayorInventory
      ? "DISTYNC is saving the complete inventory, batch, transaction, and barcode reference data needed for offline stock-in. Keep this device online until preparation is complete."
      : "DISTYNC is preparing the information needed for offline use. Keep this device online until preparation is complete."
    : ready
      ? isMayorInventory
        ? "Complete inventory reference data is saved on this device. You can use the supported manual and scanner stock-in flow offline."
        : "The information needed for supported offline operations is available on this device."
      : previousCache
        ? isMayorInventory
          ? "The previously saved inventory data is still available on this device, but the latest refresh could not be completed."
          : "Previously prepared offline data is still available, but the latest update could not be completed."
        : isMayorInventory
          ? "The complete inventory data is not saved on this device yet. Connect to DISTYNC and prepare offline data before relying on offline stock-in."
          : "Some information needed for offline use could not be prepared. Keep the device online and try again.";
  const readyAcknowledged = isMayorInventory && mayorDismissal?.isAcknowledged;
  if (dismissed || (ready && (!readyNotice || readyAcknowledged))) return <button type="button" aria-label={`Offline data status: ${title}`} onClick={() => { setDismissed(false); setReadyNotice(true); }} style={{ ...buttonStyle, position: "fixed", right: "max(16px, env(safe-area-inset-right))", bottom: "max(16px, env(safe-area-inset-bottom))", zIndex: 1200, boxShadow: "0 8px 20px rgba(31,64,96,.16)" }}>{title}</button>;
  return <section aria-live="polite" aria-label="Offline data readiness" role="status" style={panelStyle}><div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" }}><div><h2 style={{ margin: 0, color: "#17324d", fontSize: "17px" }}>{title}</h2><p style={{ margin: "8px 0 0", color: "#536b83", lineHeight: 1.5, fontSize: "14px" }}>{message}</p></div>{preparing ? <button type="button" onClick={() => setDismissed(true)} style={{ ...buttonStyle, minHeight: "36px", padding: "4px 10px" }}>Hide</button> : null}</div>{preparing ? <p style={{ margin: "16px 0 0", color: "#536b83", fontSize: "13px" }}>{isMayorInventory ? "Saving all inventory dependencies and verifying local read-back…" : "Preparing records for the current disaster event…"}</p> : null}{ready && readyNotice ? <button type="button" onClick={() => { setReadyNotice(false); setDismissed(true); mayorDismissal?.acknowledge(); }} style={{ ...buttonStyle, marginTop: "16px", width: "100%" }}>Got It</button> : null}{!ready && !preparing ? <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}><button type="button" onClick={retry} style={{ ...buttonStyle, flex: 1 }}>Try Again</button><button type="button" onClick={() => setDismissed(true)} style={{ ...buttonStyle, flex: 1 }}>Close</button></div> : null}</section>;
}
const panel = {
  position: "fixed",
  right: "max(16px, env(safe-area-inset-right))",
  bottom: "max(16px, env(safe-area-inset-bottom))",
  zIndex: 1200,
  width: "min(390px, calc(100vw - 32px))",
  boxSizing: "border-box",
  padding: "18px",
  border: "1px solid #cbdbea",
  borderRadius: "16px",
  background: "#ffffff",
  boxShadow: "0 14px 36px rgba(31, 64, 96, 0.2)",
};

const button = {
  minHeight: "44px",
  border: "1px solid #b9cde0",
  borderRadius: "10px",
  padding: "8px 14px",
  background: "#ffffff",
  color: "#17324d",
  fontWeight: 700,
  cursor: "pointer",
};

function OfflineDataReadinessReleaseReference({ readiness, diagnostics, retry }) {
  const previousStatus = useRef(readiness);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showReadyNotice, setShowReadyNotice] = useState(false);

  useEffect(() => {
    if (readiness === OFFLINE_PREPARATION_STATUS.READY && previousStatus.current !== readiness) {
      setIsDismissed(false);
      setShowReadyNotice(true);
    }
    if (readiness === OFFLINE_PREPARATION_STATUS.PREPARING) setIsDismissed(false);
    previousStatus.current = readiness;
  }, [readiness]);

  if (readiness === OFFLINE_PREPARATION_STATUS.NOT_PREPARED) return null;
  const isReady = readiness === OFFLINE_PREPARATION_STATUS.READY;
  const isPreparing = readiness === OFFLINE_PREPARATION_STATUS.PREPARING;
  const hasPrevious = Boolean(diagnostics?.previousCompleteCache || diagnostics?.previous_complete_cache);
  const title = isPreparing ? "Preparing Offline Data" : isReady ? "Offline Data Ready" : hasPrevious ? "Offline Data Needs Refresh" : "Offline Data Not Ready";
  const message = isPreparing
    ? "DISTYNC is preparing the information needed for offline use. Keep this device online until preparation is complete."
    : isReady
      ? "The information needed for supported offline operations is available on this device."
      : hasPrevious
        ? "Previously prepared offline data is still available, but the latest update could not be completed."
        : "Some information needed for offline use could not be prepared. Keep the device online and try again.";

  if (isReady && !showReadyNotice) {
    return (
      <button type="button" aria-label="Offline data status: ready" onClick={() => setShowReadyNotice(true)} style={{ ...button, position: "fixed", right: "max(16px, env(safe-area-inset-right))", bottom: "max(16px, env(safe-area-inset-bottom))", zIndex: 1200, boxShadow: "0 8px 20px rgba(31, 64, 96, 0.16)" }}>Offline Data Ready</button>
    );
  }

  if (isDismissed) {
    return (
      <button type="button" aria-label={`Offline data status: ${title}`} onClick={() => setIsDismissed(false)} style={{ ...button, position: "fixed", right: "max(16px, env(safe-area-inset-right))", bottom: "max(16px, env(safe-area-inset-bottom))", zIndex: 1200, boxShadow: "0 8px 20px rgba(31, 64, 96, 0.16)" }}>{title}</button>
    );
  }

  return (
    <section aria-live="polite" aria-label="Offline data readiness" role="status" style={panel}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, color: "#17324d", fontSize: "17px" }}>{title}</h2>
          <p style={{ margin: "8px 0 0", color: "#536b83", lineHeight: 1.5, fontSize: "14px" }}>{message}</p>
        </div>
        {isPreparing ? <button type="button" aria-label="Minimize offline data status" onClick={() => setIsDismissed(true)} style={{ ...button, minHeight: "36px", padding: "4px 10px" }}>Hide</button> : null}
      </div>
      {isPreparing ? <div aria-label="Offline data preparation in progress" style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "16px", color: "#536b83", fontSize: "13px" }}><span aria-hidden="true" style={{ width: "16px", height: "16px", border: "3px solid #d8e6f2", borderTopColor: "#2f80b7", borderRadius: "50%", animation: "distync-offline-spinner 0.9s linear infinite" }} />Preparing records for the current disaster event…</div> : null}
      {isReady && showReadyNotice ? <button type="button" onClick={() => { setShowReadyNotice(false); setIsDismissed(true); }} style={{ ...button, marginTop: "16px", width: "100%" }}>Got It</button> : null}
      {!isReady && !isPreparing ? <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}><button type="button" onClick={retry} style={{ ...button, flex: "1 1 auto" }}>Try Again</button><button type="button" onClick={() => setIsDismissed(true)} style={{ ...button, flex: "1 1 auto" }}>Close</button></div> : null}
    </section>
  );
}
