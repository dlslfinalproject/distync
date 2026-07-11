import React from "react";
import { FiX } from "react-icons/fi";
import { pageHeaderStyles } from "../layout/PageHeader";
import { shellStyles } from "../layout/BarangayLayout";

const overlayStyles = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(21, 40, 63, 0.48)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  zIndex: 1300,
};

const modalStyles = {
  width: "min(520px, 100%)",
  backgroundColor: "#eef5fb",
  borderRadius: "22px",
  border: "1px solid #d7e2ef",
  boxShadow: "0 24px 60px rgba(23, 50, 77, 0.18)",
  padding: "24px",
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
            <h3 style={{ margin: 0, color: "#17324d", fontSize: "26px" }}>
              Export Disaster Event Report
            </h3>
            <p style={{ ...shellStyles.mutedText, margin: "10px 0 0" }}>
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
