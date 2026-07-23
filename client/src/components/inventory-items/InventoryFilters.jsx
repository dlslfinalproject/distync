import React from "react";
import SearchBar from "../shared/SearchBar";

const COLORS = {
  primary: "#17324d",
  muted: "#5f7892",
  border: "#c6d8ea",
  softPanel: "#f8fbfe",
};

const categoryOptions = ["All", "Perishable", "Non-Perishable"];
const stockStatusOptions = ["All", "Low Stock", "Near Expiry", "Expired"];

const styles = {
  controlsGroup: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flex: "1 1 520px",
    flexWrap: "wrap",
    minWidth: 0,
  },
  searchWrap: {
    flex: "1 1 420px",
    minWidth: "260px",
  },
  inlineSelectGroup: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flex: "0 0 auto",
  },
  inlineSelectLabel: {
    color: COLORS.primary,
    fontSize: "14px",
    fontWeight: 800,
  },
  inlineSelect: {
    minWidth: "180px",
    minHeight: "48px",
    border: `1px solid ${COLORS.border}`,
    borderRadius: "14px",
    padding: "0 14px",
    background: COLORS.softPanel,
    color: COLORS.primary,
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
  },
  inlineSelectWrap: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flex: "0 0 auto",
  },
  inlineSelectLabel: {
    color: COLORS.primary,
    fontSize: "14px",
    fontWeight: 800,
  },
  inlineSelect: {
    minWidth: "180px",
    minHeight: "48px",
    border: `1px solid ${COLORS.border}`,
    borderRadius: "14px",
    padding: "0 14px",
    background: COLORS.softPanel,
    color: COLORS.primary,
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
  },
};

const InventoryFilters = ({ filters, onFilterChange }) => {
  const selectedStockStatus = Array.isArray(filters.status)
    ? filters.status[0] || "All"
    : filters.status || "All";

  return (
    <div style={styles.controlsGroup}>
      <div style={styles.searchWrap}>
        <SearchBar
          value={filters.search}
          onChange={(value) => onFilterChange("search", value)}
          placeholder="Search item name, code, or barcode"
        />
      </div>

      <div style={styles.inlineSelectGroup}>
        <label
          htmlFor="inventory-category-filter"
          style={styles.inlineSelectLabel}
        >
          Category
        </label>
        <select
          id="inventory-category-filter"
          value={filters.category}
          onChange={(event) => onFilterChange("category", event.target.value)}
          style={styles.inlineSelect}
        >
          {categoryOptions.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      <div style={styles.inlineSelectWrap}>
        <label
          htmlFor="inventory-status-filter"
          style={styles.inlineSelectLabel}
        >
          Stock Status
        </label>
        <select
          id="inventory-status-filter"
          value={selectedStockStatus}
          onChange={(event) => onFilterChange("status", event.target.value)}
          style={styles.inlineSelect}
        >
          {stockStatusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default InventoryFilters;
