import React from "react";
import { shellStyles } from "../layout/BarangayLayout";

const tableStyles = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "760px",
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
  },
  helperText: {
    display: "block",
    marginTop: "4px",
    color: "#6b8298",
    fontSize: "12px",
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

const getDirectionStyles = (direction) => {
  if (direction === "INFLOW") {
    return {
      backgroundColor: "#eaf3fc",
      color: "#356592",
    };
  }

  if (direction === "OUTFLOW") {
    return {
      backgroundColor: "#e6f5ec",
      color: "#2d7a4f",
    };
  }

  return {
    backgroundColor: "#eef3f8",
    color: "#4d647c",
  };
};

const InventoryTransactionsTable = ({ rows, isLoading, errorMessage }) => {
  if (isLoading) {
    return (
      <div style={{ marginTop: "8px" }}>
        <p style={{ ...shellStyles.mutedText, marginTop: 0 }}>
          Loading inventory tracking records...
        </p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div style={{ marginTop: "8px" }}>
        <p style={{ ...shellStyles.mutedText, marginTop: 0, color: "#a14d58" }}>
          {errorMessage}
        </p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div style={{ marginTop: "8px" }}>
        <p style={{ ...shellStyles.mutedText, marginTop: 0 }}>
          No inventory tracking records were found for the current filters.
        </p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={tableStyles.table}>
        <thead>
          <tr>
            <th style={tableStyles.headerCell}>Item</th>
            <th style={tableStyles.headerCell}>Transaction Type</th>
            <th style={tableStyles.headerCell}>Quantity</th>
            <th style={tableStyles.headerCell}>Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td style={tableStyles.bodyCell}>
                <div>{row.inventory_item?.item_name || "--"}</div>
                {row.inventory_item?.item_code ? (
                  <span style={tableStyles.helperText}>
                    {row.inventory_item.item_code}
                  </span>
                ) : null}
                {row.source_label ? (
                  <span style={tableStyles.helperText}>
                    {row.source_label}
                    {row.source_details && row.source_details !== row.source_label
                      ? ` | ${row.source_details}`
                      : ""}
                  </span>
                ) : null}
              </td>
              <td style={tableStyles.bodyCell}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    borderRadius: "999px",
                    padding: "4px 10px",
                    fontSize: "12px",
                    fontWeight: 700,
                    ...getDirectionStyles(row.transaction_direction),
                  }}
                >
                  {row.transaction_direction || "--"}
                </span>
              </td>
              <td style={tableStyles.bodyCell}>{row.quantity ?? 0}</td>
              <td style={tableStyles.bodyCell}>
                <div>{formatDateTime(row.performed_at)}</div>
                {row.sync_status ? (
                  <span style={tableStyles.helperText}>
                    {String(row.sync_status).replace(/_/g, " ")}
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default InventoryTransactionsTable;
