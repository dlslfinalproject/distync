import React, { useCallback, useEffect, useRef, useState } from "react";
import { FiFilter } from "react-icons/fi";
import SearchBar from "../shared/SearchBar";
import { pageHeaderStyles } from "../layout/PageHeader";

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

const FILTER_PANEL_GAP = 12;
const FILTER_PANEL_VIEWPORT_PADDING = 16;
const MIN_FILTER_PANEL_HEIGHT = 220;

const getFilterPanelPosition = ({ triggerRect, panelHeight }) => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const constrainedPanelWidth = Math.min(
    360,
    viewportWidth - FILTER_PANEL_VIEWPORT_PADDING * 2,
  );
  const safePanelHeight = Math.max(panelHeight || 0, MIN_FILTER_PANEL_HEIGHT);
  const spaceBelow =
    viewportHeight - triggerRect.bottom - FILTER_PANEL_VIEWPORT_PADDING;
  const spaceAbove = triggerRect.top - FILTER_PANEL_VIEWPORT_PADDING;
  const shouldOpenBelow =
    spaceBelow >= MIN_FILTER_PANEL_HEIGHT || spaceBelow >= spaceAbove;

  let left = triggerRect.right - constrainedPanelWidth;
  left = Math.min(
    Math.max(left, FILTER_PANEL_VIEWPORT_PADDING),
    viewportWidth - constrainedPanelWidth - FILTER_PANEL_VIEWPORT_PADDING,
  );

  if (shouldOpenBelow) {
    const top = Math.max(
      FILTER_PANEL_VIEWPORT_PADDING,
      triggerRect.bottom + FILTER_PANEL_GAP,
    );
    const availableHeight =
      viewportHeight - top - FILTER_PANEL_VIEWPORT_PADDING;

    return {
      top,
      left,
      maxHeight: Math.max(availableHeight, 0),
    };
  }

  const maxHeight = Math.max(
    triggerRect.top - FILTER_PANEL_GAP - FILTER_PANEL_VIEWPORT_PADDING,
    0,
  );
  const top = Math.max(
    FILTER_PANEL_VIEWPORT_PADDING,
    triggerRect.top - FILTER_PANEL_GAP - Math.min(safePanelHeight, maxHeight),
  );

  return {
    top,
    left,
    maxHeight,
  };
};

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
  const [filterPanelPosition, setFilterPanelPosition] = useState({
    top: 0,
    left: 0,
    maxHeight: 320,
  });
  const filterButtonRef = useRef(null);
  const filterPanelRef = useRef(null);
  const selectedStatuses = Array.isArray(filters.status) ? filters.status : [];
  const selectedSortOrder = filters.sortOrder || "newest";
  const activeFilterCount = selectedStatuses.length + (selectedSortOrder !== "newest" ? 1 : 0);

  const updateFilterPanelPosition = useCallback(() => {
    if (!filterButtonRef.current) {
      return;
    }

    const triggerRect = filterButtonRef.current.getBoundingClientRect();
    const panelHeight =
      filterPanelRef.current?.getBoundingClientRect().height || 0;

    setFilterPanelPosition(
      getFilterPanelPosition({ triggerRect, panelHeight }),
    );
  }, []);

  useEffect(() => {
    if (!isFilterOpen) {
      return;
    }

    updateFilterPanelPosition();

    const handleWindowChange = () => {
      updateFilterPanelPosition();
    };

    window.addEventListener("resize", handleWindowChange);
    window.addEventListener("scroll", handleWindowChange, true);

    return () => {
      window.removeEventListener("resize", handleWindowChange);
      window.removeEventListener("scroll", handleWindowChange, true);
    };
  }, [activeFilterCount, isFilterOpen, updateFilterPanelPosition]);

  useEffect(() => {
    if (!isFilterOpen) {
      return;
    }

    const handleOutsideClick = (event) => {
      if (
        filterPanelRef.current?.contains(event.target) ||
        filterButtonRef.current?.contains(event.target)
      ) {
        return;
      }

      setIsFilterOpen(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isFilterOpen]);

  useEffect(() => {
    if (!isFilterOpen) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      updateFilterPanelPosition();
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [activeFilterCount, isFilterOpen, updateFilterPanelPosition]);

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
    <div style={styles.controlsGroup}>
      <div style={styles.searchWrap}>
        <SearchBar
          value={filters.search}
          onChange={(value) => onFilterChange("search", value)}
          placeholder="Search item name, barcode, packaging, or code"
        />
      </div>

      <div style={styles.inlineSelectWrap}>
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

      <div>
        <button
          ref={filterButtonRef}
          type="button"
          onClick={() => setIsFilterOpen((currentValue) => !currentValue)}
          style={{
            ...pageHeaderStyles.secondaryButton,
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <FiFilter size={16} />
          {activeFilterCount > 0 ? `Filter (${activeFilterCount})` : "Filter"}
        </button>

        {isFilterOpen ? (
          <div
            ref={filterPanelRef}
            style={{
              ...styles.filterPanel,
              top: filterPanelPosition.top,
              left: filterPanelPosition.left,
              maxHeight: filterPanelPosition.maxHeight,
            }}
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
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default InventoryFilters;
