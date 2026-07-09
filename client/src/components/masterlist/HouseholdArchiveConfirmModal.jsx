import React from "react";
import { shellStyles } from "../layout/BarangayLayout";
import { pageHeaderStyles } from "../layout/PageHeader";

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
    maxWidth: "460px",
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
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
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
  photoName: {
    margin: "12px 0 0",
    color: "#17324d",
    fontWeight: 700,
    textAlign: "center",
  },
};

const HouseholdArchiveConfirmModal = ({
  isOpen,
  isSubmitting,
  isLoadingHouseholdDetails = false,
  familyHeadName = "",
  familyHeadPhotoUrl = "",
  onCancel,
  onConfirm,
  mode = "archive",
  restoreVariant = "readmit",
}) => {
  if (!isOpen) {
    return null;
  }

  const isRestoreMode = mode === "restore";
  const isAdmitVariant = restoreVariant === "admit";
  const title = isRestoreMode
    ? isAdmitVariant
      ? "Admit Household"
      : "Re-admit Household"
    : "Archive Household";
  const message = isRestoreMode
    ? isAdmitVariant
      ? "Are you sure this family should now be admitted to the evacuation center?"
      : "Are you sure this family has returned to the evacuation center?"
    : "Are you sure you want to archive this household?";
  const confirmLabel = isRestoreMode
    ? isAdmitVariant
      ? isSubmitting
        ? "Admitting Household..."
        : "Admit Household"
      : isSubmitting
        ? "Recording Re-admission..."
        : "Re-admit Household"
    : isSubmitting
      ? "Archiving..."
      : "Archive Household";
  if (!isRestoreMode) {
    return null;
  }

  return (
    <div style={modalStyles.overlay}>
      <div style={modalStyles.modal}>
        <h3 style={modalStyles.title}>{title}</h3>

        <p style={modalStyles.message}>{message}</p>

        <div style={modalStyles.photoSection}>
          {isLoadingHouseholdDetails ? (
            <p style={{ ...shellStyles.mutedText, margin: 0 }}>
              Loading registered family head photo...
            </p>
          ) : (
            <>
              {familyHeadPhotoUrl ? (
                <img
                  src={familyHeadPhotoUrl}
                  alt="Registered family head"
                  style={modalStyles.photoPreview}
                />
              ) : (
                <div style={modalStyles.photoPlaceholder}>No photo available</div>
              )}

              <p style={modalStyles.photoName}>{familyHeadName || "--"}</p>
            </>
          )}
        </div>

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
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HouseholdArchiveConfirmModal;
