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
    maxWidth: "540px",
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
  detailsCard: {
    marginTop: "18px",
    padding: "16px",
    borderRadius: "16px",
    backgroundColor: "#f8fbfe",
    border: "1px solid #d6e2ee",
    display: "grid",
    gap: "10px",
  },
  detailLabel: {
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#66809c",
  },
  detailValue: {
    fontSize: "14px",
    color: "#21405f",
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    marginTop: "24px",
    flexWrap: "wrap",
  },
};

const DistributionLifecycleModal = ({
  mode,
  isOpen,
  isSubmitting,
  remarks,
  onChangeRemarks,
  row,
  onCancel,
  onConfirm,
}) => {
  if (!isOpen || !mode || !row) {
    return null;
  }

  const isViewMode = mode === "view";
  const isReverseMode = mode === "reverse";
  const title = isViewMode
    ? "Distribution Status Details"
    : isReverseMode
      ? "Reverse Distribution"
      : "Cancel Distribution";
  const message = isViewMode
    ? "Review the current status, receipt state, and recorded remarks for this distribution entry."
    : isReverseMode
      ? "Are you sure you want to reverse this distribution?"
      : "Are you sure you want to cancel this distribution?";

  return (
    <div style={modalStyles.overlay}>
      <div style={modalStyles.modal}>
        <h3 style={modalStyles.title}>{title}</h3>
        <p style={modalStyles.message}>{message}</p>

        <div style={modalStyles.detailsCard}>
          <div>
            <div style={modalStyles.detailLabel}>Family Head</div>
            <div style={modalStyles.detailValue}>{row.family_head_name || "--"}</div>
          </div>
          <div>
            <div style={modalStyles.detailLabel}>Stub / QR</div>
            <div style={modalStyles.detailValue}>
              Stub: {row.stub_no || "--"}
              {"\n"}
              QR: {row.qr_reference_value || row.serial_no || "--"}
            </div>
          </div>
          <div>
            <div style={modalStyles.detailLabel}>Current Status</div>
            <div style={modalStyles.detailValue}>
              {row.distribution_status || "--"} / Receipt: {row.receipt_status || "--"}
            </div>
          </div>
          <div>
            <div style={modalStyles.detailLabel}>Remarks / Reason</div>
            <div style={modalStyles.detailValue}>{row.remarks || "No remarks recorded."}</div>
          </div>
        </div>

        {!isViewMode ? (
          <textarea
            value={remarks}
            onChange={(event) => onChangeRemarks?.(event.target.value)}
            placeholder={
              isReverseMode
                ? "Required reversal remarks"
                : "Required cancellation remarks"
            }
            style={modalStyles.textarea}
            disabled={isSubmitting}
          />
        ) : null}

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
            {isViewMode ? "Close" : "Cancel"}
          </button>
          {!isViewMode ? (
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
              {isSubmitting
                ? isReverseMode
                  ? "Reversing..."
                  : "Cancelling..."
                : isReverseMode
                  ? "Reverse Distribution"
                  : "Cancel Distribution"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default DistributionLifecycleModal;
