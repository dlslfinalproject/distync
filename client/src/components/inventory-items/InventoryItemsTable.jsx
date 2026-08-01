import React from "react";
import { FiAlertCircle, FiEdit2, FiEye } from "react-icons/fi";
import { formatNumericValue } from "../../features/inventory-items/inventoryItemFormatting";
import TableActionsMenu from "../shared/TableActionsMenu";
import StatusPill from "../shared/StatusPill";

const styles = {
  tableWrap: {
    marginTop: "0",
    overflowX: "hidden",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    background: "transparent",
    tableLayout: "fixed",
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

const InventoryItemsTable = ({
  rows,
  isLoading,
  errorMessage,
  onEditItem,
  onViewDetails,
  onLogStatus,
}) => {
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            {tableHeaders.map((header) => (
              <th
                key={header}
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
              <td colSpan="7" style={styles.emptyStateCell}>
                Loading inventory items...
              </td>
            </tr>
          ) : errorMessage ? (
            <tr>
              <td
                colSpan="7"
                style={{ ...styles.emptyStateCell, color: "#b91c1c" }}
              >
                {errorMessage}
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan="7" style={styles.emptyStateCell}>
                No inventory items found
              </td>
            </tr>
          ) : (
            rows.map((item, index) => {
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
                <tr key={item.id || index}>
                  <td style={{ ...styles.td, ...styles.leftCell }}>
                    <div style={styles.itemCellContent}>
                      <div style={styles.itemNameText}>{itemName}</div>
                    </div>
                  </td>
                  <td style={{ ...styles.td, ...styles.centerCell }}>
                    {item.category || "--"}
                  </td>
                  <td style={{ ...styles.td, ...styles.centerCell }}>
                    {formatNumericValue(Number(item.total_stock_on_hand || 0))}
                  </td>
                  <td style={{ ...styles.td, ...styles.centerCell }}>
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
                  <td style={{ ...styles.td, ...styles.centerCell }}>
                    {item.reorder_level_display ?? item.reorder_level ?? "--"}
                  </td>
                  <td style={{ ...styles.td, ...styles.centerCell }}>
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
                  <td style={{ ...styles.td, ...styles.actionCell }}>
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
                          label: "View Details",
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
                          title: "Edit Item",
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
  );
};

export default InventoryItemsTable;
