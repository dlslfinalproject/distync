import React from "react";
import { pageHeaderStyles } from "../layout/PageHeader";
import { shellStyles } from "../layout/BarangayLayout";
import QrCodePanel from "./QrCodePanel";

const modalStyles = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(18, 34, 51, 0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    zIndex: 1200,
  },
  modal: {
    width: "100%",
    maxWidth: "420px",
    backgroundColor: "#ffffff",
    borderRadius: "20px",
    padding: "28px",
    boxShadow: "0 24px 48px rgba(20, 48, 78, 0.2)",
  },
  title: {
    margin: 0,
    color: "#17324d",
    fontSize: "22px",
  },
  message: {
    margin: "12px 0 0",
    color: "#5d7188",
    fontSize: "15px",
    lineHeight: 1.6,
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    marginTop: "24px",
    flexWrap: "wrap",
  },
  photoSection: {
    marginTop: "20px",
    padding: "16px",
    borderRadius: "16px",
    border: "1px solid #e1eaf3",
    backgroundColor: "#f8fbfe",
  },
  photoPreview: {
    width: "100%",
    maxWidth: "220px",
    aspectRatio: "4 / 3",
    objectFit: "cover",
    borderRadius: "14px",
    border: "1px solid #d5e0ea",
    backgroundColor: "#eaf2f8",
  },
  photoPlaceholder: {
    width: "100%",
    maxWidth: "220px",
    aspectRatio: "4 / 3",
    borderRadius: "14px",
    border: "1px dashed #cbd9e7",
    backgroundColor: "#f3f8fc",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#698099",
    fontSize: "13px",
    fontWeight: 600,
    textAlign: "center",
    padding: "14px",
    boxSizing: "border-box",
  },
};

const formatPhotoCapturedAt = (value) => {
  if (!value) {
    return "";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsedDate);
};

const StubClaimConfirmModal = ({
  isOpen,
  isSubmitting,
  isLoadingStubDetails = false,
  onCancel,
  onConfirm,
  selectedCount = 1,
  stubDetails = null,
}) => {
  if (!isOpen) {
    return null;
  }

  const message =
    selectedCount > 1
      ? "Are you sure the selected stubs have been claimed?"
      : "Are you sure this stub has been claimed?";

  return (
    <div style={modalStyles.overlay}>
      <div style={modalStyles.modal}>
        <h3 style={modalStyles.title}>Confirm Relief Distribution</h3>
        <p style={modalStyles.message}>{message}</p>

        {selectedCount === 1 ? (
          <div style={modalStyles.photoSection}>
            <p
              style={{
                margin: 0,
                color: "#60738a",
                fontSize: "12px",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 700,
              }}
            >
              Family Head Photo Verification
            </p>

            <p style={{ margin: "10px 0 0", color: "#17324d", fontWeight: 700 }}>
              {stubDetails?.household?.family_head_name || "--"}
            </p>

            <div style={{ marginTop: "14px" }}>
              {isLoadingStubDetails ? (
                <p style={{ ...shellStyles.mutedText, margin: 0 }}>
                  Loading registered family head photo...
                </p>
              ) : stubDetails?.household?.family_head_photo_url ? (
                <img
                  src={stubDetails.household.family_head_photo_url}
                  alt="Registered family head"
                  style={modalStyles.photoPreview}
                />
              ) : (
                <div style={modalStyles.photoPlaceholder}>No photo available</div>
              )}
            </div>

            {stubDetails?.household?.photo_captured_at ? (
              <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
                Captured: {formatPhotoCapturedAt(stubDetails.household.photo_captured_at)}
              </p>
            ) : null}

            {stubDetails?.household?.photo_verification_notes ? (
              <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
                Notes: {stubDetails.household.photo_verification_notes}
              </p>
            ) : null}

            <div style={{ marginTop: "16px" }}>
              <QrCodePanel
                value={stubDetails?.qr_code_value || ""}
                emptyLabel="No QR available"
              />
            </div>
          </div>
        ) : null}

        <div style={modalStyles.actions}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            style={{
              ...pageHeaderStyles.secondaryButton,
              opacity: isSubmitting ? 0.7 : 1,
              cursor: isSubmitting ? "not-allowed" : "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            style={{
              ...pageHeaderStyles.primaryButton,
              opacity: isSubmitting ? 0.7 : 1,
              cursor: isSubmitting ? "wait" : "pointer",
            }}
          >
            {isSubmitting ? "Marking as Claimed..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StubClaimConfirmModal;
