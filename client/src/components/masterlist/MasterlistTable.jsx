import React from "react";
import { shellStyles } from "../layout/BarangayLayout";
import { MdDoorFront } from "react-icons/md";

const tableStyles = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "860px",
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
    verticalAlign: "middle",
    lineHeight: 1.5,
    wordBreak: "break-word",
  },
  departureButton: {
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
  membersBadge: {
    display: "inline-block",
    minWidth: "36px",
    textAlign: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    backgroundColor: "#e5f1fb",
    color: "#356592",
    fontSize: "12px",
    fontWeight: 700,
  },
};

const MasterlistTable = ({
  rows,
  isLoading,
  errorMessage,
  hasSelectedEvent,
  onMarkDeparted,
  isDepartureReadOnly = false,
  departureReadOnlyText = "-",
  selectedHouseholds,
  onToggleSelect,
  onSelectAll,
}) => {
  const safeSelectedHouseholds = Array.isArray(selectedHouseholds)
    ? selectedHouseholds
    : [];
  const canUseSelection =
    typeof onToggleSelect === "function" && typeof onSelectAll === "function";

  if (!hasSelectedEvent) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Registered Family</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          Please select a disaster event to load the masterlist.
        </p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Registered Family</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          Loading masterlist data...
        </p>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Registered Family</h3>
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
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Registered Family</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          No registered families were found for the current filters.
        </p>
      </section>
    );
  }

  const selectableRows = isDepartureReadOnly
    ? []
    : rows.filter(
        (row) => !row.departure_time_value && row.can_record_departure,
      );

  const areAllSelected =
    selectableRows.length > 0 &&
    selectableRows.every((row) =>
      safeSelectedHouseholds.includes(row.household_id),
    );

  return (
    <section style={shellStyles.card}>
      <div style={{ marginBottom: "18px" }}>
        <h3 style={{ margin: 0, color: "#17324d" }}>Registered Family</h3>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              <th
                style={{
                  ...tableStyles.headerCell,
                  width: "56px",
                  textAlign: "center",
                }}
              >
                <input
                  type="checkbox"
                  checked={areAllSelected}
                  onChange={onSelectAll}
                  disabled={!canUseSelection || !selectableRows.length}
                />
              </th>
              <th style={tableStyles.headerCell}>Family Head</th>
              <th style={tableStyles.headerCell}>Address</th>
              <th style={tableStyles.headerCell}>Members</th>
              <th style={tableStyles.headerCell}>Sectors</th>
              <th
                style={{
                  ...tableStyles.headerCell,
                  textAlign: "center",
                }}
              >
                Arrival Time
              </th>
              <th
                style={{
                  ...tableStyles.headerCell,
                  textAlign: "center",
                }}
              >
                Departure Time
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isSelectable =
                !isDepartureReadOnly &&
                !row.departure_time_value &&
                row.can_record_departure;
              const isSelected = safeSelectedHouseholds.includes(
                row.household_id,
              );

              return (
                <tr key={row.household_id}>
                  <td
                    style={{
                      ...tableStyles.bodyCell,
                      textAlign: "center",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={!canUseSelection || !isSelectable}
                      onChange={() => onToggleSelect(row.household_id)}
                    />
                  </td>
                  <td style={tableStyles.bodyCell}>{row.family_head_name}</td>
                  <td style={tableStyles.bodyCell}>{row.address}</td>
                  <td style={tableStyles.bodyCell}>
                    <span style={tableStyles.membersBadge}>
                      {row.members_count}
                    </span>
                  </td>
                  <td style={tableStyles.bodyCell}>{row.sectors_text}</td>
                  <td
                    style={{
                      ...tableStyles.bodyCell,
                      textAlign: "center",
                    }}
                  >
                    {row.arrival_time_text}
                  </td>
                  <td
                    style={{
                      ...tableStyles.bodyCell,
                      textAlign: "center",
                    }}
                  >
                    {isDepartureReadOnly ? (
                      departureReadOnlyText || "-"
                    ) : row.departure_time_value ? (
                      row.departure_time_text
                    ) : row.can_record_departure ? (
                      <button
                        type="button"
                        onClick={() => onMarkDeparted(row.household_id)}
                        style={tableStyles.departureButton}
                        title="Mark Departed"
                      >
                        <MdDoorFront size={18} />
                      </button>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default MasterlistTable;
