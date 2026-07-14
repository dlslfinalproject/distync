import React, { useEffect, useMemo, useState } from "react";
import { FiFileText, FiX } from "react-icons/fi";
import PageHeader, { pageHeaderStyles } from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import EmptyState from "../../components/shared/EmptyState";
import ErrorState from "../../components/shared/ErrorState";
import FeedbackToast from "../../components/shared/FeedbackToast";
import LoadingState from "../../components/shared/LoadingState";
import SearchBar from "../../components/shared/SearchBar";
import {
  exportDisasterEventReportSummary,
  fetchAllDisasterEvents,
  fetchBarangays,
  fetchDisasterEventReportSummary,
} from "../../features/disaster-events/disasterEventService";
import {
  buildExportSuccessMessage,
  COMMON_EXPORT_FORMAT_OPTIONS,
  downloadExportFile,
  NO_EXPORT_DATA_MESSAGE,
  resolveExportErrorMessage,
} from "../../utils/exportHelpers";

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

const overlayStyles = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(21, 40, 63, 0.48)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  zIndex: 1300,
};

const modalStyles = {
  width: "min(860px, 100%)",
  maxHeight: "90vh",
  overflowY: "auto",
  backgroundColor: "#eef5fb",
  borderRadius: "22px",
  border: "1px solid #d7e2ef",
  boxShadow: "0 24px 60px rgba(23, 50, 77, 0.18)",
  padding: "24px",
  boxSizing: "border-box",
};

const sectionTitleStyles = {
  margin: "0 0 12px",
  color: "#17324d",
};

const toolbarStyles = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  flexWrap: "wrap",
};

const exportButtonStyles = (isDisabled) => ({
  ...pageHeaderStyles.secondaryButton,
  cursor: isDisabled ? "not-allowed" : "pointer",
  opacity: isDisabled ? 0.65 : 1,
});

const exportFilterGridStyles = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "16px",
};

const tableStyles = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "fixed",
  },
  th: {
    padding: "12px 14px",
    textAlign: "left",
    fontSize: "12px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#66809c",
    borderBottom: "1px solid #e0eaf4",
    whiteSpace: "normal",
    lineHeight: 1.35,
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

const centeredColumnStyles = {
  textAlign: "center",
  verticalAlign: "middle",
};

const headerLabelStyles = {
  display: "inline-flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "2px",
  lineHeight: 1.25,
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
    width: "11%",
  },
  distributedAid: {
    width: "11%",
  },
  claimStatus: {
    width: "12%",
  },
  quantityReleased: {
    width: "8%",
  },
};

const SORT_OPTIONS = [
  { value: "newest", label: "Newest-Oldest" },
  { value: "oldest", label: "Oldest-Newest" },
  { value: "az", label: "Sort A-Z" },
  { value: "za", label: "Sort Z-A" },
];

const sortSummaryRows = (summaryRows, sortOrder = "newest") =>
  [...summaryRows].sort((leftRow, rightRow) => {
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
      return sortOrder === "za"
        ? rightTitle.localeCompare(leftTitle)
        : leftTitle.localeCompare(rightTitle);
    }

    const leftBarangay = String(
      leftRow?.barangay_name || leftRow?.affected_barangays_text || "",
    )
      .trim()
      .toUpperCase();
    const rightBarangay = String(
      rightRow?.barangay_name || rightRow?.affected_barangays_text || "",
    )
      .trim()
      .toUpperCase();

    return leftBarangay.localeCompare(rightBarangay);
  });

const formatDisasterEventTitle = (event) =>
  String(event?.title || "").trim() || "--";

const normalizeSearchText = (value) => String(value || "").trim().toLowerCase();

const doesRowMatchSearch = (row, searchTerm) => {
  const normalizedSearch = normalizeSearchText(searchTerm);

  if (!normalizedSearch) {
    return true;
  }

  const searchableText = [
    formatDisasterEventTitle(row),
    row.disaster_type,
    row.barangay_name,
    row.affected_barangays_text,
  ]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");

  return searchableText.includes(normalizedSearch);
};

const renderStackedHeader = (firstLine, secondLine) => (
  <span style={headerLabelStyles}>
    <span>{firstLine}</span>
    <span>{secondLine}</span>
  </span>
);

const getDisasterEventStatusLabel = (status) =>
  String(status || "").toUpperCase() === "ACTIVE" ? "Active" : "Ended";

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

const DisasterEventReportsPage = () => {
  const [disasterEvents, setDisasterEvents] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({
    disaster_event_id: "",
    barangay_id: "",
    sort_order: "newest",
  });
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [isLoadingRows, setIsLoadingRows] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [exportFeedback, setExportFeedback] = useState({
    type: "",
    message: "",
  });
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedExportFormat, setSelectedExportFormat] = useState("csv");
  const [selectedExportDisasterEventId, setSelectedExportDisasterEventId] =
    useState("");
  const [selectedExportSortOrder, setSelectedExportSortOrder] =
    useState("newest");
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadFilters = async () => {
      setIsLoadingFilters(true);

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
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            error.message || "Failed to load disaster report filters.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingFilters(false);
        }
      }
    };

    loadFilters();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadRows = async () => {
      setIsLoadingRows(true);
      setErrorMessage("");

      try {
        const response = await fetchDisasterEventReportSummary({
          disaster_event_id: filters.disaster_event_id,
          barangay_id: filters.barangay_id,
          sort_order: filters.sort_order,
          limit: 100,
        });

        if (!isMounted) {
          return;
        }

        setRows(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        if (isMounted) {
          setRows([]);
          setErrorMessage(
            error.message || "Failed to load disaster event reports.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingRows(false);
        }
      }
    };

    loadRows();

    return () => {
      isMounted = false;
    };
  }, [filters.disaster_event_id, filters.barangay_id, filters.sort_order]);

  const sortedRows = useMemo(
    () => sortSummaryRows(rows, filters.sort_order),
    [rows, filters.sort_order],
  );
  const displayedRows = useMemo(
    () => sortedRows.filter((row) => doesRowMatchSearch(row, searchTerm)),
    [searchTerm, sortedRows],
  );
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
  const isExportDisabled = isLoadingRows || rows.length === 0;

  useEffect(() => {
    if (!filters.barangay_id) {
      return;
    }

    const isSelectedBarangayAvailable = selectableBarangays.some(
      (barangay) => barangay.id === filters.barangay_id,
    );

    if (!isSelectedBarangayAvailable) {
      setFilters((currentValue) => ({
        ...currentValue,
        barangay_id: "",
      }));
    }
  }, [filters.barangay_id, selectableBarangays]);

  const openExportModal = () => {
    if (rows.length === 0) {
      setExportFeedback({
        type: "error",
        message: NO_EXPORT_DATA_MESSAGE,
      });
      return;
    }

    setSelectedExportFormat("csv");
    setSelectedExportDisasterEventId("");
    setSelectedExportSortOrder(filters.sort_order);
    setIsExportModalOpen(true);
  };

  const handleExportSummary = async () => {
    setIsExporting(true);

    try {
      const file = await exportDisasterEventReportSummary({
        disaster_event_id: selectedExportDisasterEventId,
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
            <label htmlFor="disaster-report-event" style={labelStyles}>
              Disaster Event
            </label>
            <select
              id="disaster-report-event"
              value={filters.disaster_event_id}
              onChange={(event) =>
                setFilters((currentValue) => ({
                  ...currentValue,
                  disaster_event_id: event.target.value,
                }))
              }
              disabled={isLoadingFilters}
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
                setFilters((currentValue) => ({
                  ...currentValue,
                  barangay_id: event.target.value,
                }))
              }
              disabled={isLoadingFilters}
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
            <label htmlFor="disaster-report-sort-order" style={labelStyles}>
              Order List
            </label>
            <select
              id="disaster-report-sort-order"
              value={filters.sort_order}
              onChange={(event) =>
                setFilters((currentValue) => ({
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

      <div style={toolbarStyles}>
        <div style={{ flex: 1 }}>
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search disaster events name, type, or affected barangays"
          />
        </div>
        <button
          type="button"
          onClick={openExportModal}
          disabled={isExportDisabled}
          style={exportButtonStyles(isExportDisabled)}
        >
          <FiFileText aria-hidden="true" />
          Export
        </button>
      </div>

      <section style={shellStyles.card}>
        <div style={{ marginBottom: "16px" }}>
          <h3 style={{ margin: 0, color: "#17324d" }}>Disaster Events Record</h3>
        </div>

        {errorMessage ? <ErrorState message={errorMessage} style={{ marginBottom: "16px" }} /> : null}

        {isLoadingRows ? (
          <LoadingState message="Loading disaster event reports..." />
        ) : displayedRows.length === 0 ? (
          <EmptyState message="No disaster event reports are available yet." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyles.table}>
              <thead>
                <tr>
                  <th style={{ ...tableStyles.th, ...columnWidthStyles.disasterEvent }}>
                    Disaster Event
                  </th>
                  <th
                    style={{
                      ...tableStyles.th,
                      ...centeredColumnStyles,
                      ...columnWidthStyles.status,
                    }}
                  >
                    Status
                  </th>
                  <th style={{ ...tableStyles.th, ...columnWidthStyles.affectedBarangays }}>
                    {isSpecificDisasterEventSelected ? "Barangay" : "Affected Barangays"}
                  </th>
                  <th
                    style={{
                      ...tableStyles.th,
                      ...centeredColumnStyles,
                      ...columnWidthStyles.registeredHouseholds,
                    }}
                  >
                    {renderStackedHeader("Registered", "Households")}
                  </th>
                  <th
                    style={{
                      ...tableStyles.th,
                      ...centeredColumnStyles,
                      ...columnWidthStyles.distributedAid,
                    }}
                  >
                    {renderStackedHeader("Distributed", "Aid Count")}
                  </th>
                  <th
                    style={{
                      ...tableStyles.th,
                      ...centeredColumnStyles,
                      ...columnWidthStyles.claimStatus,
                    }}
                  >
                    {renderStackedHeader("Claim Status", "Summary")}
                  </th>
                  <th
                    style={{
                      ...tableStyles.th,
                      ...centeredColumnStyles,
                      ...columnWidthStyles.quantityReleased,
                    }}
                  >
                    {renderStackedHeader("Quantity", "Released")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayedRows.map((row) => (
                  <tr key={`${row.id}-${row.barangay_id || "summary"}`}>
                    <td style={{ ...tableStyles.td, ...columnWidthStyles.disasterEvent }}>
                      <div style={{ fontWeight: 700 }}>
                        {formatDisasterEventTitle(row)}
                      </div>
                      <div style={{ color: "#60738a", fontSize: "12px" }}>
                        {row.disaster_type || "--"}
                      </div>
                    </td>
                    <td
                      style={{
                        ...tableStyles.td,
                        ...centeredColumnStyles,
                        ...columnWidthStyles.status,
                      }}
                    >
                      <span style={getDisasterEventStatusStyles(row.status)}>
                        {getDisasterEventStatusLabel(row.status)}
                      </span>
                    </td>
                    <td style={{ ...tableStyles.td, ...columnWidthStyles.affectedBarangays }}>
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
                      style={{
                        ...tableStyles.td,
                        ...centeredColumnStyles,
                        ...columnWidthStyles.registeredHouseholds,
                      }}
                    >
                      {row.registered_households_count || 0}
                    </td>
                    <td
                      style={{
                        ...tableStyles.td,
                        ...centeredColumnStyles,
                        ...columnWidthStyles.distributedAid,
                      }}
                    >
                      {row.distributed_aid_count || 0}
                    </td>
                    <td
                      style={{
                        ...tableStyles.td,
                        ...centeredColumnStyles,
                        ...columnWidthStyles.claimStatus,
                      }}
                    >
                      <div>Claimed: {row.claimed_stubs_count || 0}</div>
                      <div style={{ color: "#60738a", fontSize: "12px" }}>
                        Unclaimed: {row.unclaimed_stubs_count || 0}
                      </div>
                    </td>
                    <td
                      style={{
                        ...tableStyles.td,
                        ...centeredColumnStyles,
                        ...columnWidthStyles.quantityReleased,
                      }}
                    >
                      {row.quantity_released_total || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {isExportModalOpen ? (
        <div style={overlayStyles}>
          <div style={modalStyles}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "16px",
                marginBottom: "20px",
              }}
            >
              <div>
                <h3 style={{ margin: 0, color: "#17324d", fontSize: "26px" }}>
                  Disaster Events Barangay Distribution Report
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !isExporting && setIsExportModalOpen(false)}
                style={pageHeaderStyles.secondaryButton}
                disabled={isExporting}
              >
                <FiX />
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

                <div style={exportFilterGridStyles}>
                  <div>
                    <label htmlFor="summary-export-event" style={labelStyles}>
                      Disaster Event
                    </label>
                    <select
                      id="summary-export-event"
                      value={selectedExportDisasterEventId}
                      onChange={(event) =>
                        setSelectedExportDisasterEventId(event.target.value)
                      }
                      disabled={isExporting}
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
                    <label
                      htmlFor="summary-export-sort-order"
                      style={labelStyles}
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
                    <label htmlFor="summary-export-format" style={labelStyles}>
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
