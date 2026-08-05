import React from "react";
import { FiInfo, FiRefreshCw, FiShield, FiWifi } from "react-icons/fi";

const containerPaddingStyles = {
  padding: "32px",
};

const sectionHeaderStyles = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "14px",
  flexWrap: "wrap",
};

const sectionHeaderTitleStyles = {
  display: "flex",
  alignItems: "center",
  gap: "14px",
};

const sectionTitleStyles = {
  margin: 0,
  color: "#17324d",
  fontSize: "18px",
  fontWeight: 700,
};

const sectionStyles = {
  display: "grid",
  gap: "18px",
};

const dividerStyles = {
  borderTop: "1px solid #e3ecf5",
  margin: "24px 0",
};

const infoRowsStyles = {
  display: "grid",
  gap: "14px",
};

const infoRowStyles = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
  gap: "8px 16px",
  paddingBottom: "14px",
  borderBottom: "1px solid #edf3f8",
  minWidth: 0,
};

const infoLabelStyles = {
  margin: 0,
  color: "#5f7892",
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const infoValueStyles = {
  margin: 0,
  color: "#17324d",
  fontSize: "14px",
  fontWeight: 600,
  lineHeight: 1.6,
  minWidth: 0,
  overflowWrap: "anywhere",
  wordBreak: "break-word",
};

const infoDescriptionStyles = {
  margin: 0,
  color: "#60738a",
  fontSize: "12px",
  lineHeight: 1.5,
};

const statusValueWrapStyles = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
  minWidth: 0,
};

const refreshButtonStyles = {
  border: "1px solid #d7e3ef",
  borderRadius: "999px",
  backgroundColor: "#ffffff",
  color: "#2f6499",
  padding: "8px 12px",
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "12px",
  fontWeight: 700,
  cursor: "pointer",
};

const iconBadgeStyles = (backgroundColor, color) => ({
  width: "40px",
  height: "40px",
  borderRadius: "14px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor,
  color,
  flexShrink: 0,
});

const SectionRows = ({ rows = [], StatusChip }) => (
  <div style={infoRowsStyles}>
    {rows.map((row) => (
      <div key={row.label} style={infoRowStyles}>
        <p style={infoLabelStyles}>{row.label}</p>
        <div style={{ display: "grid", gap: "6px", minWidth: 0 }}>
          <div style={statusValueWrapStyles}>
            <p style={infoValueStyles}>{row.value}</p>
            {row.badge ? (
              <StatusChip tone={row.badge.tone} label={row.badge.label} />
            ) : null}
          </div>
          {row.description ? (
            <p style={infoDescriptionStyles}>{row.description}</p>
          ) : null}
        </div>
      </div>
    ))}
  </div>
);

const SystemInformationSection = ({
  shellStyles,
  StatusChip,
  systemInformation,
}) => {
  const {
    application = {},
    offline = {},
    about = {},
    loading = false,
    refresh,
    isRefreshing = false,
  } = systemInformation || {};

  return (
    <section style={{ ...shellStyles.card, ...containerPaddingStyles }}>
      <div style={{ display: "grid", gap: 0 }}>
        <article style={sectionStyles}>
          <div style={sectionHeaderStyles}>
            <div style={sectionHeaderTitleStyles}>
              <span style={iconBadgeStyles("#eaf3ff", "#2f6499")}>
                <FiInfo size={18} />
              </span>
              <h3 style={sectionTitleStyles}>Application Information</h3>
            </div>
          </div>
          <SectionRows rows={application.rows} StatusChip={StatusChip} />
        </article>

        <div style={dividerStyles} />

        <article style={sectionStyles} aria-live="polite">
          <div style={sectionHeaderStyles}>
            <div style={sectionHeaderTitleStyles}>
              <span style={iconBadgeStyles("#e9f8ef", "#2d8a57")}>
                <FiWifi size={18} />
              </span>
              <h3 style={sectionTitleStyles}>Offline Capability</h3>
            </div>
            {typeof refresh === "function" ? (
              <button
                type="button"
                style={refreshButtonStyles}
                onClick={() => refresh()}
                disabled={isRefreshing}
                aria-label="Refresh system information"
              >
                <FiRefreshCw size={14} />
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            ) : null}
          </div>
          {loading ? (
            <p style={infoValueStyles}>Checking system status...</p>
          ) : null}
          <SectionRows rows={offline.rows} StatusChip={StatusChip} />
        </article>

        <div style={dividerStyles} />

        <article style={sectionStyles}>
          <div style={sectionHeaderStyles}>
            <div style={sectionHeaderTitleStyles}>
              <span style={iconBadgeStyles("#eef4ff", "#365f9c")}>
                <FiShield size={18} />
              </span>
              <h3 style={sectionTitleStyles}>About DISTYNC</h3>
            </div>
          </div>
          <SectionRows rows={about.rows} StatusChip={StatusChip} />
        </article>
      </div>
    </section>
  );
};

export default SystemInformationSection;
