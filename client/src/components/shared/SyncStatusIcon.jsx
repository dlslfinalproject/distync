import React from "react";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiRefreshCcw,
} from "react-icons/fi";
import {
  getSyncBadgePalette,
  getSyncLabel,
  getNormalizedSyncStatus,
} from "../../offline/syncStatus";

const getIcon = (status) => {
  const normalizedStatus = getNormalizedSyncStatus(status);

  if (normalizedStatus === "PENDING") {
    return <FiClock size={14} />;
  }

  if (normalizedStatus === "FAILED" || normalizedStatus === "CONFLICT") {
    return <FiAlertTriangle size={14} />;
  }

  if (normalizedStatus === "RESOLVED") {
    return <FiRefreshCcw size={14} />;
  }

  return <FiCheckCircle size={14} />;
};

const SyncStatusIcon = ({ status = "SYNCED" }) => {
  const palette = getSyncBadgePalette(status);
  const label = getSyncLabel(status);

  return (
    <span
      title={label}
      aria-label={label}
      style={{
        width: "24px",
        height: "24px",
        borderRadius: "999px",
        border: `1px solid ${palette.borderColor}`,
        backgroundColor: palette.backgroundColor,
        color: palette.color,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "0 0 auto",
      }}
    >
      {getIcon(status)}
    </span>
  );
};

export default SyncStatusIcon;
