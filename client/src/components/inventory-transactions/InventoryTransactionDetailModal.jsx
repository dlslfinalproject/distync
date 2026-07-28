import React from "react";
import DetailsModalShell from "../shared/DetailsModalShell";
import { shellStyles } from "../layout/BarangayLayout";

const styles = {
  shellPanel: {
    backgroundColor: "#eef5fb",
    border: "1px solid #d7e2ef",
    boxShadow: "0 24px 60px rgba(23, 50, 77, 0.18)",
  },
  sectionCard: {
    ...shellStyles.card,
    backgroundColor: "#ffffff",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "16px",
  },
  label: {
    margin: 0,
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#66809c",
  },
  value: {
    margin: "8px 0 0",
    color: "#21405f",
    fontSize: "15px",
    lineHeight: 1.55,
    wordBreak: "break-word",
  },
};

const formatDateTime = (value) => {
  if (!value) {
    return "--";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "--";
  }

  return parsedDate.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const InventoryTransactionDetailModal = ({ isOpen, row, onClose }) => {
  if (!isOpen || !row) {
    return null;
  }

  const transactionDetails = [
    ["Item Name", row.inventory_item?.item_name || "--"],
    ["Item Code", row.inventory_item?.item_code || "--"],
    ["Batch Number", row.batch_no || "--"],
    ["Quantity", String(row.quantity ?? 0)],
    ["Movement", row.transaction_direction || "--"],
    ["Transaction Type", row.transaction_type_label || row.transaction_type || "--"],
    ["Date", formatDateTime(row.performed_at)],
    ["Performed By", row.performed_by_label || "--"],
  ];

  const additionalDetails = [
    ["Source", row.source_label || "--"],
    ["Remarks", row.remarks || "--"],
    ["Sync Status", row.sync_status || "--"],
    ["Record ID", row.id || "--"],
  ];

  return (
    <DetailsModalShell
      isOpen={isOpen}
      title="View Details"
      onClose={onClose}
      maxWidth="980px"
      closeMode="icon"
      titleStyle={{ fontSize: "30px", fontWeight: 700 }}
      panelStyle={styles.shellPanel}
    >
      <div style={{ display: "grid", gap: "20px" }}>
        <section style={styles.sectionCard}>
          <h3 style={{ margin: 0, color: "#17324d" }}>Transaction Information</h3>

          <div style={{ ...styles.grid, marginTop: "16px" }}>
            {transactionDetails.map(([label, value]) => (
              <div key={label}>
                <p style={styles.label}>{label}</p>
                <p style={styles.value}>{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={styles.sectionCard}>
          <h3 style={{ margin: 0, color: "#17324d" }}>Additional Information</h3>

          <div style={{ ...styles.grid, marginTop: "16px" }}>
            {additionalDetails.map(([label, value]) => (
              <div key={label}>
                <p style={styles.label}>{label}</p>
                <p style={styles.value}>{value}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </DetailsModalShell>
  );
};

export default InventoryTransactionDetailModal;
