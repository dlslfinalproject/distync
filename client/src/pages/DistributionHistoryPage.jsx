import React, { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/layout/PageHeader";
import { shellStyles } from "../components/layout/BarangayLayout";
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
import { FiEye, FiSearch } from "react-icons/fi";
import { formatOrderedSectorText } from "../utils/sectorDisplay";
import {
  buildExportSuccessMessage,
  COMMON_EXPORT_FORMAT_OPTIONS,
  downloadExportFile,
  NO_EXPORT_DATA_MESSAGE,
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
  const isMswdo = currentRole === ROLE_CODES.MSWDO;

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
          limit: 100,
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
  }, [filters]);

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
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            alignItems: "end",
          }}
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
          display: "flex",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
          margin: "18px 0",
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

        {isMswdo ? (
          <button
            type="button"
            onClick={() => {
              setSelectedExportFormat("csv");
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
            }}
          >
            {exportingFormat
              ? `Exporting ${exportingFormat.toUpperCase()}...`
              : "Export"}
          </button>
        ) : null}
      </section>

      <section style={shellStyles.card}>
        <div style={{ marginBottom: "16px" }}>
          <h3 style={{ margin: 0, color: "#17324d" }}>Distribution Records</h3>
        </div>

        {errorMessage ? <ErrorState message={errorMessage} style={{ marginBottom: "16px" }} /> : null}

        {isLoadingHistory ? (
          <LoadingState message="Loading distribution history..." />
        ) : visibleHistoryRows.length === 0 ? (
          <EmptyState message="No matching records found. Try adjusting your search or filters." />
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
        description="Choose the distribution history format to generate."
        reportOptions={[
          {
            value: "DISTRIBUTION_HISTORY",
            label: "Distribution History",
          },
        ]}
        formatOptions={COMMON_EXPORT_FORMAT_OPTIONS}
        selectedReportType="DISTRIBUTION_HISTORY"
        selectedFormat={selectedExportFormat}
        isSubmitting={Boolean(exportingFormat)}
        onReportTypeChange={() => {}}
        onFormatChange={setSelectedExportFormat}
        onClose={() => {
          if (!exportingFormat) {
            setIsExportModalOpen(false);
          }
        }}
        onSubmit={async () => {
          if (!historyRows.length) {
            setIsExportModalOpen(false);
            setExportFeedback({
              type: "error",
              message: NO_EXPORT_DATA_MESSAGE,
            });
            return;
          }

          setExportingFormat(selectedExportFormat);
          setIsExportModalOpen(false);

          try {
            const file = await exportDistributionHistory({
              ...filters,
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
      />

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
