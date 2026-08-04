import React, { useEffect, useId, useRef } from "react";
import { FiX } from "react-icons/fi";

const overlayStyles = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(23, 50, 77, 0.42)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  zIndex: 1500,
};

const contentStyles = {
  width: "100%",
  maxHeight: "min(88vh, 720px)",
  overflowY: "auto",
  backgroundColor: "#ffffff",
  borderRadius: "24px",
  padding: "28px",
  boxShadow: "0 24px 54px rgba(31, 64, 95, 0.22)",
  boxSizing: "border-box",
};

const headerStyles = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  marginBottom: "22px",
};

const titleStyles = {
  margin: 0,
  color: "#17324d",
  fontSize: "26px",
  fontWeight: 800,
};

const descriptionStyles = {
  margin: "12px 0 0",
  color: "#5d7188",
  fontSize: "14px",
  lineHeight: 1.6,
};

const bodyStyles = {
  marginTop: 0,
};

const footerStyles = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "12px",
  marginTop: "26px",
  flexWrap: "wrap",
};

const closeButtonStyles = {
  border: "1px solid #c6d8ea",
  borderRadius: "14px",
  width: "42px",
  height: "42px",
  backgroundColor: "#f8fbfe",
  color: "#24496e",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flexShrink: 0,
};

const FormModalShell = ({
  isOpen,
  title,
  description,
  children,
  footer,
  maxWidth = "480px",
  zIndex = 1500,
  onClose,
  isCloseDisabled = false,
  closeOnBackdrop = false,
  initialFocusRef = null,
  finalFocusRef = null,
  headerStyle,
  titleStyle,
  bodyStyle,
  closeButtonStyle,
}) => {
  const panelRef = useRef(null);
  const overlayRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const panelElement = panelRef.current;

    if (!panelElement) {
      return undefined;
    }

    const activeElement =
      typeof document !== "undefined" ? document.activeElement : null;
    const fallbackFocusTarget =
      initialFocusRef?.current ||
      panelElement.querySelector(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ||
      panelElement;

    window.setTimeout(() => {
      fallbackFocusTarget?.focus?.();
    }, 0);

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && onClose && !isCloseDisabled) {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = Array.from(
        panelElement.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("disabled"));

      if (focusableElements.length === 0) {
        event.preventDefault();
        panelElement.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const returnFocusTarget =
        finalFocusRef?.current || activeElement;
      returnFocusTarget?.focus?.();
    };
  }, [
    finalFocusRef,
    initialFocusRef,
    isCloseDisabled,
    isOpen,
    onClose,
  ]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={overlayRef}
      style={{
        ...overlayStyles,
        zIndex,
      }}
      onMouseDown={(event) => {
        if (
          closeOnBackdrop &&
          onClose &&
          !isCloseDisabled &&
          event.target === overlayRef.current
        ) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        style={{
          ...contentStyles,
          maxWidth,
        }}
      >
        {title || onClose ? (
          <div style={{ ...headerStyles, ...(headerStyle || {}) }}>
            <div>
              {title ? (
                <h3 id={titleId} style={{ ...titleStyles, ...(titleStyle || {}) }}>
                  {title}
                </h3>
              ) : null}
              {description ? (
                <p id={descriptionId} style={descriptionStyles}>
                  {description}
                </p>
              ) : null}
            </div>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                style={{ ...closeButtonStyles, ...(closeButtonStyle || {}) }}
                disabled={isCloseDisabled}
                aria-label="Close modal"
              >
                <FiX size={20} />
              </button>
            ) : null}
          </div>
        ) : null}
        {!title && !onClose && description ? (
          <p style={descriptionStyles}>{description}</p>
        ) : null}
        <div style={{ ...bodyStyles, ...(bodyStyle || {}) }}>{children}</div>
        {footer ? <div style={footerStyles}>{footer}</div> : null}
      </div>
    </div>
  );
};

export default FormModalShell;
