import React, { useEffect, useState } from "react";

const getDateOnly = (value) => {
  if (!value) {
    return "";
  }

  return String(value).slice(0, 10);
};

const DisasterEventEndModal = ({
  isOpen,
  onClose,
  onConfirm,
  event,
  isSubmitting = false,
}) => {
  const [validationMessage, setValidationMessage] = useState("");

  useEffect(() => {
    if (isOpen) {
      setValidationMessage("");
    }
  }, [event?.id, isOpen]);

  if (!isOpen || !event) return null;

  const startDate = getDateOnly(event.start_date);
  const currentEndDate = getDateOnly(event.end_date);

  const handleConfirm = async () => {
    if (event.status !== "ACTIVE") {
      setValidationMessage("Only active disaster events can be marked as completed.");
      return;
    }

    setValidationMessage("");

    try {
      await onConfirm(event.id);
      onClose();
    } catch (error) {
      setValidationMessage(
        error.message || "Unable to complete this disaster event. Please try again.",
      );
    }
  };

  return (
    <div style={overlay}>
      <div style={modal}>
        <h2 style={title}>End Relief Period</h2>
        <p style={subtitle}>{event.title}</p>

        <div style={infoBox}>
          <p style={infoTitle}>Current Relief Period</p>
          <div style={periodRow}>
            <span style={periodText}>Start: {startDate || "--"}</span>
            <span style={periodText}>End: {currentEndDate || "--"}</span>
          </div>
        </div>

        <p style={warningText}>
          This will mark the disaster event as completed and set the end date to today.
        </p>

        {validationMessage ? (
          <p style={errorText}>{validationMessage}</p>
        ) : null}

        <div style={actions}>
          <button style={secondaryBtn} onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>

          <button
            style={{
              ...primaryBtn,
              opacity: isSubmitting ? 0.7 : 1,
              cursor: isSubmitting ? "not-allowed" : "pointer",
            }}
            disabled={isSubmitting}
            onClick={handleConfirm}
          >
            {isSubmitting ? "Completing..." : "Complete Event"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DisasterEventEndModal;

/* ===== STYLES ===== */
const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.28)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "24px",
  zIndex: 999,
};

const modal = {
  background: "#ffffff",
  borderRadius: "28px",
  padding: "36px 42px",
  width: "100%",
  maxWidth: "720px",
  boxSizing: "border-box",
  boxShadow: "0 18px 40px rgba(31, 57, 87, 0.16)",
};

const title = {
  margin: 0,
  fontSize: "34px",
  fontWeight: 800,
  lineHeight: 1.15,
  color: "#183b63",
};

const subtitle = {
  margin: "10px 0 28px",
  fontSize: "20px",
  fontWeight: 500,
  lineHeight: 1.4,
  color: "#486685",
};

const infoBox = {
  background: "#f2f5f8",
  borderRadius: "20px",
  padding: "22px 18px",
  marginBottom: "28px",
};

const infoTitle = {
  margin: "0 0 14px",
  fontSize: "16px",
  fontWeight: 700,
  color: "#183b63",
};

const periodRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  flexWrap: "wrap",
};

const periodText = {
  fontSize: "16px",
  color: "#183b63",
  fontWeight: 500,
};

const actions = {
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: "14px",
  flexWrap: "wrap",
};

const primaryBtn = {
  border: "none",
  borderRadius: "14px",
  padding: "12px 18px",
  background: "linear-gradient(135deg, #2f6499 0%, #4c86be 100%)",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 12px 24px rgba(58, 97, 141, 0.18)",
};

const secondaryBtn = {
  border: "1px solid #c6d8ea",
  borderRadius: "14px",
  padding: "12px 18px",
  backgroundColor: "#f8fbfe",
  color: "#2a4c6f",
  fontSize: "14px",
  fontWeight: 700,
  cursor: "pointer",
};

const warningText = {
  margin: "0 0 16px",
  color: "#486685",
  fontSize: "14px",
  lineHeight: 1.5,
};

const errorText = {
  margin: "0 0 16px",
  fontSize: "14px",
  color: "#a14d58",
  fontWeight: 700,
};
