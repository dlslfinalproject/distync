import React, { useEffect, useMemo, useState } from "react";
import PageHeader, { pageHeaderStyles } from "../components/layout/PageHeader";
import { shellStyles } from "../components/layout/BarangayLayout";
import { fetchSystemLogReview } from "../features/system-logs/systemLogService";

const filterButtonStyles = (isActive) => ({
  border: "none",
  borderRadius: "999px",
  padding: "10px 16px",
  backgroundColor: isActive ? "#dbe8f6" : "#eef5fc",
  color: isActive ? "#17324d" : "#40617f",
  fontWeight: 700,
  cursor: "pointer",
});

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

const statusStyles = {
  SUCCESS: {
    backgroundColor: "#edf8f1",
    color: "#2f6c47",
  },
  ERROR: {
    backgroundColor: "#fff3f1",
    color: "#9d4d58",
  },
  WARNING: {
    backgroundColor: "#fff6e8",
    color: "#9a6519",
  },
  CRITICAL: {
    backgroundColor: "#fdecec",
    color: "#aa2a2a",
  },
  INFO: {
    backgroundColor: "#eef6ff",
    color: "#2a4c6f",
  },
};

const formatDateTime = (value) => {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
};

const StatusPill = ({ value }) => {
  const normalizedValue = String(value || "INFO").toUpperCase();
  const selectedStyles = statusStyles[normalizedValue] || statusStyles.INFO;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: "92px",
        borderRadius: "999px",
        padding: "6px 10px",
        fontSize: "12px",
        fontWeight: 800,
        letterSpacing: "0.03em",
        ...selectedStyles,
      }}
    >
      {normalizedValue}
    </span>
  );
};

const EmptyState = ({ message }) => (
  <p style={{ margin: 0, color: "#60738a", fontSize: "14px", lineHeight: 1.6 }}>
    {message}
  </p>
);

const SystemLogReviewPage = () => {
  const [activeFilter, setActiveFilter] = useState("all");
  const [reviewData, setReviewData] = useState({
    audit_logs: [],
    error_logs: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadLogs = async (selectedFilter = activeFilter) => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetchSystemLogReview({
        type: selectedFilter,
        limit: 50,
      });

      setReviewData({
        audit_logs: response.audit_logs || [],
        error_logs: response.error_logs || [],
      });
    } catch (error) {
      setErrorMessage(error.message || "Failed to load system logs.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs(activeFilter);
  }, [activeFilter]);

  const summary = useMemo(() => {
    return {
      auditCount: reviewData.audit_logs.length,
      errorCount: reviewData.error_logs.length,
    };
  }, [reviewData]);

  return (
    <>
      <PageHeader
        title="SYSTEM LOG REVIEW"
        description="Review audit and error logs for inventory, donations, households, sync, and forecasting."
      />

      <section style={shellStyles.card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {[
              { key: "all", label: "All" },
              { key: "audit", label: "Audit Logs" },
              { key: "error", label: "Error Logs" },
            ].map((filterOption) => (
              <button
                key={filterOption.key}
                type="button"
                onClick={() => setActiveFilter(filterOption.key)}
                style={filterButtonStyles(activeFilter === filterOption.key)}
              >
                {filterOption.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => loadLogs(activeFilter)}
            style={pageHeaderStyles.secondaryButton}
            disabled={isLoading}
          >
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "12px",
            marginTop: "18px",
          }}
        >
          <div style={{ ...shellStyles.card, marginTop: 0 }}>
            <p style={{ margin: 0, color: "#60738a", fontSize: "13px" }}>
              Audit Entries
            </p>
            <p style={{ margin: "8px 0 0", color: "#17324d", fontSize: "28px", fontWeight: 800 }}>
              {summary.auditCount}
            </p>
          </div>
          <div style={{ ...shellStyles.card, marginTop: 0 }}>
            <p style={{ margin: 0, color: "#60738a", fontSize: "13px" }}>
              Error Entries
            </p>
            <p style={{ margin: "8px 0 0", color: "#17324d", fontSize: "28px", fontWeight: 800 }}>
              {summary.errorCount}
            </p>
          </div>
        </div>
      </section>

      {errorMessage ? (
        <section style={shellStyles.card}>
          <p style={{ margin: 0, color: "#9d4d58", fontWeight: 700 }}>
            {errorMessage}
          </p>
        </section>
      ) : null}

      <section style={shellStyles.card}>
        <h3 style={{ margin: "0 0 16px", color: "#17324d" }}>Audit Logs</h3>

        {isLoading ? (
          <EmptyState message="Loading audit log review..." />
        ) : reviewData.audit_logs.length === 0 ? (
          <EmptyState message="No matching records found. Try adjusting your search or filters." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyles.table}>
              <thead>
                <tr>
                  <th style={tableStyles.th}>Action</th>
                  <th style={tableStyles.th}>Module</th>
                  <th style={tableStyles.th}>Performed By</th>
                  <th style={tableStyles.th}>Timestamp</th>
                  <th style={tableStyles.th}>Status</th>
                  <th style={tableStyles.th}>Details</th>
                </tr>
              </thead>
              <tbody>
                {reviewData.audit_logs.map((entry) => (
                  <tr key={entry.id}>
                    <td style={tableStyles.td}>
                      <strong>{entry.action}</strong>
                    </td>
                    <td style={tableStyles.td}>{entry.module}</td>
                    <td style={tableStyles.td}>
                      <div>{entry.performed_by}</div>
                      {entry.role_code ? (
                        <div style={{ color: "#60738a", fontSize: "12px", marginTop: "4px" }}>
                          {entry.role_code}
                        </div>
                      ) : null}
                    </td>
                    <td style={tableStyles.td}>{formatDateTime(entry.timestamp)}</td>
                    <td style={tableStyles.td}>
                      <StatusPill value={entry.status} />
                    </td>
                    <td style={tableStyles.td}>
                      <div>Updated: {entry.details.changed_fields}</div>
                      <div style={{ color: "#60738a", fontSize: "12px", marginTop: "4px" }}>
                        Previous: {entry.details.previous_fields}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={shellStyles.card}>
        <h3 style={{ margin: "0 0 16px", color: "#17324d" }}>Error Logs</h3>

        {isLoading ? (
          <EmptyState message="Loading error log review..." />
        ) : reviewData.error_logs.length === 0 ? (
          <EmptyState message="No matching records found. Try adjusting your search or filters." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyles.table}>
              <thead>
                <tr>
                  <th style={tableStyles.th}>Action</th>
                  <th style={tableStyles.th}>Module</th>
                  <th style={tableStyles.th}>Performed By</th>
                  <th style={tableStyles.th}>Timestamp</th>
                  <th style={tableStyles.th}>Status</th>
                  <th style={tableStyles.th}>Error Message</th>
                </tr>
              </thead>
              <tbody>
                {reviewData.error_logs.map((entry) => (
                  <tr key={entry.id}>
                    <td style={tableStyles.td}>
                      <strong>{entry.action}</strong>
                    </td>
                    <td style={tableStyles.td}>{entry.module}</td>
                    <td style={tableStyles.td}>{entry.performed_by}</td>
                    <td style={tableStyles.td}>{formatDateTime(entry.timestamp)}</td>
                    <td style={tableStyles.td}>
                      <StatusPill value={entry.status} />
                    </td>
                    <td style={tableStyles.td}>
                      <div>{entry.error_message}</div>
                    </td>
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

export default SystemLogReviewPage;
