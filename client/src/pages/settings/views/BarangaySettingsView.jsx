import React from "react";
import NotificationPreferencesSection from "../components/NotificationPreferencesSection";
import ProfileSection from "../components/ProfileSection";
import RoleSettingsViewShell from "../components/RoleSettingsViewShell";
import SyncPreferencesSection from "../components/SyncPreferencesSection";

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
  statusBanner,
  ctx,
}) => {
  const {
    profileSectionProps,
    notificationSectionProps,
    syncSummary,
    getSyncStatusMeta,
    isOnline,
    localSyncLogRows,
    syncHistoryErrorMessage,
    handleSyncNow,
    isSyncingNow,
    navigate,
    formatSyncDateTime,
    lastQueueActivityAt,
    lastSuccessfulSyncAt,
    dashboardDescription,
  } = ctx;

  const renderSectionContent = () => {
    switch (activeSection) {
      case "account-settings":
        return <ProfileSection {...profileSectionProps} />;
      case "notification-preferences":
        return <NotificationPreferencesSection {...notificationSectionProps} />;
      case "sync-preferences":
        return (
          <SyncPreferencesSection
            {...ctx.syncSectionProps}
            syncSummary={syncSummary}
            syncStatusMeta={getSyncStatusMeta(syncSummary, isOnline)}
            localSyncLogRows={localSyncLogRows.map((row) => ({
              ...row,
              timestamp: formatSyncDateTime(row.timestamp),
            }))}
            syncHistoryErrorMessage={syncHistoryErrorMessage}
            handleSyncNow={handleSyncNow}
            isSyncingNow={isSyncingNow}
            onOpenFullSyncCenter={() => navigate("/barangay/sync")}
            lastQueueActivityAt={lastQueueActivityAt}
            lastSuccessfulSyncAt={lastSuccessfulSyncAt}
          />
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
      statusBanner={statusBanner}
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
