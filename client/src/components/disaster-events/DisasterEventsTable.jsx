import React, { useState } from "react";
import { shellStyles } from "../layout/BarangayLayout";
import { pageHeaderStyles } from "../layout/PageHeader";
import StatusPill from "../shared/StatusPill";

const tableStyles = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  headerCell: {
    padding: "14px 16px",
    textAlign: "center",
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
    verticalAlign: "middle",
    textAlign: "center",
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

const DisasterEventsTable = ({
  rows,
  isLoading,
  errorMessage,
  onViewEvent,
  onExtendEvent,
  onEndEvent,
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
        <p
          style={{
            ...shellStyles.mutedText,
            marginTop: "10px",
            color: "#a14d58",
          }}
        >
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
      </div>

      <div>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              <th style={{ ...tableStyles.headerCell, textAlign: "left" }}>
                Name
              </th>
              <th style={{ ...tableStyles.headerCell, textAlign: "left" }}>
                Disaster Type
              </th>
              <th style={tableStyles.headerCell}>Affected Barangays</th>
              <th style={tableStyles.headerCell}>Start Date</th>
              <th style={tableStyles.headerCell}>End Date</th>
              <th style={tableStyles.headerCell}>Status</th>
              <th style={tableStyles.headerCell}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} style={{ borderBottom: "1px solid #edf3f8" }}>
                <td style={{ ...tableStyles.bodyCell, textAlign: "left" }}>
                  {row.title}
                </td>

                <td style={{ ...tableStyles.bodyCell, textAlign: "left" }}>
                  {row.disaster_type}
                </td>

                <td style={tableStyles.bodyCell}>
                  {row.affected_barangays?.length ? (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "6px",
                        maxWidth: "220px",
                        justifyContent: "center",
                      }}
                    >
                      {row.affected_barangays.map((brgy, index) => (
                        <span
                          key={index}
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
                            whiteSpace: "nowrap",
                          }}
                        >
                          {brgy.name || brgy}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ color: "#9aa9b8" }}>—</span>
                  )}
                </td>
                <td style={tableStyles.bodyCell}>
                  {formatDate(row.start_date)}
                </td>
                <td style={tableStyles.bodyCell}>{formatDate(row.end_date)}</td>
                <td style={tableStyles.bodyCell}>
                  <StatusPill status={row.status} />
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
