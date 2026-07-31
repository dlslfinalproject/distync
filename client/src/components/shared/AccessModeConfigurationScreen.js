import React from "react";

const pageStyles = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: "24px",
  boxSizing: "border-box",
  background:
    "linear-gradient(180deg, #edf4fb 0%, #e5eef7 52%, #dde7f2 100%)",
  fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
  color: "#17324d",
};

const panelStyles = {
  width: "min(560px, 100%)",
  backgroundColor: "#ffffff",
  border: "1px solid #d7e2ef",
  borderRadius: "20px",
  padding: "clamp(24px, 4vw, 32px)",
  boxShadow: "0 16px 34px rgba(76, 101, 132, 0.12)",
  display: "grid",
  gap: "14px",
};

const alertStyles = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "fit-content",
  minHeight: "32px",
  padding: "0 12px",
  borderRadius: "999px",
  backgroundColor: "#fff3f1",
  color: "#9d4d58",
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const AccessModeConfigurationScreen = () => {
  return React.createElement(
    "main",
    { style: pageStyles },
    React.createElement(
      "section",
      {
        style: panelStyles,
        role: "alert",
        "aria-live": "assertive",
      },
      React.createElement(
        "span",
        { style: alertStyles },
        "Configuration Required",
      ),
      React.createElement(
        "h1",
        { style: { margin: 0, fontSize: "32px", lineHeight: 1.15 } },
        "DISTYNC configuration error",
      ),
      React.createElement(
        "p",
        { style: { margin: 0, color: "#60738a", lineHeight: 1.7 } },
        "The application access mode is not configured correctly.",
      ),
      React.createElement(
        "p",
        { style: { margin: 0, color: "#60738a", lineHeight: 1.7 } },
        "Set VITE_ACCESS_MODE to DEVELOPMENT or DEMO, then restart the application.",
      ),
    ),
  );
};

export default AccessModeConfigurationScreen;
