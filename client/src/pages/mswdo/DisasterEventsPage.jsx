import React, { useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "../../components/layout/PageHeader";
import {
  pageSpacingStyles,
  shellStyles,
} from "../../components/layout/BarangayLayout";
import DisasterEventDetailModal from "../../components/disaster-events/DisasterEventDetailModal";
import DisasterEventExportModal from "../../components/disaster-events/DisasterEventExportModal";
import DisasterEventFormModal from "../../components/disaster-events/DisasterEventFormModal";
import DisasterEventSingleExportModal from "../../components/disaster-events/DisasterEventSingleExportModal";
import DisasterEventsTable from "../../components/disaster-events/DisasterEventsTable";
import { useDisasterEvents } from "../../features/disaster-events/useDisasterEvents";
import FeedbackToast from "../../components/shared/FeedbackToast";
import ResponsiveFilterPopover from "../../components/shared/ResponsiveFilterPopover";
import SearchBar from "../../components/shared/SearchBar";
import { pageHeaderStyles } from "../../components/layout/PageHeader";
import { FiFileText, FiFilter } from "react-icons/fi";
import {
  exportDisasterEvents,
  fetchActiveDisasterEvents,
  fetchAllDisasterEvents,
  fetchDisasterEventById,
  fetchEndedDisasterEvents,
} from "../../features/disaster-events/disasterEventService";
import { MASTERLIST_SORT_OPTIONS } from "../../features/masterlist/masterlistService";
import {
  buildExportSuccessMessage,
  downloadExportFile,
  resolveExportErrorMessage,
} from "../../utils/exportHelpers";
import { DISASTER_TYPE_OPTIONS as SHARED_DISASTER_TYPE_OPTIONS } from "../../features/disaster-events/disasterTypeOptions";

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
    display: "grid",
    gap: "8px",
    marginTop: "14px",
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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const sortBarangaysByName = (barangays = []) =>
  [...barangays].sort((leftBarangay, rightBarangay) =>
    String(leftBarangay?.name || "").localeCompare(
      String(rightBarangay?.name || ""),
    ),
  );

const sortDisasterEventRows = (rows, sortOrder = "newest") => {
  const safeRows = Array.isArray(rows) ? [...rows] : [];

  return safeRows.sort((leftRow, rightRow) => {
    if (sortOrder === "oldest" || sortOrder === "newest") {
      const leftTime = new Date(
        leftRow?.start_date || leftRow?.created_at || leftRow?.updated_at || 0,
      ).getTime();
      const rightTime = new Date(
        rightRow?.start_date || rightRow?.created_at || rightRow?.updated_at || 0,
      ).getTime();

      if (leftTime !== rightTime) {
        return sortOrder === "oldest" ? leftTime - rightTime : rightTime - leftTime;
      }
    }

    const leftTitle = String(leftRow?.title || "").trim().toUpperCase();
    const rightTitle = String(rightRow?.title || "").trim().toUpperCase();

    if (leftTitle !== rightTitle) {
      if (sortOrder === "za") {
        return rightTitle.localeCompare(leftTitle);
      }

      return leftTitle.localeCompare(rightTitle);
    }

    const leftTime = new Date(
      leftRow?.start_date || leftRow?.created_at || leftRow?.updated_at || 0,
    ).getTime();
    const rightTime = new Date(
      rightRow?.start_date || rightRow?.created_at || rightRow?.updated_at || 0,
    ).getTime();
    return rightTime - leftTime;
  });
};

const DisasterEventsPage = () => {
  const {
    selectedFilter,
    setSelectedFilter,
    filterOptions,
    events,
    barangays,
    selectedEvent,
    isLoading,
    isDetailLoading,
    isSubmitting,
    errorMessage,
    detailErrorMessage,
    formErrorMessage,
    successMessage,
    isCreateModalOpen,
    isDetailModalOpen,
    editingEvent,
    openCreateModal,
    openEditModal,
    closeCreateModal,
    openDetailModal,
    closeDetailModal,
    submitCreateEvent,
    submitEditEvent,
  } = useDisasterEvents();

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportingFormat, setExportingFormat] = useState("");
  const [selectedExportFormat, setSelectedExportFormat] = useState("csv");
  const [selectedExportRecordStatus, setSelectedExportRecordStatus] =
    useState("active");
  const [selectedExportSortOrder, setSelectedExportSortOrder] =
    useState("newest");
  const [selectedExportDisasterTypes, setSelectedExportDisasterTypes] =
    useState([]);
  const [selectedExportAffectedBarangayIds, setSelectedExportAffectedBarangayIds] =
    useState([]);
  const [exportValidationErrors, setExportValidationErrors] = useState({
    disasterTypes: "",
    affectedBarangays: "",
  });
  const [exportScopeEvents, setExportScopeEvents] = useState([]);
  const [singleExportEvent, setSingleExportEvent] = useState(null);
  const [selectedSingleExportFormat, setSelectedSingleExportFormat] =
    useState("csv");
  const [exportFeedback, setExportFeedback] = useState({
    type: "",
    message: "",
  });
  const shouldApplyExportDefaultsRef = useRef(false);
  const [searchValue, setSearchValue] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filtersByTab, setFiltersByTab] = useState({
    active: {
      sortOrder: "newest",
      disasterTypes: [],
      affectedBarangayIds: [],
    },
    closed: {
      sortOrder: "newest",
      disasterTypes: [],
      affectedBarangayIds: [],
    },
    all: {
      sortOrder: "newest",
      disasterTypes: [],
      affectedBarangayIds: [],
    },
  });
  const currentTabFilters = filtersByTab[selectedFilter] || filtersByTab.all;
  const selectedSortOrder = currentTabFilters.sortOrder || "newest";
  const selectedDisasterTypes = currentTabFilters.disasterTypes || [];
  const selectedAffectedBarangayIds = currentTabFilters.affectedBarangayIds || [];

  const disasterTypeOptions = SHARED_DISASTER_TYPE_OPTIONS;

  const availableExportDisasterTypes = useMemo(() => {
    const hasCustomDisasterType = exportScopeEvents.some((event) => {
      const disasterType = String(event?.disaster_type || "").trim();
      return disasterType && !SHARED_DISASTER_TYPE_OPTIONS.includes(disasterType);
    });

    return SHARED_DISASTER_TYPE_OPTIONS.filter((disasterType) => {
      if (disasterType === "Other") {
        return hasCustomDisasterType;
      }

      return exportScopeEvents.some(
        (event) => String(event?.disaster_type || "").trim() === disasterType,
      );
    });
  }, [exportScopeEvents]);

  const availableExportAffectedBarangayIds = useMemo(() => {
    const filteredScopeEvents = exportScopeEvents.filter((event) => {
      if (selectedExportDisasterTypes.length === 0) {
        return true;
      }

      const disasterType = String(event?.disaster_type || "").trim();
      const isCustomDisasterType =
        disasterType && !SHARED_DISASTER_TYPE_OPTIONS.includes(disasterType);

      return selectedExportDisasterTypes.some((selectedType) => {
        if (selectedType === "Other") {
          return isCustomDisasterType;
        }

        return disasterType === selectedType;
      });
    });

    return sortBarangaysByName(barangays)
      .filter((barangay) =>
        filteredScopeEvents.some((event) =>
          Array.isArray(event?.affected_barangays)
            ? event.affected_barangays.some(
                (affectedBarangay) => affectedBarangay?.id === barangay.id,
              )
            : false,
        ),
      )
      .map((barangay) => barangay.id)
      .filter((barangayId) => UUID_PATTERN.test(String(barangayId || "")));
  }, [barangays, exportScopeEvents, selectedExportDisasterTypes]);

  const hasActiveFilters = Boolean(
    selectedDisasterTypes.length > 0 ||
      selectedAffectedBarangayIds.length > 0 ||
      selectedSortOrder !== "newest",
  );
  const activeFilterCount =
    selectedDisasterTypes.length +
    selectedAffectedBarangayIds.length +
    Number(selectedSortOrder !== "newest");

  const filteredEvents = useMemo(() => {
    const filteredRows = events.filter((event) => {
      const search = searchValue.trim().toLowerCase();
      const matchesSearch =
        !search ||
        event.title?.toLowerCase().includes(search) ||
        event.disaster_type?.toLowerCase().includes(search) ||
        event.affected_barangays?.some((barangay) =>
          String(barangay?.name || barangay || "")
            .toLowerCase()
            .includes(search),
        );

      const eventDisasterType = String(event.disaster_type || "").trim();
      const isCustomDisasterType =
        eventDisasterType && !SHARED_DISASTER_TYPE_OPTIONS.includes(eventDisasterType);
      const matchesDisasterType =
        selectedDisasterTypes.length === 0 ||
        selectedDisasterTypes.some((selectedType) =>
          selectedType === "Other"
            ? isCustomDisasterType
            : eventDisasterType === selectedType,
        );

      const matchesAffectedBarangay =
        selectedAffectedBarangayIds.length === 0 ||
        event.affected_barangays?.some((barangay) =>
          selectedAffectedBarangayIds.includes(barangay.id),
        );

      return matchesSearch && matchesDisasterType && matchesAffectedBarangay;
    });

    return sortDisasterEventRows(filteredRows, selectedSortOrder);
  }, [
    events,
    searchValue,
    selectedAffectedBarangayIds,
    selectedDisasterTypes,
    selectedSortOrder,
  ]);

  useEffect(() => {
    if (!isExportModalOpen) {
      return;
    }

    let isCancelled = false;

    const loadExportScopeEvents = async () => {
      try {
        let eventRows;

        if (selectedExportRecordStatus === "closed") {
          eventRows = await fetchEndedDisasterEvents();
        } else if (selectedExportRecordStatus === "all") {
          eventRows = await fetchAllDisasterEvents();
        } else {
          eventRows = await fetchActiveDisasterEvents();
        }

        if (!isCancelled) {
          const detailedRows = await Promise.all(
            (Array.isArray(eventRows) ? eventRows : []).map(async (event) => {
              try {
                const detail = await fetchDisasterEventById(event.id);

                return {
                  ...event,
                  affected_barangays: detail?.affected_barangays || [],
                };
              } catch (_error) {
                return {
                  ...event,
                  affected_barangays: Array.isArray(event?.affected_barangays)
                    ? event.affected_barangays
                    : [],
                };
              }
            }),
          );

          setExportScopeEvents(detailedRows);
        }
      } catch (_error) {
        if (!isCancelled) {
          setExportScopeEvents([]);
        }
      }
    };

    loadExportScopeEvents();

    return () => {
      isCancelled = true;
    };
  }, [isExportModalOpen, selectedExportRecordStatus]);

  useEffect(() => {
    if (!isExportModalOpen) {
      return;
    }

    setSelectedExportDisasterTypes((currentValues) =>
      currentValues.filter((value) => availableExportDisasterTypes.includes(value)),
    );
  }, [availableExportDisasterTypes, isExportModalOpen]);

  useEffect(() => {
    if (!isExportModalOpen || !shouldApplyExportDefaultsRef.current) {
      return;
    }

    if (availableExportDisasterTypes.length === 0) {
      return;
    }

    setSelectedExportDisasterTypes(availableExportDisasterTypes);
  }, [availableExportDisasterTypes, isExportModalOpen]);

  useEffect(() => {
    if (!isExportModalOpen) {
      return;
    }

    setSelectedExportAffectedBarangayIds((currentValues) =>
      currentValues.filter((value) =>
        availableExportAffectedBarangayIds.includes(value),
      ),
    );
  }, [availableExportAffectedBarangayIds, isExportModalOpen]);

  useEffect(() => {
    if (!isExportModalOpen) {
      return;
    }

    setExportValidationErrors((currentErrors) => ({
      disasterTypes:
        selectedExportDisasterTypes.length > 0 ? "" : currentErrors.disasterTypes,
      affectedBarangays:
        selectedExportAffectedBarangayIds.length > 0
          ? ""
          : currentErrors.affectedBarangays,
    }));
  }, [
    isExportModalOpen,
    selectedExportAffectedBarangayIds.length,
    selectedExportDisasterTypes.length,
  ]);

  useEffect(() => {
    if (!isExportModalOpen || !shouldApplyExportDefaultsRef.current) {
      return;
    }

    const areDefaultTypesReady =
      availableExportDisasterTypes.length > 0 &&
      selectedExportDisasterTypes.length === availableExportDisasterTypes.length &&
      availableExportDisasterTypes.every((type) =>
        selectedExportDisasterTypes.includes(type),
      );

    if (!areDefaultTypesReady) {
      return;
    }

    setSelectedExportAffectedBarangayIds(availableExportAffectedBarangayIds);
    shouldApplyExportDefaultsRef.current = false;
  }, [
    availableExportAffectedBarangayIds,
    availableExportDisasterTypes,
    isExportModalOpen,
    selectedExportDisasterTypes,
  ]);

  const handleExport = async (format) => {
    const validationErrors = {
      disasterTypes:
        selectedExportDisasterTypes.length > 0
          ? ""
          : "Select at least one disaster type.",
      affectedBarangays:
        selectedExportAffectedBarangayIds.length > 0
          ? ""
          : "Select at least one affected barangay.",
    };

    if (validationErrors.disasterTypes || validationErrors.affectedBarangays) {
      setExportValidationErrors(validationErrors);
      return;
    }

    setExportValidationErrors({
      disasterTypes: "",
      affectedBarangays: "",
    });
    setExportingFormat(format);
    setIsExportModalOpen(false);

    try {
      const file = await exportDisasterEvents({
        selectedFilter: selectedExportRecordStatus,
        search: searchValue,
        disasterTypes: selectedExportDisasterTypes,
        affectedBarangayIds: selectedExportAffectedBarangayIds,
        sortOrder: selectedExportSortOrder,
        format,
      });
      downloadExportFile(file);
      setExportFeedback({
        type: "success",
        message: buildExportSuccessMessage("Disaster event report"),
      });
    } catch (error) {
      setExportFeedback({
        type: "error",
        message: resolveExportErrorMessage(
          error,
          "Unable to export disaster events. Please try again.",
        ),
      });
    } finally {
      setExportingFormat("");
    }
  };

  const handleOpenSingleExportModal = (eventData) => {
    setSingleExportEvent(eventData);
    setSelectedSingleExportFormat("csv");
    setExportFeedback({ type: "", message: "" });
  };

  const handleSingleExport = async () => {
    if (!singleExportEvent) {
      return;
    }

    const format = selectedSingleExportFormat;
    setExportingFormat(format);
    setSingleExportEvent(null);

    try {
      const file = await exportDisasterEvents({
        selectedFilter: "all",
        disasterEventId: singleExportEvent.id,
        sortOrder: "newest",
        format,
      });
      downloadExportFile(file);
      setExportFeedback({
        type: "success",
        message: buildExportSuccessMessage("Disaster events report"),
      });
    } catch (error) {
      setExportFeedback({
        type: "error",
        message: resolveExportErrorMessage(
          error,
          "Unable to export disaster event. Please try again.",
        ),
      });
    } finally {
      setExportingFormat("");
    }
  };

  const handleExportRecordStatusChange = (nextRecordStatus) => {
    setSelectedExportRecordStatus(nextRecordStatus);
    setSelectedExportDisasterTypes([]);
    setSelectedExportAffectedBarangayIds([]);
    setExportScopeEvents([]);
    setExportValidationErrors({
      disasterTypes: "",
      affectedBarangays: "",
    });
    shouldApplyExportDefaultsRef.current = true;
  };

  const updateCurrentTabFilters = (nextValues) => {
    setFiltersByTab((currentFilters) => ({
      ...currentFilters,
      [selectedFilter]: {
        ...currentFilters[selectedFilter],
        ...nextValues,
      },
    }));
  };

  const clearCurrentTabFilters = () => {
    updateCurrentTabFilters({
      sortOrder: "newest",
      disasterTypes: [],
      affectedBarangayIds: [],
    });
  };

  const toggleCurrentTabDisasterType = (disasterType) => {
    updateCurrentTabFilters({
      disasterTypes: selectedDisasterTypes.includes(disasterType)
        ? selectedDisasterTypes.filter((value) => value !== disasterType)
        : [...selectedDisasterTypes, disasterType],
    });
  };

  const toggleCurrentTabAffectedBarangay = (barangayId) => {
    updateCurrentTabFilters({
      affectedBarangayIds: selectedAffectedBarangayIds.includes(barangayId)
        ? selectedAffectedBarangayIds.filter((value) => value !== barangayId)
        : [...selectedAffectedBarangayIds, barangayId],
    });
  };

  useEffect(() => {
    setIsFilterOpen(false);
  }, [selectedFilter]);

  const getTabStyle = (filterKey) => ({
    padding: "12px 24px",
    border: "none",
    background: "none",
    fontSize: "14px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: selectedFilter === filterKey ? "#17324d" : "#6b8298",
    borderBottom:
      selectedFilter === filterKey
        ? "3px solid #17324d"
        : "3px solid transparent",
    cursor: "pointer",
    transition: "all 0.2s ease",
    whiteSpace: "nowrap",
  });

  return (
    <div style={pageSpacingStyles.pageStack}>
      <PageHeader title="DISASTER EVENT MANAGEMENT" />

      <section style={{ ...shellStyles.card, boxSizing: "border-box" }}>
        <div
          className="disaster-events-tabs"
          style={{
            display: "flex",
            borderBottom: "1px solid #d6e2ef",
            marginBottom: "24px",
            flexWrap: "wrap",
            gap: "8px",
            overflowX: "auto",
            msOverflowStyle: "none",
            scrollbarWidth: "none",
          }}
        >
          <button
            onClick={() => setSelectedFilter(filterOptions.active)}
            style={getTabStyle(filterOptions.active)}
          >
            Active Events
          </button>
          <button
            onClick={() => setSelectedFilter(filterOptions.closed)}
            style={getTabStyle(filterOptions.closed)}
          >
            Ended Events
          </button>
          <button
            onClick={() => setSelectedFilter(filterOptions.all)}
            style={getTabStyle(filterOptions.all)}
          >
            All Events
          </button>
        </div>
      </section>

      <div
        className="disaster-events-toolbar"
        style={pageSpacingStyles.toolbar}
      >
        <div className="disaster-events-toolbar-search" style={{ flex: 1, minWidth: 0 }}>
          <SearchBar
            value={searchValue}
            onChange={setSearchValue}
            placeholder="Search events, type, or barangay"
          />
        </div>

        <div
          className="disaster-events-toolbar-actions"
          style={pageSpacingStyles.actionGroup}
        >
          <div>
            <ResponsiveFilterPopover
              isOpen={isFilterOpen}
              onOpenChange={setIsFilterOpen}
              title="Filter Disaster Events"
              panelClassName="disaster-events-filter-panel"
              scopeKey={selectedFilter}
              trigger={({ ref, ...triggerProps }) => (
                <button
                  className="disaster-events-filter-button"
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
                  {hasActiveFilters ? `Filter (${activeFilterCount})` : "Filter"}
                </button>
              )}
            >
                <h3 style={filterPanelStyles.title}>Filter Disaster Events</h3>

                <label style={filterPanelStyles.field}>
                  <span style={filterPanelStyles.label}>Order List</span>
                  <select
                    value={selectedSortOrder}
                    onChange={(event) =>
                      updateCurrentTabFilters({ sortOrder: event.target.value })
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

                <h3 style={filterPanelStyles.title}>Disaster Type</h3>

                <div style={filterPanelStyles.list}>
                  {disasterTypeOptions.length > 0 ? (
                    disasterTypeOptions.map((disasterType) => (
                      <label key={disasterType} style={filterPanelStyles.option}>
                        <input
                          type="checkbox"
                          checked={selectedDisasterTypes.includes(disasterType)}
                          onChange={() =>
                            toggleCurrentTabDisasterType(disasterType)
                          }
                          style={{ accentColor: "#2f6499" }}
                        />
                        <span>{disasterType}</span>
                      </label>
                    ))
                  ) : (
                    <p style={{ margin: 0, color: "#5d7188", fontSize: "14px" }}>
                      No disaster types are available.
                    </p>
                  )}
                </div>

                <h3 style={filterPanelStyles.title}>Affected Barangay</h3>

                <div style={filterPanelStyles.list}>
                  {barangays.length > 0 ? (
                    barangays.map((barangay) => (
                      <label key={barangay.id} style={filterPanelStyles.option}>
                        <input
                          type="checkbox"
                          checked={selectedAffectedBarangayIds.includes(
                            barangay.id,
                          )}
                          onChange={() =>
                            toggleCurrentTabAffectedBarangay(barangay.id)
                          }
                          style={{ accentColor: "#2f6499" }}
                        />
                        <span>{barangay.name}</span>
                      </label>
                    ))
                  ) : (
                    <p style={{ margin: 0, color: "#5d7188", fontSize: "14px" }}>
                      No barangays are available.
                    </p>
                  )}
                </div>

                <div style={filterPanelStyles.actions}>
                  <button
                    type="button"
                    onClick={clearCurrentTabFilters}
                    style={filterPanelStyles.clearAction}
                  >
                    Clear
                  </button>
                </div>
            </ResponsiveFilterPopover>
          </div>

          <button
            className="disaster-events-create-button"
            onClick={openCreateModal}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              border: "none",
              borderRadius: "14px",
              padding: "12px 18px",
              background: "linear-gradient(135deg, #2f6499 0%, #4c86be 100%)",
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 12px 24px rgba(58, 97, 141, 0.18)",
            }}
          >
            <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span>
            Create Disaster Event
          </button>

          <button
            className="disaster-events-export-button"
            type="button"
            onClick={() => {
              setSelectedExportFormat("csv");
              setSelectedExportRecordStatus(selectedFilter);
              setSelectedExportSortOrder(selectedSortOrder);
              setSelectedExportDisasterTypes([]);
              setSelectedExportAffectedBarangayIds([]);
              setExportScopeEvents([]);
              setExportFeedback({ type: "", message: "" });
              setExportValidationErrors({
                disasterTypes: "",
                affectedBarangays: "",
              });
              shouldApplyExportDefaultsRef.current = true;
              setIsExportModalOpen(true);
            }}
            disabled={Boolean(exportingFormat)}
            style={{
              border: "1px solid #c6d8ea",
              borderRadius: "14px",
              padding: "12px 18px",
              backgroundColor: "#f8fbfe",
              color: "#2a4c6f",
              fontSize: "14px",
              fontWeight: 700,
              cursor: exportingFormat ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              opacity: exportingFormat ? 0.7 : 1,
            }}
          >
            <FiFileText size={16} />
            {exportingFormat
              ? `Exporting ${exportingFormat.toUpperCase()}...`
              : "Export"}
          </button>
        </div>
      </div>

      <section
        className="disaster-events-list-card"
        style={{
          ...shellStyles.card,
          marginTop: "0",
          boxSizing: "border-box",
          overflow: "visible",
        }}
      >
        <div style={{ width: "100%", minWidth: 0 }}>
          <DisasterEventsTable
            rows={filteredEvents}
            isLoading={isLoading}
            errorMessage={errorMessage}
            onViewEvent={openDetailModal}
            onEditEvent={openEditModal}
            onExportEvent={handleOpenSingleExportModal}
            validBarangayCount={barangays.length}
          />
        </div>
      </section>

      <DisasterEventFormModal
        isOpen={isCreateModalOpen}
        barangays={barangays}
        isSubmitting={isSubmitting}
        errorMessage={formErrorMessage}
        initialValues={editingEvent}
        mode={editingEvent ? "edit" : "create"}
        onClose={closeCreateModal}
        onSubmit={editingEvent ? submitEditEvent : submitCreateEvent}
      />

      <DisasterEventDetailModal
        isOpen={isDetailModalOpen}
        eventData={selectedEvent}
        isLoading={isDetailLoading}
        errorMessage={detailErrorMessage}
        onClose={closeDetailModal}
      />

      <DisasterEventExportModal
        isOpen={isExportModalOpen}
        barangays={barangays}
        availableDisasterTypes={availableExportDisasterTypes}
        availableAffectedBarangayIds={availableExportAffectedBarangayIds}
        selectedFormat={selectedExportFormat}
        selectedRecordStatus={selectedExportRecordStatus}
        selectedSortOrder={selectedExportSortOrder}
        selectedDisasterTypes={selectedExportDisasterTypes}
        selectedAffectedBarangayIds={selectedExportAffectedBarangayIds}
        validationErrors={exportValidationErrors}
        isSubmitting={Boolean(exportingFormat)}
        onRecordStatusChange={handleExportRecordStatusChange}
        onSortOrderChange={setSelectedExportSortOrder}
        onDisasterTypeToggle={(disasterType) => {
          setSelectedExportDisasterTypes((currentValues) => {
            const nextValues = currentValues.includes(disasterType)
              ? currentValues.filter((value) => value !== disasterType)
              : [...currentValues, disasterType];

            if (nextValues.length > 0) {
              setExportValidationErrors((currentErrors) => ({
                ...currentErrors,
                disasterTypes: "",
              }));
            }

            return nextValues;
          });
        }}
        onSelectAllDisasterTypes={() => {
          setSelectedExportDisasterTypes(availableExportDisasterTypes);
          setExportValidationErrors((currentErrors) => ({
            ...currentErrors,
            disasterTypes: "",
          }));
        }}
        onClearDisasterTypes={() => setSelectedExportDisasterTypes([])}
        onAffectedBarangayToggle={(barangayId) => {
          setSelectedExportAffectedBarangayIds((currentValues) => {
            const nextValues = currentValues.includes(barangayId)
              ? currentValues.filter((value) => value !== barangayId)
              : [...currentValues, barangayId];

            if (nextValues.length > 0) {
              setExportValidationErrors((currentErrors) => ({
                ...currentErrors,
                affectedBarangays: "",
              }));
            }

            return nextValues;
          });
        }}
        onSelectAllBarangays={() => {
          setSelectedExportAffectedBarangayIds(availableExportAffectedBarangayIds);
          setExportValidationErrors((currentErrors) => ({
            ...currentErrors,
            affectedBarangays: "",
          }));
        }}
        onClearBarangays={() => setSelectedExportAffectedBarangayIds([])}
        onFormatChange={setSelectedExportFormat}
        onClose={() => {
          if (!exportingFormat) {
            setIsExportModalOpen(false);
          }
        }}
        onSubmit={() => handleExport(selectedExportFormat)}
      />

      <DisasterEventSingleExportModal
        isOpen={Boolean(singleExportEvent)}
        eventData={singleExportEvent}
        selectedFormat={selectedSingleExportFormat}
        isSubmitting={Boolean(exportingFormat)}
        onFormatChange={setSelectedSingleExportFormat}
        onClose={() => {
          if (!exportingFormat) {
            setSingleExportEvent(null);
          }
        }}
        onSubmit={handleSingleExport}
      />

      <FeedbackToast
        type={exportFeedback.type}
        message={exportFeedback.message}
        onClose={() => setExportFeedback({ type: "", message: "" })}
      />
    </div>
  );
};

export default DisasterEventsPage;


