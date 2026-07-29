import React from "react";

const SyncPreferencesSection = ({
  shellStyles,
  gridStyles,
  cardStyles,
  helperTextStyles,
  mutedValueStyles,
  tableStyles,
  pageHeaderStyles,
  InfoRow,
  EmptyState,
  StatusChip,
  description,
  isOnline,
  syncSummary,
  syncStatusMeta,
  lastQueueActivityAt,
  lastSuccessfulSyncAt,
  localSyncLogRows,
  syncHistoryErrorMessage,
  handleSyncNow,
  isSyncingNow,
  onOpenFullSyncCenter,
}) => {
  return (
    <section style={shellStyles.card}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "20px",
          flexWrap: "wrap",
          marginBottom: "20px",
        }}
      >
        <div style={{ display: "grid", gap: "8px", flex: "1 1 320px" }}>
          <h3 style={{ margin: 0, color: "#17324d" }}>Sync Preferences</h3>
          <p style={mutedValueStyles}>{description}</p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleSyncNow}
            disabled={isSyncingNow}
            style={pageHeaderStyles.primaryButton}
          >
            {isSyncingNow ? "Syncing..." : "Sync Now"}
          </button>
          <button
            type="button"
            onClick={onOpenFullSyncCenter}
            style={pageHeaderStyles.secondaryButton}
          >
            Open Full Sync Center
          </button>
        </div>
      </div>

      {syncHistoryErrorMessage ? (
        <div
          style={{
            border: "1px solid #f0d2d8",
            borderRadius: "14px",
            padding: "14px 16px",
            backgroundColor: "#fff8f9",
            marginBottom: "20px",
          }}
        >
          <p style={{ ...helperTextStyles, color: "#9d4d58", margin: 0 }}>
            {syncHistoryErrorMessage}
          </p>
        </div>
      ) : null}

      <div style={gridStyles}>
        <article style={cardStyles}>
          <h4 style={{ margin: 0, color: "#17324d" }}>Offline Sync Information</h4>
          <InfoRow label="Connection" value={isOnline ? "Online" : "Offline"} />
          <InfoRow
            label="Pending Synchronizations"
            value={`${syncSummary.pending || 0}`}
          />
          <InfoRow
            label="Needs Review"
            value={`${(syncSummary.failed || 0) + (syncSummary.conflict || 0)}`}
          />
          <p style={helperTextStyles}>
            DISTYNC keeps offline sync behavior unchanged. This section is informative
            only and does not allow queue deletion or conflict-rule changes.
          </p>
        </article>

        <article style={cardStyles}>
          <h4 style={{ margin: 0, color: "#17324d" }}>Sync Status</h4>
          <InfoRow label="Current State" value={syncStatusMeta.label} />
          <InfoRow label="Last Queue Activity" value={lastQueueActivityAt} />
          <InfoRow label="Last Successful Synchronization" value={lastSuccessfulSyncAt} />
          <StatusChip tone={syncStatusMeta.tone} label={syncStatusMeta.label} />
        </article>
      </div>

      <div style={{ marginTop: "20px" }}>
        <h4 style={{ margin: "0 0 12px", color: "#17324d" }}>
          Recent Sync Queue Activity
        </h4>
        {localSyncLogRows.length === 0 ? (
          <EmptyState message="No local sync queue activity is available for this account yet." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyles.table}>
              <thead>
                <tr>
                  <th style={tableStyles.th}>Date & Time</th>
                  <th style={tableStyles.th}>Record Type</th>
                  <th style={tableStyles.th}>Status</th>
                  <th style={tableStyles.th}>Details</th>
                </tr>
              </thead>
              <tbody>
                {localSyncLogRows.slice(0, 12).map((row) => (
                  <tr key={row.id}>
                    <td style={tableStyles.td}>{row.timestamp}</td>
                    <td style={tableStyles.td}>{row.label}</td>
                    <td style={tableStyles.td}>
                      <StatusChip
                        tone={
                          row.status === "FAILED"
                            ? "error"
                            : row.status === "CONFLICT"
                              ? "warning"
                              : row.status === "SYNCED"
                                ? "success"
                                : "info"
                        }
                        label={row.status}
                      />
                    </td>
                    <td style={tableStyles.td}>{row.detail || "--"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};

export default SyncPreferencesSection;
