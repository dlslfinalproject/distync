import React, { useEffect, useRef, useState } from "react";
import SearchBar from "../shared/SearchBar";
import { pageHeaderStyles } from "../layout/PageHeader";
import { FiUserPlus, FiFilter } from "react-icons/fi";

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
    justifyContent: "space-between",
    gap: "10px",
    marginTop: "auto",
  },
};

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

const MasterlistToolbar = ({
  searchValue,
  onSearchChange,
  onOpenRegisterFamily,
  hideRegisterButton,
  recordStatus = "active",
  onRecordStatusChange,
  sectorOptions = [],
  selectedSectorNames = [],
  onToggleSector,
  onClearFilters,
  filterScopeKey = "",
}) => {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterPanelPosition, setFilterPanelPosition] = useState({
    top: 0,
    left: 0,
    maxHeight: 320,
  });
  const filterButtonRef = useRef(null);
  const filterPanelRef = useRef(null);
  const activeFilterCount = selectedSectorNames.length;

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
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "16px",
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: 1 }}>
        <SearchBar
          value={searchValue}
          onChange={onSearchChange}
          placeholder="Search family head, address, or sectors"
        />
      </div>

      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <label
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
            value={recordStatus}
            onChange={(event) => onRecordStatusChange?.(event.target.value)}
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
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
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
              <h3 style={filterPanelStyles.title}>Filter by Sector</h3>

              <div style={filterPanelStyles.list}>
                {sectorOptions.length > 0 ? (
                  sectorOptions.map((sectorName) => (
                    <label key={sectorName} style={filterPanelStyles.option}>
                      <input
                        type="checkbox"
                        checked={selectedSectorNames.includes(sectorName)}
                        onChange={() => onToggleSector(sectorName)}
                        style={{ accentColor: "#2f6499" }}
                      />
                      <span>{sectorName}</span>
                    </label>
                  ))
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
                  style={pageHeaderStyles.secondaryButton}
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(false)}
                  style={pageHeaderStyles.primaryButton}
                >
                  Apply
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {!hideRegisterButton && (
          <button
            type="button"
            onClick={onOpenRegisterFamily}
            style={{
              ...pageHeaderStyles.primaryButton,
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <FiUserPlus size={16} />
            Register Family
          </button>
        )}
      </div>
    </section>
  );
};

export default MasterlistToolbar;
