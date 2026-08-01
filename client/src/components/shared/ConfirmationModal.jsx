import React, { useState } from "react";
import { pageHeaderStyles } from "../layout/PageHeader";
import FormModalShell from "./FormModalShell";

const confirmToneStyles = {
  primary: {
    default: {
      background: "linear-gradient(135deg, #2f6499 0%, #4c86be 100%)",
      border: "none",
      color: "#ffffff",
      boxShadow: "0 12px 24px rgba(58, 97, 141, 0.18)",
    },
    hover: {
      background: "linear-gradient(135deg, #285784 0%, #4276a7 100%)",
      boxShadow: "0 14px 28px rgba(58, 97, 141, 0.22)",
    },
    active: {
      background: "linear-gradient(135deg, #244b71 0%, #3a6894 100%)",
      boxShadow: "0 8px 18px rgba(58, 97, 141, 0.2)",
    },
    focus: {
      boxShadow:
        "0 0 0 4px rgba(76, 134, 190, 0.24), 0 12px 24px rgba(58, 97, 141, 0.18)",
    },
    disabled: {
      background: "linear-gradient(135deg, #8ea8c4 0%, #aac0d6 100%)",
      color: "#ffffff",
      boxShadow: "none",
    },
  },
  destructive: {
    default: {
      background: "#b91c1c",
      border: "1px solid #b91c1c",
      color: "#ffffff",
      boxShadow: "0 12px 24px rgba(185, 28, 28, 0.2)",
    },
    hover: {
      background: "#991b1b",
      border: "1px solid #991b1b",
      boxShadow: "0 14px 28px rgba(153, 27, 27, 0.24)",
    },
    active: {
      background: "#7f1d1d",
      border: "1px solid #7f1d1d",
      boxShadow: "0 8px 18px rgba(127, 29, 29, 0.22)",
    },
    focus: {
      boxShadow:
        "0 0 0 4px rgba(185, 28, 28, 0.24), 0 12px 24px rgba(185, 28, 28, 0.2)",
    },
    disabled: {
      background: "#d88d8d",
      border: "1px solid #d88d8d",
      color: "#ffffff",
      boxShadow: "none",
    },
  },
};

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
  confirmTone = "primary",
  maxWidth,
  onClose,
  closeOnBackdrop = false,
  initialFocusRef,
  finalFocusRef,
  cancelButtonRef,
  confirmButtonRef,
}) => {
  const [isConfirmHovered, setIsConfirmHovered] = useState(false);
  const [isConfirmPressed, setIsConfirmPressed] = useState(false);
  const [isConfirmFocused, setIsConfirmFocused] = useState(false);
  const toneStyles =
    confirmToneStyles[confirmTone] || confirmToneStyles.primary;

  let confirmStateStyles = toneStyles.default;

  if (isSubmitting) {
    confirmStateStyles = toneStyles.disabled;
  } else if (isConfirmPressed) {
    confirmStateStyles = toneStyles.active;
  } else if (isConfirmHovered) {
    confirmStateStyles = toneStyles.hover;
  }

  if (isConfirmFocused && !isSubmitting) {
    confirmStateStyles = {
      ...confirmStateStyles,
      ...toneStyles.focus,
    };
  }

  return (
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
            onMouseEnter={() => setIsConfirmHovered(true)}
            onMouseLeave={() => {
              setIsConfirmHovered(false);
              setIsConfirmPressed(false);
            }}
            onMouseDown={() => setIsConfirmPressed(true)}
            onMouseUp={() => setIsConfirmPressed(false)}
            onFocus={() => setIsConfirmFocused(true)}
            onBlur={() => {
              setIsConfirmFocused(false);
              setIsConfirmPressed(false);
            }}
            style={{
              ...pageHeaderStyles.primaryButton,
              transition:
                "background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease",
              ...(confirmStateStyles || {}),
              ...(confirmButtonStyle || {}),
              opacity: isSubmitting ? 0.8 : 1,
              cursor: isSubmitting ? "not-allowed" : "pointer",
              transform: isConfirmPressed && !isSubmitting ? "translateY(1px)" : "none",
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
};

export default ConfirmationModal;
