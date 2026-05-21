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
    justifyContent: "flex-end",
    marginTop: "24px",
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

const SyncConflictDetailModal = ({ isOpen, conflict, onClose }) => {
  if (!isOpen || !conflict) {
    return null;
  }

  return (
    <div style={modalStyles.overlay}>
      <div style={modalStyles.modal}>
        <h3 style={modalStyles.title}>Sync Conflict Detail</h3>
        <p style={modalStyles.message}>
          Review why this conflict was raised, which timestamp won, and what
          payload summaries were compared during automatic resolution.
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
                <SyncStatusBadge status="RESOLVED" />
              </span>
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
            <div style={modalStyles.label}>Resolution Status</div>
            <div style={modalStyles.value}>{conflict.status || "--"}</div>
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

        <div style={modalStyles.actions}>
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
