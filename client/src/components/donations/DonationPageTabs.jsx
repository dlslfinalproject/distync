import React from "react";

const DonationPageTabs = ({ availableTabs, activeTab, onTabChange }) => {
  return (
    <div
      style={{
        display: "flex",
        gap: "28px",
        flexWrap: "wrap",
        marginTop: "18px",
        paddingBottom: "2px",
        borderBottom: "1px solid #d7e2ef",
      }}
    >
      {availableTabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onTabChange(tab.key)}
          style={{
            border: "none",
            borderBottom:
              activeTab === tab.key ? "3px solid #2f6499" : "3px solid transparent",
            padding: "0 0 14px",
            backgroundColor: "transparent",
            color: activeTab === tab.key ? "#17324d" : "#6d86a0",
            fontSize: "14px",
            fontWeight: 800,
            letterSpacing: "0.02em",
            cursor: "pointer",
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

export default DonationPageTabs;
