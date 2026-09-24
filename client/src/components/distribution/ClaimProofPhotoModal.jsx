import React, { useEffect, useState } from "react";
import { fetchClaimProofPhoto } from "../../features/distribution/distributionService.js";

const ClaimProofPhotoModal = ({
  isOpen,
  transactionId,
  context = null,
  onClose,
}) => {
  const [proof, setProof] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !transactionId) {
      setProof(null);
      setErrorMessage("");
      return undefined;
    }

    let cancelled = false;
    setProof(null);
    setErrorMessage("");
    setIsLoading(true);
    fetchClaimProofPhoto(transactionId)
      .then((response) => {
        if (!cancelled) {
          setProof(response?.data || null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage(error?.message || "Proof photo unavailable.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
      setProof(null);
    };
  }, [isOpen, transactionId]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        background: "rgba(18, 34, 51, 0.58)",
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Claim receipt proof photo"
        style={{
          width: "min(760px, 100%)",
          maxHeight: "calc(100vh - 40px)",
          overflowY: "auto",
          padding: "22px",
          borderRadius: "18px",
          boxSizing: "border-box",
          background: "#ffffff",
          boxShadow: "0 24px 48px rgba(20, 48, 78, 0.24)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "16px" }}>
          <div>
            <h2 style={{ margin: 0, color: "#17324d", fontSize: "22px" }}>
              Claim Receipt Proof
            </h2>
            {context ? (
              <p style={{ margin: "8px 0 0", color: "#60738a", fontSize: "14px" }}>
                {[context.familyHeadName, context.stubNo].filter(Boolean).join(" · ")}
              </p>
            ) : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close proof photo">
            Close
          </button>
        </div>
        {isLoading ? (
          <p style={{ margin: "20px 0 0", color: "#60738a" }}>Loading proof photo…</p>
        ) : errorMessage ? (
          <p role="alert" style={{ margin: "20px 0 0", color: "#a14d58" }}>
            {errorMessage}
          </p>
        ) : proof?.url ? (
          <>
            <img
              src={proof.url}
              alt="Photo captured during relief handoff"
              referrerPolicy="no-referrer"
              style={{
                display: "block",
                width: "100%",
                maxHeight: "65vh",
                objectFit: "contain",
                marginTop: "18px",
                borderRadius: "12px",
                background: "#152536",
              }}
            />
            <p style={{ margin: "12px 0 0", color: "#60738a", fontSize: "13px" }}>
              Captured: {proof.captured_at ? new Date(proof.captured_at).toLocaleString() : "Not recorded"}
              {proof.received_at ? ` · Received: ${new Date(proof.received_at).toLocaleString()}` : ""}
            </p>
          </>
        ) : (
          <p style={{ margin: "20px 0 0", color: "#60738a" }}>Proof photo unavailable.</p>
        )}
      </section>
    </div>
  );
};

export default ClaimProofPhotoModal;
