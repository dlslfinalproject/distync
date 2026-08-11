import React from "react";
import { pageHeaderStyles } from "../layout/PageHeader";
import { FiX } from "react-icons/fi";

const overlayStyles = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(18, 34, 51, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  zIndex: 1300,
};

const modalStyles = {
  width: "100%",
  maxHeight: "86vh",
  overflowY: "auto",
  backgroundColor: "#ffffff",
  borderRadius: "20px",
  padding: "28px",
  boxShadow: "0 24px 48px rgba(20, 48, 78, 0.2)",
  boxSizing: "border-box",
};

const DetailsModalShell = ({
  isOpen,
  title,
  description,
  children,
  onClose,
  maxWidth = "960px",
  titleStyle = null,
  closeMode = "button",
  panelStyle = null,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div style={overlayStyles}>
      <div
        style={{
          ...modalStyles,
          maxWidth,
          ...(panelStyle || null),
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "16px",
            alignItems: "flex-start",
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                color: "#17324d",
                fontSize: "24px",
                ...titleStyle,
              }}
            >
              {title}
            </h3>
            {description ? (
              <p
                style={{
                  margin: "10px 0 0",
                  color: "#5d7188",
                  fontSize: "15px",
                  lineHeight: 1.6,
                }}
              >
                {description}
              </p>
            ) : null}
          </div>
          {closeMode === "icon" ? (
            <button
              type="button"
              onClick={onClose}
              style={{
                ...pageHeaderStyles.secondaryButton,
                minWidth: "44px",
                width: "44px",
                height: "44px",
                padding: 0,
                borderRadius: "14px",
              }}
              aria-label="Close details"
            >
              <FiX />
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              style={pageHeaderStyles.secondaryButton}
            >
              Close
            </button>
          )}
        </div>

        <div style={{ marginTop: "20px" }}>{children}</div>
      </div>
    </div>
  );
};

export default DetailsModalShell;
