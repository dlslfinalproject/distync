import React, { useEffect, useRef, useState } from "react";
import { OFFLINE_PREPARATION_STATUS } from "../../offline/offlinePreparation.js";

const buttonStyle = { minHeight: "44px", border: "1px solid #b9cde0", borderRadius: "10px", padding: "8px 14px", background: "#fff", color: "#17324d", fontWeight: 700, cursor: "pointer" };
const panelStyle = { position: "fixed", right: "max(16px, env(safe-area-inset-right))", bottom: "max(16px, env(safe-area-inset-bottom))", zIndex: 1200, width: "min(390px, calc(100vw - 32px))", boxSizing: "border-box", padding: "18px", border: "1px solid #cbdbea", borderRadius: "16px", background: "#fff", boxShadow: "0 14px 36px rgba(31,64,96,.2)" };

export default function OfflineDataReadiness({ readiness, diagnostics, retry }) {
  const previous = useRef(readiness);
  const [dismissed, setDismissed] = useState(false);
  const [readyNotice, setReadyNotice] = useState(false);
  useEffect(() => {
    if (readiness === OFFLINE_PREPARATION_STATUS.READY && previous.current !== readiness) { setDismissed(false); setReadyNotice(true); }
    if (readiness === OFFLINE_PREPARATION_STATUS.PREPARING) setDismissed(false);
    previous.current = readiness;
  }, [readiness]);
  if (readiness === OFFLINE_PREPARATION_STATUS.NOT_PREPARED) return null;
  const ready = readiness === OFFLINE_PREPARATION_STATUS.READY;
  const preparing = readiness === OFFLINE_PREPARATION_STATUS.PREPARING;
  const previousCache = Boolean(diagnostics?.previousCompleteCache || diagnostics?.previous_complete_cache);
  const title = preparing ? "Preparing Offline Data" : ready ? "Offline Data Ready" : previousCache ? "Offline Data Needs Refresh" : "Offline Data Not Ready";
  const message = preparing ? "DISTYNC is preparing the information needed for offline use. Keep this device online until preparation is complete." : ready ? "The information needed for supported offline operations is available on this device." : previousCache ? "Previously prepared offline data is still available, but the latest update could not be completed." : "Some information needed for offline use could not be prepared. Keep the device online and try again.";
  if (dismissed || (ready && !readyNotice)) return <button type="button" aria-label={`Offline data status: ${title}`} onClick={() => { setDismissed(false); setReadyNotice(true); }} style={{ ...buttonStyle, position: "fixed", right: "max(16px, env(safe-area-inset-right))", bottom: "max(16px, env(safe-area-inset-bottom))", zIndex: 1200, boxShadow: "0 8px 20px rgba(31,64,96,.16)" }}>{title}</button>;
  return <section aria-live="polite" aria-label="Offline data readiness" role="status" style={panelStyle}><div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" }}><div><h2 style={{ margin: 0, color: "#17324d", fontSize: "17px" }}>{title}</h2><p style={{ margin: "8px 0 0", color: "#536b83", lineHeight: 1.5, fontSize: "14px" }}>{message}</p></div>{preparing ? <button type="button" onClick={() => setDismissed(true)} style={{ ...buttonStyle, minHeight: "36px", padding: "4px 10px" }}>Hide</button> : null}</div>{preparing ? <p style={{ margin: "16px 0 0", color: "#536b83", fontSize: "13px" }}>Preparing records for the current disaster event…</p> : null}{ready && readyNotice ? <button type="button" onClick={() => { setReadyNotice(false); setDismissed(true); }} style={{ ...buttonStyle, marginTop: "16px", width: "100%" }}>Got It</button> : null}{!ready && !preparing ? <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}><button type="button" onClick={retry} style={{ ...buttonStyle, flex: 1 }}>Try Again</button><button type="button" onClick={() => setDismissed(true)} style={{ ...buttonStyle, flex: 1 }}>Close</button></div> : null}</section>;
}
