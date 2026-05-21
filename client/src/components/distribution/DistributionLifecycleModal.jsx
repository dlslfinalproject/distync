import React from "react";
import ConfirmationModal from "../shared/ConfirmationModal";
import DetailsModalShell from "../shared/DetailsModalShell";

const modalStyles = {
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

  const detailContent = (
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
  );

  if (isViewMode) {
    return (
      <DetailsModalShell
        isOpen={isOpen}
        title={title}
        description={message}
        onClose={onCancel}
        maxWidth="540px"
      >
        {detailContent}
      </DetailsModalShell>
    );
  }

  return (
    <ConfirmationModal
      isOpen={isOpen}
      title={title}
      message={message}
      onCancel={onCancel}
      onConfirm={onConfirm}
      isSubmitting={isSubmitting}
      confirmLabel={
        isSubmitting
          ? isReverseMode
            ? "Reversing..."
            : "Cancelling..."
          : isReverseMode
            ? "Reverse Distribution"
            : "Cancel Distribution"
      }
      maxWidth="540px"
    >
      {detailContent}
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
    </ConfirmationModal>
  );
};

export default DistributionLifecycleModal;
