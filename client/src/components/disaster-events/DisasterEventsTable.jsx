import React, { useState } from "react";
import { shellStyles } from "../layout/BarangayLayout";
import { pageHeaderStyles } from "../layout/PageHeader";

const tableStyles = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "fixed",
  },
  headerCell: {
    padding: "14px 16px",
    textAlign: "left",
    fontSize: "12px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#66809c",
    borderBottom: "1px solid #e0eaf4",
    whiteSpace: "nowrap",
  },
  bodyCell: {
    padding: "16px",
    color: "#21405f",
    borderBottom: "1px solid #edf3f8",
    fontSize: "14px",
    verticalAlign: "top",
  },
};

const formatDate = (value) => {
  if (!value) {
    return "--";
  }

  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getStatusBadgeStyles = (status) => {
  const paletteByStatus = {
    PLANNED: { backgroundColor: "#eef2f6", color: "#60738a" },
    ACTIVE: { backgroundColor: "#e6f5ec", color: "#2d7a4f" },
    CLOSED: { backgroundColor: "#fff4df", color: "#9a6c11" },
    ARCHIVED: { backgroundColor: "#f6ebeb", color: "#9d4d58" },
  };

  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "84px",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 700,
    ...(paletteByStatus[status] || {
      backgroundColor: "#eef2f6",
      color: "#60738a",
    }),
  };
};

const DisasterEventsTable = ({
  rows,
  isLoading,
  errorMessage,
  onViewEvent,
  onExtendEvent,
  onEndEvent
}) => {
  const [activeMenu, setActiveMenu] = useState(null);
  if (isLoading) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Disaster Events</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          Loading disaster events...
        </p>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Disaster Events</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px", color: "#a14d58" }}>
          {errorMessage}
        </p>
      </section>
    );
  }

  if (rows.length === 0) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Disaster Events</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          No disaster events were found for the current filter.
        </p>
      </section>
    );
  }

  return (
    <section style={shellStyles.card}>
      <div style={{ marginBottom: "18px" }}>
        <h3 style={{ margin: 0, color: "#17324d" }}>Disaster Events</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
          MSWDO event registry with lifecycle status and affected barangay
          coverage.
        </p>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              <th style={tableStyles.headerCell}>Title</th>
              <th style={tableStyles.headerCell}>Disaster Type</th>
              <th style={tableStyles.headerCell}>Affected Barangays</th>
              <th style={tableStyles.headerCell}>Start Date</th>
              <th style={tableStyles.headerCell}>End Date</th>
              <th style={tableStyles.headerCell}>Status</th>
              <th style={tableStyles.headerCell}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={tableStyles.bodyCell}>{row.title}</td>
                <td style={tableStyles.bodyCell}>{row.disaster_type}</td>
                <td style={tableStyles.bodyCell}>
                  {row.affected_barangays?.length || 0}
                </td>
                <td style={tableStyles.bodyCell}>{formatDate(row.start_date)}</td>
                <td style={tableStyles.bodyCell}>{formatDate(row.end_date)}</td>
                <td style={tableStyles.bodyCell}>
                  <span style={getStatusBadgeStyles(row.status)}>{row.status}</span>
                </td>
                <td style={tableStyles.bodyCell}>
                  {row.status === "ACTIVE" ? (
                    <div style={{ position: "relative" }}>
                      {/* THREE DOT BUTTON */}
                      <button
                        onClick={() =>
                          setActiveMenu(activeMenu === row.id ? null : row.id)
                        }
                        style={{
                          background: "none",
                          border: "none",
                          fontSize: "20px",
                          cursor: "pointer",
                        }}
                      >
                        •••
                      </button>

                      {/* DROPDOWN */}
                      {activeMenu === row.id && (
                        <div
                          style={{
                            position: "absolute",
                            top: "30px",
                            right: 0,
                            background: "#fff",
                            borderRadius: "10px",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                            padding: "10px",
                            zIndex: 10,
                            minWidth: "160px",
                          }}
                        >
                          <div
                            style={{ padding: "8px", cursor: "pointer" }}
                            onClick={() => {
                              onExtendEvent(row);
                              setActiveMenu(null);
                            }}
                          >
                            Extend Period
                          </div>

                          <div
                            style={{ padding: "8px", cursor: "pointer" }}
                            onClick={() => {
                              onEndEvent(row);
                              setActiveMenu(null);
                            }}
                          >
                            Mark as Completed
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span style={{ color: "#9aa9b8", fontSize: "13px" }}>
                      —
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default DisasterEventsTable;
