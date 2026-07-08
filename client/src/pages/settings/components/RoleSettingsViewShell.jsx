import React from "react";
import PageHeader from "../../../components/layout/PageHeader";
import { shellStyles } from "../../../components/layout/BarangayLayout";
import FeedbackToast from "../../../components/shared/FeedbackToast";

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
        description={activeSectionMeta?.description || roleMeta.description}
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
        renderSectionContent()
      ) : (
        <section style={shellStyles.card}>
          <div style={{ display: "grid", gap: "8px", marginBottom: "20px" }}>
            <p style={labelStyles}>Settings Dashboard</p>
            <h3 style={{ margin: 0, color: "#17324d" }}>
              Open one settings function at a time
            </h3>
            <p style={mutedValueStyles}>{dashboardDescription}</p>
          </div>

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
