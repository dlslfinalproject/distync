import React, { useState } from "react";
import { FiFilter } from "react-icons/fi";
import SearchBar from "../shared/SearchBar";
import { pageHeaderStyles } from "../layout/PageHeader";
import ResponsiveFilterPopover from "../shared/ResponsiveFilterPopover";

const COLORS = {
  primary: "#17324d",
  border: "#c7d6e5",
  white: "#ffffff",
};

const categoryOptions = ["All", "Perishable", "Non-Perishable"];
const stockStatusOptions = [
  "Available",
  "Low Stock",
  "Near Expiry",
  "Expired",
  "Depleted",
];
const sortOptions = [
  { value: "newest", label: "Newest-Oldest" },
  { value: "oldest", label: "Oldest-Newest" },
  { value: "az", label: "A-Z" },
  { value: "za", label: "Z-A" },
];

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
  inlineSelectWrap: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flex: "0 0 auto",
  },
  inlineSelectLabel: {
    color: COLORS.primary,
    fontSize: "14px",
    fontWeight: 700,
  },
  inlineSelect: {
    minWidth: "120px",
    border: `1px solid ${COLORS.border}`,
    borderRadius: "12px",
    padding: "10px 12px",
    background: COLORS.white,
    color: COLORS.primary,
    fontSize: "14px",
    fontWeight: 600,
    outline: "none",
    boxSizing: "border-box",
    appearance: "auto",
  },
  filterPanel: {
    position: "fixed",
    width: "min(360px, calc(100vw - 32px))",
    backgroundColor: "#ffffff",
    border: "1px solid #d6e2ef",
    borderRadius: "18px",
    boxShadow: "0 18px 36px rgba(31, 64, 95, 0.16)",
    padding: "18px",
    zIndex: 1200,
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    overflow: "hidden",
    boxSizing: "border-box",
  },
  filterTitle: {
    margin: 0,
    color: "#17324d",
    fontSize: "16px",
    fontWeight: 800,
  },
  filterField: {
    display: "grid",
    gap: "8px",
  },
  filterLabel: {
    color: "#55718b",
    fontSize: "13px",
    fontWeight: 700,
  },
  filterSelect: {
    minHeight: "44px",
    borderRadius: "14px",
    border: "1px solid #d0ddeb",
    backgroundColor: "#ffffff",
    color: "#17324d",
    padding: "10px 12px",
    fontSize: "14px",
    fontWeight: 600,
  },
  filterList: {
    display: "grid",
    gap: "10px",
    overflowY: "auto",
    flex: "1 1 auto",
    minHeight: 0,
    paddingRight: "4px",
  },
  filterOption: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    color: "#1f405f",
    fontSize: "14px",
  },
  filterActions: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "auto",
  },
  clearAction: {
    border: "none",
    background: "transparent",
    color: "#55718b",
    padding: "2px 0",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
    textDecoration: "underline",
    textUnderlineOffset: "3px",
  },
};

const InventoryFilters = ({ filters, onFilterChange }) => {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const selectedStatuses = Array.isArray(filters.status) ? filters.status : [];
  const selectedSortOrder = filters.sortOrder || "newest";
  const activeFilterCount = selectedStatuses.length + (selectedSortOrder !== "newest" ? 1 : 0);

  const handleToggleStatus = (status) => {
    const nextStatuses = selectedStatuses.includes(status)
      ? selectedStatuses.filter((entry) => entry !== status)
      : [...selectedStatuses, status];

    onFilterChange("status", nextStatuses);
  };

  const handleClearFilters = () => {
    onFilterChange("sortOrder", "newest");
    onFilterChange("status", []);
  };

  return (
    <div className="inventory-items-filter-controls" style={styles.controlsGroup}>
      <div className="inventory-items-search-wrap" style={styles.searchWrap}>
        <SearchBar
          value={filters.search}
          onChange={(value) => onFilterChange("search", value)}
          placeholder="Search item name, barcode, packaging, or code"
        />
      </div>

      <div className="inventory-items-category-filter" style={styles.inlineSelectWrap}>
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

      <div className="inventory-items-filter-button-wrap">
        <ResponsiveFilterPopover
          isOpen={isFilterOpen}
          onOpenChange={setIsFilterOpen}
          title="Filter Records"
          trigger={({ ref, ...triggerProps }) => (
            <button
              ref={ref}
              type="button"
              style={{
                ...pageHeaderStyles.secondaryButton,
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
              {...triggerProps}
            >
              <FiFilter size={16} />
              {activeFilterCount > 0 ? `Filter (${activeFilterCount})` : "Filter"}
            </button>
          )}
        >
            <h3 style={styles.filterTitle}>Filter Records</h3>

            <label style={styles.filterField}>
              <span style={styles.filterLabel}>Order List</span>
              <select
                value={selectedSortOrder}
                onChange={(event) =>
                  onFilterChange("sortOrder", event.target.value)
                }
                style={styles.filterSelect}
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <h3 style={styles.filterTitle}>Stock Status</h3>

            <div style={styles.filterList}>
              {stockStatusOptions.map((status) => (
                <label key={status} style={styles.filterOption}>
                  <input
                    type="checkbox"
                    checked={selectedStatuses.includes(status)}
                    onChange={() => handleToggleStatus(status)}
                    style={{ accentColor: "#2f6499" }}
                  />
                  <span>{status}</span>
                </label>
              ))}
            </div>

            <div style={styles.filterActions}>
              <button
                type="button"
                onClick={handleClearFilters}
                style={styles.clearAction}
              >
                Clear
              </button>
            </div>
        </ResponsiveFilterPopover>
      </div>
    </div>
  );
};

export default InventoryFilters;
