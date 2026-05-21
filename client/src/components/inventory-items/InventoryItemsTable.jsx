import React from "react";
import SyncStatusBadge from "../shared/SyncStatusBadge";
import {
  formatDisplayDate,
  formatUnitOfMeasurement,
  getTotalItemQuantity,
} from "../../features/inventory-items/inventoryItemFormatting";
import {
  createEmptyTrackingStats,
  getItemStatus,
  getItemStatusStyle,
} from "../../features/inventory-items/inventoryItemStockStatus";

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
};

const InventoryItemsTable = ({
  rows,
  isLoading,
  errorMessage,
  inventoryTrackingMap,
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
              "Quantity",
              "Unit of Measurement",
              "Expiry Date",
              "Status",
              "Sync",
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
                Loading...
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
                No items found
              </td>
            </tr>
          ) : (
            rows.map((item, index) => {
              const trackingStats =
                inventoryTrackingMap.get(item.id) || createEmptyTrackingStats();
              const itemStatus = getItemStatus(item, trackingStats);
              const itemStatusStyle = getItemStatusStyle(itemStatus);

              const itemName =
                item.item_name ??
                item.name ??
                item.product_name ??
                "Unnamed Item";

              return (
                <tr key={item.id || index} style={styles.tr}>
                  <td style={styles.td}>{itemName}</td>
                  <td style={styles.td}>{item.category ?? "--"}</td>
                  <td style={styles.td}>{getTotalItemQuantity(item) ?? "0"}</td>
                  <td style={styles.td}>{formatUnitOfMeasurement(item) ?? "--"}</td>
                  <td style={styles.td}>{formatDisplayDate(item.expiration_date)}</td>
                  <td style={styles.td}>
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: 600,
                        background: itemStatusStyle.background,
                        color: itemStatusStyle.color,
                      }}
                    >
                      {itemStatus}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <SyncStatusBadge status={item.sync_status} compact />
                  </td>
                  <td style={styles.td}>
                    <button
                      type="button"
                      onClick={() => onViewDetails?.(item.id)}
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
                      View Details
                    </button>
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
