import React from "react";
import { shellStyles } from "../layout/BarangayLayout";
import { pageHeaderStyles } from "../layout/PageHeader";
import SyncStatusBadge from "../shared/SyncStatusBadge";

const tableStyles = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
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

const getBooleanBadgeStyles = (value) => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "72px",
  padding: "6px 10px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: 700,
  backgroundColor: value ? "#e6f5ec" : "#f1f4f7",
  color: value ? "#2d7a4f" : "#60738a",
});

const SuppliersTable = ({ rows, isLoading, errorMessage, onEditSupplier }) => {
  if (isLoading) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Suppliers</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          Loading suppliers...
        </p>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Suppliers</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px", color: "#a14d58" }}>
          {errorMessage}
        </p>
      </section>
    );
  }

  if (rows.length === 0) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Suppliers</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          No matching records found. Try adjusting your search or filters.
        </p>
      </section>
    );
  }

  return (
    <section style={shellStyles.card}>
      <div style={{ marginBottom: "18px" }}>
        <h3 style={{ margin: 0, color: "#17324d" }}>Suppliers</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
          Supplier reference records for inventory intake, procurement, and
          reporting.
        </p>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              <th style={tableStyles.headerCell}>Name</th>
              <th style={tableStyles.headerCell}>Contact Person</th>
              <th style={tableStyles.headerCell}>Contact Number</th>
              <th style={tableStyles.headerCell}>Address</th>
              <th style={tableStyles.headerCell}>Has MOA</th>
              <th style={tableStyles.headerCell}>Sync</th>
              <th style={tableStyles.headerCell}>Notes</th>
              <th style={tableStyles.headerCell}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={tableStyles.bodyCell}>{row.name}</td>
                <td style={tableStyles.bodyCell}>{row.contact_person || "--"}</td>
                <td style={tableStyles.bodyCell}>{row.contact_number || "--"}</td>
                <td style={tableStyles.bodyCell}>{row.address || "--"}</td>
                <td style={tableStyles.bodyCell}>
                  <span style={getBooleanBadgeStyles(row.has_moa)}>
                    {row.has_moa ? "Yes" : "No"}
                  </span>
                </td>
                <td style={tableStyles.bodyCell}>
                  <SyncStatusBadge status={row.sync_status} compact />
                </td>
                <td style={tableStyles.bodyCell}>{row.notes || "--"}</td>
                <td style={tableStyles.bodyCell}>
                  <button
                    type="button"
                    onClick={() => onEditSupplier(row.id)}
                    style={pageHeaderStyles.secondaryButton}
                    disabled={row.is_local_only}
                    title={row.is_local_only ? "Available after sync" : undefined}
                  >
                    Edit
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

export default SuppliersTable;
