import React from "react";
import { FiInfo, FiShield, FiWifi } from "react-icons/fi";
import appPackage from "../../../../package.json";

const SyncPreferencesSection = ({ shellStyles, mutedValueStyles, StatusChip }) => {
  const applicationVersion = appPackage.version || "1.0.0";

  const containerStyles = {
    ...shellStyles.card,
    padding: "32px",
  };

  const sectionHeaderStyles = {
    display: "flex",
    alignItems: "center",
    gap: "14px",
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
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "6px 16px",
    paddingBottom: "14px",
    borderBottom: "1px solid #edf3f8",
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
    lineHeight: 1.5,
  };

  return (
    <section style={containerStyles}>
      <div style={{ display: "grid", gap: 0 }}>
        <article style={sectionStyles}>
          <div style={sectionHeaderStyles}>
            <span style={iconBadgeStyles("#eaf3ff", "#2f6499")}>
              <FiInfo size={18} />
            </span>
            <h3 style={sectionTitleStyles}>Application Information</h3>
          </div>
          <div style={infoRowsStyles}>
            <div style={infoRowStyles}>
              <p style={infoLabelStyles}>System Name</p>
              <p style={infoValueStyles}>DISTYNC</p>
            </div>
            <div style={infoRowStyles}>
              <p style={infoLabelStyles}>Version</p>
              <p style={infoValueStyles}>{applicationVersion}</p>
            </div>
          </div>
        </article>

        <div style={dividerStyles} />

        <article style={sectionStyles}>
          <div style={sectionHeaderStyles}>
            <span style={iconBadgeStyles("#e9f8ef", "#2d8a57")}>
              <FiWifi size={18} />
            </span>
            <h3 style={sectionTitleStyles}>Offline Capability</h3>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <StatusChip tone="success" label="Available" />
          </div>
        </article>

        <div style={dividerStyles} />

        <article style={sectionStyles}>
          <div style={sectionHeaderStyles}>
            <span style={iconBadgeStyles("#eef4ff", "#365f9c")}>
              <FiShield size={18} />
            </span>
            <h3 style={sectionTitleStyles}>About DISTYNC</h3>
          </div>
          <p style={infoValueStyles}>
            Disaster relief management system for LGU operations.
          </p>
        </article>
      </div>
    </section>
  );
};

export default SyncPreferencesSection;
