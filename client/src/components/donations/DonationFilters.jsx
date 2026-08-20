import React, { useState } from "react";
import { FiFileText, FiFilter, FiPackage, FiPlus } from "react-icons/fi";
import SearchBar from "../shared/SearchBar";
import { pageHeaderStyles } from "../layout/PageHeader";
import { inputStyles } from "../../features/donations/donationUi";
import { donorTypeLabels } from "../../features/donations/donationFormatters";
import ResponsiveFilterPopover from "../shared/ResponsiveFilterPopover";

const donorTypeFilterOptions = [
  "INDIVIDUAL",
  "NGO",
  "PRIVATE_ORGANIZATION",
  "GOVERNMENT_PARTNER",
  "OTHER",
];

const sortOptions = [
  { value: "newest", label: "Newest-Oldest" },
  { value: "oldest", label: "Oldest-Newest" },
  { value: "az", label: "A-Z" },
  { value: "za", label: "Z-A" },
];

const transparencySortOptions = [
  { value: "newest", label: "Newest-Oldest" },
  { value: "oldest", label: "Oldest-Newest" },
  { value: "az", label: "A-Z" },
  { value: "za", label: "Z-A" },
];

const transparencyMovementFilterOptions = [
  { value: "has_distributed", label: "Has Distributed Quantity" },
  { value: "has_write_off", label: "Has Write-Off" },
  { value: "has_remaining", label: "Has Remaining Balance" },
  { value: "no_remaining", label: "No Remaining Balance" },
];

const toolbarStyles = {
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
    width: "100%",
  },
  searchWrap: {
    flex: 1,
    minWidth: 0,
  },
  inlineSelectWrap: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flex: "0 0 auto",
  },
  inlineSelectLabel: {
    color: "#17324d",
    fontSize: "14px",
    fontWeight: 700,
  },
  inlineSelect: {
    minWidth: "120px",
    border: "1px solid #c7d6e5",
    borderRadius: "12px",
    padding: "10px 12px",
    background: "#ffffff",
    color: "#17324d",
    fontSize: "14px",
    fontWeight: 600,
    outline: "none",
    boxSizing: "border-box",
    appearance: "auto",
    minHeight: "44px",
  },
  controlsWrap: {
    display: "flex",
    gap: "16px",
    flexWrap: "wrap",
    alignItems: "center",
    flex: "0 0 auto",
  },
  actionGroup: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
    flex: "0 0 auto",
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

const DonationFilters = ({
  activeTab,
  canManageDonations,
  selectedEventId,
  disasterEvents,
  donationSearch,
  donationTypeFilter,
  donationToolbarFilters,
  transparencySearch,
  transparencyToolbarFilters,
  onSelectedEventChange,
  onDonationSearchChange,
  onDonationTypeFilterChange,
  onDonationToolbarFilterChange,
  onTransparencySearchChange,
  onTransparencyToolbarFilterChange,
  onOpenDonationModal,
  onExportDonations,
  isExportingTransparency,
  onOpenTransparencyExport,
  showEventSelector = true,
  showDonationActions = true,
  showTransparencyActions = true,
}) => {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const selectedDonorTypes = Array.isArray(donationToolbarFilters?.donorTypes)
    ? donationToolbarFilters.donorTypes
    : [];
  const selectedSortOrder = donationToolbarFilters?.sortOrder || "newest";
  const selectedTransparencyMovements = Array.isArray(
    transparencyToolbarFilters?.movements,
  )
    ? transparencyToolbarFilters.movements
    : [];
  const selectedTransparencySortOrder =
    transparencyToolbarFilters?.sortOrder || "newest";
  const donationActiveFilterCount =
    selectedDonorTypes.length + (selectedSortOrder !== "newest" ? 1 : 0);
  const transparencyActiveFilterCount =
    selectedTransparencyMovements.length +
    (selectedTransparencySortOrder !== "newest" ? 1 : 0);
  const activeFilterCount =
    activeTab === "transparency"
      ? transparencyActiveFilterCount
      : donationActiveFilterCount;

  const handleToggleDonorType = (donorType) => {
    const nextDonorTypes = selectedDonorTypes.includes(donorType)
      ? selectedDonorTypes.filter((entry) => entry !== donorType)
      : [...selectedDonorTypes, donorType];

    onDonationToolbarFilterChange?.("donorTypes", nextDonorTypes);
  };

  const handleToggleTransparencyMovement = (movement) => {
    const nextMovements = selectedTransparencyMovements.includes(movement)
      ? selectedTransparencyMovements.filter((entry) => entry !== movement)
      : [...selectedTransparencyMovements, movement];

    onTransparencyToolbarFilterChange?.("movements", nextMovements);
  };

  const handleClearFilters = () => {
    if (activeTab === "transparency") {
      onTransparencyToolbarFilterChange?.("sortOrder", "newest");
      onTransparencyToolbarFilterChange?.("movements", []);
      return;
    }

    onDonationToolbarFilterChange?.("sortOrder", "newest");
    onDonationToolbarFilterChange?.("donorTypes", []);
  };

  return (
    <section
      style={{
        display: "grid",
        gap: "20px",
      }}
    >
      {showEventSelector ? (
        <div style={{ maxWidth: "420px" }}>
          <label
            htmlFor="donation-management-disaster-event"
            style={{
              display: "block",
              marginBottom: "8px",
              color: "#58708a",
              fontSize: "12px",
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Disaster Event
          </label>
          <select
            id="donation-management-disaster-event"
            value={selectedEventId}
            onChange={(event) => onSelectedEventChange(event.target.value)}
            style={{ ...inputStyles, maxWidth: "100%" }}
          >
            <option value="">All disaster events</option>
            {disasterEvents.map((eventRow) => (
              <option key={eventRow.id} value={eventRow.id}>
                {eventRow.title}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {activeTab === "donations" && showDonationActions ? (
        <div
          style={{
            width: "100%",
            display: "grid",
            gap: "16px",
          }}
        >
          <div
            className="mayor-donation-management-toolbar"
            style={toolbarStyles.row}
          >
            <div
              className="mayor-donation-management-search-wrap"
              style={toolbarStyles.searchWrap}
            >
              <SearchBar
                value={donationSearch}
                onChange={onDonationSearchChange}
                placeholder="Search by donor name or item name"
              />
            </div>

            <div
              className="mayor-donation-management-toolbar-controls"
              style={toolbarStyles.controlsWrap}
            >
              <label
                htmlFor="donation-type-filter"
                className="mayor-donation-management-type-filter"
                style={toolbarStyles.inlineSelectWrap}
              >
                <span style={toolbarStyles.inlineSelectLabel}>Type</span>
                <select
                  id="donation-type-filter"
                  value={donationTypeFilter}
                  onChange={(event) => onDonationTypeFilterChange?.(event.target.value)}
                  style={toolbarStyles.inlineSelect}
                >
                  <option value="">All</option>
                  <option value="LOOSE ITEM">Loose Item</option>
                  <option value="RELIEF PACK">Relief Pack</option>
                </select>
              </label>

              <div className="mayor-donation-management-filter-button-wrap">
                <ResponsiveFilterPopover
                  isOpen={isFilterOpen}
                  onOpenChange={setIsFilterOpen}
                  title="Filter Records"
                  panelClassName="mayor-donation-management-filter-panel"
                  scopeKey={activeTab}
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
                    <h3 style={toolbarStyles.filterTitle}>Filter Records</h3>

                    <label style={toolbarStyles.filterField}>
                      <span style={toolbarStyles.filterLabel}>Order List</span>
                      <select
                        value={selectedSortOrder}
                        onChange={(event) =>
                          onDonationToolbarFilterChange?.(
                            "sortOrder",
                            event.target.value,
                          )
                        }
                        style={toolbarStyles.filterSelect}
                      >
                        {sortOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <h3 style={toolbarStyles.filterTitle}>Donor Types</h3>

                    <div style={toolbarStyles.filterList}>
                      {donorTypeFilterOptions.map((donorType) => (
                        <label key={donorType} style={toolbarStyles.filterOption}>
                          <input
                            type="checkbox"
                            checked={selectedDonorTypes.includes(donorType)}
                            onChange={() => handleToggleDonorType(donorType)}
                            style={{ accentColor: "#2f6499" }}
                          />
                          <span>{donorTypeLabels[donorType] || donorType}</span>
                        </label>
                      ))}
                    </div>

                    <div style={toolbarStyles.filterActions}>
                      <button
                        type="button"
                        onClick={handleClearFilters}
                        style={toolbarStyles.clearAction}
                      >
                        Clear
                      </button>
                    </div>
                </ResponsiveFilterPopover>
              </div>

              <div
                className="mayor-donation-management-action-group"
                style={toolbarStyles.actionGroup}
              >
                {canManageDonations ? (
                  <button
                    type="button"
                    onClick={onOpenDonationModal}
                    style={pageHeaderStyles.primaryButton}
                  >
                    <span
                      style={{
                        position: "relative",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "18px",
                        height: "18px",
                        flexShrink: 0,
                      }}
                    >
                      <FiPackage size={16} />
                      <span
                        style={{
                          position: "absolute",
                          right: "-5px",
                          bottom: "-4px",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          lineHeight: 1,
                        }}
                      >
                        <FiPlus size={10} strokeWidth={3} />
                      </span>
                    </span>
                    Add Donation
                  </button>
                ) : null}

                {canManageDonations ? (
                  <button
                    type="button"
                    onClick={onExportDonations}
                    style={pageHeaderStyles.secondaryButton}
                  >
                    <FiFileText size={16} />
                    Export
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "transparency" && showTransparencyActions ? (
        <div
          style={{
            width: "100%",
            display: "grid",
            gap: "16px",
          }}
        >
          <div className="mayor-donation-management-toolbar" style={toolbarStyles.row}>
            <div
              className="mayor-donation-management-search-wrap"
              style={toolbarStyles.searchWrap}
            >
              <SearchBar
                value={transparencySearch}
                onChange={onTransparencySearchChange}
                placeholder="Search by donor, item, event, or write-off reason"
              />
            </div>

            <div
              className="mayor-donation-management-toolbar-controls"
              style={toolbarStyles.controlsWrap}
            >
              <div className="mayor-donation-management-filter-button-wrap">
                <ResponsiveFilterPopover
                  isOpen={isFilterOpen}
                  onOpenChange={setIsFilterOpen}
                  title="Filter Records"
                  panelClassName="mayor-donation-management-filter-panel"
                  scopeKey={activeTab}
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
                    <h3 style={toolbarStyles.filterTitle}>Filter Records</h3>

                    <label style={toolbarStyles.filterField}>
                      <span style={toolbarStyles.filterLabel}>Order List</span>
                      <select
                        value={selectedTransparencySortOrder}
                        onChange={(event) =>
                          onTransparencyToolbarFilterChange?.(
                            "sortOrder",
                            event.target.value,
                          )
                        }
                        style={toolbarStyles.filterSelect}
                      >
                        {transparencySortOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <h3 style={toolbarStyles.filterTitle}>Item Status / Movement</h3>

                    <div style={toolbarStyles.filterList}>
                      {transparencyMovementFilterOptions.map((option) => (
                        <label key={option.value} style={toolbarStyles.filterOption}>
                          <input
                            type="checkbox"
                            checked={selectedTransparencyMovements.includes(
                              option.value,
                            )}
                            onChange={() =>
                              handleToggleTransparencyMovement(option.value)
                            }
                            style={{ accentColor: "#2f6499" }}
                          />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>

                    <div style={toolbarStyles.filterActions}>
                      <button
                        type="button"
                        onClick={handleClearFilters}
                        style={toolbarStyles.clearAction}
                      >
                        Clear
                      </button>
                    </div>
                </ResponsiveFilterPopover>
              </div>

              <div
                className="mayor-donation-management-action-group"
                style={toolbarStyles.actionGroup}
              >
                {canManageDonations ? (
                  <button
                    type="button"
                    onClick={onOpenTransparencyExport}
                    style={pageHeaderStyles.secondaryButton}
                    disabled={Boolean(isExportingTransparency)}
                  >
                    <FiFileText size={16} />
                    Export
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default DonationFilters;
