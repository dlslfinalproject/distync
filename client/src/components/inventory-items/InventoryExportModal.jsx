import React from "react";
import { pageHeaderStyles } from "../layout/PageHeader";

const noticeModalStyles = {
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
    maxWidth: "440px",
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
  },
};

const exportModalStyles = {
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
    fontSize: "24px",
  },
  description: {
    margin: "12px 0 0",
    color: "#5d7188",
    fontSize: "14px",
    lineHeight: 1.6,
  },
  fieldGroup: {
    display: "grid",
    gap: "18px",
    marginTop: "22px",
  },
  label: {
    display: "block",
    marginBottom: "8px",
    color: "#4f677f",
    fontSize: "13px",
    fontWeight: 700,
  },
  select: {
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
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    marginTop: "24px",
    flexWrap: "wrap",
  },
};

const InventoryExportModal = ({
  isOpen,
  selectedExportReportType,
  selectedExportFormat,
  exportNoticeMessage,
  reportOptions,
  formatOptions,
  onReportTypeChange,
  onFormatChange,
  onClose,
  onSubmit,
  onCloseNotice,
}) => {
  return (
    <>
      {isOpen ? (
        <div style={exportModalStyles.overlay}>
          <div style={exportModalStyles.modal}>
            <h3 style={exportModalStyles.title}>Export Inventory Report</h3>
            <p style={exportModalStyles.description}>
              Choose which inventory report to export and the file format to generate.
            </p>

            {exportNoticeMessage ? (
              <div
                style={{
                  marginTop: "18px",
                  padding: "12px 14px",
                  borderRadius: "14px",
                  backgroundColor: "#fff3f1",
                  border: "1px solid #f4c9c2",
                  color: "#a14538",
                  fontSize: "0.95rem",
                  fontWeight: 600,
                }}
              >
                {exportNoticeMessage}
              </div>
            ) : null}

            <div style={exportModalStyles.fieldGroup}>
              <div>
                <label style={exportModalStyles.label}>Report Type</label>
                <select
                  value={selectedExportReportType}
                  onChange={(event) => onReportTypeChange(event.target.value)}
                  style={exportModalStyles.select}
                >
                  {reportOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={exportModalStyles.label}>Format</label>
                <select
                  value={selectedExportFormat}
                  onChange={(event) => onFormatChange(event.target.value)}
                  style={exportModalStyles.select}
                >
                  {formatOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={exportModalStyles.actions}>
              <button
                type="button"
                onClick={onClose}
                style={pageHeaderStyles.secondaryButton}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSubmit}
                style={pageHeaderStyles.primaryButton}
              >
                Export
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!isOpen && exportNoticeMessage ? (
        <div style={noticeModalStyles.overlay}>
          <div style={noticeModalStyles.modal}>
            <h3 style={noticeModalStyles.title}>Export Unavailable</h3>
            <p style={noticeModalStyles.message}>{exportNoticeMessage}</p>
            <div style={noticeModalStyles.actions}>
              <button
                type="button"
                onClick={onCloseNotice}
                style={pageHeaderStyles.primaryButton}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default InventoryExportModal;
