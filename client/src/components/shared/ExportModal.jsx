import React from "react";
import { pageHeaderStyles } from "../layout/PageHeader";
import FormModalShell from "./FormModalShell";

const fieldGroupStyles = {
  display: "grid",
  gap: "18px",
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
  hideReportType = false,
  placeFormatLast = false,
  isSubmitting = false,
  onReportTypeChange,
  onFormatChange,
  onClose,
  onSubmit,
  children,
}) => {
  if (!isOpen) {
    return null;
  }

  const formatField = (
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
  );

  return (
    <FormModalShell
      isOpen={isOpen}
      title={title}
      description={description}
      footer={
        <>
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
        </>
      }
    >
      <div style={fieldGroupStyles}>
        {!hideReportType ? (
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
        ) : null}

        {!placeFormatLast ? formatField : null}

        {children}

        {placeFormatLast ? formatField : null}
      </div>
    </FormModalShell>
  );
};

export default ExportModal;
