import React from "react";
import NotificationPreferencesSection from "../components/NotificationPreferencesSection";
import ProfileSection from "../components/ProfileSection";
import RoleSettingsViewShell from "../components/RoleSettingsViewShell";
import SecuritySection from "../components/SecuritySection";

const MswdoSettingsView = ({
  activeSection,
  activeSectionMeta,
  roleMeta,
  pageActions,
  errorMessage,
  sectionCards,
  onOpenSection,
  toast,
  onCloseToast,
  settingsHubStyles,
  labelStyles,
  mutedValueStyles,
  StatusChip,
  ctx,
}) => {
  const {
    shellStyles,
    gridStyles,
    cardStyles,
    tableStyles,
    pageHeaderStyles,
    formatSyncDateTime,
    InfoRow,
    EmptyState,
    navigate,
    handleSyncNow,
    isSyncingNow,
    syncSummary,
    LOCAL_SYNC_STATUS,
    getSyncStatusMeta,
    isOnline,
    localSyncLogRows,
    profileSectionProps,
    securitySectionProps,
    notificationSectionProps,
    dashboardDescription,
  } = ctx;

  const renderSectionContent = () => {
    switch (activeSection) {
      case "profile":
        return <ProfileSection {...profileSectionProps} />;
      case "security":
        return <SecuritySection {...securitySectionProps} />;
      case "notification-preferences":
        return <NotificationPreferencesSection {...notificationSectionProps} />;
      case "sync-center":
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
                <h3 style={{ margin: 0, color: "#17324d" }}>Sync Center</h3>
                <p style={mutedValueStyles}>
                  Monitor whether MSWDO records are aligned with the current DISTYNC
                  queue and review the most recent sync logs.
                </p>
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
                  onClick={() => navigate("/mswdo/sync")}
                  style={pageHeaderStyles.secondaryButton}
                >
                  Open Full Sync Center
                </button>
              </div>
            </div>

            <div style={gridStyles}>
              <article style={cardStyles}>
                <h4 style={{ margin: 0, color: "#17324d" }}>Sync Overview</h4>
                <InfoRow label="Connection" value={isOnline ? "Online" : "Offline"} />
                <InfoRow
                  label="Latest Queue Activity"
                  value={formatSyncDateTime(localSyncLogRows[0]?.timestamp)}
                />
                <InfoRow
                  label="Pending Records"
                  value={`${syncSummary[LOCAL_SYNC_STATUS.PENDING] || 0}`}
                />
                <InfoRow
                  label="Failed / Conflict Records"
                  value={`${
                    (syncSummary[LOCAL_SYNC_STATUS.FAILED] || 0) +
                    (syncSummary[LOCAL_SYNC_STATUS.CONFLICT] || 0)
                  }`}
                />
                <StatusChip
                  tone={getSyncStatusMeta(syncSummary, isOnline).tone}
                  label={getSyncStatusMeta(syncSummary, isOnline).label}
                />
              </article>

              <article style={cardStyles}>
                <h4 style={{ margin: 0, color: "#17324d" }}>Synced Record Types</h4>
                <div style={{ display: "grid", gap: "10px" }}>
                  {[
                    "Evacuee Records",
                    "Distribution Records",
                    "Attendance Reports",
                    "Inventory Updates",
                  ].map((label) => (
                    <div
                      key={label}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "12px",
                      }}
                    >
                      <span style={{ color: "#21405f", fontWeight: 700 }}>{label}</span>
                      <StatusChip
                        tone="info"
                        label={localSyncLogRows.length > 0 ? "Tracked" : "Waiting"}
                      />
                    </div>
                  ))}
                </div>
              </article>
            </div>

            <div style={{ marginTop: "20px" }}>
              <h4 style={{ margin: "0 0 12px", color: "#17324d" }}>
                Local Queue Activity
              </h4>
              {localSyncLogRows.length === 0 ? (
                <EmptyState message="No local sync queue activity is available for this MSWDO account yet." />
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
                          <td style={tableStyles.td}>
                            {formatSyncDateTime(row.timestamp)}
                          </td>
                          <td style={tableStyles.td}>{row.label}</td>
                          <td style={tableStyles.td}>
                            <StatusChip
                              tone={
                                row.status === LOCAL_SYNC_STATUS.FAILED
                                  ? "error"
                                  : row.status === LOCAL_SYNC_STATUS.CONFLICT
                                    ? "warning"
                                    : row.status === "RESOLVED"
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
      default:
        return null;
    }
  };

  return (
    <RoleSettingsViewShell
      activeSectionMeta={activeSectionMeta}
      roleMeta={roleMeta}
      pageActions={pageActions}
      errorMessage={errorMessage}
      renderSectionContent={renderSectionContent}
      sectionCards={sectionCards}
      onOpenSection={onOpenSection}
      dashboardDescription={dashboardDescription}
      toast={toast}
      onCloseToast={onCloseToast}
      settingsHubStyles={settingsHubStyles}
      labelStyles={labelStyles}
      mutedValueStyles={mutedValueStyles}
      StatusChip={StatusChip}
    />
  );
};

export default MswdoSettingsView;
