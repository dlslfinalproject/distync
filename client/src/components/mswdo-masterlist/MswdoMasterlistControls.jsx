import React from "react";
import { FiFileText, FiFilter, FiUserPlus } from "react-icons/fi";
import PageHeader, { pageHeaderStyles } from "../layout/PageHeader";
import { shellStyles } from "../layout/BarangayLayout";
import SearchBar from "../shared/SearchBar";
import { MASTERLIST_SORT_OPTIONS } from "../../features/masterlist/masterlistService";

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

const MswdoMasterlistControls = ({
  searchTerm,
  onSearchChange,
  recordStatus,
  onRecordStatusChange,
  filterButtonRef,
  filterPanelRef,
  isFilterOpen,
  filterPanelPosition,
  hasActiveSectorFilters,
  hasNonDefaultSort,
  selectedSectorIds,
  selectedSortOrder = "newest",
  sectors,
  onToggleFilterOpen,
  onToggleSectorFilter,
  onSortOrderChange,
  onClearSectorFilters,
  canRegisterFamily,
  onOpenRegisterModal,
  selectedDisasterEventId,
  exportingFormat,
  onOpenExportModal,
}) => {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        margin: "20px 0",
        gap: "16px",
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: 1 }}>
        <SearchBar
          value={searchTerm}
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
            onClick={onToggleFilterOpen}
            style={{
              ...pageHeaderStyles.secondaryButton,
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <FiFilter size={16} />
            {hasActiveSectorFilters || hasNonDefaultSort
              ? `Filter (${selectedSectorIds.length + (hasNonDefaultSort ? 1 : 0)})`
              : "Filter"}
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
                  {MASTERLIST_SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <h3 style={filterPanelStyles.title}>Filter by Sector</h3>
              <div style={filterPanelStyles.list}>
                {sectors.length > 0 ? (
                  sectors.map((sector) => (
                    <label key={sector.id} style={filterPanelStyles.option}>
                      <input
                        type="checkbox"
                        checked={selectedSectorIds.includes(sector.id)}
                        onChange={() => onToggleSectorFilter(sector.id)}
                        style={{ accentColor: "#2f6499" }}
                      />
                      <span>{sector.display_name || sector.name}</span>
                    </label>
                  ))
                ) : (
                  <p style={{ ...shellStyles.mutedText, margin: 0 }}>
                    No sectors are available.
                  </p>
                )}
              </div>

              <div style={filterPanelStyles.actions}>
                <button
                  type="button"
                  onClick={onClearSectorFilters}
                  style={filterPanelStyles.clearAction}
                >
                  Clear
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {canRegisterFamily ? (
          <button
            type="button"
            onClick={onOpenRegisterModal}
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
        ) : null}

        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={onOpenExportModal}
            disabled={!selectedDisasterEventId || Boolean(exportingFormat)}
            style={{
              border: "1px solid #c6d8ea",
              borderRadius: "14px",
              padding: "12px 18px",
              backgroundColor: "#f8fbfe",
              color: "#2a4c6f",
              fontSize: "14px",
              fontWeight: 700,
              cursor:
                !selectedDisasterEventId || exportingFormat
                  ? "not-allowed"
                  : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              opacity: !selectedDisasterEventId || exportingFormat ? 0.7 : 1,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "2px" }}>
              <FiFileText size={16} />
            </span>
            {exportingFormat
              ? `Exporting ${exportingFormat.toUpperCase()}...`
              : "Export"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MswdoMasterlistControls;
