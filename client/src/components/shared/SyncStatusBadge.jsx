import React from "react";
import { getSyncBadgePalette, getSyncLabel } from "../../offline/syncStatus";

const SyncStatusBadge = ({ status = "SYNCED", compact = false, label = null }) => {
  const palette = getSyncBadgePalette(status);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: compact ? "4px 8px" : "5px 10px",
        borderRadius: "999px",
        fontSize: compact ? "11px" : "12px",
        fontWeight: 700,
        lineHeight: 1.2,
        border: `1px solid ${palette.borderColor}`,
        backgroundColor: palette.backgroundColor,
        color: palette.color,
        whiteSpace: "nowrap",
      }}
    >
      {label || getSyncLabel(status)}
    </span>
  );
};

export default SyncStatusBadge;
