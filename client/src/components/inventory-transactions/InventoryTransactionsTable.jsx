import React from "react";
import { shellStyles } from "../layout/BarangayLayout";
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

const getActivityLabel = (row) => {
  if (
    row.transaction_type === "OUTFLOW" &&
    row.reference_type === "DISTRIBUTION"
  ) {
    return "DISTRIBUTED";
  }

  return row.transaction_type;
};

const getActivityBadgeStyles = (activityLabel) => {
  const paletteByActivity = {
    DISTRIBUTED: {
      backgroundColor: "#dbeafe",
      color: "#1d4ed8",
    },
    EXPIRED: {
      backgroundColor: "#fee2e2",
      color: "#b91c1c",
    },
    RETURN: {
      backgroundColor: "#dcfce7",
      color: "#15803d",
    },
    ADJUSTMENT: {
      backgroundColor: "#ede9fe",
      color: "#6d28d9",
    },
  };

  return {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: "999px",
    padding: "4px 10px",
    fontSize: "12px",
    fontWeight: 700,
    ...(paletteByActivity[activityLabel] || {
      backgroundColor: "#e2e8f0",
      color: "#334155",
    }),
  };
};

const InventoryTransactionsTable = ({ rows, isLoading, errorMessage }) => {
  if (isLoading) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Inventory Tracking Log</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          Loading inventory tracking records...
        </p>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Inventory Tracking Log</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px", color: "#a14d58" }}>
          {errorMessage}
        </p>
      </section>
    );
  }

  if (rows.length === 0) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Inventory Tracking Log</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          No inventory tracking records were found for the current filters.
        </p>
      </section>
    );
  }

  return (
    <section style={shellStyles.card}>
      <div style={{ marginBottom: "18px" }}>
        <h3 style={{ margin: 0, color: "#17324d" }}>Inventory Tracking Log</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
          Item-level movement history for distributed, expired, returned, and
          adjusted stock.
        </p>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              <th style={tableStyles.headerCell}>Performed At</th>
              <th style={tableStyles.headerCell}>Item</th>
              <th style={tableStyles.headerCell}>Activity</th>
              <th style={tableStyles.headerCell}>Quantity</th>
              <th style={tableStyles.headerCell}>Reference Type</th>
              <th style={tableStyles.headerCell}>Sync</th>
              <th style={tableStyles.headerCell}>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const activityLabel = getActivityLabel(row);

              return (
                <tr key={row.id}>
                  <td style={tableStyles.bodyCell}>
                    {formatDateTime(row.performed_at)}
                  </td>
                  <td style={tableStyles.bodyCell}>
                    {row.inventory_item?.item_name || "--"}
                  </td>
                  <td style={tableStyles.bodyCell}>
                    <span style={getActivityBadgeStyles(activityLabel)}>
                      {activityLabel}
                    </span>
                  </td>
                  <td style={tableStyles.bodyCell}>{row.quantity}</td>
                  <td style={tableStyles.bodyCell}>{row.reference_type}</td>
                  <td style={tableStyles.bodyCell}>
                    <SyncStatusBadge status={row.sync_status} compact />
                  </td>
                  <td style={tableStyles.bodyCell}>{row.remarks || "--"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default InventoryTransactionsTable;
