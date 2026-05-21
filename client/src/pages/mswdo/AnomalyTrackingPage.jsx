import React, { useEffect, useState } from "react";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import EmptyState from "../../components/shared/EmptyState";
import ErrorState from "../../components/shared/ErrorState";
import LoadingState from "../../components/shared/LoadingState";
import {
  fetchAllDisasterEvents,
  fetchBarangays,
} from "../../features/disaster-events/disasterEventService";
import { fetchMswdoAnomalies } from "../../features/mswdo-reports/mswdoReportService";

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

const AnomalyTrackingPage = () => {
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
          setErrorMessage(error.message || "Failed to load anomaly filters.");
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
        const response = await fetchMswdoAnomalies({
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
          setErrorMessage(error.message || "Failed to load anomalies.");
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
        title="ANOMALY TRACKING"
        description="Review suspicious distribution activity, sync-related anomalies, and any captured duplicate or failed verification signals."
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
            <label htmlFor="anomaly-event" style={labelStyles}>
              Disaster Event
            </label>
            <select
              id="anomaly-event"
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
            <label htmlFor="anomaly-barangay" style={labelStyles}>
              Barangay
            </label>
            <select
              id="anomaly-barangay"
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
            <label htmlFor="anomaly-status" style={labelStyles}>
              Status
            </label>
            <select
              id="anomaly-status"
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
              <option value="OPEN">Open</option>
              <option value="FAILED">Failed</option>
              <option value="ERROR">Error</option>
              <option value="WARNING">Warning</option>
            </select>
          </div>

          <div>
            <label htmlFor="anomaly-date-from" style={labelStyles}>
              Date From
            </label>
            <input
              id="anomaly-date-from"
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
            <label htmlFor="anomaly-date-to" style={labelStyles}>
              Date To
            </label>
            <input
              id="anomaly-date-to"
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
          <h3 style={{ margin: 0, color: "#17324d" }}>Operational Anomalies</h3>
          <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
            Duplicate claim attempts and failed QR or stub verification appear here
            when they are captured by system logs. Sync anomalies and suspicious
            multiple distributions are surfaced directly from current records.
          </p>
        </div>

        {errorMessage ? <ErrorState message={errorMessage} style={{ marginBottom: "16px" }} /> : null}

        {isLoadingRows ? (
          <LoadingState message="Loading anomaly tracking..." />
        ) : rows.length === 0 ? (
          <EmptyState message="No anomalies are available for the current filters." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyles.table}>
              <thead>
                <tr>
                  <th style={tableStyles.th}>Type</th>
                  <th style={tableStyles.th}>Disaster Event</th>
                  <th style={tableStyles.th}>Barangay / Household</th>
                  <th style={tableStyles.th}>Reason</th>
                  <th style={tableStyles.th}>Status</th>
                  <th style={tableStyles.th}>Resolution</th>
                  <th style={tableStyles.th}>Date / Time</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.anomaly_type}-${row.reference_id}`}>
                    <td style={tableStyles.td}>{row.anomaly_type || "--"}</td>
                    <td style={tableStyles.td}>
                      <div>{row.event_code || "--"}</div>
                      <div style={{ color: "#60738a", fontSize: "12px" }}>
                        {row.disaster_event_title || "--"}
                      </div>
                    </td>
                    <td style={tableStyles.td}>
                      <div>{row.barangay_name || "--"}</div>
                      <div style={{ color: "#60738a", fontSize: "12px" }}>
                        {row.family_head_name || "No household reference"}
                      </div>
                    </td>
                    <td style={tableStyles.td}>{row.anomaly_reason || "--"}</td>
                    <td style={tableStyles.td}>{row.status || "--"}</td>
                    <td style={tableStyles.td}>{row.resolution_status || "--"}</td>
                    <td style={tableStyles.td}>{formatDateTime(row.occurred_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
};

export default AnomalyTrackingPage;
