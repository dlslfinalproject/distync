import React from "react";
import NotificationPreferencesSection from "../components/NotificationPreferencesSection";
import ProfileSection from "../components/ProfileSection";
import RoleSettingsViewShell from "../components/RoleSettingsViewShell";
import SecuritySection from "../components/SecuritySection";

const getMayorSettingsGridTemplateColumns = () => {
  if (typeof window === "undefined") {
    return "repeat(3, minmax(0, 1fr))";
  }

  if (window.innerWidth >= 1180) {
    return "repeat(3, minmax(0, 1fr))";
  }

  if (window.innerWidth >= 760) {
    return "repeat(2, minmax(0, 1fr))";
  }

  return "1fr";
};

const MayorSettingsView = ({
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
    isLoading,
    navigate,
    handleSyncNow,
    isSyncingNow,
    syncSummary,
    LOCAL_SYNC_STATUS,
    getSyncStatusMeta,
    isOnline,
    localSyncLogRows,
    forecastHealth,
    inventoryThresholdSummary,
    profileSectionProps,
    securitySectionProps,
    notificationSectionProps,
    dashboardDescription,
  } = ctx;
  const [mayorGridTemplateColumns, setMayorGridTemplateColumns] = React.useState(
    getMayorSettingsGridTemplateColumns,
  );

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleResize = () => {
      setMayorGridTemplateColumns(getMayorSettingsGridTemplateColumns());
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const mayorSettingsHubStyles = React.useMemo(() => {
    return {
      ...settingsHubStyles,
      grid: {
        ...settingsHubStyles.grid,
        gridTemplateColumns: mayorGridTemplateColumns,
      },
    };
  }, [mayorGridTemplateColumns, settingsHubStyles]);

  const renderSectionContent = () => {
    switch (activeSection) {
      case "profile":
        return <ProfileSection {...profileSectionProps} />;
      case "security":
        return <SecuritySection {...securitySectionProps} />;
      case "notification-preferences":
        return <NotificationPreferencesSection {...notificationSectionProps} />;
      case "sync-status":
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
                  Monitor pending queue records, sync health, and recent local
                  synchronization activity here. Use the full Sync Center for
                  deeper monitoring when needed.
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
                  onClick={() => navigate("/inventory/sync")}
                  style={pageHeaderStyles.secondaryButton}
                >
                  Open Full Sync Center
                </button>
              </div>
            </div>

            <div style={gridStyles}>
              <article style={cardStyles}>
                <h4 style={{ margin: 0, color: "#17324d" }}>Sync Summary</h4>
                <InfoRow label="Connection" value={isOnline ? "Online" : "Offline"} />
                <InfoRow
                  label="Last Queue Update"
                  value={formatSyncDateTime(localSyncLogRows[0]?.timestamp)}
                />
                <InfoRow
                  label="Pending Queue Entries"
                  value={`${syncSummary[LOCAL_SYNC_STATUS.PENDING] || 0}`}
                />
                <InfoRow
                  label="Failed / Conflict Entries"
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
                    "Inventory Updates",
                    "Distribution Records",
                    "Donation Records",
                    "System Queue Entries",
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
                <EmptyState message="No local sync queue activity is available for this Office of the Mayor account yet." />
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
      case "analytics-service":
        return (
          <section style={shellStyles.card}>
            <div style={{ display: "grid", gap: "8px", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, color: "#17324d" }}>Analytics Service</h3>
              <p style={mutedValueStyles}>
                Review read-only analytics availability for executive visibility.
              </p>
            </div>

            <div style={gridStyles}>
              <article style={cardStyles}>
                <h4 style={{ margin: 0, color: "#17324d" }}>Service Health</h4>
                {isLoading ? (
                  <EmptyState message="Checking analytics service..." />
                ) : forecastHealth ? (
                  <>
                    <InfoRow
                      label="Service Status"
                      value={forecastHealth.status || "Online"}
                    />
                    <InfoRow
                      label="Checked Endpoint"
                      value={forecastHealth.analytics_url || "--"}
                      muted
                    />
                    <StatusChip
                      tone={
                        forecastHealth.status === "Online"
                          ? "success"
                          : forecastHealth.status === "Offline"
                            ? "error"
                            : "warning"
                      }
                      label={forecastHealth.status || "Unavailable"}
                    />
                  </>
                ) : (
                  <>
                    <EmptyState message="Analytics service unavailable." />
                    <StatusChip tone="error" label="Unavailable" />
                  </>
                )}
              </article>
            </div>
          </section>
        );
      case "inventory-alert-thresholds":
        return (
          <section style={shellStyles.card}>
            <div style={{ display: "grid", gap: "8px", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, color: "#17324d" }}>
                Inventory Alert Thresholds
              </h3>
              <p style={mutedValueStyles}>
                Review read-only inventory threshold coverage without changing live
                operational rules.
              </p>
            </div>

            <div style={gridStyles}>
              <article style={cardStyles}>
                <h4 style={{ margin: 0, color: "#17324d" }}>Threshold Coverage</h4>
                <p style={mutedValueStyles}>
                  Thresholds are currently operational values tied to inventory records
                  and service logic. This section shows them read-only for safety.
                </p>
                <InfoRow
                  label="Configured Active Items"
                  value={`${inventoryThresholdSummary?.configured_items || 0}`}
                />
                <InfoRow
                  label="Distinct Threshold Values"
                  value={
                    inventoryThresholdSummary?.distinct_thresholds?.length
                      ? inventoryThresholdSummary.distinct_thresholds.join(", ")
                      : "No thresholds loaded"
                  }
                />
              </article>
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
      settingsHubStyles={mayorSettingsHubStyles}
      labelStyles={labelStyles}
      mutedValueStyles={mutedValueStyles}
      StatusChip={StatusChip}
    />
  );
};

export default MayorSettingsView;
