import React from "react";
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
    maxWidth: "480px",
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
  textarea: {
    width: "100%",
    minHeight: "108px",
    marginTop: "18px",
    borderRadius: "14px",
    border: "1px solid #cad8e6",
    padding: "12px 14px",
    fontSize: "14px",
    boxSizing: "border-box",
    resize: "vertical",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    marginTop: "24px",
    flexWrap: "wrap",
  },
};

const HouseholdArchiveConfirmModal = ({
  isOpen,
  isSubmitting,
  archiveRemarks,
  onChangeArchiveRemarks,
  onCancel,
  onConfirm,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div style={modalStyles.overlay}>
      <div style={modalStyles.modal}>
        <h3 style={modalStyles.title}>Archive Household</h3>
        <p style={modalStyles.message}>
          Are you sure you want to archive this household?
        </p>
        <textarea
          value={archiveRemarks}
          onChange={(event) => onChangeArchiveRemarks?.(event.target.value)}
          placeholder="Optional archive remarks"
          style={modalStyles.textarea}
          disabled={isSubmitting}
        />
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
            {isSubmitting ? "Archiving..." : "Archive Household"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HouseholdArchiveConfirmModal;
