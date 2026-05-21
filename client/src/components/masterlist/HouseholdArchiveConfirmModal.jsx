import React from "react";
import ConfirmationModal from "../shared/ConfirmationModal";

const textareaStyles = {
  width: "100%",
  minHeight: "108px",
  borderRadius: "14px",
  border: "1px solid #cad8e6",
  padding: "12px 14px",
  fontSize: "14px",
  boxSizing: "border-box",
  resize: "vertical",
};

const HouseholdArchiveConfirmModal = ({
  isOpen,
  isSubmitting,
  archiveRemarks,
  onChangeArchiveRemarks,
  onCancel,
  onConfirm,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <ConfirmationModal
      isOpen={isOpen}
      title="Archive Household"
      message="Are you sure you want to archive this household?"
      onCancel={onCancel}
      onConfirm={onConfirm}
      isSubmitting={isSubmitting}
      confirmLabel={isSubmitting ? "Archiving..." : "Archive Household"}
      maxWidth="480px"
    >
      <textarea
        value={archiveRemarks}
        onChange={(event) => onChangeArchiveRemarks?.(event.target.value)}
        placeholder="Optional archive remarks"
        style={textareaStyles}
        disabled={isSubmitting}
      />
    </ConfirmationModal>
  );
};

export default HouseholdArchiveConfirmModal;
