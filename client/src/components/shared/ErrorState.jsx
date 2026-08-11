import React from "react";

const ErrorState = ({ message, style, compact = false }) => {
  if (!message) {
    return null;
  }

  return (
    <div
      style={{
        padding: compact ? "0" : "14px 16px",
        borderRadius: compact ? "0" : "14px",
        backgroundColor: compact ? "transparent" : "#fff3f1",
        border: compact ? "none" : "1px solid #f1d2cc",
        color: "#9d4d58",
        fontSize: "14px",
        fontWeight: compact ? 500 : 600,
        lineHeight: 1.6,
        ...style,
      }}
    >
      {message}
    </div>
  );
};

export default ErrorState;
