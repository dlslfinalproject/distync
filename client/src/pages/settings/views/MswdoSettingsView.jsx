import React from "react";
import NotificationPreferencesSection from "../components/NotificationPreferencesSection";
import ProfileSection from "../components/ProfileSection";
import RoleSettingsViewShell from "../components/RoleSettingsViewShell";
import SystemInformationSection from "../components/SystemInformationSection";
import { SETTINGS_SECTIONS } from "../settingsSectionRouting";

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
  statusBanner,
  ctx,
}) => {
  const {
    profileSectionProps,
    notificationSectionProps,
    dashboardDescription,
    systemInformation,
  } = ctx;

  const renderSectionContent = () => {
    switch (activeSection) {
      case SETTINGS_SECTIONS.ACCOUNT:
        return <ProfileSection {...profileSectionProps} />;
      case SETTINGS_SECTIONS.NOTIFICATIONS:
        return <NotificationPreferencesSection {...notificationSectionProps} />;
      case SETTINGS_SECTIONS.SYSTEM:
        return (
          <SystemInformationSection
            {...ctx.syncSectionProps}
            systemInformation={systemInformation}
          />
        );
      default:
        return null;
    }
  };

  return (
    <RoleSettingsViewShell
      activeSection={activeSection}
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

export default MswdoSettingsView;
