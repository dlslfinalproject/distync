import React from "react";
import { FiAlertCircle, FiEdit2, FiEye } from "react-icons/fi";
import { getTotalItemQuantity } from "../../features/inventory-items/inventoryItemFormatting";
import { getItemStatusStyle } from "../../features/inventory-items/inventoryItemStockStatus";
import TableActionsMenu from "../shared/TableActionsMenu";

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
  shelfLifeText: {
    color: "#21405f",
    fontSize: "14px",
    lineHeight: 1.5,
    textAlign: "center",
  },
  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 12px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 700,
    lineHeight: 1,
  },
};

const tableHeaders = [
  "Item Name",
  "Source",
  "Quantity",
  "Shelf Life",
  "Minimum Stock Level",
  "Status",
  "Actions",
];

const centeredHeaders = new Set([
  "Quantity",
  "Minimum Stock Level",
  "Status",
  "Actions",
]);

const getShelfLifeDisplay = (expirationDate) => {
  if (!expirationDate) {
    return "--";
  }

  const today = new Date();
  const comparisonDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const parsedExpirationDate = new Date(expirationDate);

  if (Number.isNaN(parsedExpirationDate.getTime())) {
    return "--";
  }

  const targetDate = new Date(
    parsedExpirationDate.getFullYear(),
    parsedExpirationDate.getMonth(),
    parsedExpirationDate.getDate(),
  );

  if (Number.isNaN(targetDate.getTime())) {
    return "--";
  }

  const diffInDays = Math.ceil(
    (targetDate.getTime() - comparisonDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  const remainingDays = Math.max(diffInDays, 0);

  return `${remainingDays} day${remainingDays === 1 ? "" : "s"}`;
};

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
              const stockStatus = item.stock_status_label || "In Stock";
              const stockStatusStyle = getItemStatusStyle(stockStatus);

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
                      <div style={styles.secondaryText}>
                        {item.packaging ? `Packaging: ${item.packaging}` : "Packaging: --"}
                      </div>
                    </div>
                  </td>
                  <td style={styles.td}>{item.source_label || "--"}</td>
                  <td style={{ ...styles.td, ...styles.centerCell }}>
                    {getTotalItemQuantity(item)}
                  </td>
                  <td style={styles.td}>
                    <div style={styles.shelfLifeText}>
                      {getShelfLifeDisplay(item.expiration_date)}
                    </div>
                  </td>
                  <td style={{ ...styles.td, ...styles.centerCell }}>
                    {item.reorder_level ?? "--"}
                  </td>
                  <td style={{ ...styles.td, ...styles.centerCell }}>
                    <span
                      style={{
                        ...styles.statusPill,
                        background: stockStatusStyle.background,
                        color: stockStatusStyle.color,
                      }}
                    >
                      {stockStatus}
                    </span>
                  </td>
                  <td style={{ ...styles.td, ...styles.actionCell }}>
                    <TableActionsMenu
                      row={item}
                      menuId={item.id || `inventory-item-${index}`}
                      buttonTitle="Actions"
                      buttonAriaLabel="Actions"
                      dataPrefix="inventory-item-action"
                      menuWidth={116}
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
                          key: "status-log",
                          label: "Log Status",
                          icon: <FiAlertCircle size={18} />,
                          disabled: typeof onLogStatus !== "function",
                          onClick: (selectedRow) => onLogStatus?.(selectedRow),
                        },
                        {
                          key: "edit",
                          label: "Edit Item",
                          icon: <FiEdit2 size={18} />,
                          disabled: typeof onEditItem !== "function",
                          title: "Edit Item",
                          onClick: (selectedRow) => onEditItem?.(selectedRow),
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
