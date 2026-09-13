import React, { useEffect, useState } from "react";
import { FiEye } from "react-icons/fi";
import { shellStyles } from "../layout/BarangayLayout";
import TablePagination from "../shared/TablePagination";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  getTablePaginationState,
  TABLE_PAGE_SIZE_OPTIONS,
} from "../../features/pagination/pagination.mjs";

const tableStyles = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "1280px",
    tableLayout: "fixed",
  },
  itemColumn: {
    width: "190px",
  },
  batchColumn: {
    width: "220px",
  },
  itrColumn: {
    width: "160px",
  },
  quantityColumn: {
    width: "86px",
  },
  movementColumn: {
    width: "118px",
  },
  transactionColumn: {
    width: "170px",
  },
  dateColumn: {
    width: "185px",
  },
  performedByColumn: {
    width: "170px",
  },
  actionColumn: {
    width: "80px",
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
  compactCell: {
    whiteSpace: "nowrap",
  },
  dateCell: {
    whiteSpace: "nowrap",
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

const getTransactionTypeDisplay = (row) => {
  if (String(row.transaction_type || "").toUpperCase() === "OTHER") {
    return String(row.other_status || "").trim() || "Other";
  }

  return row.transaction_type_label || row.transaction_type || "--";
};

const InventoryTransactionsTable = ({
  rows,
  isLoading,
  errorMessage,
  onViewDetails,
}) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const pagination = getTablePaginationState({
    totalItems: safeRows.length,
    currentPage,
    pageSize,
    pageSizeOptions: TABLE_PAGE_SIZE_OPTIONS,
  });
  const paginatedRows = safeRows.slice(
    (pagination.currentPage - 1) * pagination.pageSize,
    pagination.currentPage * pagination.pageSize,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [rows]);

  useEffect(() => {
    setCurrentPage((previousPage) => {
      if (pagination.totalPages === 0) {
        return 1;
      }

      return Math.min(Math.max(previousPage, 1), pagination.totalPages);
    });
  }, [pagination.totalPages]);

  const handlePageSizeChange = (value) => {
    const nextPageSize = Number(value);

    if (!TABLE_PAGE_SIZE_OPTIONS.includes(nextPageSize)) {
      return;
    }

    setPageSize(nextPageSize);
    setCurrentPage(1);
  };

  const showPagination =
    !isLoading && !errorMessage && pagination.totalItems > 0;
  const paginationBar = (
    <TablePagination
      totalItems={pagination.totalItems}
      currentPage={pagination.currentPage}
      pageSize={pagination.pageSize}
      pageSizeOptions={TABLE_PAGE_SIZE_OPTIONS}
      onPageChange={setCurrentPage}
      onPageSizeChange={handlePageSizeChange}
      isVisible={showPagination}
      ariaLabel="Inventory transactions pagination"
      previousAriaLabel="Go to previous inventory transactions page"
      nextAriaLabel="Go to next inventory transactions page"
    />
  );

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

  if (safeRows.length === 0) {
    return (
      <div style={{ marginTop: "8px" }}>
        <p style={{ ...shellStyles.mutedText, marginTop: 0 }}>
          No matching records found. Try adjusting your search or filters.
        </p>
      </div>
    );
  }

  return (
    <>
      {paginationBar}

      <div className="inventory-tracking-table-scroll" style={{ overflowX: "auto" }}>
        <table className="inventory-tracking-table" style={tableStyles.table}>
        <colgroup>
          <col style={tableStyles.itemColumn} />
          <col style={tableStyles.batchColumn} />
          <col style={tableStyles.itrColumn} />
          <col style={tableStyles.quantityColumn} />
          <col style={tableStyles.movementColumn} />
          <col style={tableStyles.transactionColumn} />
          <col style={tableStyles.dateColumn} />
          <col style={tableStyles.performedByColumn} />
          <col style={tableStyles.actionColumn} />
        </colgroup>
        <thead>
          <tr>
            <th className="inventory-tracking-table-header-cell" style={tableStyles.headerCell}>Item</th>
            <th className="inventory-tracking-table-header-cell" style={tableStyles.headerCell}>Batch Number</th>
            <th className="inventory-tracking-table-header-cell" style={tableStyles.headerCell}>ITR No.</th>
            <th className="inventory-tracking-table-header-cell" style={{ ...tableStyles.headerCell, ...tableStyles.centerCell }}>Quantity</th>
            <th className="inventory-tracking-table-header-cell" style={{ ...tableStyles.headerCell, ...tableStyles.centerCell }}>Movement</th>
            <th className="inventory-tracking-table-header-cell" style={{ ...tableStyles.headerCell, ...tableStyles.centerCell }}>Transaction</th>
            <th className="inventory-tracking-table-header-cell" style={{ ...tableStyles.headerCell, ...tableStyles.centerCell }}>Date</th>
            <th className="inventory-tracking-table-header-cell" style={{ ...tableStyles.headerCell, ...tableStyles.centerCell }}>Performed By</th>
            <th className="inventory-tracking-table-header-cell" style={{ ...tableStyles.headerCell, ...tableStyles.centerCell }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {paginatedRows.map((row) => (
            <tr key={row.id}>
              <td className="inventory-tracking-table-cell inventory-tracking-text-cell" style={tableStyles.bodyCell}>
                {row.inventory_item?.item_name || "--"}
              </td>
              <td className="inventory-tracking-table-cell inventory-tracking-text-cell" style={tableStyles.bodyCell}>{row.batch_no || "--"}</td>
              <td className="inventory-tracking-table-cell inventory-tracking-text-cell" style={tableStyles.bodyCell}>
                {row.inventory_transaction_reference_no ||
                  (row.is_local_only ? "Pending assignment" : "Not applicable")}
              </td>
              <td className="inventory-tracking-table-cell" style={{ ...tableStyles.bodyCell, ...tableStyles.centerCell, ...tableStyles.compactCell }}>
                {row.quantity ?? 0}
              </td>
              <td className="inventory-tracking-table-cell" style={{ ...tableStyles.bodyCell, ...tableStyles.centerCell, ...tableStyles.compactCell }}>
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
              <td className="inventory-tracking-table-cell inventory-tracking-text-cell" style={{ ...tableStyles.bodyCell, ...tableStyles.centerCell, ...tableStyles.compactCell }}>
                {getTransactionTypeDisplay(row)}
              </td>
              <td className="inventory-tracking-table-cell" style={{ ...tableStyles.bodyCell, ...tableStyles.centerCell, ...tableStyles.dateCell }}>
                <div>{formatDateTime(row.performed_at)}</div>
              </td>
              <td className="inventory-tracking-table-cell inventory-tracking-text-cell" style={{ ...tableStyles.bodyCell, ...tableStyles.centerCell }}>
                <div>{row.performed_by_label || "--"}</div>
              </td>
              <td className="inventory-tracking-table-cell inventory-tracking-actions-cell" style={{ ...tableStyles.bodyCell, ...tableStyles.centerCell, ...tableStyles.compactCell }}>
                <button
                  className="inventory-tracking-action-button"
                  type="button"
                  onClick={() => onViewDetails?.(row)}
                  style={tableStyles.actionButton}
                  title="View Inventory Transaction Details"
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
    </>
  );
};

export default InventoryTransactionsTable;
