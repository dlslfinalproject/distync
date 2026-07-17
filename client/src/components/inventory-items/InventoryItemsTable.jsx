import React from "react";
import { FiEdit2, FiEye } from "react-icons/fi";
import { getTotalItemQuantity } from "../../features/inventory-items/inventoryItemFormatting";
import { getItemStatusStyle } from "../../features/inventory-items/inventoryItemStockStatus";
import TableActionsMenu from "../shared/TableActionsMenu";

const styles = {
  tableWrap: {
    marginTop: "10px",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    background: "transparent",
  },
  th: {
    textAlign: "left",
    padding: "10px 8px",
    fontSize: "13px",
    color: "#17324d",
    fontWeight: 700,
    borderBottom: "none",
    whiteSpace: "nowrap",
  },
  tr: {
    borderBottom: "1px solid #e7edf5",
  },
  td: {
    padding: "10px 8px",
    fontSize: "13px",
    color: "#334155",
    verticalAlign: "middle",
  },
  emptyStateCell: {
    padding: "16px 8px",
    fontSize: "14px",
    color: "#334155",
  },
  secondaryText: {
    marginTop: "4px",
    color: "#6b8298",
    fontSize: "12px",
  },
  shelfLifeText: {
    color: "#4f677f",
    fontSize: "13px",
    lineHeight: 1.5,
  },
};

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
}) => {
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            {[
              "Item Name",
              "Category",
              "Source",
              "Quantity",
              "Shelf Life",
              "Minimum Stock Level",
              "Active Status",
              "Actions",
            ].map((header) => (
              <th key={header} style={styles.th}>
                {header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan="8" style={styles.emptyStateCell}>
                Loading inventory items...
              </td>
            </tr>
          ) : errorMessage ? (
            <tr>
              <td
                colSpan="8"
                style={{ ...styles.emptyStateCell, color: "#b91c1c" }}
              >
                {errorMessage}
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan="8" style={styles.emptyStateCell}>
                No inventory items found
              </td>
            </tr>
          ) : (
            rows.map((item, index) => {
              const activeStatus = item.is_active === false ? "Inactive" : "Active";
              const activeStatusStyle = getItemStatusStyle(activeStatus);

              const itemName =
                item.item_name ??
                item.name ??
                item.product_name ??
                "Unnamed Item";

              return (
                <tr key={item.id || index} style={styles.tr}>
                  <td style={styles.td}>
                    <div>{itemName}</div>
                    <div style={styles.secondaryText}>
                      {item.packaging ? `Packaging: ${item.packaging}` : "Packaging: --"}
                    </div>
                  </td>
                  <td style={styles.td}>{item.category ?? "--"}</td>
                  <td style={styles.td}>{item.source_label || "--"}</td>
                  <td style={styles.td}>{getTotalItemQuantity(item)}</td>
                  <td style={styles.td}>
                    <div style={styles.shelfLifeText}>
                      {getShelfLifeDisplay(item.expiration_date)}
                    </div>
                  </td>
                  <td style={styles.td}>{item.reorder_level ?? "--"}</td>
                  <td style={styles.td}>
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: 600,
                        background: activeStatusStyle.background,
                        color: activeStatusStyle.color,
                      }}
                    >
                      {activeStatus}
                    </span>
                  </td>
                  <td style={styles.td}>
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
