import React, { useEffect, useMemo, useState } from "react";
import PageHeader, { pageHeaderStyles } from "../components/layout/PageHeader";
import { shellStyles } from "../components/layout/BarangayLayout";
import { useAuth } from "../context/AuthContext";
import { ROLE_CODES } from "../utils/roleSession";
import {
  fetchDistributionHistory,
  exportDistributionHistory,
  updateDistributionLifecycle,
} from "../features/distribution/distributionService";
import {
  fetchAllDisasterEvents,
  fetchBarangays,
} from "../features/disaster-events/disasterEventService";
import ExportModal from "../components/shared/ExportModal";
import FeedbackToast from "../components/shared/FeedbackToast";
import DistributionLifecycleModal from "../components/distribution/DistributionLifecycleModal";
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

const statusBadgeStyles = (status) => {
  if (status === "CLAIMED") {
    return {
      backgroundColor: "#dcfce7",
      color: "#15803d",
    };
  }

  if (status === "CANCELLED") {
    return {
      backgroundColor: "#fee2e2",
      color: "#b91c1c",
    };
  }

  if (status === "REVERSED") {
    return {
      backgroundColor: "#fef3c7",
      color: "#b45309",
    };
  }

  return {
    backgroundColor: "#e2e8f0",
    color: "#475569",
  };
};

const StatusBadge = ({ status }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      borderRadius: "999px",
      padding: "4px 10px",
      fontSize: "12px",
      fontWeight: 700,
      ...statusBadgeStyles(status),
    }}
  >
    {status || "--"}
  </span>
);

const DistributionHistoryPage = () => {
  const { currentRole } = useAuth();
  const isBarangay = currentRole === ROLE_CODES.BARANGAY;
  const isMayor = currentRole === ROLE_CODES.MAYOR;
  const isMswdo = currentRole === ROLE_CODES.MSWDO;

  const [disasterEvents, setDisasterEvents] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [historyRows, setHistoryRows] = useState([]);
  const [filters, setFilters] = useState({
    disaster_event_id: "",
    barangay_id: "",
    status: "",
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
  const [actionFeedback, setActionFeedback] = useState({
    type: "",
    title: "",
    message: "",
  });
  const [lifecycleModalMode, setLifecycleModalMode] = useState("");
  const [selectedHistoryRow, setSelectedHistoryRow] = useState(null);
  const [lifecycleRemarks, setLifecycleRemarks] = useState("");
  const [isSubmittingLifecycleAction, setIsSubmittingLifecycleAction] =
    useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadFilterData = async () => {
      setIsLoadingFilters(true);

      try {
        const [eventRows, barangayRows] = await Promise.all([
          fetchAllDisasterEvents(),
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

  const pageDescription = useMemo(() => {
    if (isBarangay) {
      return "Review distribution records for your assigned barangay, including household, stub, pack, release details, and guarded correction actions.";
    }

    if (isMayor) {
      return "Review read-only disaster distribution records across barangays for monitoring and oversight.";
    }

    return "Review disaster distribution records across barangays, including stub claims, item releases, and guarded correction actions.";
  }, [isBarangay, isMayor]);

  const canManageLifecycle = !isMayor;

  const openLifecycleModal = (mode, row) => {
    setSelectedHistoryRow(row);
    setLifecycleModalMode(mode);
    setLifecycleRemarks("");
    setActionFeedback({ type: "", title: "", message: "" });
  };

  const closeLifecycleModal = (force = false) => {
    if (isSubmittingLifecycleAction && !force) {
      return;
    }

    setLifecycleModalMode("");
    setSelectedHistoryRow(null);
    setLifecycleRemarks("");
  };

  const handleLifecycleSubmit = async () => {
    if (!selectedHistoryRow || !lifecycleModalMode) {
      return;
    }

    if (!lifecycleRemarks.trim()) {
      setActionFeedback({
        type: "error",
        title: "Action Error",
        message: "Remarks are required before cancelling or reversing a distribution.",
      });
      return;
    }

    setIsSubmittingLifecycleAction(true);

    try {
      const response = await updateDistributionLifecycle({
        transactionId: selectedHistoryRow.id,
        action: lifecycleModalMode === "reverse" ? "REVERSED" : "CANCELLED",
        remarks: lifecycleRemarks.trim(),
      });

      const updatedRow = response?.data || {};

      setHistoryRows((currentRows) =>
        currentRows.map((row) =>
          row.id === selectedHistoryRow.id
            ? {
                ...row,
                distribution_status:
                  updatedRow.distribution_status || row.distribution_status,
                receipt_status: updatedRow.receipt_status || row.receipt_status,
                remarks: updatedRow.remarks || row.remarks,
              }
            : row,
        ),
      );

      setActionFeedback({
        type: "success",
        title: "Distribution Updated",
        message:
          lifecycleModalMode === "reverse"
            ? "Distribution reversed successfully."
            : "Distribution cancelled successfully.",
      });
      closeLifecycleModal(true);
    } catch (error) {
      setActionFeedback({
        type: "error",
        title: "Action Error",
        message:
          error.message || "Failed to update the selected distribution record.",
      });
    } finally {
      setIsSubmittingLifecycleAction(false);
    }
  };

  return (
    <>
      <PageHeader
        title="DISTRIBUTION HISTORY"
        description={pageDescription}
        actions={[]}
      />

      <section
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
          marginBottom: "16px",
        }}
      >
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

        <button
          type="button"
          onClick={() => setFilters((currentValue) => ({ ...currentValue }))}
          style={pageHeaderStyles.secondaryButton}
        >
          Refresh
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
                }))
              }
              disabled={isLoadingFilters}
              style={inputStyles}
            >
              <option value="">All disaster events</option>
              {disasterEvents.map((eventRow) => (
                <option key={eventRow.id} value={eventRow.id}>
                  {eventRow.event_code} - {eventRow.title}
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
                {barangays.map((barangay) => (
                  <option key={barangay.id} value={barangay.id}>
                    {barangay.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div>
            <label htmlFor="distribution-history-status" style={labelStyles}>
              Status
            </label>
            <select
              id="distribution-history-status"
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
              <option value="CANCELLED">Cancelled</option>
              <option value="REVERSED">Reversed</option>
            </select>
          </div>

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
        </div>
      </section>

      <section style={shellStyles.card}>
        <div style={{ marginBottom: "16px" }}>
          <h3 style={{ margin: 0, color: "#17324d" }}>Distribution Records</h3>
          <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
            Read-only history of claimed and recorded disaster distributions.
          </p>
        </div>

        {errorMessage ? (
          <div
            style={{
              marginBottom: "16px",
              padding: "14px 16px",
              borderRadius: "14px",
              backgroundColor: "#fff3f1",
              border: "1px solid #f1d2cc",
              color: "#9d4d58",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            {errorMessage}
          </div>
        ) : null}

        {isLoadingHistory ? (
          <p style={shellStyles.mutedText}>Loading distribution history...</p>
        ) : historyRows.length === 0 ? (
          <p style={shellStyles.mutedText}>
            No distribution history is available for the current filters.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyles.table}>
              <thead>
                <tr>
                  <th style={tableStyles.th}>Household / Family Head</th>
                  <th style={tableStyles.th}>Stub / QR</th>
                  <th style={tableStyles.th}>Disaster Event</th>
                  <th style={tableStyles.th}>Relief Item / Pack</th>
                  <th style={tableStyles.th}>Quantity</th>
                  <th style={tableStyles.th}>Claimed / Recorded By</th>
                  <th style={tableStyles.th}>Barangay</th>
                  <th style={tableStyles.th}>Status</th>
                  <th style={tableStyles.th}>Date / Time</th>
                  <th style={tableStyles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map((row) => (
                  <tr key={row.id}>
                    <td style={tableStyles.td}>
                      <div style={{ fontWeight: 700 }}>{row.family_head_name || "--"}</div>
                      <div style={{ color: "#60738a", fontSize: "12px" }}>
                        Household ID: {row.household_id || "--"}
                      </div>
                    </td>
                    <td style={tableStyles.td}>
                      <div>Stub: {row.stub_no || "--"}</div>
                      <div style={{ color: "#60738a", fontSize: "12px" }}>
                        QR: {row.qr_reference_value || row.serial_no || "--"}
                      </div>
                    </td>
                    <td style={tableStyles.td}>
                      <div>{row.event_code || "--"}</div>
                      <div style={{ color: "#60738a", fontSize: "12px" }}>
                        {row.disaster_event_title || "--"}
                      </div>
                    </td>
                    <td style={tableStyles.td}>
                      <div>{row.relief_pack_template_name || row.released_items_summary || "--"}</div>
                      <div style={{ color: "#60738a", fontSize: "12px" }}>
                        {row.relief_pack_template_name && row.released_items_summary
                          ? row.released_items_summary
                          : row.relief_pack_template_name
                            ? "Pack-based release"
                            : "Item-based release"}
                      </div>
                    </td>
                    <td style={tableStyles.td}>{row.total_quantity_released || 0}</td>
                    <td style={tableStyles.td}>
                      <div>Claimed: {row.claimed_by_name || "--"}</div>
                      <div style={{ color: "#60738a", fontSize: "12px" }}>
                        Recorded by: {row.verified_by_name || "--"}
                      </div>
                    </td>
                    <td style={tableStyles.td}>{row.barangay_name || "--"}</td>
                    <td style={tableStyles.td}>
                      <StatusBadge status={row.distribution_status} />
                      <div style={{ color: "#60738a", fontSize: "12px", marginTop: "6px" }}>
                        Receipt: {row.receipt_status || "--"}
                      </div>
                    </td>
                    <td style={tableStyles.td}>
                      <div>{formatDateTime(row.distribution_date)}</div>
                      <div style={{ color: "#60738a", fontSize: "12px" }}>
                        Receipt: {row.receipt_no || "--"}
                      </div>
                    </td>
                    <td style={tableStyles.td}>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "8px",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => openLifecycleModal("view", row)}
                          style={pageHeaderStyles.secondaryButton}
                        >
                          View Reason / Status
                        </button>
                        {canManageLifecycle &&
                        row.distribution_status === "CLAIMED" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openLifecycleModal("cancel", row)}
                              style={pageHeaderStyles.secondaryButton}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => openLifecycleModal("reverse", row)}
                              style={pageHeaderStyles.primaryButton}
                            >
                              Reverse
                            </button>
                          </>
                        ) : null}
                      </div>
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

      <FeedbackToast
        type={actionFeedback.type}
        title={actionFeedback.title}
        message={actionFeedback.message}
        onClose={() =>
          setActionFeedback({ type: "", title: "", message: "" })
        }
      />

      <DistributionLifecycleModal
        mode={lifecycleModalMode}
        isOpen={Boolean(lifecycleModalMode && selectedHistoryRow)}
        isSubmitting={isSubmittingLifecycleAction}
        remarks={lifecycleRemarks}
        onChangeRemarks={setLifecycleRemarks}
        row={selectedHistoryRow}
        onCancel={closeLifecycleModal}
        onConfirm={handleLifecycleSubmit}
      />
    </>
  );
};

export default DistributionHistoryPage;
