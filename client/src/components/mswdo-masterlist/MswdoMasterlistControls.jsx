import React from "react";
import { FiFileText, FiFilter, FiUserPlus } from "react-icons/fi";
import PageHeader, { pageHeaderStyles } from "../layout/PageHeader";
import { shellStyles } from "../layout/BarangayLayout";
import SearchBar from "../shared/SearchBar";

const filterPanelStyles = {
  panel: {
    position: "fixed",
    width: "min(380px, calc(100vw - 32px))",
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

const MswdoMasterlistControls = ({
  searchTerm,
  onSearchChange,
  filterButtonRef,
  filterPanelRef,
  isFilterOpen,
  filterPanelPosition,
  hasActiveSectorFilters,
  selectedSectorIds,
  sectors,
  onToggleFilterOpen,
  onToggleSectorFilter,
  onClearSectorFilters,
  onApplySectorFilters,
  canRegisterFamily,
  selectedBarangayId,
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
            {hasActiveSectorFilters
              ? `Filter (${selectedSectorIds.length})`
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
                      <span>{sector.name}</span>
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
                  style={pageHeaderStyles.secondaryButton}
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={onApplySectorFilters}
                  style={pageHeaderStyles.primaryButton}
                >
                  Apply
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {canRegisterFamily ? (
          <button
            type="button"
            onClick={onOpenRegisterModal}
            disabled={!selectedBarangayId}
            title={
              selectedBarangayId
                ? "Register a family under the selected barangay"
                : "Select one barangay before registering a family"
            }
            style={{
              ...pageHeaderStyles.primaryButton,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: selectedBarangayId ? "pointer" : "not-allowed",
              opacity: selectedBarangayId ? 1 : 0.65,
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
