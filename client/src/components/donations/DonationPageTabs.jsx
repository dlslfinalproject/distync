import React from "react";

export const DONATION_PAGE_TAB_IDS = Object.freeze({
  donations: "donation-management-donations-tab",
  transparency: "donation-management-transparency-tab",
});

export const DONATION_PAGE_PANEL_IDS = Object.freeze({
  donations: "donation-management-donations-panel",
  transparency: "donation-management-transparency-panel",
});

export const DONATION_PAGE_PANEL_STYLE = Object.freeze({
  boxSizing: "border-box",
  minHeight: "112px",
  minWidth: 0,
  padding: "clamp(16px, 1.8vw, 24px)",
  overflow: "visible",
});

const tabButtonStyles = (isActive) => ({
  alignItems: "center",
  boxSizing: "border-box",
  border: "none",
  borderBottom: isActive ? "3px solid #17324d" : "3px solid transparent",
  background: "none",
  color: isActive ? "#17324d" : "#6b8298",
  cursor: "pointer",
  display: "inline-flex",
  fontSize: "14px",
  fontFamily: "inherit",
  fontWeight: 700,
  justifyContent: "center",
  letterSpacing: "0.01em",
  lineHeight: 1.3,
  minHeight: "48px",
  padding: "11px 16px",
  transition: "color 160ms ease, border-color 160ms ease",
  whiteSpace: "nowrap",
});

const DonationPageTabs = ({ availableTabs, activeTab, onTabChange }) => {
  return (
    <div
      className="mayor-donation-management-tabs"
      role="tablist"
      aria-label="Donation Management sections"
      style={{
        alignItems: "stretch",
        borderBottom: "1px solid #d6e2ef",
        backgroundColor: "#fbfdff",
        borderTopLeftRadius: "17px",
        borderTopRightRadius: "17px",
        display: "flex",
        flexWrap: "nowrap",
        gap: "4px",
        overflowX: "auto",
        padding: "8px clamp(14px, 2vw, 24px) 0",
        minHeight: "56px",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {availableTabs.map((tab) => (
        <button
          key={tab.key}
          id={DONATION_PAGE_TAB_IDS[tab.key] || `donation-management-${tab.key}-tab`}
          role="tab"
          aria-selected={activeTab === tab.key}
          aria-controls={
            DONATION_PAGE_PANEL_IDS[tab.key] ||
            `donation-management-${tab.key}-panel`
          }
          type="button"
          onClick={() => onTabChange(tab.key)}
          style={tabButtonStyles(activeTab === tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

export default DonationPageTabs;
