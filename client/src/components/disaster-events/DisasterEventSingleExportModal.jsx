import React from "react";
import { FiX } from "react-icons/fi";
import { pageHeaderStyles } from "../layout/PageHeader";
import { shellStyles } from "../layout/BarangayLayout";

const overlayStyles = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(23, 50, 77, 0.42)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  zIndex: 1500,
};

const modalStyles = {
  width: "min(560px, 100%)",
  backgroundColor: "#ffffff",
  borderRadius: "24px",
  boxShadow: "0 24px 54px rgba(31, 64, 95, 0.22)",
  padding: "28px",
  boxSizing: "border-box",
};

const inputStyles = {
  width: "100%",
  minHeight: "48px",
  padding: "12px 14px",
  borderRadius: "14px",
  border: "1px solid #cbdbea",
  boxSizing: "border-box",
  fontSize: "14px",
  color: "#17324d",
  backgroundColor: "#f8fbfe",
};

const labelStyles = {
  display: "block",
  marginBottom: "8px",
  color: "#48627d",
  fontSize: "12px",
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const titleStyles = {
  margin: 0,
  color: "#17324d",
  fontSize: "26px",
  fontWeight: 800,
};

const messageStyles = {
  margin: "12px 0 0",
  color: "#5d7188",
  fontSize: "15px",
  lineHeight: 1.6,
};

const closeButtonStyles = {
  border: "1px solid #c6d8ea",
  borderRadius: "14px",
  width: "42px",
  height: "42px",
  backgroundColor: "#f8fbfe",
  color: "#24496e",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flexShrink: 0,
};

const getEventLabel = (eventData) =>
  String(eventData?.title || "").trim() || "this disaster event";

const DisasterEventSingleExportModal = ({
  isOpen,
  eventData,
  selectedFormat,
  isSubmitting,
  onClose,
  onFormatChange,
  onSubmit,
}) => {
  if (!isOpen || !eventData) {
    return null;
  }

  return (
    <div className="disaster-event-modal-backdrop" style={overlayStyles}>
      <div className="disaster-event-single-export-modal" style={modalStyles}>
        <div
          className="disaster-event-modal-topbar"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "16px",
            marginBottom: "18px",
          }}
        >
          <div className="disaster-event-modal-heading">
            <h3 style={titleStyles}>Disaster Event Report</h3>
            <p style={messageStyles}>
              Generate a report for {getEventLabel(eventData)}?
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={closeButtonStyles}
            disabled={isSubmitting}
            aria-label="Close modal"
          >
            <FiX size={20} />
          </button>
        </div>

        <section style={{ ...shellStyles.card, padding: "18px 20px" }}>
          <label style={labelStyles}>Format</label>
          <select
            value={selectedFormat}
            onChange={(event) => onFormatChange(event.target.value)}
            style={inputStyles}
            disabled={isSubmitting}
          >
            <option value="csv">CSV</option>
            <option value="excel">Excel</option>
            <option value="pdf">PDF</option>
          </select>
        </section>

        <div
          className="disaster-event-modal-actions"
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px",
            marginTop: "18px",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={pageHeaderStyles.secondaryButton}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            style={{
              ...pageHeaderStyles.primaryButton,
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? "Exporting..." : "Export"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DisasterEventSingleExportModal;
