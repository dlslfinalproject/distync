import React from "react";

const getNormalizedStatus = (status) => {
  const normalized = String(status || "").toUpperCase();

  if (normalized === "CLOSED" || normalized === "ARCHIVED") {
    return "COMPLETED";
  }

  return normalized || "UNKNOWN";
};

const getStatusPillStyles = (status) => {
  const normalizedStatus = getNormalizedStatus(status);

  if (normalizedStatus === "ACTIVE") {
    return {
      backgroundColor: "#e8f3ff",
      color: "#1f5f99",
      border: "1px solid #c8dcf0",
    };
  }

  if (normalizedStatus === "COMPLETED") {
    return {
      backgroundColor: "#edf7ef",
      color: "#2f7a4b",
      border: "1px solid #d4ead9",
    };
  }

  if (normalizedStatus === "CLAIMED") {
    return {
      backgroundColor: "#e6f5ec",
      color: "#2d7a4f",
      border: "1px solid #d4ead9",
    };
  }

  if (normalizedStatus === "UNCLAIMED" || normalizedStatus === "ISSUED") {
    return {
      backgroundColor: "#eef5fc",
      color: "#295f92",
      border: "1px solid #c8dbee",
    };
  }

  if (normalizedStatus === "VOID" || normalizedStatus === "CANCELLED") {
    return {
      backgroundColor: "#f6ebeb",
      color: "#9d4d58",
      border: "1px solid #efd4d8",
    };
  }

  return {
    backgroundColor: "#eef2f6",
    color: "#5f7288",
    border: "1px solid #d7e2ef",
  };
};

const getDisplayLabel = (status, label) => {
  if (label) {
    return label;
  }

  return getNormalizedStatus(status);
};

const StatusPill = ({
  status,
  label,
  style = {},
}) => {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "6px 12px",
        borderRadius: "999px",
        fontSize: "13px",
        fontWeight: 700,
        lineHeight: 1,
        whiteSpace: "nowrap",
        ...getStatusPillStyles(status),
        ...style,
      }}
    >
      {getDisplayLabel(status, label)}
    </span>
  );
};

export default StatusPill;