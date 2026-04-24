import React, { useState } from "react";
import { shellStyles } from "../layout/BarangayLayout";
import StatusPill from "../shared/StatusPill";
import { FiCalendar, FiCheckCircle, FiMoreHorizontal } from "react-icons/fi";
import {
  formatDisasterEventDate,
  getAffectedBarangayDisplayItems,
} from "../../features/disaster-events/disasterEventFormatters";

const tableStyles = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "920px",
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
    lineHeight: 1.5,
    wordBreak: "break-word",
  },
};

const DisasterEventsTable = ({
  rows,
  isLoading,
  errorMessage,
  onViewEvent,
  onExtendEvent,
  onEndEvent,
  validBarangayCount = 0,
}) => {
  const [activeMenu, setActiveMenu] = useState(null);
  if (isLoading) {
    return (
      <div style={{ width: "100%" }}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Disaster Events</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          Loading disaster events...
        </p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div style={{ width: "100%" }}>
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
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div style={{ width: "100%" }}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Disaster Events</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          No disaster events were found for the current filter.
        </p>
      </div>
    );
  }

  return (
    <div style={{ width: "100%" }}>
      <div style={{ marginBottom: "18px" }}>
        <h3 style={{ margin: 0, color: "#17324d" }}>Disaster Events</h3>
      </div>

      <div style={{ width: "100%", overflowX: "auto" }}>
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
            {rows.map((row) => {
              const affectedBarangayDisplayItems = getAffectedBarangayDisplayItems(
                row.affected_barangays,
                validBarangayCount,
              );

              return (
              <tr key={row.id} style={{ borderBottom: "1px solid #edf3f8" }}>
                <td style={{ ...tableStyles.bodyCell, textAlign: "left" }}>
                  {row.title}
                </td>

                <td style={{ ...tableStyles.bodyCell, textAlign: "left" }}>
                  {row.disaster_type}
                </td>

                <td style={tableStyles.bodyCell}>
                  {affectedBarangayDisplayItems.length ? (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "6px",
                        maxWidth: "220px",
                        justifyContent: "center",
                      }}
                    >
                      {affectedBarangayDisplayItems.map((brgy, index) => (
                        <span
                          key={brgy.id || brgy.name || brgy || index}
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
                  {formatDisasterEventDate(row.start_date)}
                </td>
                <td style={tableStyles.bodyCell}>
                  {formatDisasterEventDate(row.end_date)}
                </td>
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
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#24496e",
                        }}
                      >
                        <FiMoreHorizontal size={18} />
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
                            display: "flex",
                            gap: "20px",
                            justifyContent: "center",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              onExtendEvent(row);
                              setActiveMenu(null);
                            }}
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
                            title="Extend Period"
                          >
                            <FiCalendar size={18} />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              onEndEvent(row);
                              setActiveMenu(null);
                            }}
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
                            title="Mark as Completed"
                          >
                            <FiCheckCircle size={18} />
                          </button>
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
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DisasterEventsTable;
