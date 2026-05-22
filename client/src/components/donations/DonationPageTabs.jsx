import React from "react";

const DonationPageTabs = ({ availableTabs, activeTab, onTabChange }) => {
  return (
    <div
      style={{
        display: "flex",
        gap: "10px",
        flexWrap: "wrap",
        marginTop: "18px",
      }}
    >
      {availableTabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onTabChange(tab.key)}
          style={{
            border: "none",
            borderRadius: "999px",
            padding: "10px 16px",
            backgroundColor: activeTab === tab.key ? "#dbe8f6" : "#eef5fc",
            color: activeTab === tab.key ? "#17324d" : "#40617f",
            fontWeight: 700,
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
