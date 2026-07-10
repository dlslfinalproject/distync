import React from "react";
import { shellStyles } from "../layout/BarangayLayout";
import StatusPill from "../shared/StatusPill";
import { FiEdit2 } from "react-icons/fi";
import {
  formatDisasterEventDate,
  getAffectedBarangayDisplayItems,
} from "../../features/disaster-events/disasterEventFormatters";

const tableStyles = {
  table: {
    width: "100%",
    maxWidth: "100%",
    borderCollapse: "collapse",
    tableLayout: "fixed",
  },
  headerCell: {
    padding: "14px 12px",
    textAlign: "center",
    fontSize: "12px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#66809c",
    borderBottom: "1px solid #e0eaf4",
    whiteSpace: "normal",
    lineHeight: 1.4,
  },
  bodyCell: {
    padding: "16px 12px",
    color: "#21405f",
    borderBottom: "1px solid #edf3f8",
    fontSize: "14px",
    verticalAlign: "middle",
    textAlign: "center",
    lineHeight: 1.5,
    whiteSpace: "normal",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  },
  dropdownButton: {
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
  },
};

const DisasterEventsTable = ({
  rows,
  isLoading,
  errorMessage,
  onViewEvent,
  onEditEvent,
  validBarangayCount = 0,
}) => {
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

      <div style={{ width: "100%", minWidth: 0 }}>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              <th
                style={{
                  ...tableStyles.headerCell,
                  width: "20%",
                  textAlign: "left",
                }}
              >
                Name
              </th>
              <th
                style={{
                  ...tableStyles.headerCell,
                  width: "13%",
                  textAlign: "left",
                }}
              >
                Disaster Type
              </th>
              <th style={{ ...tableStyles.headerCell, width: "22%" }}>
                Affected Barangays
              </th>
              <th style={{ ...tableStyles.headerCell, width: "11%" }}>
                Start Date
              </th>
              <th style={{ ...tableStyles.headerCell, width: "11%" }}>
                End Date
              </th>
              <th
                style={{
                  ...tableStyles.headerCell,
                  width: "12%",
                  textAlign: "center",
                }}
              >
                Status
              </th>
              <th
                style={{
                  ...tableStyles.headerCell,
                  width: "10%",
                  textAlign: "center",
                }}
              >
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const affectedBarangayDisplayItems =
                getAffectedBarangayDisplayItems(
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
                          maxWidth: "100%",
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
                              whiteSpace: "normal",
                              overflowWrap: "anywhere",
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

                  <td
                    style={{
                      ...tableStyles.bodyCell,
                      textAlign: "center",
                    }}
                  >
                    <StatusPill status={row.status} />
                  </td>

                  <td
                    style={{
                      ...tableStyles.bodyCell,
                      textAlign: "center",
                      position: "relative",
                    }}
                  >
                    {row.status === "ACTIVE" ? (
                      <button
                        type="button"
                        onClick={() => onEditEvent?.(row.id)}
                        style={tableStyles.dropdownButton}
                        title="Edit Disaster Event"
                      >
                        <FiEdit2 size={18} />
                      </button>
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
