import React from "react";
import { inventoryPageStyles } from "../../features/inventory-items/inventoryItemsPageUi";

const tabButtonStyles = (isActive) => ({
  padding: "12px 24px",
  border: "none",
  background: "none",
  fontSize: "14px",
  fontWeight: 700,
  textTransform: "uppercase",
  color: isActive ? "#17324d" : "#6b8298",
  borderBottom: isActive ? "3px solid #17324d" : "3px solid transparent",
  cursor: "pointer",
});

const InventoryPageTabs = ({ tabs, activeTab, onTabChange }) => {
  return (
    <div style={inventoryPageStyles.tabContainer}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
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

export default InventoryPageTabs;
