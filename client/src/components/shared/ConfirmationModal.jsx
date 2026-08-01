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
  onClose,
  closeOnBackdrop = false,
  initialFocusRef,
  finalFocusRef,
  cancelButtonRef,
  confirmButtonRef,
}) => (
  <FormModalShell
    isOpen={isOpen}
    title={title}
    description={message}
    maxWidth={maxWidth}
    onClose={onClose || onCancel}
    closeOnBackdrop={closeOnBackdrop}
    initialFocusRef={initialFocusRef}
    finalFocusRef={finalFocusRef}
    footer={
      <>
        <button
          ref={cancelButtonRef}
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
          ref={confirmButtonRef}
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
