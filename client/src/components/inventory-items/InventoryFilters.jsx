import React from "react";
import SearchBar from "../shared/SearchBar";

const COLORS = {
  primary: "#17324d",
  muted: "#6b8298",
  chipBg: "#d7dee9",
};

const activeChipPalette = {
  All: {
    backgroundColor: COLORS.primary,
    color: "#ffffff",
  },
  Perishable: {
    backgroundColor: "#fef3c7",
    color: "#92400e",
  },
  "Non-Perishable": {
    backgroundColor: "#e6f5ec",
    color: "#2d7a4f",
  },
  Available: {
    backgroundColor: "#e0f2fe",
    color: "#075985",
  },
  Expired: {
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
  },
  Expiring: {
    backgroundColor: "#ede9fe",
    color: "#6d28d9",
  },
  "Low Stock": {
    backgroundColor: "#fff7ed",
    color: "#c2410c",
  },
  "Out of Stock": {
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
  },
};

const chipGroupStyle = {
  display: "flex",
  background: COLORS.chipBg,
  borderRadius: "7px",
  padding: "2px",
  gap: "1px",
  flexWrap: "wrap",
};

const styles = {
  filterRow: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    marginBottom: "8px",
    flexWrap: "wrap",
  },
  inlineFilters: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginTop: "2px",
    flexWrap: "wrap",
    color: COLORS.primary,
    fontSize: "13px",
    fontWeight: 600,
    marginBottom: "16px",
  },
};

const getChipStyle = (label, isActive) => {
  const activePalette = activeChipPalette[label] || activeChipPalette.All;

  return {
    border: "none",
    borderRadius: "6px",
    padding: "3px 10px",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer",
    backgroundColor: isActive
      ? activePalette.backgroundColor
      : "transparent",
    color: isActive ? activePalette.color : COLORS.muted,
    transition: "all 0.2s",
    lineHeight: 1.2,
  };
};

const InventoryFilters = ({ filters, onFilterChange }) => {
  return (
    <>
      <div style={styles.filterRow}>
        <div style={{ flex: 1 }}>
          <SearchBar
            value={filters.search}
            onChange={(value) => onFilterChange("search", value)}
            placeholder="Search item name, code, or barcode"
          />
        </div>
      </div>

      <div style={styles.inlineFilters}>
        <span>Category:</span>
        <div style={chipGroupStyle}>
          {["All", "Perishable", "Non-Perishable"].map((category) => (
            <button
              key={category}
              type="button"
              style={getChipStyle(category, filters.category === category)}
              onClick={() => onFilterChange("category", category)}
            >
              {category}
            </button>
          ))}
        </div>

        <span>Stock Status:</span>
        <div style={chipGroupStyle}>
          {["All", "Low Stock", "Expiring", "Out of Stock"].map((status) => (
            <button
              key={status}
              type="button"
              style={getChipStyle(status, filters.status === status)}
              onClick={() => onFilterChange("status", status)}
            >
              {status}
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

export default InventoryFilters;
