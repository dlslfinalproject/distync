import React from "react";
import { FiX } from "react-icons/fi";
import { pageHeaderStyles } from "../layout/PageHeader";
import { shellStyles } from "../layout/BarangayLayout";

const overlayStyles = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(18, 34, 51, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  zIndex: 1200,
};

const modalStyles = {
  width: "100%",
  maxWidth: "460px",
  backgroundColor: "#ffffff",
  borderRadius: "20px",
  boxShadow: "0 24px 48px rgba(20, 48, 78, 0.2)",
  padding: "28px",
  boxSizing: "border-box",
};

const inputStyles = {
  width: "100%",
  minHeight: "48px",
  padding: "12px 14px",
  borderRadius: "14px",
  border: "1px solid #d2deea",
  boxSizing: "border-box",
  fontSize: "14px",
  color: "#21405f",
  backgroundColor: "#ffffff",
};

const labelStyles = {
  display: "block",
  marginBottom: "8px",
  color: "#4f677f",
  fontSize: "13px",
  fontWeight: 700,
};

const titleStyles = {
  margin: 0,
  color: "#17324d",
  fontSize: "22px",
};

const messageStyles = {
  margin: "12px 0 0",
  color: "#5d7188",
  fontSize: "15px",
  lineHeight: 1.6,
};

const getEventLabel = (eventData) =>
  [eventData?.event_code, eventData?.title].filter(Boolean).join(" - ") ||
  "this disaster event";

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
    <div style={overlayStyles}>
      <div style={modalStyles}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "16px",
            marginBottom: "18px",
          }}
        >
          <div>
            <h3 style={titleStyles}>Disaster Event Report</h3>
            <p style={messageStyles}>
              Generate a report for {getEventLabel(eventData)}?
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={pageHeaderStyles.secondaryButton}
            disabled={isSubmitting}
          >
            <FiX />
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
