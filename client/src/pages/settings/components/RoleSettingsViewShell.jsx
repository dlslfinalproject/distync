import React from "react";
import PageHeader from "../../../components/layout/PageHeader";
import { shellStyles } from "../../../components/layout/BarangayLayout";
import FeedbackToast from "../../../components/shared/FeedbackToast";
import { DEFAULT_SETTINGS_SECTION } from "../settingsSectionRouting";

class SettingsSectionErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(prevProps) {
    if (
      this.state.hasError &&
      prevProps.sectionKey !== this.props.sectionKey
    ) {
      this.setState({ hasError: false });
    }
  }

  render() {
    const { hasError } = this.state;
    const { children, onOpenSection } = this.props;

    if (hasError) {
      return (
        <section style={shellStyles.card}>
          <div style={{ display: "grid", gap: "10px" }}>
            <h3 style={{ margin: 0, color: "#17324d" }}>
              This settings section could not be displayed.
            </h3>
            <p style={{ margin: 0, color: "#60738a", lineHeight: 1.6 }}>
              Refresh the page or go back to the settings categories and open the
              section again.
            </p>
            <div>
              <button
                type="button"
                onClick={() => onOpenSection(DEFAULT_SETTINGS_SECTION)}
                style={{
                  minHeight: "42px",
                  padding: "0 16px",
                  borderRadius: "14px",
                  border: "1px solid #c7d6e8",
                  backgroundColor: "#ffffff",
                  color: "#2f6499",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Back to Account Settings
              </button>
            </div>
          </div>
        </section>
      );
    }

    return children;
  }
}

const SectionContentRenderer = ({ renderSectionContent }) => {
  const sectionContent = renderSectionContent?.();

  if (sectionContent) {
    return sectionContent;
  }

  return (
    <section style={shellStyles.card}>
      <div style={{ display: "grid", gap: "8px" }}>
        <h3 style={{ margin: 0, color: "#17324d" }}>
          This settings section is unavailable right now.
        </h3>
        <p style={{ margin: 0, color: "#60738a", lineHeight: 1.6 }}>
          Go back to the categories and try opening the section again.
        </p>
      </div>
    </section>
  );
};

const RoleSettingsViewShell = ({
  activeSection,
  activeSectionMeta,
  roleMeta,
  pageActions,
  errorMessage,
  statusBanner,
  renderSectionContent,
  sectionCards,
  onOpenSection,
  dashboardDescription,
  toast,
  onCloseToast,
  settingsHubStyles,
  labelStyles,
  mutedValueStyles,
  StatusChip,
}) => {
  const StatusChipComponent = StatusChip;
  const statusBannerTitleId = activeSectionMeta
    ? `settings-offline-banner-title-${activeSectionMeta.key}`
    : "settings-offline-banner-title-dashboard";
  const statusBannerMessageId = activeSectionMeta
    ? `settings-offline-banner-message-${activeSectionMeta.key}`
    : "settings-offline-banner-message-dashboard";

  return (
    <>
      <PageHeader
        eyebrow={activeSectionMeta ? roleMeta.title : undefined}
        title={activeSectionMeta?.label || roleMeta.title}
        description={activeSectionMeta ? undefined : roleMeta.description}
        actions={pageActions}
      />

      {statusBanner ? (
        <section
          style={shellStyles.card}
          aria-live="polite"
          aria-labelledby={statusBannerTitleId}
          aria-describedby={statusBannerMessageId}
        >
          <div style={{ display: "grid", gap: "8px" }}>
            <h3
              id={statusBannerTitleId}
              style={{ margin: 0, color: "#17324d" }}
            >
              {statusBanner.title}
            </h3>
            <p
              id={statusBannerMessageId}
              style={{ margin: 0, color: "#60738a", lineHeight: 1.6 }}
            >
              {statusBanner.message}
            </p>
          </div>
        </section>
      ) : null}

      {errorMessage ? (
        <section style={shellStyles.card}>
          <p style={{ margin: 0, color: "#9d4d58", fontWeight: 700 }}>
            {errorMessage}
          </p>
        </section>
      ) : null}

      <section style={shellStyles.card}>
        <div style={settingsHubStyles.grid}>
          {sectionCards.map((section) => {
            const Icon = section.icon;
            const isActive = section.key === activeSection;

            return (
              <button
                key={section.key}
                type="button"
                onClick={() => onOpenSection(section.key)}
                aria-current={isActive ? "page" : undefined}
                style={{
                  ...settingsHubStyles.button,
                  borderColor: isActive ? "#2f6499" : settingsHubStyles.button.border,
                  boxShadow: isActive
                    ? "0 18px 32px rgba(47, 100, 153, 0.16)"
                    : settingsHubStyles.button.boxShadow,
                  transform: isActive ? "translateY(-2px)" : undefined,
                  background: isActive
                    ? "linear-gradient(180deg, rgba(234, 244, 255, 0.98) 0%, rgba(246, 250, 255, 0.98) 100%)"
                    : settingsHubStyles.button.background,
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
                  <span style={settingsHubStyles.iconBadge}>
                    <Icon size={22} />
                  </span>
                  <StatusChipComponent
                    tone={section.statusTone}
                    label={section.statusLabel}
                  />
                </div>

                <div style={{ display: "grid", gap: "8px" }}>
                  <h3 style={{ margin: 0, color: "#17324d" }}>{section.label}</h3>
                  <p style={mutedValueStyles}>{section.description}</p>
                </div>

                <span style={settingsHubStyles.openLabel}>
                  {isActive ? "Current section" : "Open section"}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {activeSectionMeta ? (
        <SettingsSectionErrorBoundary
          sectionKey={activeSectionMeta.key}
          onOpenSection={onOpenSection}
        >
          <SectionContentRenderer renderSectionContent={renderSectionContent} />
        </SettingsSectionErrorBoundary>
      ) : null}

      <FeedbackToast
        message={toast.message}
        type={toast.type}
        title={toast.title}
        onClose={onCloseToast}
      />
    </>
  );
};

export default RoleSettingsViewShell;
