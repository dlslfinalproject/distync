import React from "react";
import { Link } from "react-router-dom";
import { formatSyncDateTime } from "../../features/sync/syncManagementHelpers.js";
import { getSyncHealthPresentation } from "../../offline/syncStatus.js";

const badgePalette = {
  offline: {
    backgroundColor: "#e0f2fe",
    borderColor: "#bae6fd",
    color: "#075985",
  },
  healthy: {
    backgroundColor: "#e6f5ec",
    borderColor: "#ccebd9",
    color: "#2d7a4f",
  },
  pending: {
    backgroundColor: "#e0f2fe",
    borderColor: "#bae6fd",
    color: "#075985",
  },
  failed: {
    backgroundColor: "#fff3f1",
    borderColor: "#f4c9c2",
    color: "#a14538",
  },
  conflict: {
    backgroundColor: "#fef3c7",
    borderColor: "#fde68a",
    color: "#92400e",
  },
};

const cardStyles = {
  full: {
    backgroundColor: "#ffffff",
    border: "1px solid #d7e2ef",
    borderRadius: "18px",
    boxSizing: "border-box",
    boxShadow: "0 10px 24px rgba(76, 101, 132, 0.08)",
    display: "grid",
    gap: "18px",
    padding: "clamp(18px, 2vw, 24px)",
    width: "100%",
  },
  compact: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    border: "1px solid #d7e2ef",
    borderRadius: "14px",
    boxSizing: "border-box",
    display: "flex",
    flexWrap: "wrap",
    gap: "12px 16px",
    padding: "12px 16px",
    width: "100%",
  },
};

const getAccentColor = (state) => {
  if (state === "HEALTHY") {
    return "#2d7a4f";
  }

  if (state === "PENDING") {
    return "#075985";
  }

  return "#a14538";
};

const SyncHealthStatus = ({
  health,
  isOnline = true,
  variant = "full",
  syncCenterPath = "/barangay/sync",
}) => {
  const basePresentation = health ||
    getSyncHealthPresentation({ isLoading: true });
  const isOffline = isOnline === false || basePresentation.isOnline === false;
  const presentation = isOffline
    ? {
        ...basePresentation,
        state: "PENDING",
        needsAttention: true,
        badges: [
          { type: "offline", label: "Offline" },
          ...basePresentation.badges.filter((badge) => badge.type !== "healthy"),
        ],
        message:
          "You're offline. Supported actions will be saved on this device and synchronized when connection returns.",
      }
    : basePresentation;

  if (variant === "compact" && !isOffline && !presentation.needsAttention) {
    return null;
  }

  const isCompact = variant === "compact";
  const accentColor = getAccentColor(presentation.state);

  return (
    <section
      aria-label="Synchronization status"
      aria-live="polite"
      role="status"
      style={{
        ...cardStyles[isCompact ? "compact" : "full"],
        borderLeft: `4px solid ${accentColor}`,
      }}
    >
      <div
        style={{
          display: "grid",
          flex: "1 1 260px",
          gap: isCompact ? "3px" : "8px",
          minWidth: 0,
        }}
      >
        {!isCompact ? (
          <h3
            style={{
              color: "#17324d",
              fontSize: "13px",
              letterSpacing: "0.08em",
              margin: 0,
              textTransform: "uppercase",
            }}
          >
            Sync Status
          </h3>
        ) : null}
        <p
          style={{
            color: "#314b67",
            fontSize: isCompact ? "14px" : "16px",
            fontWeight: 700,
            lineHeight: 1.45,
            margin: 0,
            overflowWrap: "anywhere",
          }}
        >
          {presentation.message}
        </p>
        {!isCompact && presentation.lastSuccessfulSyncAt ? (
          <p
            style={{
              color: "#60738a",
              fontSize: "14px",
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            Last successful sync: {formatSyncDateTime(presentation.lastSuccessfulSyncAt)}
          </p>
        ) : null}
      </div>

      {presentation.badges.length > 0 ? (
        <div
          aria-label="Synchronization status details"
          style={{
            display: "flex",
            flex: "0 1 auto",
            flexWrap: "wrap",
            gap: "8px",
            minWidth: 0,
          }}
        >
          {presentation.badges.map((badge) => (
            <span
              key={badge.type}
              style={{
                ...badgePalette[badge.type],
                border: "1px solid",
                borderRadius: "999px",
                fontSize: "12px",
                fontWeight: 700,
                lineHeight: 1.3,
                padding: "6px 10px",
                whiteSpace: "nowrap",
              }}
            >
              {badge.label}
            </span>
          ))}
        </div>
      ) : null}

      {isCompact && presentation.needsAttention ? (
        <Link
          to={syncCenterPath}
          style={{
            alignItems: "center",
            border: "1px solid #c6d8ea",
            borderRadius: "10px",
            color: "#24496e",
            display: "inline-flex",
            flex: "0 0 auto",
            fontSize: "13px",
            fontWeight: 700,
            justifyContent: "center",
            minHeight: "44px",
            padding: "8px 12px",
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          View Sync Center
        </Link>
      ) : null}
    </section>
  );
};

export default SyncHealthStatus;

