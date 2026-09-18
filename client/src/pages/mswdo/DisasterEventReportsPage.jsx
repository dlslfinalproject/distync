import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiFileText, FiX } from "react-icons/fi";
import PageHeader, { pageHeaderStyles } from "../../components/layout/PageHeader";
import {
  pageSpacingStyles,
  shellStyles,
} from "../../components/layout/BarangayLayout";
import EmptyState from "../../components/shared/EmptyState";
import ErrorState from "../../components/shared/ErrorState";
import FeedbackToast from "../../components/shared/FeedbackToast";
import LoadingState from "../../components/shared/LoadingState";
import SearchBar from "../../components/shared/SearchBar";
import TablePagination from "../../components/shared/TablePagination";
import {
  exportDisasterEventReportSummary,
  fetchAllDisasterEvents,
  fetchBarangays,
  fetchDisasterEventReportSummary,
} from "../../features/disaster-events/disasterEventService";
import {
  buildDisasterEventReportExportOptions,
  DISASTER_EVENT_REPORT_EXPORT_SELECTIONS,
  formatDisasterEventReportSelectionValue,
  parseDisasterEventReportSelectionValue,
} from "../../features/disaster-events/disasterEventReportExportOptions.mjs";
import {
  buildExportSuccessMessage,
  COMMON_EXPORT_FORMAT_OPTIONS,
  downloadExportFile,
  NO_EXPORT_DATA_MESSAGE,
  resolveExportErrorMessage,
} from "../../utils/exportHelpers";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  getTablePaginationState,
  TABLE_PAGE_SIZE_OPTIONS,
} from "../../features/pagination/pagination.mjs";
import { useDashboardRevalidation } from "../../utils/dashboardRevalidation";

const inputStyles = {
  width: "100%",
  minHeight: "48px",
  padding: "12px 14px",
  borderRadius: "14px",
  border: "1px solid #cbdbea",
  backgroundColor: "#f8fbfe",
  color: "#17324d",
  fontSize: "14px",
  boxSizing: "border-box",
};

const labelStyles = {
  display: "block",
  marginBottom: "8px",
  color: "#5f7892",
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const exportLabelStyles = {
  display: "block",
  marginBottom: "8px",
  color: "#48627d",
  fontSize: "12px",
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const overlayStyles = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(23, 50, 77, 0.42)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  zIndex: 1500,
  boxSizing: "border-box",
};

const modalStyles = {
  width: "min(860px, 100%)",
  maxHeight: "90vh",
  overflowY: "auto",
  backgroundColor: "#ffffff",
  borderRadius: "24px",
  boxShadow: "0 24px 54px rgba(31, 64, 95, 0.22)",
  padding: "28px",
  boxSizing: "border-box",
};

const sectionTitleStyles = {
  margin: "0 0 14px",
  color: "#17324d",
  fontSize: "18px",
  fontWeight: 800,
};

const closeButtonStyles = {
  border: "1px solid #c6d8ea",
  borderRadius: "14px",
  width: "42px",
  height: "42px",
  backgroundColor: "#f8fbfe",
  color: "#24496e",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const toolbarStyles = pageSpacingStyles.toolbar;

const exportButtonStyles = (isDisabled) => ({
  ...pageHeaderStyles.secondaryButton,
  cursor: isDisabled ? "not-allowed" : "pointer",
  opacity: isDisabled ? 0.65 : 1,
});

const exportFilterGridStyles = {
  ...pageSpacingStyles.filterGrid,
};

const tableStyles = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "auto",
  },
  th: {
    padding: "12px 14px",
    textAlign: "left",
    fontSize: "12px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#66809c",
    borderBottom: "1px solid #e0eaf4",
    whiteSpace: "nowrap",
    lineHeight: 1.35,
  },
  td: {
    padding: "14px",
    borderBottom: "1px solid #edf3f8",
    color: "#21405f",
    fontSize: "14px",
    verticalAlign: "top",
    lineHeight: 1.5,
    overflowWrap: "break-word",
  },
};

const centeredColumnStyles = {
  textAlign: "center",
  verticalAlign: "middle",
};

const columnWidthStyles = {
  disasterEvent: {
    width: "24%",
  },
  status: {
    width: "9%",
  },
  affectedBarangays: {
    width: "25%",
  },
  registeredHouseholds: {
    width: "13%",
  },
  distributedAid: {
    width: "13%",
  },
  claimStatus: {
    width: "15%",
  },
};

const specificEventColumnWidthStyles = {
  disasterEvent: {
    width: "24%",
  },
  status: {
    width: "9%",
  },
  affectedBarangays: {
    width: "15%",
    minWidth: "170px",
  },
  registeredHouseholds: {
    width: "17%",
  },
  distributedAid: {
    width: "17%",
  },
  claimStatus: {
    width: "18%",
  },
};

const SORT_OPTIONS = [
  { value: "newest", label: "Newest-Oldest" },
  { value: "oldest", label: "Oldest-Newest" },
  { value: "az", label: "Sort A-Z" },
  { value: "za", label: "Sort Z-A" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "CLOSED", label: "Ended" },
];

const formatDisasterEventTitle = (event) =>
  String(event?.title || "").trim() || "--";

const getDisasterEventStatusLabel = (status) =>
  String(status || "").toUpperCase() === "ACTIVE"
    ? "Active"
    : String(status || "").toUpperCase() === "CLOSED"
      ? "Ended"
      : String(status || "").toUpperCase() === "PLANNED"
        ? "Planned"
        : "--";

const getDisasterEventStatusStyles = (status) => {
  const isActive = String(status || "").toUpperCase() === "ACTIVE";

  return {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: "999px",
    padding: "6px 12px",
    border: isActive ? "1px solid #bdd8f1" : "1px solid #c9e8d7",
    backgroundColor: isActive ? "#e9f4ff" : "#eefaf3",
    color: isActive ? "#145995" : "#16733c",
    fontSize: "12px",
    fontWeight: 700,
  };
};

const getAffectedBarangayIds = (event) => {
  if (!Array.isArray(event?.affected_barangays)) {
    return [];
  }

  return event.affected_barangays
    .map((barangay) => {
      if (typeof barangay === "string") {
        return barangay;
      }

      return barangay?.id || barangay?.barangay_id || "";
    })
    .filter(Boolean);
};

const getPaginationFromResponse = ({
  responsePagination,
  rowCount,
  page,
  pageSize,
}) => {
  if (responsePagination && typeof responsePagination === "object") {
    return {
      page: Number(responsePagination.page) || page,
      pageSize: Number(responsePagination.pageSize) || pageSize,
      totalItems: Number(responsePagination.totalItems) || 0,
      totalPages: Number(responsePagination.totalPages) || 0,
      hasPreviousPage: Boolean(responsePagination.hasPreviousPage),
      hasNextPage: Boolean(responsePagination.hasNextPage),
    };
  }

  const fallbackPagination = getTablePaginationState({
    totalItems: rowCount,
    currentPage: page,
    pageSize,
    pageSizeOptions: TABLE_PAGE_SIZE_OPTIONS,
  });

  return {
    page: fallbackPagination.currentPage,
    pageSize: fallbackPagination.pageSize,
    totalItems: fallbackPagination.totalItems,
    totalPages: fallbackPagination.totalPages,
    hasPreviousPage: fallbackPagination.hasPreviousPage,
    hasNextPage: fallbackPagination.hasNextPage,
  };
};

const DisasterEventReportsPage = () => {
  const [disasterEvents, setDisasterEvents] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({
    disaster_event_id: "",
    barangay_id: "",
    status: "",
    date_from: "",
    date_to: "",
    sort_order: "newest",
  });
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [isRefreshingFilters, setIsRefreshingFilters] = useState(false);
  const [isLoadingRows, setIsLoadingRows] = useState(true);
  const [isRefreshingRows, setIsRefreshingRows] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: DEFAULT_TABLE_PAGE_SIZE,
    totalItems: 0,
    totalPages: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  });
  const [exportFeedback, setExportFeedback] = useState({
    type: "",
    message: "",
  });
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedExportFormat, setSelectedExportFormat] = useState("csv");
  const [selectedExportEventSelection, setSelectedExportEventSelection] =
    useState(DISASTER_EVENT_REPORT_EXPORT_SELECTIONS.ALL);
  const [selectedExportBarangayId, setSelectedExportBarangayId] =
    useState("");
  const [selectedExportStatus, setSelectedExportStatus] = useState("");
  const [selectedExportDateFrom, setSelectedExportDateFrom] = useState("");
  const [selectedExportDateTo, setSelectedExportDateTo] = useState("");
  const [selectedExportSearch, setSelectedExportSearch] = useState("");
  const [selectedExportSortOrder, setSelectedExportSortOrder] =
    useState("newest");
  const [isExporting, setIsExporting] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [filtersReloadToken, setFiltersReloadToken] = useState(0);
  const backgroundFiltersReloadRef = useRef(false);
  const backgroundRowsReloadRef = useRef(false);
  const hasLoadedFiltersRef = useRef(false);
  const hasLoadedRowsRef = useRef(false);

  useDashboardRevalidation(() => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return;
    }

    backgroundFiltersReloadRef.current = true;
    backgroundRowsReloadRef.current = true;
    setFiltersReloadToken((value) => value + 1);
    setReloadToken((value) => value + 1);
  });

  const updateFilters = (updater) => {
    setPage(1);
    setFilters(updater);
  };

  const handleSearchChange = (value) => {
    setPage(1);
    setSearchTerm(value);
  };

  const handlePageSizeChange = (value) => {
    const nextPageSize = Number(value);

    if (!TABLE_PAGE_SIZE_OPTIONS.includes(nextPageSize)) {
      return;
    }

    setPage(1);
    setPageSize(nextPageSize);
  };

  useEffect(() => {
    let isMounted = true;

    const loadFilters = async () => {
      const preserveExistingFilters =
        backgroundFiltersReloadRef.current && hasLoadedFiltersRef.current;
      backgroundFiltersReloadRef.current = false;
      if (!preserveExistingFilters) {
        setIsLoadingFilters(true);
      }
      setIsRefreshingFilters(preserveExistingFilters);

      try {
        const [eventRows, barangayRows] = await Promise.all([
          fetchAllDisasterEvents(),
          fetchBarangays(),
        ]);

        if (!isMounted) {
          return;
        }

        setDisasterEvents(Array.isArray(eventRows) ? eventRows : []);
        setBarangays(Array.isArray(barangayRows) ? barangayRows : []);
        hasLoadedFiltersRef.current = true;
      } catch (error) {
        if (isMounted) {
          if (!preserveExistingFilters) {
            setErrorMessage(
              error.message || "Failed to load disaster report filters.",
            );
          }
        }
      } finally {
        if (isMounted) {
          setIsLoadingFilters(false);
          setIsRefreshingFilters(false);
        }
      }
    };

    loadFilters();

    return () => {
      isMounted = false;
    };
  }, [filtersReloadToken]);

  useEffect(() => {
    let isMounted = true;

    const loadRows = async () => {
      const preserveExistingRows =
        backgroundRowsReloadRef.current && hasLoadedRowsRef.current;
      backgroundRowsReloadRef.current = false;
      if (!preserveExistingRows) {
        setIsLoadingRows(true);
      }
      setIsRefreshingRows(preserveExistingRows);
      setErrorMessage("");

      try {
        const response = await fetchDisasterEventReportSummary({
          disaster_event_id: filters.disaster_event_id,
          barangay_id: filters.barangay_id,
          status: filters.status,
          date_from: filters.date_from,
          date_to: filters.date_to,
          search: searchTerm,
          sort_order: filters.sort_order,
          page,
          page_size: pageSize,
        });

        if (!isMounted) {
          return;
        }

        const nextRows = Array.isArray(response.data) ? response.data : [];
        const nextPagination = getPaginationFromResponse({
          responsePagination: response.pagination,
          rowCount: nextRows.length,
          page,
          pageSize,
        });

        setRows(nextRows);
        setPagination(nextPagination);
        setPage((currentPage) =>
          currentPage === nextPagination.page
            ? currentPage
            : nextPagination.page,
        );
        hasLoadedRowsRef.current = true;
      } catch (error) {
        if (isMounted) {
          if (preserveExistingRows) {
            setErrorMessage("");
            return;
          }
          setRows([]);
          setPagination(
            getPaginationFromResponse({
              responsePagination: null,
              rowCount: 0,
              page: 1,
              pageSize,
            }),
          );
          setErrorMessage(
            error.message || "Failed to load disaster event reports.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingRows(false);
          setIsRefreshingRows(false);
        }
      }
    };

    loadRows();

    return () => {
      isMounted = false;
    };
  }, [
    filters.disaster_event_id,
    filters.barangay_id,
    filters.status,
    filters.date_from,
    filters.date_to,
    filters.sort_order,
    page,
    pageSize,
    searchTerm,
    reloadToken,
  ]);

  const displayedRows = rows;
  const selectedDisasterEvent = useMemo(
    () =>
      disasterEvents.find((event) => event.id === filters.disaster_event_id) ||
      null,
    [disasterEvents, filters.disaster_event_id],
  );
  const selectableBarangays = useMemo(() => {
    if (!selectedDisasterEvent) {
      return barangays;
    }

    const affectedBarangayIds = getAffectedBarangayIds(selectedDisasterEvent);

    if (affectedBarangayIds.length === 0) {
      return [];
    }

    return barangays.filter((barangay) => affectedBarangayIds.includes(barangay.id));
  }, [barangays, selectedDisasterEvent]);
  const isSpecificDisasterEventSelected = Boolean(filters.disaster_event_id);
  const activeColumnWidthStyles = isSpecificDisasterEventSelected
    ? specificEventColumnWidthStyles
    : columnWidthStyles;
  const isInitialLoadingRows = isLoadingRows && !isRefreshingRows;
  const isInitialLoadingFilters = isLoadingFilters && !isRefreshingFilters;
  const isExportDisabled = isInitialLoadingRows || pagination.totalItems === 0;
  const exportDisasterEventOptions = useMemo(
    () => buildDisasterEventReportExportOptions(disasterEvents),
    [disasterEvents],
  );

  const selectedExportEventId = useMemo(
    () =>
      parseDisasterEventReportSelectionValue(selectedExportEventSelection)
        .disasterEventId,
    [selectedExportEventSelection],
  );
  const selectedExportDisasterEvent = useMemo(
    () =>
      disasterEvents.find((event) => event.id === selectedExportEventId) ||
      null,
    [disasterEvents, selectedExportEventId],
  );
  const isSelectedExportEventBreakdown = Boolean(selectedExportEventId);
  const selectableExportBarangays = useMemo(() => {
    if (!selectedExportDisasterEvent) {
      return barangays;
    }

    const affectedBarangayIds = getAffectedBarangayIds(
      selectedExportDisasterEvent,
    );

    if (affectedBarangayIds.length === 0) {
      return [];
    }

    return barangays.filter((barangay) =>
      affectedBarangayIds.includes(barangay.id),
    );
  }, [barangays, selectedExportDisasterEvent]);

  useEffect(() => {
    if (!filters.barangay_id) {
      return;
    }

    const isSelectedBarangayAvailable = selectableBarangays.some(
      (barangay) => barangay.id === filters.barangay_id,
    );

    if (!isSelectedBarangayAvailable) {
      setPage(1);
      setFilters((currentValue) => ({
        ...currentValue,
        barangay_id: "",
      }));
    }
  }, [filters.barangay_id, selectableBarangays]);

  useEffect(() => {
    if (!selectedExportBarangayId) {
      return;
    }

    const isSelectedBarangayAvailable = selectableExportBarangays.some(
      (barangay) => barangay.id === selectedExportBarangayId,
    );

    if (!isSelectedBarangayAvailable) {
      setSelectedExportBarangayId("");
    }
  }, [selectedExportBarangayId, selectableExportBarangays]);

  const getCurrentExportEventSelection = () => {
    if (filters.disaster_event_id) {
      return formatDisasterEventReportSelectionValue(
        filters.disaster_event_id,
      );
    }

    if (filters.status === "ACTIVE") {
      return DISASTER_EVENT_REPORT_EXPORT_SELECTIONS.ACTIVE;
    }

    if (filters.status === "CLOSED") {
      return DISASTER_EVENT_REPORT_EXPORT_SELECTIONS.ENDED;
    }

    return DISASTER_EVENT_REPORT_EXPORT_SELECTIONS.ALL;
  };

  const openExportModal = () => {
    if (pagination.totalItems === 0) {
      setExportFeedback({
        type: "error",
        message: NO_EXPORT_DATA_MESSAGE,
      });
      return;
    }

    setSelectedExportFormat("csv");
    setSelectedExportEventSelection(getCurrentExportEventSelection());
    setSelectedExportBarangayId(filters.barangay_id);
    setSelectedExportStatus(filters.status);
    setSelectedExportDateFrom(filters.date_from);
    setSelectedExportDateTo(filters.date_to);
    setSelectedExportSearch(searchTerm);
    setSelectedExportSortOrder(filters.sort_order);
    setIsExportModalOpen(true);
  };

  const handleExportSummary = async () => {
    setIsExporting(true);

    try {
      const file = await exportDisasterEventReportSummary({
        event_selection: selectedExportEventSelection,
        barangay_id: selectedExportBarangayId,
        status: selectedExportStatus,
        date_from: selectedExportDateFrom,
        date_to: selectedExportDateTo,
        search: selectedExportSearch,
        sort_order: selectedExportSortOrder,
        format: selectedExportFormat,
      });

      downloadExportFile(file);
      setExportFeedback({
        type: "success",
        message: buildExportSuccessMessage("Disaster events summary report"),
      });
      setIsExportModalOpen(false);
    } catch (error) {
      setExportFeedback({
        type: "error",
        message: resolveExportErrorMessage(
          error,
          "Unable to export the disaster events summary report.",
        ),
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="DISASTER EVENTS SUMMARY"
        actions={[]}
      />

      <section className="disaster-summary-filter-card" style={shellStyles.card}>
        <div
          className="disaster-summary-filter-grid"
          style={pageSpacingStyles.filterGrid}
        >
          <div>
            <label htmlFor="disaster-report-event" style={labelStyles}>
              Disaster Event
            </label>
            <select
              id="disaster-report-event"
              value={filters.disaster_event_id}
              onChange={(event) =>
                updateFilters((currentValue) => ({
                  ...currentValue,
                  disaster_event_id: event.target.value,
                }))
              }
              disabled={isInitialLoadingFilters}
              style={inputStyles}
            >
              <option value="">All disaster events</option>
              {disasterEvents.map((row) => (
                <option key={row.id} value={row.id}>
                  {formatDisasterEventTitle(row)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="disaster-report-barangay" style={labelStyles}>
              Barangay
            </label>
            <select
              id="disaster-report-barangay"
              value={filters.barangay_id}
              onChange={(event) =>
                updateFilters((currentValue) => ({
                  ...currentValue,
                  barangay_id: event.target.value,
                }))
              }
              disabled={isInitialLoadingFilters}
              style={inputStyles}
            >
              <option value="">All barangays</option>
              {selectableBarangays.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="disaster-report-status" style={labelStyles}>
              Status
            </label>
            <select
              id="disaster-report-status"
              value={filters.status}
              onChange={(event) =>
                updateFilters((currentValue) => ({
                  ...currentValue,
                  status: event.target.value,
                }))
              }
              style={inputStyles}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="disaster-report-date-from" style={labelStyles}>
              Date From
            </label>
            <input
              id="disaster-report-date-from"
              type="date"
              value={filters.date_from}
              onChange={(event) =>
                updateFilters((currentValue) => ({
                  ...currentValue,
                  date_from: event.target.value,
                }))
              }
              style={inputStyles}
            />
          </div>

          <div>
            <label htmlFor="disaster-report-date-to" style={labelStyles}>
              Date To
            </label>
            <input
              id="disaster-report-date-to"
              type="date"
              value={filters.date_to}
              onChange={(event) =>
                updateFilters((currentValue) => ({
                  ...currentValue,
                  date_to: event.target.value,
                }))
              }
              style={inputStyles}
            />
          </div>

          <div>
            <label htmlFor="disaster-report-sort-order" style={labelStyles}>
              Order List
            </label>
            <select
              id="disaster-report-sort-order"
              value={filters.sort_order}
              onChange={(event) =>
                updateFilters((currentValue) => ({
                  ...currentValue,
                  sort_order: event.target.value,
                }))
              }
              style={inputStyles}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <div className="disaster-summary-toolbar" style={toolbarStyles}>
        <div className="disaster-summary-toolbar-search" style={{ flex: "1 1 320px", minWidth: 0 }}>
          <SearchBar
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search disaster events name, type, or affected barangays"
          />
        </div>
        <button
          className="disaster-summary-export-button"
          type="button"
          onClick={openExportModal}
          disabled={isExportDisabled}
          style={exportButtonStyles(isExportDisabled)}
        >
          <FiFileText aria-hidden="true" />
          Export
        </button>
      </div>

      <section className="disaster-summary-records-card" style={shellStyles.card}>
        <div style={pageSpacingStyles.tableHeader}>
          <h3 style={{ margin: 0, color: "#17324d" }}>Disaster Events Record</h3>
        </div>

        <TablePagination
          totalItems={pagination.totalItems}
          currentPage={pagination.page || page}
          pageSize={pagination.pageSize}
          pageSizeOptions={TABLE_PAGE_SIZE_OPTIONS}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
          isVisible={!isInitialLoadingRows && !errorMessage}
          disabled={isInitialLoadingRows}
          disablePageSize={isInitialLoadingRows}
          ariaLabel="Disaster events summary pagination"
          previousAriaLabel="Go to previous disaster events summary page"
          nextAriaLabel="Go to next disaster events summary page"
        />

        {errorMessage ? <ErrorState message={errorMessage} style={{ marginBottom: "16px" }} /> : null}

        {isInitialLoadingRows ? (
          <LoadingState message="Loading disaster event reports..." />
        ) : displayedRows.length === 0 ? (
          <EmptyState message="No matching records found. Try adjusting your search or filters." />
        ) : (
          <div className="disaster-summary-table-scroll" style={{ overflowX: "auto" }}>
            <table className="disaster-summary-table" style={tableStyles.table}>
              <thead>
                <tr>
                  <th
                    className="disaster-summary-text-cell"
                    style={{ ...tableStyles.th, ...activeColumnWidthStyles.disasterEvent }}
                  >
                    Disaster Event
                  </th>
                  <th
                    className="disaster-summary-status-cell"
                    style={{
                      ...tableStyles.th,
                      ...centeredColumnStyles,
                      ...activeColumnWidthStyles.status,
                    }}
                  >
                    Status
                  </th>
                  <th
                    className="disaster-summary-text-cell"
                    style={{ ...tableStyles.th, ...activeColumnWidthStyles.affectedBarangays }}
                  >
                    {isSpecificDisasterEventSelected ? "Barangay" : "Affected Barangays"}
                  </th>
                  <th
                    className="disaster-summary-number-cell"
                    style={{
                      ...tableStyles.th,
                      ...centeredColumnStyles,
                      ...activeColumnWidthStyles.registeredHouseholds,
                    }}
                  >
                    Registered Households
                  </th>
                  <th
                    className="disaster-summary-number-cell"
                    style={{
                      ...tableStyles.th,
                      ...centeredColumnStyles,
                      ...activeColumnWidthStyles.distributedAid,
                    }}
                  >
                    Aid Distributed
                  </th>
                  <th
                    className="disaster-summary-number-cell"
                    style={{
                      ...tableStyles.th,
                      ...centeredColumnStyles,
                      ...activeColumnWidthStyles.claimStatus,
                    }}
                  >
                    Claim Summary
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayedRows.map((row) => (
                  <tr key={`${row.id}-${row.barangay_id || "summary"}`}>
                    <td
                      className="disaster-summary-text-cell"
                      style={{ ...tableStyles.td, ...activeColumnWidthStyles.disasterEvent }}
                    >
                      <div style={{ fontWeight: 700 }}>
                        {formatDisasterEventTitle(row)}
                      </div>
                      <div style={{ color: "#60738a", fontSize: "12px" }}>
                        {row.disaster_type || "--"}
                      </div>
                    </td>
                    <td
                      className="disaster-summary-status-cell"
                      style={{
                        ...tableStyles.td,
                        ...centeredColumnStyles,
                        ...activeColumnWidthStyles.status,
                      }}
                    >
                      <span style={getDisasterEventStatusStyles(row.status)}>
                        {getDisasterEventStatusLabel(row.status)}
                      </span>
                    </td>
                    <td
                      className={`disaster-summary-text-cell${
                        isSpecificDisasterEventSelected
                          ? " disaster-summary-specific-barangay-cell"
                          : ""
                      }`}
                      style={{ ...tableStyles.td, ...activeColumnWidthStyles.affectedBarangays }}
                    >
                      {isSpecificDisasterEventSelected ? (
                        <div>{row.barangay_name || "--"}</div>
                      ) : (
                        <>
                          <div>{row.affected_barangays_text || "--"}</div>
                          <div style={{ color: "#60738a", fontSize: "12px" }}>
                            Count: {row.affected_barangays_count || 0}
                          </div>
                        </>
                      )}
                    </td>
                    <td
                      className="disaster-summary-number-cell"
                      style={{
                        ...tableStyles.td,
                        ...centeredColumnStyles,
                        ...activeColumnWidthStyles.registeredHouseholds,
                      }}
                    >
                      {row.registered_households_count || 0}
                    </td>
                    <td
                      className="disaster-summary-number-cell"
                      style={{
                        ...tableStyles.td,
                        ...centeredColumnStyles,
                        ...activeColumnWidthStyles.distributedAid,
                      }}
                    >
                      {row.distributed_aid_count || 0}
                    </td>
                    <td
                      className="disaster-summary-number-cell"
                      style={{
                        ...tableStyles.td,
                        ...centeredColumnStyles,
                        ...activeColumnWidthStyles.claimStatus,
                      }}
                    >
                      <div>Claimed: {row.claimed_stubs_count || 0}</div>
                      <div style={{ color: "#60738a", fontSize: "12px" }}>
                        Unclaimed: {row.unclaimed_stubs_count || 0}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {isExportModalOpen ? (
        <div className="disaster-summary-modal-backdrop" style={overlayStyles}>
          <div className="disaster-summary-export-modal" style={modalStyles}>
            <div
              className="disaster-summary-modal-topbar"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "16px",
                marginBottom: "20px",
              }}
            >
              <div className="disaster-summary-modal-heading">
                <h3
                  style={{
                    margin: 0,
                    color: "#17324d",
                    fontSize: "26px",
                    fontWeight: 800,
                  }}
                >
                  {isSelectedExportEventBreakdown
                    ? "Disaster Event Barangay Distribution Report"
                    : "Disaster Events Summary Report"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !isExporting && setIsExportModalOpen(false)}
                style={{
                  ...closeButtonStyles,
                  cursor: isExporting ? "not-allowed" : "pointer",
                  opacity: isExporting ? 0.7 : 1,
                }}
                disabled={isExporting}
                aria-label="Close modal"
              >
                <FiX size={20} />
              </button>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "18px",
              }}
            >
              <section style={{ ...shellStyles.card, padding: "18px 20px" }}>
                <h3 style={sectionTitleStyles}>Export Details</h3>

                <div className="disaster-summary-export-grid" style={exportFilterGridStyles}>
                  <div>
                    <label htmlFor="summary-export-event" style={exportLabelStyles}>
                      Disaster Event
                    </label>
                    <select
                      id="summary-export-event"
                      value={selectedExportEventSelection}
                      onChange={(event) =>
                        setSelectedExportEventSelection(event.target.value)
                      }
                      disabled={isExporting}
                      style={inputStyles}
                    >
                      {exportDisasterEventOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="summary-export-barangay" style={exportLabelStyles}>
                      Barangay
                    </label>
                    <select
                      id="summary-export-barangay"
                      value={selectedExportBarangayId}
                      onChange={(event) =>
                        setSelectedExportBarangayId(event.target.value)
                      }
                      disabled={isExporting}
                      style={inputStyles}
                    >
                      <option value="">All barangays</option>
                      {selectableExportBarangays.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="summary-export-status" style={exportLabelStyles}>
                      Status
                    </label>
                    <select
                      id="summary-export-status"
                      value={selectedExportStatus}
                      onChange={(event) =>
                        setSelectedExportStatus(event.target.value)
                      }
                      disabled={isExporting}
                      style={inputStyles}
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value || "all"} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="summary-export-date-from" style={exportLabelStyles}>
                      Date From
                    </label>
                    <input
                      id="summary-export-date-from"
                      type="date"
                      value={selectedExportDateFrom}
                      onChange={(event) =>
                        setSelectedExportDateFrom(event.target.value)
                      }
                      disabled={isExporting}
                      style={inputStyles}
                    />
                  </div>

                  <div>
                    <label htmlFor="summary-export-date-to" style={exportLabelStyles}>
                      Date To
                    </label>
                    <input
                      id="summary-export-date-to"
                      type="date"
                      value={selectedExportDateTo}
                      onChange={(event) =>
                        setSelectedExportDateTo(event.target.value)
                      }
                      disabled={isExporting}
                      style={inputStyles}
                    />
                  </div>

                  <div>
                    <label htmlFor="summary-export-search" style={exportLabelStyles}>
                      Search
                    </label>
                    <input
                      id="summary-export-search"
                      type="search"
                      value={selectedExportSearch}
                      onChange={(event) =>
                        setSelectedExportSearch(event.target.value)
                      }
                      disabled={isExporting}
                      placeholder="Search event, type, or Barangay"
                      style={inputStyles}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="summary-export-sort-order"
                      style={exportLabelStyles}
                    >
                      Order List
                    </label>
                    <select
                      id="summary-export-sort-order"
                      value={selectedExportSortOrder}
                      onChange={(event) =>
                        setSelectedExportSortOrder(event.target.value)
                      }
                      disabled={isExporting}
                      style={inputStyles}
                    >
                      {SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="summary-export-format" style={exportLabelStyles}>
                      Format
                    </label>
                    <select
                      id="summary-export-format"
                      value={selectedExportFormat}
                      onChange={(event) =>
                        setSelectedExportFormat(event.target.value)
                      }
                      disabled={isExporting}
                      style={inputStyles}
                    >
                      {COMMON_EXPORT_FORMAT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              <div
                className="disaster-summary-modal-actions"
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "12px",
                  marginTop: "10px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(false)}
                  style={pageHeaderStyles.secondaryButton}
                  disabled={isExporting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExportSummary}
                  disabled={isExporting}
                  style={{
                    ...pageHeaderStyles.primaryButton,
                    opacity: isExporting ? 0.7 : 1,
                  }}
                >
                  {isExporting ? "Exporting..." : "Export"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <FeedbackToast
        type={exportFeedback.type}
        message={exportFeedback.message}
        onClose={() => setExportFeedback({ type: "", message: "" })}
      />
    </>
  );
};

export default DisasterEventReportsPage;
