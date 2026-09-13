import React, { useMemo, useState } from "react";
import { FiChevronDown, FiFileText, FiFilter } from "react-icons/fi";
import PageHeader, { pageHeaderStyles } from "../../components/layout/PageHeader";
import {
  pageSpacingStyles,
  shellStyles,
} from "../../components/layout/BarangayLayout";
import InventoryDistributionTable from "../../components/inventory-distribution/InventoryDistributionTable";
import InventoryDistributionDetailModal from "../../components/inventory-distribution/InventoryDistributionDetailModal";
import MswdoExportModal from "../../components/mswdo-masterlist/MswdoExportModal";
import SearchBar from "../../components/shared/SearchBar";
import StatusCard from "../../components/shared/StatusCard";
import StatusPill from "../../components/shared/StatusPill";
import FeedbackToast from "../../components/shared/FeedbackToast";
import ResponsiveFilterPopover from "../../components/shared/ResponsiveFilterPopover";
import { useInventoryDistribution } from "../../features/inventory-distribution/useInventoryDistribution";
import { useInventoryDistributionReadiness } from "../../features/inventory-distribution/useInventoryDistributionReadiness.js";
import { MASTERLIST_SORT_OPTIONS } from "../../features/masterlist/masterlistService";
import {
  exportInventoryDistribution,
  fetchInventoryDistributionExportOptions,
  fetchInventoryDistributionDetail,
} from "../../features/distribution/distributionService";
import {
  buildExportSuccessMessage,
  downloadExportFile,
  resolveExportErrorMessage,
} from "../../utils/exportHelpers";

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
    maxHeight: "240px",
    overflowY: "auto",
    overscrollBehavior: "contain",
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

const layoutStyles = {
  page: {
    flex: 1,
    minWidth: 0,
    maxWidth: "100%",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  stack: {
    ...pageSpacingStyles.pageStack,
  },
  eventCard: {
    ...shellStyles.card,
  },
  eventInfoPanel: {
    border: "1px solid #d6e2ef",
    borderRadius: "16px",
    padding: "18px 20px",
    backgroundColor: "#f8fbfe",
  },
  eventInfoRow: {
    display: "flex",
    gap: "24px",
    flexWrap: "wrap",
    marginTop: "14px",
  },
  eventTitle: {
    margin: 0,
    color: "#17324d",
    fontSize: "18px",
    fontWeight: 800,
  },
};

const scopeCardStyles = {
  ...shellStyles.card,
  padding: 0,
  boxSizing: "border-box",
};

const scopeTabListStyles = {
  alignItems: "stretch",
  borderBottom: "1px solid #d6e2ef",
  backgroundColor: "#fbfdff",
  borderTopLeftRadius: "17px",
  borderTopRightRadius: "17px",
  display: "flex",
  flexWrap: "nowrap",
  gap: "4px",
  overflowX: "auto",
  padding: "8px clamp(14px, 2vw, 24px) 0",
  minHeight: "56px",
  WebkitOverflowScrolling: "touch",
};

const scopeFilterContentStyles = {
  boxSizing: "border-box",
  padding: "clamp(18px, 2vw, 24px)",
};

const scopeTabButtonStyles = (isActive) => ({
  alignItems: "center",
  boxSizing: "border-box",
  border: "none",
  borderBottom: isActive ? "3px solid #17324d" : "3px solid transparent",
  background: "none",
  color: isActive ? "#17324d" : "#6b8298",
  cursor: "pointer",
  display: "inline-flex",
  fontSize: "14px",
  fontFamily: "inherit",
  fontWeight: 700,
  justifyContent: "center",
  letterSpacing: "0.01em",
  lineHeight: 1.3,
  minHeight: "48px",
  padding: "11px 16px",
  transition: "color 160ms ease, border-color 160ms ease",
  whiteSpace: "nowrap",
});

const distributionStatusOptions = [
  { value: "", label: "All" },
  { value: "CLAIMED", label: "Claimed" },
  { value: "ISSUED", label: "For Claim" },
];

const formatDisplayDate = (value) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-PH", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(value));
};

const formatReliefPeriod = (event) => {
  if (!event) return "-";

  const start = formatDisplayDate(event.start_date);

  if (!event.end_date && event.status === "ACTIVE") {
    return `${start} - Ongoing`;
  }

  if (event.end_date) {
    return `${start} - ${formatDisplayDate(event.end_date)}`;
  }

  return start;
};

const formatDisasterEventTitle = (event) =>
  String(event?.title || "").trim() || "No disaster event selected";

const formatCardValue = (value) => String(value || 0).padStart(2, "0");

const areSameStringValues = (leftValues, rightValues) => {
  if (leftValues.length !== rightValues.length) {
    return false;
  }

  return leftValues.every((value, index) => value === rightValues[index]);
};

const InventoryDistributionPage = () => {
  const {
    activeTab,
    disasterEvents,
    barangays,
    scopedDisasterEvents,
    selectableBarangays,
    sectorOptions,
    selectedDisasterEvent,
    selectedDisasterEventId,
    selectedBarangayId,
    selectedStatus,
    selectedSectorIds,
    selectedSortOrder,
    searchTerm,
    templateDetails,
    displayedRows,
    analytics,
    isLoadingFilters,
    isLoadingMasterlist,
    errorMessage,
    hasActiveEvents,
    handleEventScopeChange,
    resetAllDistributionFilters,
    setSearchTerm,
    setSelectedDisasterEventId,
    setSelectedBarangayId,
    setSelectedStatus,
    setSelectedSectorIds,
    setSelectedSortOrder,
  } = useInventoryDistribution();

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedDistributionRow, setSelectedDistributionRow] = useState(null);
  const [selectedStubDetails, setSelectedStubDetails] = useState(null);
  const [isDistributionDetailOpen, setIsDistributionDetailOpen] = useState(false);
  const [distributionDetailRequestSequence, setDistributionDetailRequestSequence] =
    useState(0);
  const [isDistributionDetailLoading, setIsDistributionDetailLoading] =
    useState(false);
  const [distributionDetailErrorMessage, setDistributionDetailErrorMessage] =
    useState("");
  const distributionDetailRequestIdRef = React.useRef(0);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedExportFormat, setSelectedExportFormat] = useState("csv");
  const [selectedExportDisasterEventId, setSelectedExportDisasterEventId] =
    useState("");
  const [selectedExportStatus, setSelectedExportStatus] = useState("");
  const [selectedExportSortOrder, setSelectedExportSortOrder] =
    useState("newest");
  const [selectedExportSectorIds, setSelectedExportSectorIds] = useState([]);
  const [selectedExportBarangayIds, setSelectedExportBarangayIds] = useState([]);
  const [availableExportSectorIds, setAvailableExportSectorIds] = useState([]);
  const [availableExportBarangayIds, setAvailableExportBarangayIds] = useState([]);
  const [exportValidationErrors, setExportValidationErrors] = useState({
    sectors: "",
    barangays: "",
  });
  const [exportFeedback, setExportFeedback] = useState({
    type: "",
    message: "",
  });

  const showReadinessStatus = selectedDisasterEvent?.status === "ACTIVE";
  const {
    inventoryBatches: readinessInventoryBatches,
    isLoading: isReadinessLoading,
    errorMessage: readinessErrorMessage,
  } = useInventoryDistributionReadiness({
    isOpen: isDistributionDetailOpen,
    row: selectedDistributionRow,
    disasterEventId: selectedDisasterEventId,
    showReadinessStatus,
    requestSequence: distributionDetailRequestSequence,
  });

  React.useEffect(() => {
    setIsFilterOpen(false);
  }, [selectedBarangayId, selectedDisasterEventId]);

  const activeFilterCount = useMemo(() => {
    return selectedSectorIds.length + (selectedSortOrder !== "oldest" ? 1 : 0);
  }, [selectedSectorIds.length, selectedSortOrder]);

  const hasActiveDistributionFilters = Boolean(
    selectedDisasterEventId ||
      selectedBarangayId ||
      selectedStatus ||
      searchTerm.trim() ||
      activeFilterCount > 0,
  );

  const handleClearAllFilters = () => {
    resetAllDistributionFilters();
    setIsFilterOpen(false);
  };

  const summaryCards = useMemo(() => {
    const issuedLabel =
      activeTab === "ended" ? "Not Claimed Relief Packs" : "For Claim Relief Packs";

    return [
      {
        label: "Barangay Covered",
        value: formatCardValue(analytics.barangaysCovered),
        description: "",
      },
      {
        label: "Total Families",
        value: formatCardValue(analytics.totalFamiliesServed),
        description: "",
      },
      {
        label: "Claimed Relief Packs",
        value: formatCardValue(analytics.claimedCount),
        description: "",
      },
      {
        label: issuedLabel,
        value: formatCardValue(analytics.pendingCount),
        description: "",
      },
    ];
  }, [activeTab, analytics]);

  const statusOptions = useMemo(
    () =>
      distributionStatusOptions.map((option) =>
        option.value === "ISSUED" && activeTab === "ended"
          ? { ...option, label: "Not Claimed" }
          : option,
      ),
    [activeTab],
  );

  const selectedExportDisasterEvent = useMemo(
    () =>
      disasterEvents.find((event) => event.id === selectedExportDisasterEventId) ||
      null,
    [disasterEvents, selectedExportDisasterEventId],
  );

  const selectedExportEventScope =
    selectedExportDisasterEvent?.status === "ACTIVE" ? "active" : "ended";

  const exportStatusOptions = useMemo(
    () =>
      distributionStatusOptions.map((option) =>
        option.value === "ISSUED" && selectedExportEventScope === "ended"
          ? { ...option, label: "Not Claimed" }
          : option,
      ),
    [selectedExportEventScope],
  );

  React.useEffect(() => {
    if (!isExportModalOpen) {
      setAvailableExportBarangayIds([]);
      setAvailableExportSectorIds([]);
      setExportValidationErrors({ sectors: "", barangays: "" });
      return undefined;
    }

    if (!selectedExportDisasterEventId) {
      setAvailableExportBarangayIds([]);
      setAvailableExportSectorIds([]);
      return undefined;
    }

    if (selectedExportBarangayIds.length === 0) {
      const affectedBarangayIds = Array.isArray(
        selectedExportDisasterEvent?.affected_barangays,
      )
        ? selectedExportDisasterEvent.affected_barangays
            .map((barangay) => barangay?.id)
            .filter(Boolean)
        : [];

      setAvailableExportBarangayIds(affectedBarangayIds);
      setAvailableExportSectorIds([]);
      setSelectedExportSectorIds([]);
      return undefined;
    }

    let isMounted = true;

    const loadExportOptions = async () => {
      try {
        const payload = await fetchInventoryDistributionExportOptions({
          disaster_event_id: selectedExportDisasterEventId,
          barangay_ids: selectedExportBarangayIds,
          status: selectedExportStatus,
        });

        if (!isMounted) {
          return;
        }

        const data = payload?.data || {};
        const nextAvailableBarangayIds = Array.isArray(
          data.available_barangay_ids,
        )
          ? data.available_barangay_ids
          : [];
        const availableSourceSectorIds = new Set(
          Array.isArray(data.available_sector_ids)
            ? data.available_sector_ids
            : [],
        );
        const nextAvailableSectorIds = sectorOptions
          .filter((sector) => availableSourceSectorIds.has(sector.source_sector_id))
          .map((sector) => sector.id);

        setAvailableExportBarangayIds(nextAvailableBarangayIds);
        setAvailableExportSectorIds(nextAvailableSectorIds);
        setSelectedExportBarangayIds((currentIds) => {
          const nextIds = currentIds.filter((barangayId) =>
            nextAvailableBarangayIds.includes(barangayId),
          );

          return areSameStringValues(currentIds, nextIds) ? currentIds : nextIds;
        });
        setSelectedExportSectorIds((currentIds) => {
          const nextIds = currentIds.filter((sectorId) =>
            nextAvailableSectorIds.includes(sectorId),
          );

          const resolvedIds = nextIds.length > 0 ? nextIds : nextAvailableSectorIds;
          return areSameStringValues(currentIds, resolvedIds)
            ? currentIds
            : resolvedIds;
        });
      } catch (_error) {
        if (isMounted) {
          setAvailableExportSectorIds([]);
          setSelectedExportSectorIds([]);
        }
      }
    };

    loadExportOptions();

    return () => {
      isMounted = false;
    };
  }, [
    isExportModalOpen,
    sectorOptions,
    selectedExportBarangayIds,
    selectedExportDisasterEvent,
    selectedExportDisasterEventId,
    selectedExportStatus,
  ]);

  const handleExportDisasterEventChange = (nextEventId) => {
    const nextEvent = disasterEvents.find((event) => event.id === nextEventId);
    const affectedBarangayIds = Array.isArray(nextEvent?.affected_barangays)
      ? nextEvent.affected_barangays
          .map((barangay) => barangay?.id)
          .filter(Boolean)
      : [];

    setSelectedExportDisasterEventId(nextEventId);
    setSelectedExportStatus("");
    setSelectedExportBarangayIds(affectedBarangayIds);
    setSelectedExportSectorIds(sectorOptions.map((sector) => sector.id));
  };

  const handleOpenExportModal = () => {
    setSelectedExportDisasterEventId(selectedDisasterEventId || "");
    setSelectedExportBarangayIds(
      selectableBarangays.map((barangay) => barangay.id).filter(Boolean),
    );
    setSelectedExportStatus(selectedStatus || "");
    setSelectedExportSortOrder(selectedSortOrder || "newest");
    setSelectedExportSectorIds(sectorOptions.map((sector) => sector.id));
    setSelectedExportFormat("csv");
    setExportValidationErrors({ sectors: "", barangays: "" });
    setExportFeedback({ type: "", message: "" });
    setIsExportModalOpen(true);
  };

  const handleExportSubmit = async () => {
    const nextErrors = {
      sectors: selectedExportSectorIds.length ? "" : "Select at least one sector.",
      barangays: selectedExportBarangayIds.length
        ? ""
        : "Select at least one barangay.",
    };

    if (nextErrors.sectors || nextErrors.barangays) {
      setExportValidationErrors(nextErrors);
      return;
    }

    setIsExporting(true);
    setIsExportModalOpen(false);

    try {
      const selectedSourceSectorIds = selectedExportSectorIds
        .map(
          (sectorCode) =>
            sectorOptions.find((sector) => sector.id === sectorCode)
              ?.source_sector_id || null,
        )
        .filter(Boolean);
      const file = await exportInventoryDistribution({
        disaster_event_id: selectedExportDisasterEventId,
        barangay_ids: selectedExportBarangayIds,
        status: selectedExportStatus,
        sort_order: selectedExportSortOrder,
        sector_ids: selectedSourceSectorIds,
        format: selectedExportFormat,
      });

      downloadExportFile(file);
      setExportFeedback({
        type: "success",
        message: buildExportSuccessMessage("Inventory distribution report"),
      });
    } catch (error) {
      setExportFeedback({
        type: "error",
        message: resolveExportErrorMessage(
          error,
          "Unable to export the inventory distribution report.",
        ),
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenDistributionDetails = async (row) => {
    const requestId = distributionDetailRequestIdRef.current + 1;
    distributionDetailRequestIdRef.current = requestId;

    setSelectedDistributionRow(row);
    setSelectedStubDetails(null);
    setDistributionDetailErrorMessage("");
    setIsDistributionDetailOpen(true);
    setDistributionDetailRequestSequence((sequence) => sequence + 1);
    setIsDistributionDetailLoading(true);

    if (!row?.stub_id) {
      setIsDistributionDetailLoading(false);
      return;
    }

    try {
      const payload = await fetchInventoryDistributionDetail(row.stub_id);
      const detail = payload?.data || null;

      if (requestId !== distributionDetailRequestIdRef.current) {
        return;
      }

      if (detail) {
        setSelectedStubDetails({
          id: detail.stub?.id,
          ...detail.stub,
          disaster_event: detail.disaster_event,
          household: detail.household,
          barangay: detail.barangay,
          household_sectors: detail.household_sectors,
          member_sectors: detail.member_sectors,
          latest_attendance: detail.latest_attendance,
          distribution_transaction: detail.distribution_transaction,
          distribution_transaction_items:
            Array.isArray(detail.distribution_transaction_items)
              ? detail.distribution_transaction_items
              : [],
        });
      }
    } catch (error) {
      if (requestId === distributionDetailRequestIdRef.current) {
        setDistributionDetailErrorMessage(
          error.message || "Failed to load distribution details.",
        );
      }
    } finally {
      if (requestId === distributionDetailRequestIdRef.current) {
        setIsDistributionDetailLoading(false);
      }
    }
  };

  const handleCloseDistributionDetails = () => {
    distributionDetailRequestIdRef.current += 1;
    setDistributionDetailRequestSequence((sequence) => sequence + 1);
    setIsDistributionDetailOpen(false);
    setSelectedDistributionRow(null);
    setSelectedStubDetails(null);
    setDistributionDetailErrorMessage("");
  };

  React.useEffect(() => {
    if (isDistributionDetailOpen) {
      handleCloseDistributionDetails();
    }
  }, [selectedDisasterEventId]);

  if (!hasActiveEvents && !isLoadingFilters) {
    return (
      <div className="inventory-distribution-page" style={layoutStyles.page}>
        <PageHeader title="INVENTORY DISTRIBUTION MANAGEMENT" />

        <section style={shellStyles.card}>
          <p style={{ ...shellStyles.mutedText, margin: 0 }}>
            No disaster event is available yet.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="inventory-distribution-page" style={layoutStyles.page}>
      <PageHeader title="INVENTORY DISTRIBUTION MANAGEMENT" />

      <div style={layoutStyles.stack}>
        <section className="inventory-distribution-scope-card" style={scopeCardStyles}>
          <div
            className="inventory-distribution-tabs"
            role="tablist"
            aria-label="Inventory distribution event scope"
            style={scopeTabListStyles}
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "active"}
              onClick={() => handleEventScopeChange("active")}
              style={scopeTabButtonStyles(activeTab === "active")}
            >
              Active Events
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "ended"}
              onClick={() => handleEventScopeChange("ended")}
              style={scopeTabButtonStyles(activeTab === "ended")}
            >
              Ended Events
            </button>
          </div>

          <div
            className="inventory-distribution-filter-content"
            style={scopeFilterContentStyles}
          >
            <div
              className="inventory-distribution-filter-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "16px",
                alignItems: "end",
              }}
            >
              <div className="inventory-distribution-filter-field">
                <label
                  htmlFor="inventory-distribution-event"
                  style={filterStyles.label}
                >
                  Disaster Event
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
                    <option value="">
                      {selectedBarangayId && scopedDisasterEvents.length === 0
                        ? `No ${activeTab === "active" ? "active" : "ended"} events for this barangay`
                        : `Select ${activeTab === "active" ? "active" : "ended"} disaster event`}
                    </option>
                    {scopedDisasterEvents.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.title}
                      </option>
                    ))}
                  </select>
                  <span style={filterStyles.selectIcon}>
                    <FiChevronDown size={16} />
                  </span>
                </div>
              </div>

              <div className="inventory-distribution-filter-field">
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
                    {selectableBarangays.map((barangay) => (
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
          </div>

          {hasActiveDistributionFilters ? (
            <div className="inventory-distribution-filter-actions">
              <button
                className="inventory-distribution-clear-filters"
                type="button"
                onClick={handleClearAllFilters}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#55718b",
                  padding: "2px 0",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  textDecoration: "underline",
                  textUnderlineOffset: "3px",
                }}
              >
                Clear filters
              </button>
            </div>
          ) : null}
        </section>

        {selectedDisasterEvent ? (
          <section className="inventory-distribution-event-card" style={layoutStyles.eventCard}>
            <div className="inventory-distribution-event-panel" style={layoutStyles.eventInfoPanel}>
              <p className="inventory-distribution-event-title" style={layoutStyles.eventTitle}>
                {formatDisasterEventTitle(selectedDisasterEvent)}
              </p>

              <div className="inventory-distribution-event-meta" style={layoutStyles.eventInfoRow}>
                <span>Period: {formatReliefPeriod(selectedDisasterEvent)}</span>
                <StatusPill status={selectedDisasterEvent.status} />
              </div>
            </div>
          </section>
        ) : null}

        {selectedDisasterEvent ? (
          <section className="inventory-distribution-summary-grid" style={shellStyles.statGrid}>
            {summaryCards.map((card) => (
              <StatusCard key={card.label} {...card} />
            ))}
          </section>
        ) : null}

        <section className="inventory-distribution-toolbar" style={pageSpacingStyles.toolbar}>
          <div
            className="inventory-distribution-search-wrap"
            style={{ flex: "1 1 320px" }}
          >
            <SearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search family head, barangay, sector, relief pack, or status"
            />
          </div>

          <div
            className="inventory-distribution-toolbar-controls"
            style={{
              display: "flex",
              gap: "16px",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <label
              className="inventory-distribution-status-filter"
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
                value={selectedStatus}
                onChange={(event) => setSelectedStatus(event.target.value)}
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
                {statusOptions.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div
              className="inventory-distribution-filter-button-wrap"
              style={{ position: "relative" }}
            >
              <ResponsiveFilterPopover
                isOpen={isFilterOpen}
                onOpenChange={setIsFilterOpen}
                title="Filter Records"
                panelClassName="inventory-distribution-filter-panel"
                scopeKey={`${activeTab}-${selectedBarangayId}-${selectedDisasterEventId}`}
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
                    {activeFilterCount > 0
                      ? `Filter (${activeFilterCount})`
                      : "Filter"}
                  </button>
                )}
              >
                  <h3 style={filterPanelStyles.title}>Filter Records</h3>

                  <label style={filterPanelStyles.field}>
                    <span style={filterPanelStyles.label}>Order List</span>
                    <select
                      value={selectedSortOrder}
                      onChange={(event) =>
                        setSelectedSortOrder(event.target.value)
                      }
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
                      onClick={handleClearAllFilters}
                      style={filterPanelStyles.clearAction}
                    >
                      Clear all filters
                    </button>
                  </div>
              </ResponsiveFilterPopover>
            </div>

            <button
              className="inventory-distribution-export-button"
              type="button"
              onClick={handleOpenExportModal}
              disabled={!selectedDisasterEventId || isExporting}
              style={{
                ...pageHeaderStyles.secondaryButton,
                cursor:
                  selectedDisasterEventId && !isExporting
                    ? "pointer"
                    : "not-allowed",
                opacity: selectedDisasterEventId && !isExporting ? 1 : 0.7,
              }}
            >
              <FiFileText size={16} />
              {isExporting ? "Exporting..." : "Export"}
            </button>
          </div>
        </section>

        <InventoryDistributionTable
          key={[
            activeTab,
            selectedDisasterEventId,
            selectedBarangayId,
            selectedStatus,
            selectedSortOrder,
            searchTerm,
            selectedSectorIds.join(","),
          ].join("|")}
          rows={displayedRows}
          isLoading={isLoadingFilters || isLoadingMasterlist}
          errorMessage={errorMessage}
          hasSelectedEvent={Boolean(selectedDisasterEventId)}
          showBarangayColumn={!selectedBarangayId}
          onViewDetails={handleOpenDistributionDetails}
        />

        <InventoryDistributionDetailModal
          isOpen={isDistributionDetailOpen}
          isLoading={isDistributionDetailLoading}
          errorMessage={distributionDetailErrorMessage}
          row={selectedDistributionRow}
          stubDetails={selectedStubDetails}
          templateDetails={templateDetails}
          inventoryBatches={readinessInventoryBatches}
          isReadinessLoading={isReadinessLoading}
          readinessErrorMessage={readinessErrorMessage}
          disasterEvents={disasterEvents}
          disasterEventId={selectedDisasterEventId}
          showReadinessStatus={showReadinessStatus}
          onClose={handleCloseDistributionDetails}
        />

        <MswdoExportModal
          isOpen={isExportModalOpen}
          overlayClassName="inventory-distribution-export-modal-backdrop"
          modalClassName="inventory-distribution-export-modal"
          gridClassName="inventory-distribution-export-grid"
          chipGridClassName="inventory-distribution-export-chip-grid"
          actionsClassName="inventory-distribution-export-actions"
          title="Inventory Distribution Report"
          isSubmitting={isExporting}
          disasterEvents={disasterEvents}
          barangays={barangays}
          sectors={sectorOptions}
          selectedDisasterEventId={selectedExportDisasterEventId}
          selectedBarangayIds={selectedExportBarangayIds}
          selectedRecordStatus={selectedExportStatus}
          selectedSortOrder={selectedExportSortOrder}
          selectedSectorIds={selectedExportSectorIds}
          availableSectorIds={availableExportSectorIds}
          availableBarangayIds={availableExportBarangayIds}
          selectedFormat={selectedExportFormat}
          validationErrors={exportValidationErrors}
          recordStatusLabel="Status Record"
          recordStatusOptions={exportStatusOptions}
          sortOptions={MASTERLIST_SORT_OPTIONS}
          onClose={() => {
            if (!isExporting) {
              setIsExportModalOpen(false);
            }
          }}
          onSubmit={handleExportSubmit}
          onDisasterEventChange={handleExportDisasterEventChange}
          onBarangayToggle={(barangayId) => {
            setSelectedExportBarangayIds((currentValues) => {
              const nextValues = currentValues.includes(barangayId)
                ? currentValues.filter((id) => id !== barangayId)
                : [...currentValues, barangayId];

              if (nextValues.length > 0) {
                setExportValidationErrors((currentErrors) => ({
                  ...currentErrors,
                  barangays: "",
                }));
              }

              return nextValues;
            });
          }}
          onSelectAllBarangays={() => {
            setSelectedExportBarangayIds(availableExportBarangayIds);
            setExportValidationErrors((currentErrors) => ({
              ...currentErrors,
              barangays: "",
            }));
          }}
          onClearBarangays={() => setSelectedExportBarangayIds([])}
          onRecordStatusChange={setSelectedExportStatus}
          onSortOrderChange={setSelectedExportSortOrder}
          onSectorToggle={(sectorId) => {
            setSelectedExportSectorIds((currentValues) => {
              const nextValues = currentValues.includes(sectorId)
                ? currentValues.filter((id) => id !== sectorId)
                : [...currentValues, sectorId];

              if (nextValues.length > 0) {
                setExportValidationErrors((currentErrors) => ({
                  ...currentErrors,
                  sectors: "",
                }));
              }

              return nextValues;
            });
          }}
          onClearSectors={() => setSelectedExportSectorIds([])}
          onFormatChange={setSelectedExportFormat}
        />

        <FeedbackToast
          type={exportFeedback.type}
          message={exportFeedback.message}
          onClose={() => setExportFeedback({ type: "", message: "" })}
        />
      </div>
    </div>
  );
};

export default InventoryDistributionPage;
