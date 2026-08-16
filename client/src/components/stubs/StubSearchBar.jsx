import React, { useEffect, useRef, useState } from "react";
import SearchBar from "../shared/SearchBar";
import { pageHeaderStyles } from "../layout/PageHeader";
import { FiFilter } from "react-icons/fi";
import { STATUS_FILTERS } from "../../features/stubs/stubStatusFilters";

const filterPanelStyles = {
  panel: {
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
  title: {
    margin: 0,
    color: "#17324d",
    fontSize: "16px",
    fontWeight: 800,
  },
  field: {
    display: "grid",
    gap: "8px",
  },
  label: {
    color: "#55718b",
    fontSize: "13px",
    fontWeight: 700,
  },
  select: {
    minHeight: "44px",
    border: "1px solid #d0ddeb",
    borderRadius: "14px",
    padding: "10px 12px",
    fontSize: "14px",
    color: "#1f405f",
    backgroundColor: "#ffffff",
    boxSizing: "border-box",
    fontWeight: 600,
  },
  list: {
    display: "grid",
    gap: "10px",
    overflowY: "auto",
    flex: "1 1 auto",
    minHeight: 0,
    paddingRight: "4px",
  },
  option: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    color: "#1f405f",
    fontSize: "14px",
  },
  actions: {
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

const STUB_SORT_OPTIONS = [
  { value: "newest", label: "Newest-Oldest" },
  { value: "oldest", label: "Oldest-Newest" },
  { value: "az", label: "Sort A-Z" },
  { value: "za", label: "Sort Z-A" },
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

const StubSearchBar = ({
  searchValue,
  onSearchChange,
  onSearchSubmit,
  sectorOptions = [],
  selectedSectorNames = [],
  stubStatusOptions = [],
  selectedStubStatus = STATUS_FILTERS.ALL,
  selectedSortOrder = "oldest",
  onToggleSector,
  onSelectStubStatus,
  onSortOrderChange,
  onClearFilters,
  filterScopeKey = "",
  actions = null,
}) => {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterPanelPosition, setFilterPanelPosition] = useState({
    top: 0,
    left: 0,
    maxHeight: 320,
  });
  const filterButtonRef = useRef(null);
  const filterPanelRef = useRef(null);
  const activeFilterCount =
    selectedSectorNames.length + Number(selectedSortOrder !== "oldest");

  const updateFilterPanelPosition = () => {
    if (!filterButtonRef.current) {
      return;
    }

    const triggerRect = filterButtonRef.current.getBoundingClientRect();
    const panelHeight = filterPanelRef.current?.getBoundingClientRect().height || 0;

    setFilterPanelPosition(getFilterPanelPosition({ triggerRect, panelHeight }));
  };

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
  }, [activeFilterCount, isFilterOpen]);

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
    setIsFilterOpen(false);
  }, [filterScopeKey]);

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
  }, [activeFilterCount, isFilterOpen]);

  return (
    <section
      className="stub-distribution-toolbar"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "16px",
        flexWrap: "wrap",
      }}
    >
      {/* Search Input Container */}
      <div className="stub-distribution-toolbar-search" style={{ flex: "1" }}>
        <SearchBar
          value={searchValue}
          onChange={onSearchChange}
          onKeyPress={(e) => {
            if (e.key === "Enter") {
              onSearchSubmit();
            }
          }}
          placeholder="Search family head, sectors, or stub number"
        />
      </div>

      <div
        className="stub-distribution-toolbar-controls"
        style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}
      >
        <label
          className="stub-distribution-status-filter"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: "#17324d",
            fontWeight: 700,
          }}
        >
          <span style={{ fontSize: "14px" }}>Status</span>
          <select
            value={selectedStubStatus}
            onChange={(event) => onSelectStubStatus?.(event.target.value)}
            style={{
              minWidth: "120px",
              borderRadius: "12px",
              border: "1px solid #c7d6e5",
              backgroundColor: "#ffffff",
              color: "#17324d",
              padding: "10px 12px",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            {stubStatusOptions.map((statusOption) => (
              <option key={statusOption.value} value={statusOption.value}>
                {statusOption.label}
              </option>
            ))}
            <option value={STATUS_FILTERS.ALL}>All</option>
          </select>
        </label>

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
                ...filterPanelStyles.panel,
                top: filterPanelPosition.top,
                left: filterPanelPosition.left,
                maxHeight: filterPanelPosition.maxHeight,
              }}
            >
              <h3 style={filterPanelStyles.title}>Filter Records</h3>

              <label style={filterPanelStyles.field}>
                <span style={filterPanelStyles.label}>Order List</span>
                <select
                  value={selectedSortOrder}
                  onChange={(event) => onSortOrderChange?.(event.target.value)}
                  style={filterPanelStyles.select}
                >
                  {STUB_SORT_OPTIONS.map((sortOption) => (
                    <option key={sortOption.value} value={sortOption.value}>
                      {sortOption.label}
                    </option>
                  ))}
                </select>
              </label>

              <h3 style={filterPanelStyles.title}>Filter by Sector</h3>

              <div style={filterPanelStyles.list}>
                {sectorOptions.length > 0 ? (
                  sectorOptions.map((sectorOption) => {
                    const sectorValue = getSectorOptionValue(sectorOption);
                    const sectorLabel = getSectorOptionLabel(sectorOption);

                    return (
                      <label key={sectorValue} style={filterPanelStyles.option}>
                        <input
                          type="checkbox"
                          checked={selectedSectorNames.includes(sectorValue)}
                          onChange={() => onToggleSector(sectorValue)}
                          style={{ accentColor: "#2f6499" }}
                        />
                        <span>{sectorLabel}</span>
                      </label>
                    );
                  })
                ) : (
                  <p style={{ margin: 0, color: "#5d7188", fontSize: "14px" }}>
                    No sectors are available.
                  </p>
                )}
              </div>

              <div style={filterPanelStyles.actions}>
                <button
                  type="button"
                  onClick={onClearFilters}
                  style={filterPanelStyles.clearAction}
                >
                  Clear
                </button>
              </div>
            </div>
          ) : null}
        </div>
        {actions ? (
          <div className="stub-distribution-toolbar-actions">{actions}</div>
        ) : null}
      </div>
    </section>
  );
};

const getSectorOptionValue = (sectorOption) => {
  if (typeof sectorOption === "string") {
    return sectorOption;
  }

  return sectorOption?.id || sectorOption?.code || sectorOption?.name || "";
};

const getSectorOptionLabel = (sectorOption) => {
  if (typeof sectorOption === "string") {
    return sectorOption;
  }

  return (
    sectorOption?.display_name ||
    sectorOption?.label ||
    sectorOption?.name ||
    sectorOption?.code ||
    ""
  );
};

export default StubSearchBar;
