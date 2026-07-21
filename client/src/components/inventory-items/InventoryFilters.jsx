import React, { useState } from "react";
import { FiFilter } from "react-icons/fi";
import SearchBar from "../shared/SearchBar";

const COLORS = {
  primary: "#17324d",
  muted: "#5f7892",
  border: "#c6d8ea",
  panel: "#ffffff",
  softPanel: "#f8fbfe",
};

const categoryOptions = ["All", "Perishable", "Non-Perishable"];
const stockStatusOptions = ["Low Stock", "Expiring", "Out of Stock"];

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
  filterWrap: {
    position: "relative",
    flex: "0 0 auto",
  },
  filterButton: {
    border: `1px solid ${COLORS.border}`,
    borderRadius: "14px",
    padding: "12px 18px",
    backgroundColor: COLORS.softPanel,
    color: COLORS.primary,
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    boxShadow: "0 8px 18px rgba(75, 101, 132, 0.05)",
  },
  filterPopover: {
    position: "absolute",
    top: "calc(100% + 10px)",
    right: 0,
    zIndex: 20,
    width: "320px",
    padding: "18px",
    border: "1px solid #d6e2ef",
    borderRadius: "18px",
    background: COLORS.panel,
    boxShadow: "0 18px 40px rgba(23, 50, 77, 0.16)",
    boxSizing: "border-box",
  },
  popoverTitle: {
    margin: "0 0 16px",
    color: COLORS.primary,
    fontSize: "18px",
    fontWeight: 800,
  },
  fieldGroup: {
    marginBottom: "14px",
  },
  filterLabel: {
    display: "block",
    marginBottom: "8px",
    color: COLORS.muted,
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  checkboxList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  checkboxOption: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    color: "#2a4c6f",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  checkboxInput: {
    width: "16px",
    height: "16px",
    margin: 0,
    accentColor: "#2f75b5",
    cursor: "pointer",
  },
  popoverFooter: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "12px",
  },
  clearButton: {
    border: "none",
    padding: 0,
    background: "transparent",
    color: "#2a4c6f",
    fontSize: "14px",
    fontWeight: 700,
    textDecoration: "underline",
    cursor: "pointer",
  },
};

const InventoryFilters = ({ filters, onFilterChange }) => {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const selectedStockStatuses = Array.isArray(filters.status)
    ? filters.status
    : filters.status && filters.status !== "All"
      ? [filters.status]
      : [];

  const handleClearFilters = () => {
    onFilterChange("status", []);
  };

  const handleStockStatusToggle = (status) => {
    const nextStatuses = selectedStockStatuses.includes(status)
      ? selectedStockStatuses.filter((selectedStatus) => selectedStatus !== status)
      : [...selectedStockStatuses, status];

    onFilterChange("status", nextStatuses);
  };

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

      <div style={styles.filterWrap}>
        <button
          type="button"
          style={styles.filterButton}
          onClick={() => setIsFilterOpen((isOpen) => !isOpen)}
        >
          <FiFilter size={18} />
          Filter
        </button>

        {isFilterOpen && (
          <div style={styles.filterPopover}>
            <h3 style={styles.popoverTitle}>Filter Records</h3>

            <div style={styles.fieldGroup}>
              <span style={styles.filterLabel}>Stock Status</span>
              <div style={styles.checkboxList}>
                {stockStatusOptions.map((status) => (
                  <label key={status} style={styles.checkboxOption}>
                    <input
                      type="checkbox"
                      checked={selectedStockStatuses.includes(status)}
                      onChange={() => handleStockStatusToggle(status)}
                      style={styles.checkboxInput}
                    />
                    <span>{status}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={styles.popoverFooter}>
              <button
                type="button"
                style={styles.clearButton}
                onClick={handleClearFilters}
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryFilters;
