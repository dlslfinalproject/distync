import React, { useEffect, useState } from "react";
import SearchBar from "../shared/SearchBar";
import { pageHeaderStyles } from "../layout/PageHeader";
import { FiUserPlus, FiFilter, FiFileText } from "react-icons/fi";
import { MASTERLIST_SORT_OPTIONS } from "../../features/masterlist/masterlistService";
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
    borderRadius: "14px",
    border: "1px solid #d0ddeb",
    backgroundColor: "#ffffff",
    color: "#17324d",
    padding: "10px 12px",
    fontSize: "14px",
    fontWeight: 600,
  },
};

const MasterlistToolbar = ({
  searchValue,
  onSearchChange,
  onOpenRegisterFamily,
  hideRegisterButton,
  recordStatus = "active",
  onRecordStatusChange,
  sectorOptions = [],
  selectedSectorIds = [],
  selectedSortOrder = "newest",
  onSortOrderChange,
  onToggleSector,
  onClearFilters,
  filterScopeKey = "",
  exportingFormat = "",
  onOpenExport,
  disableExportButton = false,
  hideExportButton = false,
  hideRecordStatus = false,
}) => {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const activeFilterCount =
    selectedSectorIds.length + (selectedSortOrder !== "newest" ? 1 : 0);

  useEffect(() => {
    setIsFilterOpen(false);
  }, [filterScopeKey]);

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
      <div className="masterlist-toolbar-search" style={{ flex: 1 }}>
        <SearchBar
          value={searchValue}
          onChange={onSearchChange}
          placeholder="Search family head, address, or sectors"
        />
      </div>

      <div
        className="masterlist-toolbar-actions"
        style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}
      >
        {!hideRecordStatus ? (
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
        ) : null}

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
                  {MASTERLIST_SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <h3 style={filterPanelStyles.title}>Filter by Sector</h3>

              <div style={filterPanelStyles.list}>
                {sectorOptions.length > 0 ? (
                  sectorOptions.map((sector) => (
                    <label key={sector.id} style={filterPanelStyles.option}>
                      <input
                        type="checkbox"
                        checked={selectedSectorIds.includes(sector.id)}
                        onChange={() => onToggleSector(sector.id)}
                        style={{ accentColor: "#2f6499" }}
                      />
                      <span>{sector.display_name || sector.name}</span>
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
                  style={filterPanelStyles.clearAction}
                >
                  Clear
                </button>
              </div>
          </ResponsiveFilterPopover>
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

        {!hideExportButton ? (
          <button
            type="button"
            onClick={onOpenExport}
            disabled={disableExportButton || Boolean(exportingFormat)}
            style={{
              border: "1px solid #c6d8ea",
              borderRadius: "14px",
              padding: "12px 18px",
              backgroundColor: "#f8fbfe",
              color: "#2a4c6f",
              fontSize: "14px",
              fontWeight: 700,
              cursor:
                disableExportButton || exportingFormat ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              opacity: disableExportButton || exportingFormat ? 0.7 : 1,
            }}
          >
            <FiFileText size={16} />
            {exportingFormat
              ? `Exporting ${exportingFormat.toUpperCase()}...`
              : "Export"}
          </button>
        ) : null}
      </div>
    </section>
  );
};

export default MasterlistToolbar;
