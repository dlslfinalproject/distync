import React from "react";
import { shellStyles } from "../layout/BarangayLayout";

const formatDateTime = (value) => {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
};

const getAttendanceBadgeStyles = (status) => {
  const normalizedStatus = String(status || "").toUpperCase();

  if (normalizedStatus === "IN") {
    return {
      backgroundColor: "#e7f4ea",
      color: "#2e6c48",
      border: "1px solid #cde4d4",
    };
  }

  if (normalizedStatus === "OUT") {
    return {
      backgroundColor: "#fdf1e6",
      color: "#8a5b1e",
      border: "1px solid #edd6b7",
    };
  }

  return {
    backgroundColor: "#eef4fb",
    color: "#50708f",
    border: "1px solid #d4e1ee",
  };
};

const tableStyles = {
  table: {
    width: "100%",
    maxWidth: "100%",
    tableLayout: "fixed",
    borderCollapse: "collapse",
    minWidth: "1040px",
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
    lineHeight: 1.5,
    wordBreak: "break-word",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "42px",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 700,
  },
};

const MswdoMasterlistTable = ({
  rows,
  hasSelectedEvent,
  isLoading,
  errorMessage,
  onViewHousehold,
}) => {
  if (!hasSelectedEvent) {
    return (
      <section style={{ ...shellStyles.card, width: "100%", minWidth: 0 }}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Monitoring Table</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          Select a disaster event to load consolidated household records across
          barangays.
        </p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section style={{ ...shellStyles.card, width: "100%", minWidth: 0 }}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Monitoring Table</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          Loading consolidated masterlist...
        </p>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section style={{ ...shellStyles.card, width: "100%", minWidth: 0 }}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Monitoring Table</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px", color: "#a14d58" }}>
          {errorMessage}
        </p>
      </section>
    );
  }

  if (rows.length === 0) {
    return (
      <section style={{ ...shellStyles.card, width: "100%", minWidth: 0 }}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Monitoring Table</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          No household records were found for the selected disaster event and
          filters.
        </p>
      </section>
    );
  }

  return (
    <section style={{ ...shellStyles.card, width: "100%", minWidth: 0 }}>
      <div style={{ marginBottom: "18px" }}>
        <h3 style={{ margin: 0, color: "#17324d" }}>Monitoring Table</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
          Consolidated masterlist records with stub and latest attendance summary.
        </p>
      </div>

      <div style={{ width: "100%", overflowX: "auto" }}>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              <th style={tableStyles.headerCell}>Family Head</th>
              <th style={tableStyles.headerCell}>Barangay</th>
              <th style={tableStyles.headerCell}>Household Size</th>
              <th style={tableStyles.headerCell}>Current Stay Type</th>
              <th style={tableStyles.headerCell}>Contact Number</th>
              <th style={tableStyles.headerCell}>Stub Number</th>
              <th style={tableStyles.headerCell}>Latest Attendance</th>
              <th style={tableStyles.headerCell}>Registered Date</th>
              <th style={tableStyles.headerCell}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((household) => (
              <tr key={household.household_id}>
                <td style={tableStyles.bodyCell}>{household.family_head_name}</td>
                <td style={tableStyles.bodyCell}>
                  {household.barangay?.name || "—"}
                </td>
                <td style={tableStyles.bodyCell}>{household.household_size || 0}</td>
                <td style={tableStyles.bodyCell}>
                  {household.current_stay_type || "—"}
                </td>
                <td style={tableStyles.bodyCell}>
                  {household.contact_number || "—"}
                </td>
                <td style={tableStyles.bodyCell}>
                  {household.stub?.stub_no || "—"}
                </td>
                <td style={tableStyles.bodyCell}>
                  <span
                    style={{
                      ...tableStyles.badge,
                      ...getAttendanceBadgeStyles(
                        household.latest_attendance?.status,
                      ),
                    }}
                  >
                    {household.latest_attendance?.status || "N/A"}
                  </span>
                </td>
                <td style={tableStyles.bodyCell}>
                  {formatDateTime(household.registered_at)}
                </td>
                <td style={tableStyles.bodyCell}>
                  <button
                    type="button"
                    onClick={() => onViewHousehold(household)}
                    style={{
                      border: "1px solid #c6d8ea",
                      borderRadius: "12px",
                      padding: "10px 14px",
                      backgroundColor: "#f7fbfe",
                      color: "#24496e",
                      fontSize: "13px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default MswdoMasterlistTable;
