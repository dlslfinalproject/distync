import React from "react";

const DonationPageTabs = ({ availableTabs, activeTab, onTabChange }) => {
  return (
    <div
      style={{
        borderBottom: "1px solid #d6e2ef",
        display: "flex",
        gap: "8px",
        flexWrap: "wrap",
        overflowX: "auto",
      }}
    >
      {availableTabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onTabChange(tab.key)}
          style={{
            padding: "12px 24px",
            border: "none",
            borderBottom:
              activeTab === tab.key ? "3px solid #17324d" : "3px solid transparent",
            background: "none",
            color: activeTab === tab.key ? "#17324d" : "#6b8298",
            fontSize: "14px",
            fontWeight: 700,
            whiteSpace: "nowrap",
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
