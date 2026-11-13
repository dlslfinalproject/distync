import React from "react";

const EmptyState = ({
  message = "No records found.",
  title,
  compact = false,
  style,
}) => (
  <div
    style={{
      padding: compact ? 0 : "12px 0",
      color: "#60738a",
      ...style,
    }}
  >
    {title ? (
      <h4 style={{ margin: 0, color: "#17324d", fontSize: "16px" }}>{title}</h4>
    ) : null}
    <p
      style={{
        margin: title ? "8px 0 0" : 0,
        fontSize: "14px",
        lineHeight: 1.6,
      }}
    >
      {message}
    </p>
  </div>
);

export default EmptyState;
