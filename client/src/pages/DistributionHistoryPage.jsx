import React, { useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "../components/layout/PageHeader";
import {
  pageSpacingStyles,
  shellStyles,
} from "../components/layout/BarangayLayout";
import { useAuth } from "../context/AuthContext";
import { ROLE_CODES } from "../utils/roleSession";
import {
  fetchDistributionHistory,
  exportDistributionHistory,
} from "../features/distribution/distributionService";
import { fetchStubDetails } from "../features/stubs/stubService";
import {
  fetchAllDisasterEvents,
  fetchBarangayDisasterEventOptions,
  fetchBarangays,
} from "../features/disaster-events/disasterEventService";
import ExportModal from "../components/shared/ExportModal";
import EmptyState from "../components/shared/EmptyState";
import ErrorState from "../components/shared/ErrorState";
import FeedbackToast from "../components/shared/FeedbackToast";
import LoadingState from "../components/shared/LoadingState";
import StubDetailModal from "../components/stubs/StubDetailModal";
import { FiEye, FiFileText, FiSearch } from "react-icons/fi";
import { formatOrderedSectorText } from "../utils/sectorDisplay";
import {
  buildExportSuccessMessage,
  COMMON_EXPORT_FORMAT_OPTIONS,
  downloadExportFile,
  resolveExportErrorMessage,
} from "../utils/exportHelpers";

const inputStyles = {
  width: "100%",
  minHeight: "46px",
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid #cfddeb",
  backgroundColor: "#f8fbfe",
  color: "#1f3b57",
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
  color: "#4f677f",
  fontSize: "13px",
  fontWeight: 700,
};

const tableStyles = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
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
  },
  td: {
    padding: "14px",
    borderBottom: "1px solid #edf3f8",
    color: "#21405f",
    fontSize: "14px",
    verticalAlign: "top",
    lineHeight: 1.5,
  },
};

const formatDateTime = (value) => {
  if (!value) {
    return "--";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "--";
  }

  return parsedDate.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatDisplayStubNumber = (row) => {
  const sequenceNo = Number(row?.stub_sequence_no || 0);
  return sequenceNo > 0 ? `STUB#${sequenceNo}` : row?.stub_no || "--";
};

const getDisasterEventStatusLabel = (status) =>
  String(status || "").toUpperCase() === "ACTIVE" ? "Active" : "Ended";

const getDisasterEventStatusStyles = (status) => {
  const isEnded = String(status || "").toUpperCase() !== "ACTIVE";

  return {
    display: "inline-flex",
    alignItems: "center",
    marginTop: "6px",
    padding: "4px 10px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 700,
    border: isEnded ? "1px solid #c9e8d7" : "1px solid #bdd8f1",
    backgroundColor: isEnded ? "#eefaf3" : "#e9f4ff",
    color: isEnded ? "#16733c" : "#145995",
  };
};

const ORDER_LIST_OPTIONS = [
  { value: "newest", label: "Newest-Oldest" },
  { value: "oldest", label: "Oldest-Newest" },
  { value: "az", label: "Sort A-Z" },
  { value: "za", label: "Sort Z-A" },
];

const PAGE_SIZE_OPTIONS = [25, 50, 100];

const createDefaultPagination = () => ({
  page: 1,
  pageSize: 25,
  totalItems: 0,
  totalPages: 0,
  hasPreviousPage: false,
  hasNextPage: false,
});

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

const getHistoryPaginationState = (pagination) => {
  const totalItems = Number(pagination?.totalItems || 0);
  const totalPages = Number(pagination?.totalPages || 0);
  const currentPage = Number(pagination?.page || 1);
  const pageSize = Number(pagination?.pageSize || 25);
  const firstVisibleItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastVisibleItem = Math.min(currentPage * pageSize, totalItems);

  return {
    totalItems,
    totalPages,
    currentPage,
    pageSize,
    firstVisibleItem,
    lastVisibleItem,
    hasResults: totalItems > 0,
    hasMultiplePages: totalPages > 1,
  };
};

const HistoryPaginationMetadata = ({
  pagination,
  isLoading,
  onPageSizeChange,
}) => {
  const {
    hasResults,
    hasMultiplePages,
    pageSize,
    firstVisibleItem,
    lastVisibleItem,
    totalItems,
  } = getHistoryPaginationState(pagination);

  if (!hasResults) {
    return null;
  }

  return (
    <div className="distribution-history-pagination-metadata">
      <div className="distribution-history-pagination-range" aria-live="polite">
        Showing {firstVisibleItem}-{lastVisibleItem} of {totalItems}
      </div>

      {hasMultiplePages ? (
        <label
          className="distribution-history-page-size"
          htmlFor="distribution-history-page-size"
        >
          <span>Rows per page</span>
          <select
            id="distribution-history-page-size"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            disabled={isLoading}
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
};

const HistoryPaginationNavigation = ({
  pagination,
  isLoading,
  onPageChange,
}) => {
  const { hasMultiplePages, currentPage, totalPages } =
    getHistoryPaginationState(pagination);

  if (!hasMultiplePages) {
    return null;
  }

  return (
    <nav
      className="distribution-history-pagination-navigation"
      aria-label="Distribution history pagination"
    >
      <div className="distribution-history-pagination-controls">
        <button
          type="button"
          className="distribution-history-pagination-button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!pagination?.hasPreviousPage || isLoading}
          aria-label="Go to previous distribution history page"
        >
          Previous
        </button>

        <span className="distribution-history-page-indicator">
          Page {currentPage} of {totalPages}
        </span>

        <button
          type="button"
          className="distribution-history-pagination-button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!pagination?.hasNextPage || isLoading}
          aria-label="Go to next distribution history page"
        >
          Next
        </button>
      </div>
    </nav>
  );
};

const DistributionHistoryPage = () => {
  const { currentRole } = useAuth();
  const isBarangay = currentRole === ROLE_CODES.BARANGAY;

  const [disasterEvents, setDisasterEvents] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyPagination, setHistoryPagination] = useState(
    createDefaultPagination,
  );
  const [filters, setFilters] = useState({
    disaster_event_id: "",
    barangay_id: "",
    status: "CLAIMED",
    date_from: "",
    date_to: "",
  });
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedExportFormat, setSelectedExportFormat] = useState("csv");
  const [exportFilters, setExportFilters] = useState({
    disaster_event_id: "",
    barangay_id: "",
    date_from: "",
    date_to: "",
    search: "",
    sort_order: "newest",
  });
  const [exportingFormat, setExportingFormat] = useState("");
  const [exportFeedback, setExportFeedback] = useState({
    type: "",
    message: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [isStubDetailModalOpen, setIsStubDetailModalOpen] = useState(false);
  const [selectedStubDetails, setSelectedStubDetails] = useState(null);
  const [isLoadingStubDetails, setIsLoadingStubDetails] = useState(false);
  const [stubDetailsErrorMessage, setStubDetailsErrorMessage] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const historyRequestIdRef = useRef(0);

  const isSummaryMode = !filters.disaster_event_id;

  const updateFilters = (updater) => {
    setPage(1);
    setFilters(updater);
  };

  const handleSearchChange = (value) => {
    setPage(1);
    setSearchTerm(value);
  };

  const handleSortOrderChange = (value) => {
    setPage(1);
    setSortOrder(value);
  };

  const handlePageSizeChange = (value) => {
    setPage(1);
    setPageSize(value);
  };

  useEffect(() => {
    let isMounted = true;

    const loadFilterData = async () => {
      setIsLoadingFilters(true);

      try {
        const [eventRows, barangayRows] = await Promise.all([
          isBarangay
            ? fetchBarangayDisasterEventOptions()
            : fetchAllDisasterEvents(),
          isBarangay ? Promise.resolve([]) : fetchBarangays(),
        ]);

        if (!isMounted) {
          return;
        }

        setDisasterEvents(Array.isArray(eventRows) ? eventRows : []);
        setBarangays(Array.isArray(barangayRows) ? barangayRows : []);
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error.message || "Failed to load distribution history filters.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingFilters(false);
        }
      }
    };

    loadFilterData();

    return () => {
      isMounted = false;
    };
  }, [isBarangay]);

  useEffect(() => {
    let isMounted = true;
    const requestId = historyRequestIdRef.current + 1;
    historyRequestIdRef.current = requestId;

    const loadHistory = async () => {
      setIsLoadingHistory(true);
      setErrorMessage("");

      try {
        const response = await fetchDistributionHistory({
          ...filters,
          mode: isSummaryMode ? "summary" : "detail",
          search: searchTerm.trim(),
          sort_order: sortOrder,
          page,
          pageSize,
        });

        if (!isMounted || historyRequestIdRef.current !== requestId) {
          return;
        }

        setHistoryRows(Array.isArray(response.data) ? response.data : []);
        setHistoryPagination(response.pagination || createDefaultPagination());
      } catch (error) {
        if (isMounted && historyRequestIdRef.current === requestId) {
          setHistoryRows([]);
          setHistoryPagination(createDefaultPagination());
          setErrorMessage(error.message || "Failed to load distribution history.");
        }
      } finally {
        if (isMounted && historyRequestIdRef.current === requestId) {
          setIsLoadingHistory(false);
        }
      }
    };

    loadHistory();

    return () => {
      isMounted = false;
    };
  }, [filters, isSummaryMode, page, pageSize, searchTerm, sortOrder]);

  const selectedDisasterEvent = useMemo(
    () =>
      disasterEvents.find((eventRow) => eventRow.id === filters.disaster_event_id) ||
      null,
    [disasterEvents, filters.disaster_event_id],
  );

  const barangayOptions = useMemo(() => {
    if (!selectedDisasterEvent) {
      return barangays;
    }

    const affectedBarangayIds = getAffectedBarangayIds(selectedDisasterEvent);

    if (affectedBarangayIds.length === 0) {
      return [];
    }

    const affectedBarangayIdSet = new Set(affectedBarangayIds);

    return barangays.filter((barangay) => affectedBarangayIdSet.has(barangay.id));
  }, [barangays, selectedDisasterEvent]);

  const selectedExportDisasterEvent = useMemo(
    () =>
      disasterEvents.find(
        (eventRow) => eventRow.id === exportFilters.disaster_event_id,
      ) || null,
    [disasterEvents, exportFilters.disaster_event_id],
  );

  const exportBarangayOptions = useMemo(() => {
    if (!selectedExportDisasterEvent) {
      return barangays;
    }

    const affectedBarangayIds = getAffectedBarangayIds(selectedExportDisasterEvent);

    if (affectedBarangayIds.length === 0) {
      return [];
    }

    const affectedBarangayIdSet = new Set(affectedBarangayIds);

    return barangays.filter((barangay) => affectedBarangayIdSet.has(barangay.id));
  }, [barangays, selectedExportDisasterEvent]);

  useEffect(() => {
    if (isBarangay || !filters.barangay_id || !selectedDisasterEvent) {
      return;
    }

    const isSelectedBarangayAffected = barangayOptions.some(
      (barangay) => barangay.id === filters.barangay_id,
    );

    if (!isSelectedBarangayAffected) {
      updateFilters((currentValue) => ({
        ...currentValue,
        barangay_id: "",
      }));
    }
  }, [barangayOptions, filters.barangay_id, isBarangay, selectedDisasterEvent]);

  useEffect(() => {
    if (isBarangay || !exportFilters.barangay_id || !selectedExportDisasterEvent) {
      return;
    }

    const isSelectedBarangayAffected = exportBarangayOptions.some(
      (barangay) => barangay.id === exportFilters.barangay_id,
    );

    if (!isSelectedBarangayAffected) {
      setExportFilters((currentValue) => ({
        ...currentValue,
        barangay_id: "",
      }));
    }
  }, [
    exportBarangayOptions,
    exportFilters.barangay_id,
    isBarangay,
    selectedExportDisasterEvent,
  ]);

  const displayedRows = historyRows;

  const handleViewDetails = async (row) => {
    setIsStubDetailModalOpen(true);
    setSelectedStubDetails(null);
    setStubDetailsErrorMessage("");
    setIsLoadingStubDetails(true);

    try {
      const response = await fetchStubDetails(row.stub_id);
      setSelectedStubDetails(response?.data || response);
    } catch (error) {
      setStubDetailsErrorMessage(
        error.message || "Failed to load household details.",
      );
    } finally {
      setIsLoadingStubDetails(false);
    }
  };

  const closeStubDetailModal = () => {
    setIsStubDetailModalOpen(false);
    setSelectedStubDetails(null);
    setStubDetailsErrorMessage("");
  };

  return (
    <>
      <PageHeader
        title="DISTRIBUTION HISTORY"
        actions={[]}
      />

      <section className="distribution-history-filter-card" style={shellStyles.card}>
        <div
          className="distribution-history-filter-grid"
          style={pageSpacingStyles.filterGrid}
        >
          <div>
            <label htmlFor="distribution-history-event" style={labelStyles}>
              Disaster Event
            </label>
            <select
              id="distribution-history-event"
              value={filters.disaster_event_id}
              onChange={(event) =>
                updateFilters((currentValue) => ({
                  ...currentValue,
                  disaster_event_id: event.target.value,
                  barangay_id: "",
                }))
              }
              disabled={isLoadingFilters}
              style={inputStyles}
            >
              <option value="">All disaster events</option>
              {disasterEvents.map((eventRow) => (
                <option key={eventRow.id} value={eventRow.id}>
                  {eventRow.title}
                </option>
              ))}
            </select>
          </div>

          {!isBarangay ? (
            <div>
              <label htmlFor="distribution-history-barangay" style={labelStyles}>
                Barangay
              </label>
              <select
                id="distribution-history-barangay"
                value={filters.barangay_id}
                onChange={(event) =>
                  updateFilters((currentValue) => ({
                    ...currentValue,
                    barangay_id: event.target.value,
                  }))
                }
                disabled={isLoadingFilters}
                style={inputStyles}
              >
                <option value="">All barangays</option>
                {barangayOptions.map((barangay) => (
                  <option key={barangay.id} value={barangay.id}>
                    {barangay.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div>
            <label htmlFor="distribution-history-date-from" style={labelStyles}>
              Date From
            </label>
            <input
              id="distribution-history-date-from"
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
            <label htmlFor="distribution-history-date-to" style={labelStyles}>
              Date To
            </label>
            <input
              id="distribution-history-date-to"
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
            <label htmlFor="distribution-history-order-list" style={labelStyles}>
              Order List
            </label>
            <select
              id="distribution-history-order-list"
              value={sortOrder}
              onChange={(event) => handleSortOrderChange(event.target.value)}
              style={inputStyles}
            >
              {ORDER_LIST_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section
        className="distribution-history-toolbar"
        style={{
          ...pageSpacingStyles.toolbar,
        }}
      >
        <div
          className="distribution-history-toolbar-search"
          style={{
            position: "relative",
            flex: "1 1 420px",
            minWidth: 0,
          }}
        >
          <FiSearch
            size={18}
            style={{
              position: "absolute",
              left: "16px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "#7892aa",
            }}
          />
          <input
            type="search"
            aria-label="Search distribution history"
            value={searchTerm}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder="Search family head, sectors, or stub number"
            style={{
              ...inputStyles,
              paddingLeft: "44px",
              backgroundColor: "#ffffff",
            }}
          />
        </div>

        <button
          className="distribution-history-export-button"
          type="button"
          onClick={() => {
            setSelectedExportFormat("csv");
            setExportFilters({
              disaster_event_id: filters.disaster_event_id,
              barangay_id: isBarangay ? "" : filters.barangay_id,
              date_from: filters.date_from,
              date_to: filters.date_to,
              search: searchTerm.trim(),
              sort_order: sortOrder,
            });
            setExportFeedback({ type: "", message: "" });
            setIsExportModalOpen(true);
          }}
          disabled={Boolean(exportingFormat)}
          style={{
            border: "1px solid #c6d8ea",
            borderRadius: "14px",
            minHeight: "46px",
            padding: "12px 18px",
            backgroundColor: "#f8fbfe",
            color: "#2a4c6f",
            fontSize: "14px",
            fontWeight: 700,
            cursor: exportingFormat ? "not-allowed" : "pointer",
            opacity: exportingFormat ? 0.7 : 1,
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <FiFileText size={16} />
          {exportingFormat
            ? `Exporting ${exportingFormat.toUpperCase()}...`
            : "Export"}
        </button>
      </section>

      <section className="distribution-history-records-card" style={shellStyles.card}>
        <div
          className="distribution-history-records-header"
          style={pageSpacingStyles.tableHeader}
        >
          <div className="distribution-history-records-title-group">
            <h3 style={{ margin: 0, color: "#17324d" }}>Distribution Records</h3>
            <HistoryPaginationMetadata
              pagination={historyPagination}
              isLoading={isLoadingHistory}
              onPageSizeChange={handlePageSizeChange}
            />
          </div>
        </div>

        {errorMessage ? <ErrorState message={errorMessage} style={{ marginBottom: "16px" }} /> : null}

        {isLoadingHistory ? (
          <LoadingState message="Loading distribution history..." />
        ) : displayedRows.length === 0 ? (
          <EmptyState message="No matching records found. Try adjusting your search or filters." />
        ) : isSummaryMode ? (
          <div
            className="distribution-history-table-scroll distribution-history-summary-scroll"
            style={{ overflowX: "auto" }}
          >
            <table className="distribution-history-table distribution-history-summary-table" style={tableStyles.table}>
              <thead>
                <tr>
                  <th style={tableStyles.th}>Disaster Event</th>
                  <th style={{ ...tableStyles.th, textAlign: "center" }}>Status</th>
                  <th style={tableStyles.th}>Barangays</th>
                  <th style={{ ...tableStyles.th, textAlign: "center" }}>
                    Issued Stubs
                  </th>
                  <th style={tableStyles.th}>Claim Status Summary</th>
                  <th style={tableStyles.th}>Relief Pack</th>
                  <th style={tableStyles.th}>Latest Claim</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map((row) => (
                  <tr key={row.id}>
                    <td className="distribution-history-text-cell" style={tableStyles.td}>
                      <div>{row.disaster_event_title || "--"}</div>
                    </td>
                    <td style={{ ...tableStyles.td, textAlign: "center", verticalAlign: "middle" }}>
                      <span style={getDisasterEventStatusStyles(row.disaster_event_status)}>
                        {getDisasterEventStatusLabel(row.disaster_event_status)}
                      </span>
                    </td>
                    <td className="distribution-history-text-cell" style={tableStyles.td}>
                      <div>{row.barangay_summary}</div>
                      <div style={{ color: "#60738a", fontSize: "12px" }}>
                        Count: {row.barangay_count}
                      </div>
                    </td>
                    <td style={{ ...tableStyles.td, textAlign: "center" }}>
                      {row.issued_stubs_count || 0}
                    </td>
                    <td className="distribution-history-text-cell" style={tableStyles.td}>
                      <div>Claimed: {row.claimed_stubs_count || 0}</div>
                      <div style={{ color: "#60738a", fontSize: "12px" }}>
                        Unclaimed: {row.unclaimed_stubs_count || 0}
                      </div>
                    </td>
                    <td className="distribution-history-text-cell" style={tableStyles.td}>{row.relief_pack_summary}</td>
                    <td className="distribution-history-date-cell" style={tableStyles.td}>
                      {formatDateTime(row.latest_distribution_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div
            className="distribution-history-table-scroll distribution-history-detail-scroll"
            style={{ overflowX: "auto" }}
          >
            <table className="distribution-history-table distribution-history-detail-table" style={tableStyles.table}>
              <thead>
                <tr>
                  <th style={tableStyles.th}>Family Head</th>
                  {!isBarangay ? <th style={tableStyles.th}>Barangay</th> : null}
                  <th style={{ ...tableStyles.th, textAlign: "center" }}>
                    Household Size
                  </th>
                  <th style={tableStyles.th}>Sectors</th>
                  <th style={tableStyles.th}>Stub Number</th>
                  <th style={tableStyles.th}>Relief Pack</th>
                  <th style={tableStyles.th}>Claimed At</th>
                  <th style={tableStyles.th}>Verified By</th>
                  <th style={{ ...tableStyles.th, textAlign: "center" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map((row) => (
                  <tr key={row.id}>
                    <td className="distribution-history-text-cell" style={tableStyles.td}>
                      {row.family_head_name || "--"}
                    </td>
                    {!isBarangay ? (
                      <td className="distribution-history-text-cell" style={tableStyles.td}>{row.barangay_name || "--"}</td>
                    ) : null}
                    <td style={{ ...tableStyles.td, textAlign: "center" }}>
                      <span
                        style={{
                          display: "inline-block",
                          minWidth: "36px",
                          textAlign: "center",
                          padding: "6px 10px",
                          borderRadius: "999px",
                          backgroundColor: "#e5f1fb",
                          color: "#356592",
                          fontSize: "12px",
                          fontWeight: 700,
                        }}
                      >
                        {row.members_count ?? row.household_size ?? 0}
                      </span>
                    </td>
                    <td className="distribution-history-text-cell" style={tableStyles.td}>
                      {formatOrderedSectorText(row.sectors_text)}
                    </td>
                    <td className="distribution-history-identifier-cell" style={tableStyles.td}>
                      {formatDisplayStubNumber(row)}
                    </td>
                    <td className="distribution-history-text-cell" style={tableStyles.td}>
                      <div>
                        {row.relief_pack_template_name ||
                          row.released_items_summary ||
                          "--"}
                      </div>
                      <div style={{ color: "#60738a", fontSize: "12px" }}>
                        {row.relief_pack_template_name && row.released_items_summary
                          ? row.released_items_summary
                          : ""}
                      </div>
                    </td>
                    <td className="distribution-history-date-cell" style={tableStyles.td}>
                      {formatDateTime(row.distribution_date)}
                    </td>
                    <td className="distribution-history-text-cell" style={tableStyles.td}>{row.verified_by_name || "--"}</td>
                    <td style={{ ...tableStyles.td, textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => handleViewDetails(row)}
                        aria-label={`View details for ${formatDisplayStubNumber(row)}`}
                        title="View Details"
                        style={{
                          border: "1px solid #c6d8ea",
                          borderRadius: "12px",
                          width: "40px",
                          height: "40px",
                          backgroundColor: "#f7fbfe",
                          color: "#24496e",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        <FiEye size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <HistoryPaginationNavigation
          pagination={historyPagination}
          isLoading={isLoadingHistory}
          onPageChange={setPage}
        />
      </section>

      <ExportModal
        isOpen={isExportModalOpen}
        title="Distribution History Report"
        description=""
        formatOptions={COMMON_EXPORT_FORMAT_OPTIONS}
        selectedReportType="DISTRIBUTION_HISTORY"
        selectedFormat={selectedExportFormat}
        hideReportType
        placeFormatLast
        isSubmitting={Boolean(exportingFormat)}
        onReportTypeChange={() => {}}
        onFormatChange={setSelectedExportFormat}
        onClose={() => {
          if (!exportingFormat) {
            setIsExportModalOpen(false);
          }
        }}
        onSubmit={async () => {
          setExportingFormat(selectedExportFormat);
          setIsExportModalOpen(false);

          try {
            const file = await exportDistributionHistory({
              disaster_event_id: exportFilters.disaster_event_id,
              barangay_id: isBarangay ? "" : exportFilters.barangay_id,
              status: "CLAIMED",
              date_from: exportFilters.date_from,
              date_to: exportFilters.date_to,
              search: exportFilters.search,
              sort_order: exportFilters.sort_order,
              format: selectedExportFormat,
            });

            downloadExportFile(file);
            setExportFeedback({
              type: "success",
              message: buildExportSuccessMessage("Distribution history report"),
            });
          } catch (error) {
            setExportFeedback({
              type: "error",
              message: resolveExportErrorMessage(
                error,
                "Unable to export distribution history.",
              ),
            });
          } finally {
            setExportingFormat("");
          }
        }}
      >
        <div>
          <label htmlFor="distribution-history-export-event" style={exportLabelStyles}>
            Disaster Event
          </label>
          <select
            id="distribution-history-export-event"
            value={exportFilters.disaster_event_id}
            onChange={(event) =>
              setExportFilters((currentValue) => ({
                ...currentValue,
                disaster_event_id: event.target.value,
                barangay_id: "",
              }))
            }
            style={inputStyles}
            disabled={Boolean(exportingFormat)}
          >
            <option value="">All disaster events</option>
            {disasterEvents.map((eventRow) => (
              <option key={eventRow.id} value={eventRow.id}>
                {eventRow.title}
              </option>
            ))}
          </select>
        </div>

        {!isBarangay ? (
          <div>
            <label htmlFor="distribution-history-export-barangay" style={exportLabelStyles}>
              Barangay
            </label>
            <select
              id="distribution-history-export-barangay"
              value={exportFilters.barangay_id}
              onChange={(event) =>
                setExportFilters((currentValue) => ({
                  ...currentValue,
                  barangay_id: event.target.value,
                }))
              }
              style={inputStyles}
              disabled={Boolean(exportingFormat)}
            >
              <option value="">All barangays</option>
              {exportBarangayOptions.map((barangay) => (
                <option key={barangay.id} value={barangay.id}>
                  {barangay.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "14px",
          }}
        >
          <div>
            <label htmlFor="distribution-history-export-date-from" style={exportLabelStyles}>
              Date From (Optional)
            </label>
            <input
              id="distribution-history-export-date-from"
              type="date"
              value={exportFilters.date_from}
              onChange={(event) =>
                setExportFilters((currentValue) => ({
                  ...currentValue,
                  date_from: event.target.value,
                }))
              }
              style={inputStyles}
              disabled={Boolean(exportingFormat)}
            />
          </div>

          <div>
            <label htmlFor="distribution-history-export-date-to" style={exportLabelStyles}>
              Date To (Optional)
            </label>
            <input
              id="distribution-history-export-date-to"
              type="date"
              value={exportFilters.date_to}
              onChange={(event) =>
                setExportFilters((currentValue) => ({
                  ...currentValue,
                  date_to: event.target.value,
                }))
              }
              style={inputStyles}
              disabled={Boolean(exportingFormat)}
            />
          </div>
        </div>

        <div>
          <label htmlFor="distribution-history-export-order-list" style={exportLabelStyles}>
            Order List
          </label>
          <select
            id="distribution-history-export-order-list"
            value={exportFilters.sort_order}
            onChange={(event) =>
              setExportFilters((currentValue) => ({
                ...currentValue,
                sort_order: event.target.value,
              }))
            }
            style={inputStyles}
            disabled={Boolean(exportingFormat)}
          >
            {ORDER_LIST_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </ExportModal>

      <FeedbackToast
        type={exportFeedback.type}
        message={exportFeedback.message}
        onClose={() => setExportFeedback({ type: "", message: "" })}
      />

      <StubDetailModal
        isOpen={isStubDetailModalOpen}
        isLoading={isLoadingStubDetails}
        errorMessage={stubDetailsErrorMessage}
        stubDetails={selectedStubDetails}
        onClose={closeStubDetailModal}
      />
    </>
  );
};

export default DistributionHistoryPage;
