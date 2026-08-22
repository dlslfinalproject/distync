import React from "react";
import { pageHeaderStyles } from "../layout/PageHeader";
import SyncStatusBadge from "./SyncStatusBadge";
import FormModalShell from "./FormModalShell";
import {
  formatSyncHistoryDateTime,
  getConflictComparisonRows,
  getConflictExplanation,
  getConflictReasonLabel,
  getConflictResolutionSummary,
  getSyncRecordDetails,
  SYNC_MISSING_VALUE,
} from "../../features/sync/syncManagementHelpers";

const modalStyles = {
  panel: {
    maxHeight: "calc(100vh - 32px)",
    display: "flex",
    flexDirection: "column",
    overflowY: "hidden",
    overflowX: "hidden",
    borderRadius: "20px",
    padding: "20px",
  },
  body: {
    overflowY: "auto",
    overflowX: "hidden",
    paddingRight: "4px",
  },
  footer: {
    marginTop: "16px",
    paddingTop: "14px",
    borderTop: "1px solid #e0eaf4",
    flexShrink: 0,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
    gap: "16px",
  },
  card: {
    padding: "16px",
    borderRadius: "16px",
    backgroundColor: "#f8fbfe",
    border: "1px solid #d6e2ee",
    minWidth: 0,
  },
  conflictHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
  },
  reasonTitle: {
    margin: 0,
    color: "#17324d",
    fontSize: "16px",
    fontWeight: 800,
    lineHeight: 1.5,
    wordBreak: "break-word",
  },
  sectionTitle: {
    margin: "0 0 14px",
    color: "#5f7892",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  fieldGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(210px, 100%), 1fr))",
    gap: "14px",
  },
  fieldStack: {
    display: "grid",
    gap: "14px",
  },
  field: {
    display: "grid",
    gap: "5px",
    minWidth: 0,
  },
  fieldLabel: {
    color: "#5f7892",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  value: {
    color: "#17324d",
    fontSize: "14px",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  comparisonGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))",
    gap: "16px",
  },
  comparisonPanel: {
    border: "1px solid #d6e2ee",
    borderRadius: "12px",
    padding: "14px",
    backgroundColor: "#ffffff",
    minWidth: 0,
  },
  comparisonTitle: {
    margin: "0 0 12px",
    color: "#17324d",
    fontSize: "14px",
    fontWeight: 800,
  },
  comparisonRow: {
    padding: "10px 0",
    borderTop: "1px solid #e0eaf4",
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

const ACTION_LABELS = {
  MARK_REVIEWED: "Mark Reviewed",
  KEEP_SERVER: "Keep Saved Record",
  APPLY_LOCAL: "Use This Device Record",
};

const isUuidLikeValue = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "").trim(),
  );

const getResolvedByDisplay = (conflict = {}) => {
  const value =
    conflict.resolved_by_name ||
    conflict.reviewer_name ||
    conflict.resolvedByName ||
    "";

  return value && !isUuidLikeValue(value) ? value : "";
};

const renderMetadataItem = (label, value) =>
  value && value !== SYNC_MISSING_VALUE ? (
    <div style={modalStyles.field}>
      <div style={modalStyles.fieldLabel}>{label}</div>
      <div style={modalStyles.value}>{value}</div>
    </div>
  ) : null;

const renderComparisonPanel = (title, rows, valueKey) => (
  <div style={modalStyles.comparisonPanel}>
    <h5 style={modalStyles.comparisonTitle}>{title}</h5>
    {rows.map((row) => (
      <div key={`${title}-${row.label}`} style={modalStyles.comparisonRow}>
        <div style={modalStyles.fieldLabel}>{row.label}</div>
        <div style={modalStyles.value}>{row[valueKey]}</div>
      </div>
    ))}
  </div>
);

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
  const details = getSyncRecordDetails(conflict);
  const conflictReason = conflict.conflict_reason || getConflictReasonLabel(conflict);
  const resolutionSummary = getConflictResolutionSummary(conflict);
  const comparisonRows = getConflictComparisonRows(conflict);
  const formattedResolvedAt = formatSyncHistoryDateTime(conflict.resolved_at);
  const resolvedBy = getResolvedByDisplay(conflict);
  const requiresReason = availableActions.some((action) =>
    ["KEEP_SERVER", "APPLY_LOCAL"].includes(action),
  );
  const footer = (
    <>
      <button
        type="button"
        onClick={onClose}
        style={pageHeaderStyles.secondaryButton}
        disabled={isResolving}
      >
        Close
      </button>
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
    </>
  );

  return (
    <FormModalShell
      isOpen={isOpen}
      title="Sync Conflict Detail"
      onClose={onClose}
      closeButtonLabel="Close sync conflict detail"
      closeOnBackdrop={false}
      isCloseDisabled={isResolving}
      maxWidth="min(820px, 100vw)"
      overlayStyle={{ padding: "16px" }}
      contentStyle={modalStyles.panel}
      bodyStyle={modalStyles.body}
      footerStyle={modalStyles.footer}
      footer={footer}
    >
      <div style={{ ...modalStyles.card, marginBottom: "16px" }}>
        <div style={modalStyles.sectionTitle}>Conflict</div>
        <div style={modalStyles.conflictHeader}>
          <strong style={modalStyles.reasonTitle}>{conflictReason}</strong>
          <SyncStatusBadge status={isResolved ? "RESOLVED" : "OPEN"} />
        </div>
      </div>

      <div style={modalStyles.grid}>
        <section
          style={{ ...modalStyles.card, gridColumn: "1 / -1" }}
          aria-labelledby="conflict-summary-heading"
        >
          <h4 id="conflict-summary-heading" style={modalStyles.sectionTitle}>
            Conflict Summary
          </h4>
          <div style={modalStyles.fieldGrid}>
            {renderMetadataItem("Record Type", details.recordType)}
            {renderMetadataItem("Affected Record", details.subject)}
            {renderMetadataItem("Disaster Event", details.disasterEvent)}
          </div>
        </section>

        <section
          style={{ ...modalStyles.card, gridColumn: "1 / -1" }}
          aria-labelledby="conflict-reason-heading"
        >
          <h4 id="conflict-reason-heading" style={modalStyles.sectionTitle}>
            Why It Happened
          </h4>
          <div style={modalStyles.value}>{getConflictExplanation(conflict)}</div>
        </section>

        <section
          style={{ ...modalStyles.card, gridColumn: "1 / -1" }}
          aria-labelledby="conflict-resolution-heading"
        >
          <h4 id="conflict-resolution-heading" style={modalStyles.sectionTitle}>
            {isResolved ? "Resolution" : "Current Action"}
          </h4>
          {isResolved ? (
            <>
              <div style={modalStyles.fieldGrid}>
                {renderMetadataItem("Result", resolutionSummary.result)}
                {renderMetadataItem("Resolved At", formattedResolvedAt)}
                {renderMetadataItem("Resolved By", resolvedBy)}
              </div>
              <div style={{ ...modalStyles.field, marginTop: "14px" }}>
                <div style={modalStyles.fieldLabel}>What Happened</div>
                <div style={modalStyles.value}>{resolutionSummary.whatHappened}</div>
              </div>
              {conflict.resolution_reason ? (
                <div style={{ ...modalStyles.field, marginTop: "14px" }}>
                  <div style={modalStyles.fieldLabel}>Review Note</div>
                  <div style={modalStyles.value}>{conflict.resolution_reason}</div>
                </div>
              ) : null}
            </>
          ) : (
            <div style={modalStyles.fieldStack}>
              <div style={modalStyles.field}>
                <div style={modalStyles.fieldLabel}>What You Need To Do</div>
                <div style={modalStyles.value}>{resolutionSummary.whatHappened}</div>
              </div>
              {availableActions.length > 0 ? (
                <label style={modalStyles.field}>
                  <span style={modalStyles.fieldLabel}>Review Note</span>
                  <textarea
                    value={resolutionReason}
                    onChange={(event) => onResolutionReasonChange(event.target.value)}
                    style={modalStyles.textarea}
                    placeholder={
                      requiresReason
                        ? "Reason required for this review action"
                        : "Optional review note"
                    }
                    disabled={isResolving}
                  />
                </label>
              ) : null}
              {availableActions.includes("KEEP_SERVER") ? (
                <p style={modalStyles.warningText}>
                  Keeping the saved DISTYNC record closes the conflict without
                  changing operational data.
                </p>
              ) : null}
            </div>
          )}
        </section>

        {comparisonRows.length > 0 ? (
          <section
            style={{ ...modalStyles.card, gridColumn: "1 / -1" }}
            aria-labelledby="conflict-comparison-heading"
          >
            <h4 id="conflict-comparison-heading" style={modalStyles.sectionTitle}>
              Record Comparison
            </h4>
            <div style={modalStyles.comparisonGrid}>
              {renderComparisonPanel(
                "This Device Record",
                comparisonRows,
                "localValue",
              )}
              {renderComparisonPanel(
                "Saved DISTYNC Record",
                comparisonRows,
                "serverValue",
              )}
            </div>
          </section>
        ) : null}
      </div>
    </FormModalShell>
  );
};

export default SyncConflictDetailModal;
