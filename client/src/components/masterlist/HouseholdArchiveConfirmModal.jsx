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
  mode = "archive",
}) => {
  if (!isOpen) {
    return null;
  }

  const isRestoreMode = mode === "restore";
  const title = isRestoreMode ? "Restore Household" : "Archive Household";
  const message = isRestoreMode
    ? "Are you sure you want to restore this household?"
    : "Are you sure you want to archive this household?";
  const confirmLabel = isRestoreMode
    ? isSubmitting
      ? "Restoring..."
      : "Restore Household"
    : isSubmitting
      ? "Archiving..."
      : "Archive Household";
  const placeholder = isRestoreMode
    ? "Optional restore remarks"
    : "Optional archive remarks";

  return (
    <ConfirmationModal
      isOpen={isOpen}
      title={title}
      message={message}
      onCancel={onCancel}
      onConfirm={onConfirm}
      isSubmitting={isSubmitting}
      confirmLabel={confirmLabel}
      maxWidth="480px"
    >
      <textarea
        value={archiveRemarks}
        onChange={(event) => onChangeArchiveRemarks?.(event.target.value)}
        placeholder={placeholder}
        style={textareaStyles}
        disabled={isSubmitting}
      />
    </ConfirmationModal>
  );
};

export default HouseholdArchiveConfirmModal;
