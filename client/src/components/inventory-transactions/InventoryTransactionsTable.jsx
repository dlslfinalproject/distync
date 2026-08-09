import React from "react";
import { FiEye } from "react-icons/fi";
import { shellStyles } from "../layout/BarangayLayout";
import SyncStatusIcon from "../shared/SyncStatusIcon";

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
    verticalAlign: "top",
    lineHeight: 1.5,
  },
  centerCell: {
    textAlign: "center",
    verticalAlign: "middle",
  },
  actionButton: {
    border: "1px solid #c6d8ea",
    borderRadius: "12px",
    width: "36px",
    height: "36px",
    padding: 0,
    backgroundColor: "#f8fbfe",
    color: "#2a4c6f",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
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
      border: "1px solid #bdd8f1",
      backgroundColor: "#e9f4ff",
      color: "#145995",
    };
  }

  if (direction === "OUTFLOW") {
    return {
      border: "1px solid #c9e8d7",
      backgroundColor: "#eefaf3",
      color: "#16733c",
    };
  }

  return {
    border: "1px solid #d6e2ef",
    backgroundColor: "#eef3f8",
    color: "#4d647c",
  };
};

const InventoryTransactionsTable = ({
  rows,
  isLoading,
  errorMessage,
  onViewDetails,
}) => {
  if (isLoading) {
    return (
      <div style={{ marginTop: "8px" }}>
        <p style={{ ...shellStyles.mutedText, marginTop: 0 }}>
          Loading stock movement records...
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
          No matching records found. Try adjusting your search or filters.
        </p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={tableStyles.table}>
        <thead>
          <tr>
            <th style={tableStyles.headerCell}>Item Name</th>
            <th style={tableStyles.headerCell}>Batch Number</th>
            <th style={tableStyles.headerCell}>ITR No.</th>
            <th style={{ ...tableStyles.headerCell, ...tableStyles.centerCell }}>Quantity</th>
            <th style={{ ...tableStyles.headerCell, ...tableStyles.centerCell }}>Movement</th>
            <th style={{ ...tableStyles.headerCell, ...tableStyles.centerCell }}>Transaction Type</th>
            <th style={{ ...tableStyles.headerCell, ...tableStyles.centerCell }}>Date</th>
            <th style={{ ...tableStyles.headerCell, ...tableStyles.centerCell }}>Performed By</th>
            <th style={{ ...tableStyles.headerCell, ...tableStyles.centerCell }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td style={tableStyles.bodyCell}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  <span>{row.inventory_item?.item_name || "--"}</span>
                  <SyncStatusIcon status={row.sync_status} />
                </div>
              </td>
              <td style={tableStyles.bodyCell}>{row.batch_no || "--"}</td>
              <td style={tableStyles.bodyCell}>
                {row.inventory_transaction_reference_no || "Not applicable"}
              </td>
              <td style={{ ...tableStyles.bodyCell, ...tableStyles.centerCell }}>
                {row.quantity ?? 0}
              </td>
              <td style={{ ...tableStyles.bodyCell, ...tableStyles.centerCell }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    borderRadius: "999px",
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: 700,
                    ...getDirectionStyles(row.transaction_direction),
                  }}
                >
                  {row.transaction_direction || "--"}
                </span>
              </td>
              <td style={{ ...tableStyles.bodyCell, ...tableStyles.centerCell }}>
                {row.transaction_type_label || row.transaction_type || "--"}
              </td>
              <td style={{ ...tableStyles.bodyCell, ...tableStyles.centerCell }}>
                <div>{formatDateTime(row.performed_at)}</div>
              </td>
              <td style={{ ...tableStyles.bodyCell, ...tableStyles.centerCell }}>
                <div>{row.performed_by_label || "--"}</div>
              </td>
              <td style={{ ...tableStyles.bodyCell, ...tableStyles.centerCell }}>
                <button
                  type="button"
                  onClick={() => onViewDetails?.(row)}
                  style={tableStyles.actionButton}
                  title="View Details"
                  aria-label="View Details"
                >
                  <FiEye size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default InventoryTransactionsTable;
