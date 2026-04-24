import React from "react";

export const pageHeaderStyles = {
  wrapper: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: "18px",
    flexWrap: "wrap",
  },
  content: {
    flex: "1 1 420px",
    minWidth: 0,
  },
  eyebrow: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "10px",
    padding: "6px 12px",
    borderRadius: "999px",
    backgroundColor: "#dbe8f6",
    color: "#40617f",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  title: {
    margin: 0,
    color: "#17324d",
    fontSize: "clamp(24px, 3vw, 34px)",
    lineHeight: 1.12,
    letterSpacing: "-0.03em",
  },
  description: {
    margin: "10px 0 0",
    maxWidth: "720px",
    color: "#5d7188",
    fontSize: "15px",
    lineHeight: 1.7,
  },
  actions: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
    flex: "0 1 auto",
  },
  primaryButton: {
    border: "none",
    borderRadius: "14px",
    padding: "12px 18px",
    background: "linear-gradient(135deg, #2f6499 0%, #4c86be 100%)",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 12px 24px rgba(58, 97, 141, 0.18)",
    minHeight: "46px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    whiteSpace: "nowrap",
    boxSizing: "border-box",
  },
  secondaryButton: {
    border: "1px solid #c6d8ea",
    borderRadius: "14px",
    padding: "12px 18px",
    backgroundColor: "#f8fbfe",
    color: "#2a4c6f",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    minHeight: "46px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    whiteSpace: "nowrap",
    boxSizing: "border-box",
  },
};

const PageHeader = ({ eyebrow, title, description, actions = [] }) => {
  return (
    <div style={pageHeaderStyles.wrapper}>
      <div style={pageHeaderStyles.content}>
        {eyebrow ? <div style={pageHeaderStyles.eyebrow}>{eyebrow}</div> : null}
        <h2 style={pageHeaderStyles.title}>{title}</h2>
        {description ? (
          <p style={pageHeaderStyles.description}>{description}</p>
        ) : null}
      </div>

      {actions.length > 0 ? (
        <div style={pageHeaderStyles.actions}>
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              style={
                action.variant === "secondary"
                  ? pageHeaderStyles.secondaryButton
                  : pageHeaderStyles.primaryButton
              }
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default PageHeader;
