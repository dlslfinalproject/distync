import React, { useEffect, useMemo, useState } from "react";

const getDateOnly = (value) => {
  if (!value) {
    return "";
  }

  return String(value).slice(0, 10);
};

const getLatestMinimumDate = (startDate, endDate) => {
  const dateValues = [getDateOnly(startDate), getDateOnly(endDate)].filter(Boolean);

  if (dateValues.length === 0) {
    return "";
  }

  return dateValues.sort().at(-1);
};

const DisasterEventExtendModal = ({
  isOpen,
  onClose,
  onSubmit,
  event,
  isSubmitting = false,
}) => {
  const [newDate, setNewDate] = useState("");
  const [validationMessage, setValidationMessage] = useState("");

  const startDate = getDateOnly(event?.start_date);
  const currentEndDate = getDateOnly(event?.end_date);
  const minimumDate = useMemo(
    () => getLatestMinimumDate(event?.start_date, event?.end_date),
    [event?.start_date, event?.end_date],
  );

  useEffect(() => {
    if (isOpen) {
      setNewDate("");
      setValidationMessage("");
    }
  }, [event?.id, isOpen]);

  if (!isOpen || !event) return null;

  const validateNewEndDate = () => {
    if (!newDate) {
      return "Choose a new end date before extending the relief period.";
    }

    if (startDate && newDate < startDate) {
      return `New end date must not be earlier than the event start date (${startDate}).`;
    }

    if (currentEndDate && newDate < currentEndDate) {
      return `New end date must not be earlier than the current end date (${currentEndDate}).`;
    }

    return "";
  };

  const handleSubmit = async () => {
    const nextValidationMessage = validateNewEndDate();

    if (nextValidationMessage) {
      setValidationMessage(nextValidationMessage);
      return;
    }

    setValidationMessage("");

    try {
      await onSubmit(event.id, newDate);
      onClose();
    } catch (error) {
      setValidationMessage(
        error.message || "Unable to extend this disaster event. Please try again.",
      );
    }
  };

  return (
    <div style={overlay}>
      <div style={modal}>
        <h2 style={title}>Extend Relief Period</h2>
        <p style={subtitle}>{event.title}</p>

        <div style={infoBox}>
          <p style={infoTitle}>Current Relief Period</p>
          <div style={periodRow}>
            <span style={periodText}>Start: {startDate || "--"}</span>
            <span style={periodText}>End: {currentEndDate || "--"}</span>
          </div>
        </div>

        <label style={inputLabel}>New End Date</label>
        <input
          type="date"
          value={newDate}
          min={minimumDate || undefined}
          disabled={isSubmitting}
          onChange={(e) => {
            setNewDate(e.target.value);
            setValidationMessage("");
          }}
          style={{
            ...input,
            borderColor: validationMessage ? "#d99090" : "#cfd9e3",
            marginBottom: validationMessage ? "10px" : "30px",
          }}
        />

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
            onClick={handleSubmit}
          >
            {isSubmitting ? "Extending..." : "Extend"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DisasterEventExtendModal;

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

const inputLabel = {
  display: "block",
  marginBottom: "12px",
  fontSize: "16px",
  fontWeight: 700,
  color: "#183b63",
};

const input = {
  width: "100%",
  boxSizing: "border-box",
  padding: "16px 18px",
  borderRadius: "16px",
  border: "1px solid #cfd9e3",
  backgroundColor: "#ffffff",
  fontSize: "16px",
  color: "#183b63",
  outline: "none",
  marginBottom: "30px",
};

const helperText = {
  margin: "0 0 10px",
  fontSize: "13px",
  color: "#5f7892",
};

const errorText = {
  margin: "0 0 20px",
  fontSize: "14px",
  color: "#a14d58",
  fontWeight: 700,
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
