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

const formatDateTime = (value) => {
  if (!value) {
    return "--";
  }

  return new Date(value).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const InventoryTransactionsTable = ({ rows, isLoading, errorMessage }) => {
  if (isLoading) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Inventory Transactions</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          Loading inventory transactions...
        </p>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Inventory Transactions</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px", color: "#a14d58" }}>
          {errorMessage}
        </p>
      </section>
    );
  }

  if (rows.length === 0) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Inventory Transactions</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          No inventory transactions were found for the current filters.
        </p>
      </section>
    );
  }

  return (
    <section style={shellStyles.card}>
      <div style={{ marginBottom: "18px" }}>
        <h3 style={{ margin: 0, color: "#17324d" }}>Inventory Transactions</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
          Stock movement history across batches, transaction types, and manual
          remarks.
        </p>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              <th style={tableStyles.headerCell}>Performed At</th>
              <th style={tableStyles.headerCell}>Batch</th>
              <th style={tableStyles.headerCell}>Item</th>
              <th style={tableStyles.headerCell}>Transaction Type</th>
              <th style={tableStyles.headerCell}>Quantity</th>
              <th style={tableStyles.headerCell}>Reference Type</th>
              <th style={tableStyles.headerCell}>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={tableStyles.bodyCell}>
                  {formatDateTime(row.performed_at)}
                </td>
                <td style={tableStyles.bodyCell}>
                  {row.inventory_batch?.batch_no || "--"}
                </td>
                <td style={tableStyles.bodyCell}>
                  {row.inventory_item?.item_name || "--"}
                </td>
                <td style={tableStyles.bodyCell}>{row.transaction_type}</td>
                <td style={tableStyles.bodyCell}>{row.quantity}</td>
                <td style={tableStyles.bodyCell}>{row.reference_type}</td>
                <td style={tableStyles.bodyCell}>{row.remarks || "--"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default InventoryTransactionsTable;
