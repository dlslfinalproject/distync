import React from "react";
import { pageHeaderStyles } from "../layout/PageHeader";

const modalStyles = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(18, 34, 51, 0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    zIndex: 1300,
  },
  modal: {
    width: "100%",
    maxWidth: "920px",
    maxHeight: "86vh",
    overflowY: "auto",
    backgroundColor: "#ffffff",
    borderRadius: "20px",
    padding: "28px",
    boxShadow: "0 24px 48px rgba(20, 48, 78, 0.2)",
  },
  card: {
    borderRadius: "16px",
    border: "1px solid #d6e2ee",
    backgroundColor: "#f8fbfe",
    padding: "16px",
  },
  label: {
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#66809c",
    marginBottom: "6px",
  },
  value: {
    color: "#21405f",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    padding: "10px 12px",
    textAlign: "left",
    fontSize: "12px",
    color: "#66809c",
    borderBottom: "1px solid #dfe8f2",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  td: {
    padding: "12px",
    borderBottom: "1px solid #edf3f8",
    color: "#21405f",
    fontSize: "14px",
    verticalAlign: "top",
  },
};

const formatDate = (value) => {
  if (!value) {
    return "--";
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return "--";
  }

  return parsedDate.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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

const renderEmptyState = (message) => (
  <p style={{ margin: 0, color: "#60738a", fontSize: "14px" }}>{message}</p>
);

const InventoryBatchDetailModal = ({
  isOpen,
  isLoading,
  errorMessage,
  detail,
  onClose,
}) => {
  if (!isOpen) {
    return null;
  }

  const batch = detail?.batch || null;
  const transactions = detail?.related_transactions || [];
  const auditHistory = detail?.audit_history || [];
  const alerts = detail?.alerts || [];

  return (
    <div style={modalStyles.overlay}>
      <div style={modalStyles.modal}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start" }}>
          <div>
            <h3 style={{ margin: 0, color: "#17324d", fontSize: "24px" }}>
              Inventory Batch Detail
            </h3>
            <p style={{ margin: "10px 0 0", color: "#5d7188", fontSize: "15px", lineHeight: 1.6 }}>
              Review batch source, stock state, related transactions, alerts, and audit history.
            </p>
          </div>
          <button type="button" onClick={onClose} style={pageHeaderStyles.secondaryButton}>
            Close
          </button>
        </div>

        {isLoading ? (
          <p style={{ marginTop: "20px", color: "#60738a" }}>Loading inventory batch detail...</p>
        ) : errorMessage ? (
          <p style={{ marginTop: "20px", color: "#a14d58" }}>{errorMessage}</p>
        ) : !batch ? (
          <p style={{ marginTop: "20px", color: "#60738a" }}>Inventory batch detail is unavailable.</p>
        ) : (
          <div style={{ display: "grid", gap: "18px", marginTop: "20px" }}>
            <section
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "16px",
              }}
            >
              {[
                ["Batch Code", batch.batch_no || "--"],
                ["Item", batch.inventory_item?.item_name || "--"],
                ["Quantity Available", String(batch.quantity_available ?? 0)],
                ["Quantity Received", String(batch.quantity_received ?? 0)],
                ["Expiry Date", formatDate(batch.expiration_date)],
                ["Status", batch.status || "--"],
                ["Source Type", batch.source_type || "--"],
                ["Supplier / Source", batch.supplier?.name || "--"],
              ].map(([label, value]) => (
                <div key={label} style={modalStyles.card}>
                  <div style={modalStyles.label}>{label}</div>
                  <div style={modalStyles.value}>{value}</div>
                </div>
              ))}
            </section>

            <section style={modalStyles.card}>
              <div style={{ marginBottom: "14px" }}>
                <h4 style={{ margin: 0, color: "#17324d" }}>Expiry / Stock Alerts</h4>
              </div>
              {alerts.length === 0 ? (
                renderEmptyState("No expiry or stock alerts for this batch.")
              ) : (
                <ul style={{ margin: 0, paddingLeft: "18px", color: "#21405f" }}>
                  {alerts.map((alert) => (
                    <li key={alert} style={{ marginBottom: "6px" }}>
                      {alert}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section style={modalStyles.card}>
              <div style={{ marginBottom: "14px" }}>
                <h4 style={{ margin: 0, color: "#17324d" }}>Transaction History</h4>
              </div>
              {transactions.length === 0 ? (
                renderEmptyState("No transactions yet.")
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={modalStyles.table}>
                    <thead>
                      <tr>
                        <th style={modalStyles.th}>Type</th>
                        <th style={modalStyles.th}>Quantity</th>
                        <th style={modalStyles.th}>Reference</th>
                        <th style={modalStyles.th}>Performed By</th>
                        <th style={modalStyles.th}>Date</th>
                        <th style={modalStyles.th}>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((transaction) => (
                        <tr key={transaction.id}>
                          <td style={modalStyles.td}>{transaction.transaction_type || "--"}</td>
                          <td style={modalStyles.td}>{transaction.quantity ?? 0}</td>
                          <td style={modalStyles.td}>{transaction.reference_type || "--"}</td>
                          <td style={modalStyles.td}>
                            {[transaction.performed_by_first_name, transaction.performed_by_last_name]
                              .filter(Boolean)
                              .join(" ") || "--"}
                          </td>
                          <td style={modalStyles.td}>{formatDateTime(transaction.performed_at)}</td>
                          <td style={modalStyles.td}>{transaction.remarks || "--"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section style={modalStyles.card}>
              <div style={{ marginBottom: "14px" }}>
                <h4 style={{ margin: 0, color: "#17324d" }}>Audit History</h4>
              </div>
              {auditHistory.length === 0 ? (
                renderEmptyState("No audit history yet.")
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={modalStyles.table}>
                    <thead>
                      <tr>
                        <th style={modalStyles.th}>Action</th>
                        <th style={modalStyles.th}>Performed By</th>
                        <th style={modalStyles.th}>Role</th>
                        <th style={modalStyles.th}>Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditHistory.map((entry) => (
                        <tr key={entry.id}>
                          <td style={modalStyles.td}>{entry.action || "--"}</td>
                          <td style={modalStyles.td}>{entry.actor_name || "--"}</td>
                          <td style={modalStyles.td}>{entry.role_code || "--"}</td>
                          <td style={modalStyles.td}>{formatDateTime(entry.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryBatchDetailModal;
