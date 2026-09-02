import React from "react";
import ConfirmationModal from "../shared/ConfirmationModal";

const modalStyles = {
  detailsList: {
    display: "grid",
    gap: "12px",
  },
  detailCard: {
    padding: "16px",
    borderRadius: "16px",
    backgroundColor: "#f8fbfe",
    border: "1px solid #d6e2ee",
  },
  detailLabel: {
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#66809c",
  },
  detailValue: {
    margin: "4px 0 0",
    fontSize: "14px",
    color: "#21405f",
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
};

const ReliefPackTemplateStatusConfirmModal = ({
  isOpen,
  template,
  isSubmitting = false,
  applicabilityLabels = [],
  errorMessage = "",
  onCancel,
  onConfirm,
}) => {
  if (!isOpen || !template) {
    return null;
  }

  const isActivating = template.is_active === false;
  const packTypeLabel = template.is_additional_pack ? "Additional" : "Standard";
  const resolvedApplicabilityLabels =
    applicabilityLabels.length > 0 ? applicabilityLabels : ["All disaster types"];
  const applicabilityText = resolvedApplicabilityLabels.join(", ");

  return (
    <ConfirmationModal
      isOpen={isOpen}
      title={isActivating ? "Activate Relief Pack" : "Deactivate Relief Pack"}
      message={`Are you sure you want to ${isActivating ? "activate" : "deactivate"} this relief pack?`}
      onCancel={onCancel}
      onConfirm={onConfirm}
      confirmLabel={
        isSubmitting
          ? isActivating
            ? "Activating..."
            : "Deactivating..."
          : isActivating
            ? "Activate Relief Pack"
            : "Deactivate Relief Pack"
      }
      isSubmitting={isSubmitting}
      maxWidth="540px"
    >
      <div style={modalStyles.detailsList}>
        <div style={modalStyles.detailCard}>
          <div style={modalStyles.detailLabel}>Relief Pack</div>
          <div style={modalStyles.detailValue}>{template.name || "--"}</div>
        </div>

        <div style={modalStyles.detailCard}>
          <div style={modalStyles.detailLabel}>Pack Type</div>
          <div style={modalStyles.detailValue}>{packTypeLabel}</div>
        </div>

        <div style={modalStyles.detailCard}>
          <div style={modalStyles.detailLabel}>Applies To</div>
          <div style={modalStyles.detailValue}>{applicabilityText}</div>
        </div>

      </div>

      {errorMessage ? (
        <div
          role="alert"
          style={{
            marginTop: "14px",
            padding: "12px 14px",
            border: "1px solid #efd4d8",
            borderRadius: "14px",
            backgroundColor: "#f6ebeb",
            color: "#9d3442",
            fontSize: "13px",
            lineHeight: 1.5,
          }}
        >
          {errorMessage}
        </div>
      ) : null}
    </ConfirmationModal>
  );
};

export default ReliefPackTemplateStatusConfirmModal;
