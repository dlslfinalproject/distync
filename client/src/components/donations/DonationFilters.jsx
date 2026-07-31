import React, { useCallback, useEffect, useRef, useState } from "react";
import { FiFileText, FiFilter, FiPackage, FiPlus } from "react-icons/fi";
import SearchBar from "../shared/SearchBar";
import { pageHeaderStyles } from "../layout/PageHeader";
import { inputStyles } from "../../features/donations/donationUi";
import { donorTypeLabels } from "../../features/donations/donationFormatters";

const FILTER_PANEL_GAP = 12;
const FILTER_PANEL_VIEWPORT_PADDING = 16;
const MIN_FILTER_PANEL_HEIGHT = 220;

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

const toolbarStyles = {
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
  onSelectedEventChange,
  onDonationSearchChange,
  onDonationTypeFilterChange,
  onDonationToolbarFilterChange,
  onOpenDonationModal,
  onExportDonations,
  isExportingTransparency,
  onOpenTransparencyExport,
  showEventSelector = true,
  showDonationActions = true,
  showTransparencyActions = true,
}) => {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterPanelPosition, setFilterPanelPosition] = useState({
    top: 0,
    left: 0,
    maxHeight: 320,
  });
  const filterButtonRef = useRef(null);
  const filterPanelRef = useRef(null);
  const selectedDonorTypes = Array.isArray(donationToolbarFilters?.donorTypes)
    ? donationToolbarFilters.donorTypes
    : [];
  const selectedSortOrder = donationToolbarFilters?.sortOrder || "newest";
  const activeFilterCount =
    selectedDonorTypes.length + (selectedSortOrder !== "newest" ? 1 : 0);

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
      return undefined;
    }

    updateFilterPanelPosition();

    const handleResize = () => updateFilterPanelPosition();
    const handleOutsideClick = (event) => {
      if (
        filterPanelRef.current?.contains(event.target) ||
        filterButtonRef.current?.contains(event.target)
      ) {
        return;
      }

      setIsFilterOpen(false);
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);
    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isFilterOpen, updateFilterPanelPosition]);

  const handleToggleDonorType = (donorType) => {
    const nextDonorTypes = selectedDonorTypes.includes(donorType)
      ? selectedDonorTypes.filter((entry) => entry !== donorType)
      : [...selectedDonorTypes, donorType];

    onDonationToolbarFilterChange?.("donorTypes", nextDonorTypes);
  };

  const handleClearFilters = () => {
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
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <div style={toolbarStyles.controlsGroup}>
              <div style={toolbarStyles.searchWrap}>
                <SearchBar
                  value={donationSearch}
                  onChange={onDonationSearchChange}
                  placeholder="Search by donor name or item name"
                />
              </div>

              <div style={toolbarStyles.inlineSelectWrap}>
                <label
                  htmlFor="donation-type-filter"
                  style={toolbarStyles.inlineSelectLabel}
                >
                  Type
                </label>
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
                      ...toolbarStyles.filterPanel,
                      top: filterPanelPosition.top,
                      left: filterPanelPosition.left,
                      maxHeight: filterPanelPosition.maxHeight,
                    }}
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
                  </div>
                ) : null}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: "12px",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "flex-end",
              }}
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
                        right: "-3px",
                        bottom: "-2px",
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
      ) : null}

      {activeTab === "transparency" && showTransparencyActions ? (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          {canManageDonations ? (
            <button
              type="button"
              onClick={onOpenTransparencyExport}
              style={pageHeaderStyles.secondaryButton}
              disabled={Boolean(isExportingTransparency)}
            >
              <FiFileText size={16} />
              {isExportingTransparency
                ? `Exporting ${isExportingTransparency.toUpperCase()}...`
                : "Export"}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};

export default DonationFilters;
