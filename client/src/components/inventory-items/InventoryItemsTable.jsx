import React from "react";
import { shellStyles } from "../layout/BarangayLayout";
import { pageHeaderStyles } from "../layout/PageHeader";

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

const InventoryItemsTable = ({
  rows,
  isLoading,
  errorMessage,
  onEditItem,
}) => {
  if (isLoading) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Inventory Items</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          Loading inventory items...
        </p>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Inventory Items</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px", color: "#a14d58" }}>
          {errorMessage}
        </p>
      </section>
    );
  }

  if (rows.length === 0) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Inventory Items</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          No inventory items were found for the current filters.
        </p>
      </section>
    );
  }

  return (
    <section style={shellStyles.card}>
      <div style={{ marginBottom: "18px" }}>
        <h3 style={{ margin: 0, color: "#17324d" }}>Inventory Items</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
          Review item master data and open any row for editing.
        </p>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              <th style={tableStyles.headerCell}>Item Code</th>
              <th style={tableStyles.headerCell}>Item Name</th>
              <th style={tableStyles.headerCell}>Category</th>
              <th style={tableStyles.headerCell}>Unit of Measure</th>
              <th style={tableStyles.headerCell}>Perishable</th>
              <th style={tableStyles.headerCell}>Active</th>
              <th style={tableStyles.headerCell}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={tableStyles.bodyCell}>{row.item_code}</td>
                <td style={tableStyles.bodyCell}>{row.item_name}</td>
                <td style={tableStyles.bodyCell}>{row.category}</td>
                <td style={tableStyles.bodyCell}>{row.unit_of_measure}</td>
                <td style={tableStyles.bodyCell}>
                  <span style={getBooleanBadgeStyles(row.is_perishable)}>
                    {row.is_perishable ? "Yes" : "No"}
                  </span>
                </td>
                <td style={tableStyles.bodyCell}>
                  <span style={getBooleanBadgeStyles(row.is_active)}>
                    {row.is_active ? "Yes" : "No"}
                  </span>
                </td>
                <td style={tableStyles.bodyCell}>
                  <button
                    type="button"
                    onClick={() => onEditItem(row.id)}
                    style={pageHeaderStyles.secondaryButton}
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

export default InventoryItemsTable;
