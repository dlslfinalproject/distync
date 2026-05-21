import React from "react";

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

const contentStyles = {
  width: "100%",
  backgroundColor: "#ffffff",
  borderRadius: "20px",
  padding: "28px",
  boxShadow: "0 24px 48px rgba(20, 48, 78, 0.2)",
  boxSizing: "border-box",
};

const titleStyles = {
  margin: 0,
  color: "#17324d",
  fontSize: "24px",
};

const descriptionStyles = {
  margin: "12px 0 0",
  color: "#5d7188",
  fontSize: "14px",
  lineHeight: 1.6,
};

const bodyStyles = {
  marginTop: "22px",
};

const footerStyles = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "12px",
  marginTop: "24px",
  flexWrap: "wrap",
};

const FormModalShell = ({
  isOpen,
  title,
  description,
  children,
  footer,
  maxWidth = "480px",
  zIndex = 1300,
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
        {title ? <h3 style={titleStyles}>{title}</h3> : null}
        {description ? <p style={descriptionStyles}>{description}</p> : null}
        <div style={bodyStyles}>{children}</div>
        {footer ? <div style={footerStyles}>{footer}</div> : null}
      </div>
    </div>
  );
};

export default FormModalShell;
