import React from "react";

const DisasterEventEndModal = ({ isOpen, onClose, onConfirm, event }) => {
  if (!isOpen || !event) return null;

  return (
    <div style={overlay}>
      <div style={modal}>
        <h2 style={title}>End Relief Period</h2>
        <p style={subtitle}>{event.title}</p>

        {/* CURRENT PERIOD */}
        <div style={infoBox}>
          <p style={label}>Current Relief Period</p>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Start: {event.start_date?.slice(0, 10)}</span>
            <span>End: {event.end_date?.slice(0, 10)}</span>
          </div>
        </div>

        {/* ACTIONS */}
        <div style={actions}>
          <button
            style={dangerBtn}
            onClick={() => {
              onConfirm(event.id);
              onClose();
            }}
          >
            End
          </button>

          <button style={secondaryBtn} onClick={onClose}>
            Cancel
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
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  background: "rgba(0,0,0,0.4)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 999,
};

const modal = {
  background: "#fff",
  borderRadius: "20px",
  padding: "28px",
  width: "420px",
};

const title = {
  margin: 0,
  fontSize: "22px",
  color: "#2d3e50",
};

const subtitle = {
  margin: "6px 0 16px",
  color: "#5a6b7b",
  fontWeight: 600,
};

const infoBox = {
  background: "#f4f6f8",
  borderRadius: "12px",
  padding: "12px",
  fontSize: "14px",
};

const label = {
  margin: "0 0 6px",
  fontWeight: 600,
};

const actions = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  marginTop: "20px",
};

const dangerBtn = {
  background: "#3d4f6b",
  color: "#fff",
  border: "none",
  padding: "10px 20px",
  borderRadius: "20px",
  cursor: "pointer",
};

const secondaryBtn = {
  background: "#ddd",
  border: "none",
  padding: "10px 20px",
  borderRadius: "20px",
  cursor: "pointer",
};