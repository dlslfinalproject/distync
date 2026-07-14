import React from "react";
import NotificationPreferencesSection from "../components/NotificationPreferencesSection";
import ProfileSection from "../components/ProfileSection";
import RoleSettingsViewShell from "../components/RoleSettingsViewShell";

const BarangaySettingsView = ({
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
    formatDateTime,
    EmptyState,
    activityLogs,
    profileSectionProps,
    notificationSectionProps,
    dashboardDescription,
  } = ctx;

  const renderSectionContent = () => {
    switch (activeSection) {
      case "profile":
        return <ProfileSection {...profileSectionProps} />;
      case "notification-preferences":
        return <NotificationPreferencesSection {...notificationSectionProps} />;
      case "activity-logs":
        return (
          <section style={shellStyles.card}>
            <div style={{ display: "grid", gap: "8px", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, color: "#17324d" }}>Recent Local Activity</h3>
              <p style={mutedValueStyles}>
                Review recent operational and sync-related activity visible in this
                frontend. This section focuses on barangay workflow actions and
                device-visible operational history.
              </p>
            </div>

            {activityLogs.length === 0 ? (
              <EmptyState message="No recent local operational activity is available for this device yet." />
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                {activityLogs.map((entry) => (
                  <article
                    key={entry.id}
                    style={{
                      border: "1px solid #dbe6f0",
                      borderRadius: "16px",
                      padding: "16px 18px",
                      backgroundColor: "#fbfdff",
                      display: "grid",
                      gap: "6px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "12px",
                        flexWrap: "wrap",
                      }}
                    >
                      <strong style={{ color: "#17324d" }}>{entry.title}</strong>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <StatusChip tone="info" label={entry.moduleLabel || "Activity"} />
                        <StatusChip
                          tone={entry.tone || "info"}
                          label={entry.tone || "info"}
                        />
                      </div>
                    </div>
                    <p style={mutedValueStyles}>{entry.detail}</p>
                    <p style={{ ...mutedValueStyles, fontSize: "12px" }}>
                      {formatDateTime(entry.timestamp)}
                    </p>
                  </article>
                ))}
              </div>
            )}
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

export default BarangaySettingsView;
