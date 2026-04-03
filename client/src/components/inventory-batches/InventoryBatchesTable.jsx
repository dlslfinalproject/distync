import React from "react";
import { shellStyles } from "../layout/BarangayLayout";

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

const getStatusBadgeStyles = (status) => {
  const paletteByStatus = {
    AVAILABLE: { backgroundColor: "#e6f5ec", color: "#2d7a4f" },
    LOW_STOCK: { backgroundColor: "#fff4df", color: "#9a6c11" },
    EXPIRED: { backgroundColor: "#f6ebeb", color: "#9d4d58" },
    DEPLETED: { backgroundColor: "#eef2f6", color: "#60738a" },
    MISSING: { backgroundColor: "#f6ebeb", color: "#9d4d58" },
    DAMAGED: { backgroundColor: "#f6ebeb", color: "#9d4d58" },
  };

  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
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

const InventoryBatchesTable = ({ rows, isLoading, errorMessage }) => {
  if (isLoading) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Inventory Batches</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          Loading inventory batches...
        </p>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Inventory Batches</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px", color: "#a14d58" }}>
          {errorMessage}
        </p>
      </section>
    );
  }

  if (rows.length === 0) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Inventory Batches</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          No inventory batches were found for the current filters.
        </p>
      </section>
    );
  }

  return (
    <section style={shellStyles.card}>
      <div style={{ marginBottom: "18px" }}>
        <h3 style={{ margin: 0, color: "#17324d" }}>Inventory Batches</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
          Batch-level stock records with supplier, source, quantity, and
          expiration details.
        </p>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              <th style={tableStyles.headerCell}>Batch No</th>
              <th style={tableStyles.headerCell}>Item</th>
              <th style={tableStyles.headerCell}>Supplier</th>
              <th style={tableStyles.headerCell}>Source Type</th>
              <th style={tableStyles.headerCell}>Quantity Received</th>
              <th style={tableStyles.headerCell}>Quantity Available</th>
              <th style={tableStyles.headerCell}>Expiration Date</th>
              <th style={tableStyles.headerCell}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={tableStyles.bodyCell}>{row.batch_no}</td>
                <td style={tableStyles.bodyCell}>
                  {row.inventory_item?.item_name || "--"}
                </td>
                <td style={tableStyles.bodyCell}>{row.supplier?.name || "--"}</td>
                <td style={tableStyles.bodyCell}>{row.source_type}</td>
                <td style={tableStyles.bodyCell}>{row.quantity_received}</td>
                <td style={tableStyles.bodyCell}>{row.quantity_available}</td>
                <td style={tableStyles.bodyCell}>
                  {formatDate(row.expiration_date)}
                </td>
                <td style={tableStyles.bodyCell}>
                  <span style={getStatusBadgeStyles(row.status)}>{row.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default InventoryBatchesTable;
