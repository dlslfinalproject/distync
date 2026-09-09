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
  getResolutionStatusLabel,
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
  errorText: {
    margin: "4px 0 0",
    color: "#b2434f",
    fontSize: "12px",
    fontWeight: 700,
    lineHeight: 1.4,
  },
};

const ACTION_LABELS = {
  MARK_REVIEWED: "Mark Reviewed",
  KEEP_SERVER: "Keep Saved / Discard This Entry",
  APPLY_LOCAL: "Use This Device Record",
  ACCEPT_BOTH: "Accept Both Entries",
};

const getActionLabel = (action) => {
  return ACTION_LABELS[action] || action;
};

const getResolutionConfirmationMessage = (action) => {
  const messages = {
    MARK_REVIEWED:
      "Close this conflict review without changing the saved inventory data.",
    KEEP_SERVER:
      "Keep the saved DISTYNC record and discard this device entry from Inventory.",
    APPLY_LOCAL:
      "Use this device record and apply the correction entered during review.",
    ACCEPT_BOTH:
      "Keep both entries. DISTYNC will assign their batch numbers in offline capture order.",
  };

  return messages[action] || "Record this conflict resolution decision.";
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
  resolutionReasonError = "",
  replacementBarcode = "",
  onReplacementBarcodeChange,
  isResolving = false,
  includeBarangay = false,
  pendingResolutionAction = "",
  onConfirmResolve,
  onCancelPendingResolve,
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
  const isAutomaticCrossBarangayDuplicate =
    conflict.conflict_type === "POSSIBLE_CROSS_BARANGAY_HOUSEHOLD_DUPLICATE" &&
    conflict.resolved_payload_json?.automatic;
  const formattedResolvedAt = formatSyncHistoryDateTime(conflict.resolved_at);
  const resolvedBy = getResolvedByDisplay(conflict);
  const requiresReason = availableActions.some((action) =>
    ["KEEP_SERVER", "APPLY_LOCAL", "ACCEPT_BOTH"].includes(action),
  );
  const isBarcodeCorrection =
    !isResolved &&
    ["DUPLICATE_INVENTORY_BARCODE", "DUPLICATE_INVENTORY_ITEM"].includes(
      conflict.conflict_type,
    ) &&
    ["INVENTORY_ITEM", "INVENTORY_BATCH"].includes(conflict.entity_type) &&
    availableActions.includes("APPLY_LOCAL");
  const isPackagingBarcodeCorrection =
    isBarcodeCorrection &&
    (conflict.entity_type === "INVENTORY_BATCH" ||
      conflict.conflict_type === "DUPLICATE_INVENTORY_ITEM");
  const isConfirmingResolution = Boolean(pendingResolutionAction);
  const footer = (
    <>
      {isConfirmingResolution ? (
        <>
          <button
            type="button"
            onClick={onCancelPendingResolve || onClose}
            style={pageHeaderStyles.secondaryButton}
            disabled={isResolving}
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => onConfirmResolve?.(pendingResolutionAction)}
            style={pageHeaderStyles.primaryButton}
            disabled={isResolving}
          >
            Confirm and Resolve
          </button>
        </>
      ) : (
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
              {getActionLabel(action)}
            </button>
          ))}
        </>
      )}
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
          <SyncStatusBadge
            status={isResolved ? "RESOLVED" : "OPEN"}
            label={getResolutionStatusLabel(conflict)}
          />
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
            {includeBarangay
              ? renderMetadataItem("Barangay", details.barangay)
              : null}
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
          ) : isConfirmingResolution ? (
            <div style={modalStyles.fieldStack}>
              <div style={modalStyles.field}>
                <div style={modalStyles.fieldLabel}>Confirm Action</div>
                <div style={modalStyles.value}>
                  {getResolutionConfirmationMessage(pendingResolutionAction)}
                </div>
              </div>
              {pendingResolutionAction === "APPLY_LOCAL" && replacementBarcode ? (
                <div style={modalStyles.field}>
                  <div style={modalStyles.fieldLabel}>Replacement Barcode</div>
                  <div style={modalStyles.value}>{replacementBarcode}</div>
                </div>
              ) : null}
              {resolutionReason ? (
                <div style={modalStyles.field}>
                  <div style={modalStyles.fieldLabel}>Review Note</div>
                  <div style={modalStyles.value}>{resolutionReason}</div>
                </div>
              ) : null}
              <p style={modalStyles.warningText}>
                Check the comparison and review note before confirming. This
                decision will be recorded in Sync History.
              </p>
            </div>
          ) : (
            <div style={modalStyles.fieldStack}>
              <div style={modalStyles.field}>
                <div style={modalStyles.fieldLabel}>What You Need To Do</div>
                <div style={modalStyles.value}>{resolutionSummary.whatHappened}</div>
              </div>
              {isBarcodeCorrection ? (
                <p style={modalStyles.warningText}>
                  Use This Device Record opens a correction form.{" "}
                  {isPackagingBarcodeCorrection
                    ? "Enter a new unused barcode for this packaging."
                    : "Enter a new barcode, or leave it blank for a manual item."}
                </p>
              ) : null}
              {availableActions.length > 0 ? (
                <label style={modalStyles.field}>
                  <span style={modalStyles.fieldLabel}>
                    Review Note{requiresReason ? " *" : ""}
                  </span>
                  <textarea
                    value={resolutionReason}
                    onChange={(event) => onResolutionReasonChange(event.target.value)}
                    style={{
                      ...modalStyles.textarea,
                      ...(resolutionReasonError
                        ? { borderColor: "#b2434f" }
                        : {}),
                    }}
                    placeholder={
                      requiresReason
                        ? "Reason required for this review action"
                        : "Optional review note"
                    }
                    aria-required={requiresReason}
                    aria-invalid={Boolean(resolutionReasonError)}
                    aria-describedby={
                      resolutionReasonError
                        ? "sync-conflict-review-note-error"
                        : undefined
                    }
                    disabled={isResolving}
                  />
                  {resolutionReasonError ? (
                    <p
                      id="sync-conflict-review-note-error"
                      role="alert"
                      style={modalStyles.errorText}
                    >
                      {resolutionReasonError}
                    </p>
                  ) : null}
                </label>
              ) : null}
              {availableActions.includes("KEEP_SERVER") ? (
                <p style={modalStyles.warningText}>
                  Keeping the saved DISTYNC record closes the conflict without
                  changing operational data. This device entry is not added to
                  Inventory, but the decision remains in Sync History.
                </p>
              ) : null}
              {availableActions.includes("ACCEPT_BOTH") ? (
                <p style={modalStyles.warningText}>
                  This keeps both entries. The earlier offline entry gets the
                  earlier batch number.
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
                isAutomaticCrossBarangayDuplicate
                  ? "Earlier Registration"
                  : "This Device Record",
                comparisonRows,
                "localValue",
              )}
              {renderComparisonPanel(
                isAutomaticCrossBarangayDuplicate
                  ? "Later Registration"
                  : "Saved DISTYNC Record",
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
