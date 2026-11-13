import React from "react";
import { shellStyles } from "../layout/BarangayLayout";
import TablePagination from "../shared/TablePagination";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  TABLE_PAGE_SIZE_OPTIONS,
} from "../../features/pagination/pagination.mjs";
import SyncStatusBadge from "../shared/SyncStatusBadge";

const tableStyles = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "980px",
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
  centeredHeaderCell: {
    textAlign: "center",
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
  centeredBodyCell: {
    textAlign: "center",
    verticalAlign: "middle",
  },
  actionCell: {
    textAlign: "center",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
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

const InventoryBatchesTable = ({
  rows,
  isLoading,
  errorMessage,
  onViewDetails,
  pagination = null,
  onPageChange,
  onPageSizeChange,
}) => {
  const paginationEnabled = pagination !== null;
  const paginationTotalItems = Number(
    pagination?.totalItems ?? rows.length,
  );
  const currentPage = Number(pagination?.page || 1);
  const currentPageSize = Number(
    pagination?.pageSize || DEFAULT_TABLE_PAGE_SIZE,
  );

  const paginationControls = (
    <TablePagination
      totalItems={paginationTotalItems}
      currentPage={currentPage}
      pageSize={currentPageSize}
      pageSizeOptions={TABLE_PAGE_SIZE_OPTIONS}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      isVisible={paginationEnabled}
      disabled={isLoading}
      disablePageSize={isLoading}
      ariaLabel="Inventory batches pagination"
      previousAriaLabel="Go to previous inventory batches page"
      nextAriaLabel="Go to next inventory batches page"
    />
  );

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
        {paginationControls}
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          No matching records found. Try adjusting your search or filters.
        </p>
      </section>
    );
  }

  return (
    <section style={shellStyles.card}>
      <div style={{ marginBottom: "18px" }}>
        <h3 style={{ margin: 0, color: "#17324d" }}>Inventory Batches</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
          Batch-level stock records with source, quantity, and
          expiration details.
        </p>
      </div>
      {paginationControls}

      <div style={{ overflowX: "auto" }}>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              <th style={tableStyles.headerCell}>Batch No</th>
              <th style={tableStyles.headerCell}>Item</th>
              <th style={tableStyles.headerCell}>Source Type</th>
              <th style={tableStyles.headerCell}>Quantity Received</th>
              <th style={tableStyles.headerCell}>Quantity Available</th>
              <th style={tableStyles.headerCell}>Expiration Date</th>
              <th
                style={{
                  ...tableStyles.headerCell,
                  ...tableStyles.centeredHeaderCell,
                }}
              >
                Status
              </th>
              <th
                style={{
                  ...tableStyles.headerCell,
                  ...tableStyles.centeredHeaderCell,
                }}
              >
                Sync
              </th>
              <th
                style={{
                  ...tableStyles.headerCell,
                  ...tableStyles.actionCell,
                }}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={tableStyles.bodyCell}>{row.batch_no}</td>
                <td style={tableStyles.bodyCell}>
                  {row.inventory_item?.item_name || "--"}
                </td>
                <td style={tableStyles.bodyCell}>{row.source_type}</td>
                <td style={tableStyles.bodyCell}>{row.quantity_received}</td>
                <td style={tableStyles.bodyCell}>{row.quantity_available}</td>
                <td style={tableStyles.bodyCell}>
                  {formatDate(row.expiration_date)}
                </td>
                <td
                  style={{
                    ...tableStyles.bodyCell,
                    ...tableStyles.centeredBodyCell,
                  }}
                >
                  <span style={getStatusBadgeStyles(row.status)}>{row.status}</span>
                </td>
                <td
                  style={{
                    ...tableStyles.bodyCell,
                    ...tableStyles.centeredBodyCell,
                  }}
                >
                  <SyncStatusBadge status={row.sync_status} compact />
                </td>
                <td
                  style={{
                    ...tableStyles.bodyCell,
                    ...tableStyles.actionCell,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onViewDetails?.(row.id)}
                    style={{
                      border: "1px solid #c6d8ea",
                      borderRadius: "10px",
                      padding: "8px 10px",
                      backgroundColor: "#f8fbfe",
                      color: "#2a4c6f",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                    disabled={typeof onViewDetails !== "function"}
                  >
                    View Batch Details
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

export default InventoryBatchesTable;
