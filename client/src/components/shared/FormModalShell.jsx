import React from "react";
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
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      style={{
        ...overlayStyles,
        zIndex,
      }}
    >
      <div
        style={{
          ...contentStyles,
          maxWidth,
        }}
      >
        {title || onClose ? (
          <div style={headerStyles}>
            <div>
              {title ? <h3 style={titleStyles}>{title}</h3> : null}
              {description ? <p style={descriptionStyles}>{description}</p> : null}
            </div>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                style={closeButtonStyles}
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
        <div style={bodyStyles}>{children}</div>
        {footer ? <div style={footerStyles}>{footer}</div> : null}
      </div>
    </div>
  );
};

export default FormModalShell;
