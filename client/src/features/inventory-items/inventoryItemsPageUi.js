export const primaryTopBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  border: "none",
  borderRadius: "14px",
  padding: "12px 18px",
  background: "linear-gradient(135deg, #2f6499 0%, #4c86be 100%)",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 12px 24px rgba(58, 97, 141, 0.18)",
};

export const secondaryTopBtn = {
  border: "1px solid #c6d8ea",
  borderRadius: "14px",
  padding: "12px 18px",
  backgroundColor: "#f8fbfe",
  color: "#2a4c6f",
  fontSize: "14px",
  fontWeight: 700,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
};

export const inventoryPageStyles = {
  topActionsRow: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    margin: "16px 0 24px",
    flexWrap: "wrap",
    gap: "12px",
  },
  tabContainer: {
    display: "flex",
    borderBottom: "1px solid #d6e2ef",
    marginBottom: "24px",
    gap: "8px",
    flexWrap: "wrap",
  },
  sectionTitle: {
    margin: "0 0 12px 0",
    fontWeight: 800,
    fontSize: "24px",
    color: "#2f3f5d",
    lineHeight: 1.1,
  },
  addItemIconWrap: {
    position: "relative",
    width: "18px",
    height: "18px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  addItemPlus: {
    position: "absolute",
    right: "-5px",
    bottom: "-4px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#ffffff",
    background: "transparent",
    padding: 0,
    borderRadius: 0,
    boxShadow: "none",
    lineHeight: 1,
  },
};

export const buildInventoryItemFilters = (filters) => {
  const apiFilters = {
    search: filters.search,
  };

  if (filters.category === "Perishable") {
    apiFilters.is_perishable = "true";
  } else if (filters.category === "Non-Perishable") {
    apiFilters.is_perishable = "false";
  }

  return apiFilters;
};

export const getInventoryPageTabs = () => {
  return [
    { key: "overview", label: "Inventory List" },
    { key: "analytics", label: "Tracking Summary" },
    { key: "forecasting", label: "Forecasting" },
  ];
};

export const getInventorySectionTitle = (activeTab) => {
  if (activeTab === "overview") {
    return "ITEM STOCK TRACKING";
  }

  if (activeTab === "analytics") {
    return "TRACKING SUMMARY";
  }

  return "FORECASTING SUMMARY";
};

export const getInventoryAnalyticsCards = (inventoryAnalytics) => {
  return [
    {
      title: "Items With Stock On Hand",
      value: inventoryAnalytics.availableItems,
      detail: "Registered items that still have remaining available stock.",
    },
    {
      title: "Items Already Distributed",
      value: inventoryAnalytics.distributedItems,
      detail: "Inventory items that already have recorded distribution activity.",
    },
    {
      title: "Items With Expired Stock",
      value: inventoryAnalytics.expiredItems,
      detail: "Inventory items with expired stock records that still need attention.",
    },
    {
      title: "Perishable Goods",
      value: inventoryAnalytics.perishableItems,
      detail: `${inventoryAnalytics.perishableShare} of all registered items are marked as perishable.`,
    },
    {
      title: "Non-Perishable Goods",
      value: inventoryAnalytics.nonPerishableItems,
      detail: `${inventoryAnalytics.nonPerishableShare} of all registered items are marked as non-perishable.`,
    },
  ];
};
