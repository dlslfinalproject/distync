import React from "react";
import { pageHeaderStyles } from "../layout/PageHeader";
import FormModalShell from "./FormModalShell";

const ConfirmationModal = ({
  isOpen,
  title,
  message,
  children,
  onCancel,
  onConfirm,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isSubmitting = false,
  confirmButtonStyle,
  maxWidth,
}) => (
  <FormModalShell
    isOpen={isOpen}
    title={title}
    description={message}
    maxWidth={maxWidth}
    footer={
      <>
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
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isSubmitting}
          style={{
            ...pageHeaderStyles.primaryButton,
            ...(confirmButtonStyle || {}),
            opacity: isSubmitting ? 0.7 : 1,
            cursor: isSubmitting ? "wait" : "pointer",
          }}
        >
          {confirmLabel}
        </button>
      </>
    }
  >
    {children}
  </FormModalShell>
);

export default ConfirmationModal;
