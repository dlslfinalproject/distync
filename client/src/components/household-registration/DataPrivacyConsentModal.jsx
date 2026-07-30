import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  HOUSEHOLD_PRIVACY_ACKNOWLEDGMENT_HEADING,
  HOUSEHOLD_PRIVACY_CONFIRMATION_LABEL,
  HOUSEHOLD_PRIVACY_NOTICE_PARAGRAPHS,
  HOUSEHOLD_PRIVACY_NOTICE_TITLE,
} from "../../features/household-registration/privacyNotice.mjs";
import { pageHeaderStyles } from "../layout/PageHeader";

const modalStyles = {
  backdrop: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(23, 50, 77, 0.42)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    boxSizing: "border-box",
    zIndex: 2200,
  },
  panel: {
    width: "min(920px, 96vw)",
    maxHeight: "88vh",
    backgroundColor: "#ffffff",
    borderRadius: "24px",
    border: "1px solid #d7e2ef",
    boxShadow: "0 24px 54px rgba(31, 64, 95, 0.22)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    boxSizing: "border-box",
  },
  tabletPanel: {
    width: "90vw",
  },
  compactPanel: {
    borderRadius: "18px",
    width: "95vw",
    maxHeight: "90vh",
  },
  header: {
    padding: "24px 28px 18px",
    borderBottom: "1px solid #dbe5ef",
    backgroundColor: "#ffffff",
    flexShrink: 0,
  },
  title: {
    margin: 0,
    color: "#17324d",
    fontSize: "26px",
    fontWeight: 800,
    lineHeight: 1.15,
  },
  version: {
    margin: "10px 0 0",
    color: "#60738a",
    fontSize: "14px",
    fontWeight: 600,
    lineHeight: 1.5,
  },
  body: {
    padding: "0 28px",
    overflowY: "auto",
    boxSizing: "border-box",
    flex: "1 1 auto",
    minHeight: 0,
  },
  bodyInner: {
    width: "100%",
    margin: 0,
    padding: "24px 0 26px",
    display: "grid",
    gap: "16px",
    boxSizing: "border-box",
  },
  paragraph: {
    margin: 0,
    color: "#5d7188",
    fontSize: "15px",
    lineHeight: 1.65,
    textAlign: "left",
  },
  confirmationBox: {
    marginTop: "6px",
    paddingTop: "20px",
    borderTop: "1px solid #dbe5ef",
  },
  acknowledgmentHeading: {
    margin: "0 0 12px",
    color: "#17324d",
    fontSize: "17px",
    fontWeight: 800,
    lineHeight: 1.3,
  },
  checkboxRow: {
    display: "grid",
    gridTemplateColumns: "18px minmax(0, 1fr)",
    alignItems: "start",
    columnGap: "12px",
  },
  checkbox: {
    width: "18px",
    height: "18px",
    margin: "3px 0 0",
    accentColor: "#2f6499",
  },
  checkboxLabel: {
    color: "#17324d",
    fontSize: "14px",
    fontWeight: 700,
    lineHeight: 1.6,
    wordBreak: "break-word",
  },
  error: {
    margin: "10px 0 0 30px",
    color: "#9c4151",
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1.5,
  },
  footer: {
    padding: "18px 28px 24px",
    borderTop: "1px solid #dbe5ef",
    backgroundColor: "#ffffff",
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    flexWrap: "wrap",
    flexShrink: 0,
    boxSizing: "border-box",
  },
  footerButton: {
    flex: "1 1 180px",
    minWidth: "180px",
  },
  footerSecondaryButtonDesktop: {
    flex: "0 0 220px",
    maxWidth: "220px",
  },
  footerPrimaryButtonDesktop: {
    flex: "0 0 380px",
    maxWidth: "420px",
  },
};

const getFocusableElements = (container) => {
  if (!container) {
    return [];
  }

  return [...container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  )].filter(
    (element) =>
      !element.hasAttribute("disabled") &&
      element.getAttribute("aria-hidden") !== "true",
  );
};

const DataPrivacyConsentModal = ({
  isOpen,
  noticeVersion,
  isChecked,
  errorMessage,
  isSubmitting,
  confirmLabel,
  onToggleChecked,
  onCancel,
  onConfirm,
}) => {
  const dialogRef = useRef(null);
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [isTabletViewport, setIsTabletViewport] = useState(false);
  const checkboxId = useMemo(
    () => `household-privacy-ack-${noticeVersion || "current"}`,
    [noticeVersion],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleResize = () => {
      const viewportWidth = window.innerWidth;
      setIsCompactViewport(viewportWidth <= 640);
      setIsTabletViewport(viewportWidth > 640 && viewportWidth <= 1024);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    if (!isOpen || typeof document === "undefined") {
      return undefined;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const dialogElement = dialogRef.current;
    const focusableElements = getFocusableElements(dialogElement);
    focusableElements[0]?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const updatedFocusableElements = getFocusableElements(dialogRef.current);

      if (updatedFocusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = updatedFocusableElements[0];
      const lastElement =
        updatedFocusableElements[updatedFocusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    dialogElement?.addEventListener("keydown", handleKeyDown);

    return () => {
      dialogElement?.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isChecked, isSubmitting]);

  if (!isOpen) {
    return null;
  }

  return (
    <div style={modalStyles.backdrop}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="household-privacy-title"
        style={{
          ...modalStyles.panel,
          ...(isTabletViewport ? modalStyles.tabletPanel : null),
          ...(isCompactViewport ? modalStyles.compactPanel : null),
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={modalStyles.header}>
          <h3 id="household-privacy-title" style={modalStyles.title}>
            {HOUSEHOLD_PRIVACY_NOTICE_TITLE}
          </h3>
          <p style={modalStyles.version}>Notice version: {noticeVersion}</p>
        </div>

        <div style={modalStyles.body}>
          <div style={modalStyles.bodyInner}>
            {HOUSEHOLD_PRIVACY_NOTICE_PARAGRAPHS.map((paragraph) => (
              <p key={paragraph} style={modalStyles.paragraph}>
                {paragraph}
              </p>
            ))}

            <div style={modalStyles.confirmationBox}>
              <h4 style={modalStyles.acknowledgmentHeading}>
                {HOUSEHOLD_PRIVACY_ACKNOWLEDGMENT_HEADING}
              </h4>
              <div style={modalStyles.checkboxRow}>
                <input
                  id={checkboxId}
                  type="checkbox"
                  checked={isChecked}
                  onChange={(event) => onToggleChecked(event.target.checked)}
                  style={modalStyles.checkbox}
                />
                <label htmlFor={checkboxId} style={modalStyles.checkboxLabel}>
                  {HOUSEHOLD_PRIVACY_CONFIRMATION_LABEL}
                </label>
              </div>

              {errorMessage ? (
                <p style={modalStyles.error} role="alert">
                  {errorMessage}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div style={modalStyles.footer}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            style={{
              ...pageHeaderStyles.secondaryButton,
              ...modalStyles.footerButton,
              ...(isCompactViewport
                ? null
                : modalStyles.footerSecondaryButtonDesktop),
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting || !isChecked}
            style={{
              ...pageHeaderStyles.primaryButton,
              ...modalStyles.footerButton,
              ...(isCompactViewport
                ? null
                : modalStyles.footerPrimaryButtonDesktop),
              opacity: isSubmitting || !isChecked ? 0.7 : 1,
            }}
          >
            {isSubmitting ? "Saving..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataPrivacyConsentModal;
