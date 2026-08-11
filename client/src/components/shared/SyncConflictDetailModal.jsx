import React from "react";
import { pageHeaderStyles } from "../layout/PageHeader";
import SyncStatusBadge from "./SyncStatusBadge";

const modalStyles = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(18, 34, 51, 0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    zIndex: 1400,
  },
  modal: {
    width: "100%",
    maxWidth: "780px",
    maxHeight: "85vh",
    overflowY: "auto",
    backgroundColor: "#ffffff",
    borderRadius: "20px",
    padding: "28px",
    boxShadow: "0 24px 48px rgba(20, 48, 78, 0.2)",
  },
  title: {
    margin: 0,
    color: "#17324d",
    fontSize: "22px",
  },
  message: {
    margin: "10px 0 0",
    color: "#5d7188",
    fontSize: "15px",
    lineHeight: 1.6,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
    marginTop: "20px",
  },
  card: {
    padding: "16px",
    borderRadius: "16px",
    backgroundColor: "#f8fbfe",
    border: "1px solid #d6e2ee",
  },
  label: {
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#66809c",
    marginBottom: "8px",
  },
  value: {
    fontSize: "14px",
    color: "#21405f",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  actions: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    marginTop: "24px",
  },
  textarea: {
    width: "100%",
    minHeight: "90px",
    resize: "vertical",
    border: "1px solid #bfd0e0",
    borderRadius: "8px",
    padding: "10px 12px",
    color: "#17324d",
    fontSize: "14px",
    lineHeight: 1.5,
    boxSizing: "border-box",
  },
  warningText: {
    margin: "8px 0 0",
    color: "#8a5a00",
    fontSize: "13px",
    lineHeight: 1.5,
  },
};

const formatSummary = (value) => {
  if (!value) {
    return "--";
  }

  if (typeof value === "string") {
    return value;
  }

  const entries = Object.entries(value);
  if (entries.length === 0) {
    return "--";
  }

  return entries.map(([key, itemValue]) => `${key}: ${String(itemValue)}`).join("\n");
};

const ACTION_LABELS = {
  MARK_REVIEWED: "Mark Reviewed",
  KEEP_SERVER: "Keep Server",
  APPLY_LOCAL: "Apply Local",
};

const SyncConflictDetailModal = ({
  isOpen,
  conflict,
  onClose,
  onResolve,
  resolutionReason,
  onResolutionReasonChange,
  isResolving = false,
}) => {
  if (!isOpen || !conflict) {
    return null;
  }

  const availableActions = Array.isArray(conflict.availableResolutionActions)
    ? conflict.availableResolutionActions
    : [];
  const isResolved = conflict.status === "RESOLVED";
  const requiresReason = availableActions.some((action) =>
    ["KEEP_SERVER", "APPLY_LOCAL"].includes(action),
  );

  return (
    <div style={modalStyles.overlay}>
      <div style={modalStyles.modal}>
        <h3 style={modalStyles.title}>Sync Conflict Detail</h3>
        <p style={modalStyles.message}>
          Review the recorded local and server values before taking an
          authorized resolution action.
        </p>

        <div style={modalStyles.grid}>
          <div style={modalStyles.card}>
            <div style={modalStyles.label}>Module / Table</div>
            <div style={modalStyles.value}>
              {conflict.entity_type || "--"}
              {"\n"}
              Operation: {conflict.operation_type || "--"}
            </div>
          </div>

          <div style={modalStyles.card}>
            <div style={modalStyles.label}>Status</div>
            <div style={modalStyles.value}>
              <SyncStatusBadge status="CONFLICT" />
              <span style={{ marginLeft: "8px" }}>
                <SyncStatusBadge status={isResolved ? "RESOLVED" : "CONFLICT"} />
              </span>
              <div style={{ marginTop: "8px" }}>
                {isResolved ? "Conflict - Resolved" : "Conflict - For Review"}
              </div>
            </div>
          </div>

          <div style={modalStyles.card}>
            <div style={modalStyles.label}>Winning Side</div>
            <div style={modalStyles.value}>
              {conflict.resolved_payload_json?.winner === "LOCAL"
                ? "Local version"
                : conflict.resolved_payload_json?.winner === "SERVER"
                  ? "Server version"
                  : "--"}
            </div>
          </div>

          <div style={modalStyles.card}>
            <div style={modalStyles.label}>Resolution Action</div>
            <div style={modalStyles.value}>
              {conflict.resolution_action || "--"}
              {"\n"}
              Reason: {conflict.resolution_reason || "--"}
            </div>
          </div>

          <div style={modalStyles.card}>
            <div style={modalStyles.label}>Conflict Reason</div>
            <div style={modalStyles.value}>{conflict.conflict_reason || "--"}</div>
          </div>

          <div style={modalStyles.card}>
            <div style={modalStyles.label}>Resolution Strategy</div>
            <div style={modalStyles.value}>
              {conflict.resolution_strategy || "--"}
            </div>
          </div>

          <div style={modalStyles.card}>
            <div style={modalStyles.label}>Local Payload Summary</div>
            <div style={modalStyles.value}>
              {formatSummary(conflict.local_payload_summary)}
            </div>
          </div>

          <div style={modalStyles.card}>
            <div style={modalStyles.label}>Server Payload Summary</div>
            <div style={modalStyles.value}>
              {formatSummary(conflict.server_payload_summary)}
            </div>
          </div>

          <div style={modalStyles.card}>
            <div style={modalStyles.label}>Timestamps</div>
            <div style={modalStyles.value}>
              Client: {conflict.client_timestamp || "--"}
              {"\n"}
              Server: {conflict.server_timestamp || "--"}
              {"\n"}
              Resolved: {conflict.resolved_at || "--"}
            </div>
          </div>
        </div>

        {availableActions.length > 0 ? (
          <div style={{ ...modalStyles.card, marginTop: "16px" }}>
            <div style={modalStyles.label}>Resolution Reason</div>
            <textarea
              value={resolutionReason}
              onChange={(event) => onResolutionReasonChange(event.target.value)}
              style={modalStyles.textarea}
              placeholder={
                requiresReason
                  ? "Reason required for Keep Server or Apply Local"
                  : "Optional review note"
              }
              disabled={isResolving}
            />
            {availableActions.includes("KEEP_SERVER") ? (
              <p style={modalStyles.warningText}>
                Keeping the server record closes the conflict without changing
                authoritative domain data.
              </p>
            ) : null}
          </div>
        ) : null}

        <div style={modalStyles.actions}>
          {availableActions.map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => onResolve(action)}
              style={
                action === "MARK_REVIEWED"
                  ? pageHeaderStyles.secondaryButton
                  : pageHeaderStyles.primaryButton
              }
              disabled={isResolving}
            >
              {ACTION_LABELS[action] || action}
            </button>
          ))}
          <button
            type="button"
            onClick={onClose}
            style={pageHeaderStyles.secondaryButton}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SyncConflictDetailModal;
