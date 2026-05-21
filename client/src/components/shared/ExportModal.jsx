import React from "react";
import { pageHeaderStyles } from "../layout/PageHeader";

const overlayStyles = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(18, 34, 51, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  zIndex: 1300,
};

const modalStyles = {
  width: "100%",
  maxWidth: "480px",
  backgroundColor: "#ffffff",
  borderRadius: "20px",
  padding: "28px",
  boxShadow: "0 24px 48px rgba(20, 48, 78, 0.2)",
  boxSizing: "border-box",
};

const titleStyles = {
  margin: 0,
  color: "#17324d",
  fontSize: "24px",
};

const descriptionStyles = {
  margin: "12px 0 0",
  color: "#5d7188",
  fontSize: "14px",
  lineHeight: 1.6,
};

const fieldGroupStyles = {
  display: "grid",
  gap: "18px",
  marginTop: "22px",
};

const labelStyles = {
  display: "block",
  marginBottom: "8px",
  color: "#4f677f",
  fontSize: "13px",
  fontWeight: 700,
};

const selectStyles = {
  width: "100%",
  minHeight: "48px",
  padding: "12px 14px",
  borderRadius: "14px",
  border: "1px solid #d2deea",
  boxSizing: "border-box",
  fontSize: "14px",
  color: "#21405f",
  backgroundColor: "#ffffff",
  outline: "none",
};

const actionsStyles = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "12px",
  marginTop: "24px",
  flexWrap: "wrap",
};

const ExportModal = ({
  isOpen,
  title = "Export Report",
  description = "Choose which report to export and the file format to generate.",
  reportLabel = "Report Type",
  formatLabel = "Format",
  reportOptions = [],
  formatOptions = [],
  selectedReportType = "",
  selectedFormat = "csv",
  isSubmitting = false,
  onReportTypeChange,
  onFormatChange,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div style={overlayStyles}>
      <div style={modalStyles}>
        <h3 style={titleStyles}>{title}</h3>
        <p style={descriptionStyles}>{description}</p>

        <div style={fieldGroupStyles}>
          <div>
            <label style={labelStyles}>{reportLabel}</label>
            <select
              value={selectedReportType}
              onChange={(event) => onReportTypeChange?.(event.target.value)}
              style={selectStyles}
              disabled={isSubmitting}
            >
              {reportOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyles}>{formatLabel}</label>
            <select
              value={selectedFormat}
              onChange={(event) => onFormatChange?.(event.target.value)}
              style={selectStyles}
              disabled={isSubmitting}
            >
              {formatOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={actionsStyles}>
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
            style={pageHeaderStyles.primaryButton}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Exporting..." : "Export"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
