import React, { useEffect, useMemo, useState } from "react";
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

const getRowTime = (row) => {
  const parsedTime = new Date(row?.distribution_date || 0).getTime();
  return Number.isNaN(parsedTime) ? 0 : parsedTime;
};

const getSummaryRowTime = (row) => {
  const parsedTime = new Date(row?.latest_distribution_date || 0).getTime();
  return Number.isNaN(parsedTime) ? 0 : parsedTime;
};

const sortDistributionHistoryRows = (rows, sortOrder = "newest") => {
  return [...rows].sort((leftRow, rightRow) => {
    if (sortOrder === "az" || sortOrder === "za") {
      const comparison = String(leftRow.family_head_name || "").localeCompare(
        String(rightRow.family_head_name || ""),
        undefined,
        { sensitivity: "base" },
      );

      return sortOrder === "za" ? -comparison : comparison;
    }

    const leftTime = getRowTime(leftRow);
    const rightTime = getRowTime(rightRow);

    return sortOrder === "oldest" ? leftTime - rightTime : rightTime - leftTime;
  });
};

const buildDistributionSummaryRows = ({
  rows,
  disasterEvents,
  selectedBarangayId = "",
}) => {
  const summaryByEventId = new Map();

  (Array.isArray(disasterEvents) ? disasterEvents : []).forEach((event) => {
    const affectedBarangays = Array.isArray(event?.affected_barangays)
      ? event.affected_barangays
      : [];
    const affectedBarangayIds = affectedBarangays
      .map((barangay) => barangay?.id || barangay?.barangay_id || "")
      .filter(Boolean);

    if (
      selectedBarangayId &&
      affectedBarangayIds.length > 0 &&
      !affectedBarangayIds.includes(selectedBarangayId)
    ) {
      return;
    }

    const barangayNames = selectedBarangayId
      ? affectedBarangays
          .filter(
            (barangay) =>
              (barangay?.id || barangay?.barangay_id || "") === selectedBarangayId,
          )
          .map((barangay) => barangay?.name)
          .filter(Boolean)
      : affectedBarangays.map((barangay) => barangay?.name).filter(Boolean);

    summaryByEventId.set(event.id, {
      id: event.id,
      event_code: event.event_code || "",
      disaster_event_title: event.title || "--",
      disaster_event_status: event.status || "",
      start_date: event.start_date || null,
      barangayNames: new Set(barangayNames),
      reliefPacks: new Set(),
      issuedStubsCount: 0,
      claimedStubsCount: 0,
      unclaimedStubsCount: 0,
      latest_distribution_date: null,
    });
  });

  rows.forEach((row) => {
    const eventId = row.disaster_event_id || "unknown-event";
    const existingSummary = summaryByEventId.get(eventId) || {
      id: eventId,
      event_code: row.event_code || "",
      disaster_event_title: row.disaster_event_title || "--",
      disaster_event_status: row.disaster_event_status || "",
      start_date: row.start_date || null,
      barangayNames: new Set(),
      reliefPacks: new Set(),
      issuedStubsCount: Number(row.issued_stubs_count || 0),
      claimedStubsCount: Number(row.claimed_stubs_count || 0),
      unclaimedStubsCount: Number(row.unclaimed_stubs_count || 0),
      latest_distribution_date: null,
    };

    if (row.barangay_name) {
      existingSummary.barangayNames.add(row.barangay_name);
    }

    const reliefPack = row.relief_pack_template_name || row.released_items_summary;

    if (reliefPack) {
      existingSummary.reliefPacks.add(reliefPack);
    }

    existingSummary.issuedStubsCount = Number(
      row.issued_stubs_count || existingSummary.issuedStubsCount || 0,
    );
    existingSummary.claimedStubsCount = Number(
      row.claimed_stubs_count || existingSummary.claimedStubsCount || 0,
    );
    existingSummary.unclaimedStubsCount = Number(
      row.unclaimed_stubs_count || existingSummary.unclaimedStubsCount || 0,
    );

    const currentLatestTime = getSummaryRowTime(existingSummary);
    const rowTime = getRowTime(row);

    if (rowTime > currentLatestTime) {
      existingSummary.latest_distribution_date = row.distribution_date;
    }

    summaryByEventId.set(eventId, existingSummary);
  });

  return Array.from(summaryByEventId.values()).map((summary) => ({
    id: summary.id,
    event_code: summary.event_code,
    disaster_event_title: summary.disaster_event_title,
    disaster_event_status: summary.disaster_event_status,
    start_date: summary.start_date,
    barangay_summary: Array.from(summary.barangayNames).sort().join(", ") || "--",
    barangay_count: summary.barangayNames.size,
    issued_stubs_count: summary.issuedStubsCount,
    claimed_stubs_count: summary.claimedStubsCount,
    unclaimed_stubs_count: summary.unclaimedStubsCount,
    relief_pack_summary: Array.from(summary.reliefPacks).sort().join(", ") || "--",
    latest_distribution_date: summary.latest_distribution_date,
  }));
};

const sortDistributionSummaryRows = (rows, sortOrder = "newest") => {
  return [...rows].sort((leftRow, rightRow) => {
    if (sortOrder === "az" || sortOrder === "za") {
      const comparison = String(leftRow.disaster_event_title || "").localeCompare(
        String(rightRow.disaster_event_title || ""),
        undefined,
        { sensitivity: "base" },
      );

      return sortOrder === "za" ? -comparison : comparison;
    }

    const leftTime = getSummaryRowTime(leftRow);
    const rightTime = getSummaryRowTime(rightRow);

    if (leftTime !== rightTime) {
      return sortOrder === "oldest" ? leftTime - rightTime : rightTime - leftTime;
    }

    const leftStartTime = new Date(leftRow?.start_date || 0).getTime();
    const rightStartTime = new Date(rightRow?.start_date || 0).getTime();

    if (leftStartTime !== rightStartTime) {
      return sortOrder === "oldest"
        ? leftStartTime - rightStartTime
        : rightStartTime - leftStartTime;
    }

    return 0;
  });
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

const DistributionHistoryPage = () => {
  const { currentRole } = useAuth();
  const isBarangay = currentRole === ROLE_CODES.BARANGAY;

  const [disasterEvents, setDisasterEvents] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [historyRows, setHistoryRows] = useState([]);
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

    const loadHistory = async () => {
      setIsLoadingHistory(true);
      setErrorMessage("");

      try {
        const response = await fetchDistributionHistory({
          ...filters,
          sort_order: sortOrder,
          limit: filters.disaster_event_id ? 500 : 1000,
        });

        if (!isMounted) {
          return;
        }

        setHistoryRows(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        if (isMounted) {
          setHistoryRows([]);
          setErrorMessage(error.message || "Failed to load distribution history.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingHistory(false);
        }
      }
    };

    loadHistory();

    return () => {
      isMounted = false;
    };
  }, [filters, sortOrder]);

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
      setFilters((currentValue) => ({
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

  const visibleHistoryRows = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();

    const filteredRows = normalizedSearchTerm
      ? historyRows.filter((row) => {
          const searchableValues = [
            row.family_head_name,
            row.barangay_name,
            row.sectors_text,
            row.stub_no,
            formatDisplayStubNumber(row),
            row.serial_no,
            row.disaster_event_title,
            row.event_code,
            row.relief_pack_template_name,
            row.released_items_summary,
            row.verified_by_name,
          ];

          return searchableValues.some((value) =>
            String(value || "")
              .toLowerCase()
              .includes(normalizedSearchTerm),
          );
        })
      : historyRows;

    return sortDistributionHistoryRows(filteredRows, sortOrder);
  }, [historyRows, searchTerm, sortOrder]);

  const isSummaryMode = !filters.disaster_event_id;

  const visibleSummaryRows = useMemo(
    () =>
      sortDistributionSummaryRows(
        buildDistributionSummaryRows({
          rows: visibleHistoryRows,
          disasterEvents,
          selectedBarangayId: filters.barangay_id,
        }),
        sortOrder,
      ),
    [visibleHistoryRows, disasterEvents, filters.barangay_id, sortOrder],
  );

  const displayedRows = isSummaryMode ? visibleSummaryRows : visibleHistoryRows;

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

      <section style={shellStyles.card}>
        <div
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
                setFilters((currentValue) => ({
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
                  setFilters((currentValue) => ({
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
                setFilters((currentValue) => ({
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
                setFilters((currentValue) => ({
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
              onChange={(event) => setSortOrder(event.target.value)}
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
        style={{
          ...pageSpacingStyles.toolbar,
        }}
      >
        <div
          style={{
            position: "relative",
            flex: "1 1 420px",
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
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search family head, sectors, or stub number"
            style={{
              ...inputStyles,
              paddingLeft: "44px",
              backgroundColor: "#ffffff",
            }}
          />
        </div>

        <button
          type="button"
          onClick={() => {
            setSelectedExportFormat("csv");
            setExportFilters({
              disaster_event_id: filters.disaster_event_id,
              barangay_id: isBarangay ? "" : filters.barangay_id,
              date_from: filters.date_from,
              date_to: filters.date_to,
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

      <section style={shellStyles.card}>
        <div style={pageSpacingStyles.tableHeader}>
          <h3 style={{ margin: 0, color: "#17324d" }}>Distribution Records</h3>
        </div>

        {errorMessage ? <ErrorState message={errorMessage} style={{ marginBottom: "16px" }} /> : null}

        {isLoadingHistory ? (
          <LoadingState message="Loading distribution history..." />
        ) : displayedRows.length === 0 ? (
          <EmptyState message="No matching records found. Try adjusting your search or filters." />
        ) : isSummaryMode ? (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyles.table}>
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
                {visibleSummaryRows.map((row) => (
                  <tr key={row.id}>
                    <td style={tableStyles.td}>
                      <div>{row.disaster_event_title || "--"}</div>
                    </td>
                    <td style={{ ...tableStyles.td, textAlign: "center", verticalAlign: "middle" }}>
                      <span style={getDisasterEventStatusStyles(row.disaster_event_status)}>
                        {getDisasterEventStatusLabel(row.disaster_event_status)}
                      </span>
                    </td>
                    <td style={tableStyles.td}>
                      <div>{row.barangay_summary}</div>
                      <div style={{ color: "#60738a", fontSize: "12px" }}>
                        Count: {row.barangay_count}
                      </div>
                    </td>
                    <td style={{ ...tableStyles.td, textAlign: "center" }}>
                      {row.issued_stubs_count || 0}
                    </td>
                    <td style={tableStyles.td}>
                      <div>Claimed: {row.claimed_stubs_count || 0}</div>
                      <div style={{ color: "#60738a", fontSize: "12px" }}>
                        Unclaimed: {row.unclaimed_stubs_count || 0}
                      </div>
                    </td>
                    <td style={tableStyles.td}>{row.relief_pack_summary}</td>
                    <td style={tableStyles.td}>
                      {formatDateTime(row.latest_distribution_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyles.table}>
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
                {visibleHistoryRows.map((row) => (
                  <tr key={row.id}>
                    <td style={tableStyles.td}>
                      {row.family_head_name || "--"}
                    </td>
                    {!isBarangay ? (
                      <td style={tableStyles.td}>{row.barangay_name || "--"}</td>
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
                    <td style={tableStyles.td}>
                      {formatOrderedSectorText(row.sectors_text)}
                    </td>
                    <td style={tableStyles.td}>
                      {formatDisplayStubNumber(row)}
                    </td>
                    <td style={tableStyles.td}>
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
                    <td style={tableStyles.td}>
                      {formatDateTime(row.distribution_date)}
                    </td>
                    <td style={tableStyles.td}>{row.verified_by_name || "--"}</td>
                    <td style={{ ...tableStyles.td, textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => handleViewDetails(row)}
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
