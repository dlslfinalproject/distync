import React, { useMemo, useRef, useState } from "react";
import { FiChevronDown, FiFileText, FiFilter } from "react-icons/fi";
import PageHeader, { pageHeaderStyles } from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import InventoryDistributionTable from "../../components/inventory-distribution/InventoryDistributionTable";
import SearchBar from "../../components/shared/SearchBar";
import StatusCard from "../../components/shared/StatusCard";
import { useInventoryDistribution } from "../../features/inventory-distribution/useInventoryDistribution";

const filterStyles = {
  field: {
    width: "100%",
    padding: "12px 14px",
    paddingRight: "42px",
    borderRadius: "12px",
    border: "1px solid #cfddeb",
    backgroundColor: "#f8fbfe",
    color: "#1f3b57",
    fontSize: "14px",
    boxSizing: "border-box",
    outline: "none",
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
  },
  label: {
    display: "block",
    marginBottom: "8px",
    color: "#5f7892",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  selectWrap: {
    position: "relative",
    width: "100%",
  },
  selectIcon: {
    position: "absolute",
    right: "14px",
    top: "50%",
    transform: "translateY(-50%)",
    pointerEvents: "none",
    color: "#5f7892",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
};

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
    overflowY: "auto",
    boxSizing: "border-box",
  },
  title: {
    margin: 0,
    color: "#17324d",
    fontSize: "16px",
    fontWeight: 800,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    color: "#55718b",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  select: {
    minHeight: "42px",
    border: "1px solid #d0ddeb",
    borderRadius: "12px",
    padding: "10px 12px",
    fontSize: "14px",
    color: "#1f405f",
    backgroundColor: "#f8fbfe",
    boxSizing: "border-box",
  },
  list: {
    display: "grid",
    gap: "10px",
    overflow: "visible",
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
    marginTop: "8px",
  },
};

const layoutStyles = {
  page: {
    flex: 1,
    minWidth: 0,
    maxWidth: "100%",
    overflowX: "hidden",
  },
  stack: {
    display: "grid",
    gap: "18px",
  },
  eventCard: {
    ...shellStyles.card,
    padding: "22px 24px",
  },
  eventTitleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  eventTitle: {
    margin: 0,
    color: "#17324d",
    fontSize: "22px",
    fontWeight: 800,
  },
  eventLabel: {
    margin: "0 0 8px",
    color: "#5f7892",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  templateBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: "999px",
    backgroundColor: "#eef5fc",
    color: "#295f92",
    fontSize: "12px",
    fontWeight: 700,
  },
  toolbarCard: {
    ...shellStyles.card,
    padding: "18px 20px",
  },
};

const FILTER_PANEL_GAP = 12;
const FILTER_PANEL_VIEWPORT_PADDING = 16;
const MIN_FILTER_PANEL_HEIGHT = 220;

const getFilterPanelPosition = ({ triggerRect, panelHeight }) => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const constrainedPanelWidth = Math.min(
    380,
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

const distributionStatusOptions = [
  { value: "", label: "All Statuses" },
  { value: "CLAIMED", label: "Claimed" },
  { value: "PENDING", label: "Pending / For Claim" },
  { value: "NOT_DISTRIBUTED", label: "Not Distributed" },
];

const buildCsvCell = (value) => {
  return `"${String(value || "").replace(/"/g, '""')}"`;
};

const downloadCsvFile = (rows, selectedEvent, selectedBarangay) => {
  const header = [
    "Family Head",
    "Address",
    "Family Members",
    "Sectors",
    "Relief Pack",
    "Status",
  ];

  const csvRows = rows.map((row) => [
    row.family_head_name,
    row.address,
    row.family_members_count,
    row.sectors_text,
    Array.isArray(row.relief_pack_items) && row.relief_pack_items.length > 0
      ? row.relief_pack_items
          .map(
            (item) =>
              `${item.inventory_item?.item_name || "Unnamed Item"} (${item.quantity_required})`,
          )
          .join("; ")
      : "Template linkage pending",
    row.distribution_status_label,
  ]);

  const csvContent = [header, ...csvRows]
    .map((cells) => cells.map(buildCsvCell).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const downloadUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const safeEventCode = (
    selectedEvent?.event_code ||
    selectedEvent?.title ||
    "event"
  ).replace(/[^a-z0-9-_]+/gi, "-");
  const safeBarangayName = (
    selectedBarangay?.name ||
    "all-barangays"
  ).replace(/[^a-z0-9-_]+/gi, "-");

  anchor.href = downloadUrl;
  anchor.download = `inventory-distribution-${safeEventCode}-${safeBarangayName}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(downloadUrl);
};

const InventoryDistributionPage = () => {
  const {
    disasterEvents,
    barangays,
    sectorOptions,
    selectedDisasterEvent,
    selectedBarangay,
    selectedDisasterEventId,
    selectedBarangayId,
    selectedStatus,
    selectedSectorIds,
    searchTerm,
    selectedTemplate,
    templateNotice,
    displayedRows,
    analytics,
    isLoadingFilters,
    isLoadingMasterlist,
    isLoadingTemplate,
    errorMessage,
    hasActiveEvents,
    setSearchTerm,
    setSelectedDisasterEventId,
    setSelectedBarangayId,
    setSelectedStatus,
    setSelectedSectorIds,
  } = useInventoryDistribution();

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterPanelPosition, setFilterPanelPosition] = useState({
    top: 0,
    left: 0,
    maxHeight: 320,
  });
  const filterButtonRef = useRef(null);
  const filterPanelRef = useRef(null);

  React.useEffect(() => {
    if (!isFilterOpen) {
      return undefined;
    }

    const updateFilterPanelPosition = () => {
      if (!filterButtonRef.current) {
        return;
      }

      const triggerRect = filterButtonRef.current.getBoundingClientRect();
      const panelHeight =
        filterPanelRef.current?.getBoundingClientRect().height || 0;

      setFilterPanelPosition(
        getFilterPanelPosition({ triggerRect, panelHeight }),
      );
    };

    updateFilterPanelPosition();

    const handleWindowChange = () => {
      updateFilterPanelPosition();
    };

    const handleOutsideClick = (event) => {
      if (
        filterPanelRef.current?.contains(event.target) ||
        filterButtonRef.current?.contains(event.target)
      ) {
        return;
      }

      setIsFilterOpen(false);
    };

    window.addEventListener("resize", handleWindowChange);
    window.addEventListener("scroll", handleWindowChange, true);
    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      window.removeEventListener("resize", handleWindowChange);
      window.removeEventListener("scroll", handleWindowChange, true);
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isFilterOpen, selectedSectorIds.length]);

  React.useEffect(() => {
    setIsFilterOpen(false);
  }, [selectedBarangayId, selectedDisasterEventId]);

  const activeFilterCount = useMemo(() => {
    return Number(Boolean(selectedStatus)) + selectedSectorIds.length;
  }, [selectedStatus, selectedSectorIds.length]);

  const summaryCards = useMemo(() => {
    return [
      {
        label: "Total Families Served",
        value: analytics.totalFamiliesServed,
        description:
          "Families with relief packs already distributed for the selected event and barangay view.",
        accentColor: "#2f6499",
      },
      {
        label: "Total Relief Packs Distributed",
        value: analytics.totalReliefPacksDistributed,
        description:
          "Distributed relief packs based on issued or claimed household stub records.",
        accentColor: "#c9792b",
      },
      {
        label: "Claimed vs Unclaimed",
        value: `${analytics.claimedCount} / ${analytics.pendingCount}`,
        description:
          "Claimed families are listed first, while unclaimed families remain pending for release pickup.",
        accentColor: "#2d7a4f",
      },
      {
        label: "Sector Distribution",
        value: analytics.topSector
          ? `${analytics.topSector.name} (${analytics.topSector.count})`
          : "No tagged sector",
        description: analytics.topSector
          ? `Top tagged sector among filtered families. ${analytics.sectorBreakdown.length} sector group(s) are currently visible.`
          : "Sector counts will appear once tagged family records are available in the selected view.",
        accentColor: "#7b61a8",
      },
    ];
  }, [analytics]);

  if (!hasActiveEvents && !isLoadingFilters) {
    return (
      <div style={layoutStyles.page}>
        <PageHeader title="INVENTORY DISTRIBUTION" />

        <section style={shellStyles.card}>
          <p style={{ ...shellStyles.mutedText, margin: 0 }}>
            No active disaster event is available yet. This page is ready for
            family-level inventory distribution monitoring once an event becomes
            active.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div style={layoutStyles.page}>
      <PageHeader title="INVENTORY DISTRIBUTION" />

      <div style={layoutStyles.stack}>
        <section style={shellStyles.card}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
              alignItems: "end",
            }}
          >
            <div>
              <label
                htmlFor="inventory-distribution-event"
                style={filterStyles.label}
              >
                Active Disaster Event
              </label>
              <div style={filterStyles.selectWrap}>
                <select
                  id="inventory-distribution-event"
                  value={selectedDisasterEventId}
                  onChange={(event) =>
                    setSelectedDisasterEventId(event.target.value)
                  }
                  disabled={isLoadingFilters}
                  style={filterStyles.field}
                >
                  <option value="">Select active disaster event</option>
                  {disasterEvents.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.event_code} - {event.title}
                    </option>
                  ))}
                </select>
                <span style={filterStyles.selectIcon}>
                  <FiChevronDown size={16} />
                </span>
              </div>
            </div>

            <div>
              <label
                htmlFor="inventory-distribution-barangay"
                style={filterStyles.label}
              >
                Barangay
              </label>
              <div style={filterStyles.selectWrap}>
                <select
                  id="inventory-distribution-barangay"
                  value={selectedBarangayId}
                  onChange={(event) => setSelectedBarangayId(event.target.value)}
                  disabled={isLoadingFilters}
                  style={filterStyles.field}
                >
                  <option value="">All Barangays</option>
                  {barangays.map((barangay) => (
                    <option key={barangay.id} value={barangay.id}>
                      {barangay.name}
                    </option>
                  ))}
                </select>
                <span style={filterStyles.selectIcon}>
                  <FiChevronDown size={16} />
                </span>
              </div>
            </div>
          </div>
        </section>

        {selectedDisasterEvent ? (
          <section style={layoutStyles.eventCard}>
            <p style={layoutStyles.eventLabel}>Selected Disaster Event</p>

            <div style={layoutStyles.eventTitleRow}>
              <p style={layoutStyles.eventTitle}>
                {selectedDisasterEvent.event_code} -{" "}
                {selectedDisasterEvent.title}
              </p>

              {selectedTemplate ? (
                <span style={layoutStyles.templateBadge}>
                  {selectedTemplate.name}
                </span>
              ) : null}
            </div>

            <p style={{ ...shellStyles.mutedText, margin: "10px 0 0" }}>
              {templateNotice ||
                "Relief pack item details will appear here once a template is linked to the selected distribution flow."}
            </p>

            {(isLoadingTemplate || isLoadingFilters) && !errorMessage ? (
              <p style={{ ...shellStyles.mutedText, margin: "10px 0 0" }}>
                Loading relief pack preview...
              </p>
            ) : null}
          </section>
        ) : null}

        <section style={shellStyles.statGrid}>
          {summaryCards.map((card) => (
            <StatusCard key={card.label} {...card} />
          ))}
        </section>

        <section style={layoutStyles.toolbarCard}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: "1 1 320px" }}>
              <SearchBar
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Search family head, address, or sector"
              />
            </div>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <div style={{ position: "relative" }}>
                <button
                  ref={filterButtonRef}
                  type="button"
                  onClick={() =>
                    setIsFilterOpen((currentValue) => !currentValue)
                  }
                  style={pageHeaderStyles.secondaryButton}
                >
                  <FiFilter size={16} />
                  {activeFilterCount > 0
                    ? `Filter (${activeFilterCount})`
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
                    <h3 style={filterPanelStyles.title}>
                      Filter Distribution Records
                    </h3>

                    <label style={filterPanelStyles.field}>
                      <span style={filterPanelStyles.label}>Status</span>
                      <select
                        value={selectedStatus}
                        onChange={(event) =>
                          setSelectedStatus(event.target.value)
                        }
                        style={filterPanelStyles.select}
                      >
                        {distributionStatusOptions.map((option) => (
                          <option
                            key={option.value || "all"}
                            value={option.value}
                          >
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div style={filterPanelStyles.field}>
                      <span style={filterPanelStyles.label}>Sector</span>
                      <div style={filterPanelStyles.list}>
                        {sectorOptions.length > 0 ? (
                          sectorOptions.map((sector) => (
                            <label
                              key={sector.id}
                              style={filterPanelStyles.option}
                            >
                              <input
                                type="checkbox"
                                checked={selectedSectorIds.includes(sector.id)}
                                onChange={() =>
                                  setSelectedSectorIds((currentValues) =>
                                    currentValues.includes(sector.id)
                                      ? currentValues.filter(
                                          (value) => value !== sector.id,
                                        )
                                      : [...currentValues, sector.id],
                                  )
                                }
                                style={{ accentColor: "#2f6499" }}
                              />
                              <span>{sector.name}</span>
                            </label>
                          ))
                        ) : (
                          <p style={{ ...shellStyles.mutedText, margin: 0 }}>
                            No sector filters are available for the selected
                            records.
                          </p>
                        )}
                      </div>
                    </div>

                    <div style={filterPanelStyles.actions}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStatus("");
                          setSelectedSectorIds([]);
                        }}
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

              <button
                type="button"
                onClick={() =>
                  downloadCsvFile(
                    displayedRows,
                    selectedDisasterEvent,
                    selectedBarangay,
                  )
                }
                disabled={!displayedRows.length}
                style={{
                  ...pageHeaderStyles.secondaryButton,
                  cursor: displayedRows.length ? "pointer" : "not-allowed",
                  opacity: displayedRows.length ? 1 : 0.7,
                }}
              >
                <FiFileText size={16} />
                Export
              </button>
            </div>
          </div>
        </section>

        <InventoryDistributionTable
          rows={displayedRows}
          isLoading={isLoadingFilters || isLoadingMasterlist}
          errorMessage={errorMessage}
          hasSelectedEvent={Boolean(selectedDisasterEventId)}
        />
      </div>
    </div>
  );
};

export default InventoryDistributionPage;