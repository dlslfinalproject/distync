import React, { useEffect, useState } from "react";
import {
  FiAlertCircle,
  FiChevronLeft,
  FiChevronRight,
  FiEdit2,
  FiEye,
} from "react-icons/fi";
import { formatNumericValue } from "../../features/inventory-items/inventoryItemFormatting";
import TableActionsMenu from "../shared/TableActionsMenu";
import StatusPill from "../shared/StatusPill";

const styles = {
  tableWrap: {
    marginTop: "0",
    overflowX: "auto",
    maxWidth: "100%",
    WebkitOverflowScrolling: "touch",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    background: "transparent",
    tableLayout: "fixed",
    minWidth: "760px",
  },
  th: {
    textAlign: "center",
    padding: "14px 10px",
    fontSize: "12px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#66809c",
    fontWeight: 700,
    borderBottom: "1px solid #e0eaf4",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "16px 10px",
    fontSize: "14px",
    color: "#21405f",
    verticalAlign: "middle",
    borderBottom: "1px solid #edf3f8",
    lineHeight: 1.5,
    wordBreak: "break-word",
    textAlign: "center",
  },
  centerCell: {
    textAlign: "center",
  },
  leftCell: {
    textAlign: "left",
  },
  actionCell: {
    width: "88px",
    minWidth: "88px",
    textAlign: "center",
    whiteSpace: "nowrap",
  },
  emptyStateCell: {
    padding: "18px 16px",
    fontSize: "14px",
    color: "#5f7690",
    borderBottom: "none",
  },
  secondaryText: {
    marginTop: "4px",
    color: "#5f7690",
    fontSize: "13px",
    textAlign: "left",
  },
  pillWrap: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "8px",
  },
  infoPill: {
    display: "inline-block",
    minWidth: "36px",
    textAlign: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 700,
    backgroundColor: "#e5f1fb",
    color: "#356592",
    whiteSpace: "normal",
    overflowWrap: "anywhere",
  },
  itemCellContent: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    textAlign: "left",
    width: "100%",
    minWidth: 0,
  },
  itemNameText: {
    width: "100%",
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
};

const tableHeaders = [
  "Item Name",
  "Category",
  "Total Stock",
  "Stock Forms",
  "Reorder Level",
  "Stock Status",
  "Actions",
];

const centeredHeaders = new Set([
  "Category",
  "Total Stock",
  "Stock Forms",
  "Reorder Level",
  "Stock Status",
  "Actions",
]);

const INVENTORY_ITEMS_PAGE_SIZE_OPTIONS = [25, 50, 100];
const DEFAULT_INVENTORY_ITEMS_PAGE_SIZE = 25;

const InventoryItemsTable = ({
  rows,
  isLoading,
  errorMessage,
  onEditItem,
  onViewDetails,
  onLogStatus,
}) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_INVENTORY_ITEMS_PAGE_SIZE);
  const paginationTotalItems = safeRows.length;
  const totalPages =
    paginationTotalItems > 0 ? Math.ceil(paginationTotalItems / pageSize) : 0;
  const safeCurrentPage =
    totalPages > 0 ? Math.min(currentPage, totalPages) : 1;
  const paginatedRows = safeRows.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [rows]);

  useEffect(() => {
    setCurrentPage((previousPage) => {
      if (totalPages === 0) {
        return 1;
      }

      return Math.min(Math.max(previousPage, 1), totalPages);
    });
  }, [totalPages]);

  const handlePageSizeChange = (event) => {
    const nextPageSize = Number(event.target.value);

    if (!INVENTORY_ITEMS_PAGE_SIZE_OPTIONS.includes(nextPageSize)) {
      return;
    }

    setPageSize(nextPageSize);
    setCurrentPage(1);
  };

  const showPagination =
    !isLoading && !errorMessage && paginationTotalItems > 0;
  const paginationBar = showPagination ? (
    <div
      className="inventory-items-pagination-bar"
      role="navigation"
      aria-label="Inventory items pagination"
    >
      <p className="inventory-items-pagination-range" aria-live="polite">
        Showing {paginationTotalItems} loaded entries
      </p>
      <div className="inventory-items-pagination-controls">
        <label className="inventory-items-pagination-size">
          <span>Rows per page</span>
          <select value={pageSize} onChange={handlePageSizeChange}>
            {INVENTORY_ITEMS_PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
          disabled={safeCurrentPage <= 1}
          aria-label="Go to previous inventory items page"
          title="Previous page"
          className="inventory-items-pagination-button"
        >
          <FiChevronLeft aria-hidden="true" />
        </button>
        <span aria-live="polite">
          Page {safeCurrentPage} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() =>
            setCurrentPage((page) => Math.min(page + 1, totalPages))
          }
          disabled={safeCurrentPage >= totalPages}
          aria-label="Go to next inventory items page"
          title="Next page"
          className="inventory-items-pagination-button"
        >
          <FiChevronRight aria-hidden="true" />
        </button>
      </div>
    </div>
  ) : null;

  return (
    <>
      {paginationBar}
      <div className="inventory-items-table-scroll" style={styles.tableWrap}>
        <table className="inventory-items-table" style={styles.table}>
          <thead>
            <tr>
              {tableHeaders.map((header) => (
                <th
                  key={header}
                  className="inventory-items-table-header-cell"
                  style={{
                    ...styles.th,
                    ...(header === "Item Name" ? styles.leftCell : null),
                    ...(centeredHeaders.has(header) ? styles.centerCell : null),
                    ...(header === "Actions" ? styles.actionCell : null),
                  }}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              <tr>
                <td
                  className="inventory-items-empty-state-cell"
                  colSpan="7"
                  style={styles.emptyStateCell}
                >
                  Loading inventory items...
                </td>
              </tr>
            ) : errorMessage ? (
              <tr>
                <td
                  className="inventory-items-empty-state-cell"
                  colSpan="7"
                  style={{ ...styles.emptyStateCell, color: "#b91c1c" }}
                >
                  {errorMessage}
                </td>
              </tr>
            ) : safeRows.length === 0 ? (
              <tr>
                <td
                  className="inventory-items-empty-state-cell"
                  colSpan="7"
                  style={styles.emptyStateCell}
                >
                  No inventory items found
                </td>
              </tr>
            ) : (
              paginatedRows.map((item, index) => {
                const stockStatuses = Array.isArray(item.stock_statuses)
                  ? item.stock_statuses
                  : [{ key: item.stock_status_label || "Available", label: item.stock_status_label || "Available" }];
                const stockForms = Array.isArray(item.stock_form_labels)
                  ? item.stock_form_labels
                  : [];

                const itemName =
                  item.item_name ??
                  item.name ??
                  item.product_name ??
                  "Unnamed Item";

                return (
                  <tr className="inventory-items-table-row" key={item.id || index}>
                    <td
                      className="inventory-items-table-cell inventory-items-item-cell"
                      style={{ ...styles.td, ...styles.leftCell }}
                    >
                      <div style={styles.itemCellContent}>
                        <div
                          className="inventory-items-item-name-text"
                          style={styles.itemNameText}
                          title={itemName}
                        >
                          {itemName}
                        </div>
                      </div>
                    </td>
                    <td
                      className="inventory-items-table-cell"
                      style={{ ...styles.td, ...styles.centerCell }}
                    >
                      {item.category || "--"}
                    </td>
                    <td
                      className="inventory-items-table-cell"
                      style={{ ...styles.td, ...styles.centerCell }}
                    >
                      {formatNumericValue(Number(item.total_stock_on_hand || 0))}
                    </td>
                    <td
                      className="inventory-items-table-cell"
                      style={{ ...styles.td, ...styles.centerCell }}
                    >
                      <div style={styles.pillWrap}>
                        {stockForms.length === 0 ? (
                          <span style={styles.infoPill}>--</span>
                        ) : (
                          stockForms.map((stockFormLabel) => (
                            <span key={stockFormLabel} style={styles.infoPill}>
                              {stockFormLabel}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td
                      className="inventory-items-table-cell"
                      style={{ ...styles.td, ...styles.centerCell }}
                    >
                      {item.reorder_level_display ?? item.reorder_level ?? "--"}
                    </td>
                    <td
                      className="inventory-items-table-cell"
                      style={{ ...styles.td, ...styles.centerCell }}
                    >
                      <div style={styles.pillWrap}>
                        {stockStatuses.map((stockStatus) => {
                          return (
                            <StatusPill
                              key={`${item.id || index}-${stockStatus.key}`}
                              status={stockStatus.key}
                              label={stockStatus.label}
                              style={{ fontSize: "12px" }}
                            />
                          );
                        })}
                      </div>
                    </td>
                    <td
                      className="inventory-items-table-cell inventory-items-action-cell"
                      style={{ ...styles.td, ...styles.actionCell }}
                    >
                      <TableActionsMenu
                        row={item}
                        menuId={item.id || `inventory-item-${index}`}
                        buttonTitle="Actions"
                        buttonAriaLabel="Actions"
                        dataPrefix="inventory-item-action"
                        menuWidth={168}
                        variant="icon-grid"
                        items={[
                          {
                            key: "view",
                            label: "View Item Details",
                            icon: <FiEye size={18} />,
                            disabled: typeof onViewDetails !== "function",
                            onClick: (selectedRow) =>
                              onViewDetails?.(selectedRow.id),
                          },
                          {
                            key: "edit",
                            label: "Edit Item",
                            icon: <FiEdit2 size={18} />,
                            disabled: typeof onEditItem !== "function",
                            title: "Edit Item Details",
                            onClick: (selectedRow) => onEditItem?.(selectedRow),
                          },
                          {
                            key: "status-log",
                            label: "Log Status",
                            icon: <FiAlertCircle size={18} />,
                            disabled: typeof onLogStatus !== "function",
                            onClick: (selectedRow) => onLogStatus?.(selectedRow),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default InventoryItemsTable;
