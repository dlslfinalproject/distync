import React from "react";
import PageHeader from "../../../components/layout/PageHeader";
import { shellStyles } from "../../../components/layout/BarangayLayout";
import FeedbackToast from "../../../components/shared/FeedbackToast";

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
                onClick={() => onOpenSection(null)}
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
                Back to Categories
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
  activeSectionMeta,
  roleMeta,
  pageActions,
  errorMessage,
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

  return (
    <>
      <PageHeader
        eyebrow={activeSectionMeta ? roleMeta.title : undefined}
        title={activeSectionMeta?.label || roleMeta.title}
        description={activeSectionMeta ? undefined : roleMeta.description}
        actions={pageActions}
      />

      {errorMessage ? (
        <section style={shellStyles.card}>
          <p style={{ margin: 0, color: "#9d4d58", fontWeight: 700 }}>
            {errorMessage}
          </p>
        </section>
      ) : null}

      {activeSectionMeta ? (
        <SettingsSectionErrorBoundary
          sectionKey={activeSectionMeta.key}
          onOpenSection={onOpenSection}
        >
          <SectionContentRenderer renderSectionContent={renderSectionContent} />
        </SettingsSectionErrorBoundary>
      ) : (
        <section style={shellStyles.card}>
          <div style={settingsHubStyles.grid}>
            {sectionCards.map((section) => {
              const Icon = section.icon;

              return (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => onOpenSection(section.key)}
                  style={settingsHubStyles.button}
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

                  <span style={settingsHubStyles.openLabel}>Open section</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

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
