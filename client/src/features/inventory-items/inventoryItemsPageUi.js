export const primaryTopBtn = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
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
  justifyContent: "center",
  gap: "8px",
};

export const inventoryPageStyles = {
  pageTopActions: {
    marginTop: "18px",
  },
  overviewSection: {
    marginTop: "24px",
  },
  managementToolbar: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    margin: "0 0 24px",
    flexWrap: "wrap",
  },
  topActionsRow: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    margin: 0,
    flexWrap: "wrap",
    gap: "12px",
    flex: "0 0 auto",
  },
  tabContainer: {
    display: "flex",
    borderBottom: "1px solid #d6e2ef",
    marginBottom: "24px",
    gap: "8px",
    flexWrap: "wrap",
  },
  sectionTitle: {
    margin: "0 0 16px 0",
    fontWeight: 700,
    fontSize: "20px",
    color: "#17324d",
    lineHeight: 1.2,
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
  return [{ key: "overview", label: "Inventory Items" }];
};

export const getInventorySectionTitle = (activeTab) => {
  return "Items Record";
};
