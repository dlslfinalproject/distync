import React, { useEffect, useState } from "react";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import EmptyState from "../../components/shared/EmptyState";
import ErrorState from "../../components/shared/ErrorState";
import ExportModal from "../../components/shared/ExportModal";
import FeedbackToast from "../../components/shared/FeedbackToast";
import LoadingState from "../../components/shared/LoadingState";
import {
  fetchBarangays,
  fetchAllDisasterEvents,
} from "../../features/disaster-events/disasterEventService";
import {
  exportStubClaimHistory,
  fetchStubClaimHistory,
} from "../../features/stubs/stubService";
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

const StubClaimHistoryPage = () => {
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
            error.message || "Failed to load stub claim history filters.",
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
        const response = await fetchStubClaimHistory({
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
            error.message || "Failed to load stub claim history.",
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
        title="STUB / CLAIM HISTORY"
        description="Review issued, claimed, and still-unclaimed stub records without changing the existing claim workflow."
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
            <label htmlFor="stub-history-event" style={labelStyles}>
              Disaster Event
            </label>
            <select
              id="stub-history-event"
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
            <label htmlFor="stub-history-barangay" style={labelStyles}>
              Barangay
            </label>
            <select
              id="stub-history-barangay"
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
            <label htmlFor="stub-history-status" style={labelStyles}>
              Status
            </label>
            <select
              id="stub-history-status"
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
              <option value="CLAIMED">Claimed</option>
              <option value="UNCLAIMED">Unclaimed</option>
              <option value="INVALID">Invalid / Voided</option>
            </select>
          </div>

          <div>
            <label htmlFor="stub-history-date-from" style={labelStyles}>
              Date From
            </label>
            <input
              id="stub-history-date-from"
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
            <label htmlFor="stub-history-date-to" style={labelStyles}>
              Date To
            </label>
            <input
              id="stub-history-date-to"
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
          <h3 style={{ margin: 0, color: "#17324d" }}>Stub and Claim Records</h3>
          <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
            Includes issued stubs, claimed stubs, and currently unclaimed records.
            Failed verification and duplicate claim attempts appear in anomaly tracking
            when they are captured by system logs.
          </p>
        </div>

        {errorMessage ? <ErrorState message={errorMessage} style={{ marginBottom: "16px" }} /> : null}

        {isLoadingRows ? (
          <LoadingState message="Loading stub and claim history..." />
        ) : rows.length === 0 ? (
          <EmptyState message="No stub or claim history is available for the current filters." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyles.table}>
              <thead>
                <tr>
                  <th style={tableStyles.th}>Household / Family Head</th>
                  <th style={tableStyles.th}>Barangay</th>
                  <th style={tableStyles.th}>Disaster Event</th>
                  <th style={tableStyles.th}>Stub / QR</th>
                  <th style={tableStyles.th}>Claim Status</th>
                  <th style={tableStyles.th}>Relief Item / Pack</th>
                  <th style={tableStyles.th}>Claimed / Recorded By</th>
                  <th style={tableStyles.th}>Date / Time</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td style={tableStyles.td}>
                      <div style={{ fontWeight: 700 }}>{row.family_head_name || "--"}</div>
                      <div style={{ color: "#60738a", fontSize: "12px" }}>
                        Household ID: {row.household_id || "--"}
                      </div>
                    </td>
                    <td style={tableStyles.td}>{row.barangay_name || "--"}</td>
                    <td style={tableStyles.td}>
                      <div>{row.event_code || "--"}</div>
                      <div style={{ color: "#60738a", fontSize: "12px" }}>
                        {row.disaster_event_title || "--"}
                      </div>
                    </td>
                    <td style={tableStyles.td}>
                      <div>Stub: {row.stub_no || "--"}</div>
                      <div style={{ color: "#60738a", fontSize: "12px" }}>
                        QR: {row.qr_code_value || "--"}
                      </div>
                    </td>
                    <td style={tableStyles.td}>
                      <div style={{ fontWeight: 700 }}>
                        {row.status === "CLAIMED"
                          ? "Claimed"
                          : row.status === "ISSUED"
                            ? "Unclaimed"
                            : row.status || "--"}
                      </div>
                      <div style={{ color: "#60738a", fontSize: "12px" }}>
                        Receipt: {row.receipt_no || "--"}
                      </div>
                    </td>
                    <td style={tableStyles.td}>
                      {row.relief_pack_template_name || row.released_items_summary || "--"}
                    </td>
                    <td style={tableStyles.td}>
                      <div>Claimed: {row.claimed_by_name || "--"}</div>
                      <div style={{ color: "#60738a", fontSize: "12px" }}>
                        Recorded by: {row.recorded_by_name || "--"}
                      </div>
                    </td>
                    <td style={tableStyles.td}>
                      {formatDateTime(
                        row.distribution_date || row.claimed_at || row.issued_at,
                      )}
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
        description="Choose the stub and claim history format to generate."
        reportOptions={[
          {
            value: "STUB_CLAIM_HISTORY",
            label: "Stub / Claim History",
          },
        ]}
        formatOptions={COMMON_EXPORT_FORMAT_OPTIONS}
        selectedReportType="STUB_CLAIM_HISTORY"
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
            const file = await exportStubClaimHistory({
              ...filters,
              format: selectedExportFormat,
            });

            downloadExportFile(file);
            setExportFeedback({
              type: "success",
              message: buildExportSuccessMessage("Stub and claim history report"),
            });
          } catch (error) {
            setExportFeedback({
              type: "error",
              message: resolveExportErrorMessage(
                error,
                "Unable to export stub and claim history.",
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

export default StubClaimHistoryPage;
