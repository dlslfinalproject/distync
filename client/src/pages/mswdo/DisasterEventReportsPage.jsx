import React, { useEffect, useState } from "react";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import EmptyState from "../../components/shared/EmptyState";
import ErrorState from "../../components/shared/ErrorState";
import ExportModal from "../../components/shared/ExportModal";
import FeedbackToast from "../../components/shared/FeedbackToast";
import LoadingState from "../../components/shared/LoadingState";
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

const formatDate = (value) => {
  if (!value) {
    return "--";
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return "--";
  }

  return parsedDate.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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
  });
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [isLoadingRows, setIsLoadingRows] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedExportFormat, setSelectedExportFormat] = useState("csv");
  const [exportingFormat, setExportingFormat] = useState("");
  const [exportFeedback, setExportFeedback] = useState({
    type: "",
    message: "",
  });

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
          ...filters,
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
  }, [filters]);

  return (
    <>
      <PageHeader
        title="DISASTER EVENT REPORTS"
        description="Review disaster event summaries, affected barangays, registered households, and distribution coverage without changing the event workflow."
        actions={[]}
      />

      <section
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "12px",
          flexWrap: "wrap",
          marginBottom: "16px",
        }}
      >
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
      </section>

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
                  {row.event_code} - {row.title}
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
              {barangays.map((row) => (
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
                setFilters((currentValue) => ({
                  ...currentValue,
                  status: event.target.value,
                }))
              }
              style={inputStyles}
            >
              <option value="">All statuses</option>
              <option value="PLANNED">Planned</option>
              <option value="ACTIVE">Active</option>
              <option value="CLOSED">Closed</option>
              <option value="ARCHIVED">Archived</option>
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
                setFilters((currentValue) => ({
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
                setFilters((currentValue) => ({
                  ...currentValue,
                  date_to: event.target.value,
                }))
              }
              style={inputStyles}
            />
          </div>
        </div>
      </section>

      <section style={shellStyles.card}>
        <div style={{ marginBottom: "16px" }}>
          <h3 style={{ margin: 0, color: "#17324d" }}>Disaster Event Summary</h3>
          <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
            Event-level summary of affected barangays, registered households,
            distributed aid, and claim status coverage.
          </p>
        </div>

        {errorMessage ? <ErrorState message={errorMessage} style={{ marginBottom: "16px" }} /> : null}

        {isLoadingRows ? (
          <LoadingState message="Loading disaster event reports..." />
        ) : rows.length === 0 ? (
          <EmptyState message="No disaster event reports are available yet." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyles.table}>
              <thead>
                <tr>
                  <th style={tableStyles.th}>Disaster Event</th>
                  <th style={tableStyles.th}>Affected Barangays</th>
                  <th style={tableStyles.th}>Registered Households</th>
                  <th style={tableStyles.th}>Distributed Aid Count</th>
                  <th style={tableStyles.th}>Claim Status Summary</th>
                  <th style={tableStyles.th}>Quantity Released</th>
                  <th style={tableStyles.th}>Status</th>
                  <th style={tableStyles.th}>Period</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td style={tableStyles.td}>
                      <div style={{ fontWeight: 700 }}>
                        {[row.event_code, row.title].filter(Boolean).join(" - ") || "--"}
                      </div>
                      <div style={{ color: "#60738a", fontSize: "12px" }}>
                        {row.disaster_type || "--"}
                      </div>
                    </td>
                    <td style={tableStyles.td}>
                      <div>{row.affected_barangays_text || "--"}</div>
                      <div style={{ color: "#60738a", fontSize: "12px" }}>
                        Count: {row.affected_barangays_count || 0}
                      </div>
                    </td>
                    <td style={tableStyles.td}>{row.registered_households_count || 0}</td>
                    <td style={tableStyles.td}>{row.distributed_aid_count || 0}</td>
                    <td style={tableStyles.td}>
                      <div>Claimed: {row.claimed_stubs_count || 0}</div>
                      <div style={{ color: "#60738a", fontSize: "12px" }}>
                        Unclaimed: {row.unclaimed_stubs_count || 0}
                      </div>
                    </td>
                    <td style={tableStyles.td}>{row.quantity_released_total || 0}</td>
                    <td style={tableStyles.td}>{row.status || "--"}</td>
                    <td style={tableStyles.td}>
                      {formatDate(row.start_date)} - {formatDate(row.end_date)}
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
        title="Export MSWDO Report"
        description="Choose the disaster event summary format to generate."
        reportOptions={[
          {
            value: "DISASTER_EVENT_SUMMARY",
            label: "Disaster Event Summary",
          },
        ]}
        formatOptions={COMMON_EXPORT_FORMAT_OPTIONS}
        selectedReportType="DISASTER_EVENT_SUMMARY"
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
          if (!rows.length) {
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
            const file = await exportDisasterEventReportSummary({
              ...filters,
              format: selectedExportFormat,
            });

            downloadExportFile(file);
            setExportFeedback({
              type: "success",
              message: buildExportSuccessMessage("Disaster event summary report"),
            });
          } catch (error) {
            setExportFeedback({
              type: "error",
              message: resolveExportErrorMessage(
                error,
                "Unable to export disaster event summary.",
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
    </>
  );
};

export default DisasterEventReportsPage;
