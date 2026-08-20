import React, { useEffect, useState } from "react";
import SearchBar from "../shared/SearchBar";
import { pageHeaderStyles } from "../layout/PageHeader";
import { FiFilter } from "react-icons/fi";
import { STATUS_FILTERS } from "../../features/stubs/stubStatusFilters";
import ResponsiveFilterPopover from "../shared/ResponsiveFilterPopover";

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
  const activeFilterCount =
    selectedSectorNames.length + Number(selectedSortOrder !== "oldest");

  useEffect(() => {
    setIsFilterOpen(false);
  }, [filterScopeKey]);

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
          <ResponsiveFilterPopover
            isOpen={isFilterOpen}
            onOpenChange={setIsFilterOpen}
            title="Filter Records"
            scopeKey={filterScopeKey}
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
          </ResponsiveFilterPopover>
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
