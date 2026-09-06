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
  notice: {
    marginTop: "14px",
    padding: "12px 14px",
    borderRadius: "14px",
    backgroundColor: "#eef5fb",
    border: "1px solid #d6e2ee",
    color: "#4f677f",
    fontSize: "13px",
    lineHeight: 1.5,
  },
};

const DonationDonorNameVisibilityModal = ({
  isOpen,
  donation,
  isSubmitting = false,
  errorMessage = "",
  onCancel,
  onConfirm,
}) => {
  if (!isOpen || !donation) {
    return null;
  }

  const isPublishing = donation.donor_name_public !== true;

  return (
    <ConfirmationModal
      isOpen={isOpen}
      title={isPublishing ? "Publish Donor Name" : "Unpublish Donor Name"}
      message={
        isPublishing
          ? "Are you sure you want to publish this donor name on the public donation page?"
          : "Are you sure you want to hide this donor name from the public donation page?"
      }
      onCancel={onCancel}
      onConfirm={onConfirm}
      confirmLabel={
        isSubmitting
          ? isPublishing
            ? "Publishing..."
            : "Unpublishing..."
          : isPublishing
            ? "Publish Donor Name"
            : "Unpublish Donor Name"
      }
      isSubmitting={isSubmitting}
      maxWidth="540px"
    >
      <div style={modalStyles.detailsList}>
        <div style={modalStyles.detailCard}>
          <div style={modalStyles.detailLabel}>Donor Name</div>
          <div style={modalStyles.detailValue}>{donation.donor_name || "--"}</div>
        </div>

        <div style={modalStyles.detailCard}>
          <div style={modalStyles.detailLabel}>Public Visibility</div>
          <div style={modalStyles.detailValue}>
            {isPublishing ? "Anonymous" : "Published publicly"}
          </div>
        </div>
      </div>

      <div style={modalStyles.notice}>
        {isPublishing
          ? "Only the donor name will be revealed. Donation quantities and other private information will not be changed."
          : "The donor name will be shown anonymously on the public donation page."
        }
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

export default DonationDonorNameVisibilityModal;
