import React from "react";
import { shellStyles } from "../layout/BarangayLayout";

const InventoryAlertsPanel = ({ lowStockItems, totalDistributions }) => {
  return (
    <section style={shellStyles.card}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(320px, 1.2fr) minmax(240px, 0.8fr)",
          gap: "20px",
        }}
      >
        <div>
          <h3 style={{ margin: 0, color: "#17324d" }}>Low Stock Items</h3>
          <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
            Batches currently tagged low stock or with 10 or fewer units
            available.
          </p>

          <div style={{ marginTop: "18px", display: "grid", gap: "12px" }}>
            {lowStockItems.length === 0 ? (
              <p style={shellStyles.mutedText}>No low stock items found.</p>
            ) : (
              lowStockItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: "14px 16px",
                    borderRadius: "14px",
                    border: "1px solid #ead9b6",
                    backgroundColor: "#fff8ea",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "12px",
                      color: "#21405f",
                      fontSize: "14px",
                    }}
                  >
                    <strong>{item.item_name}</strong>
                    <span>{item.quantity_available} left</span>
                  </div>
                  <p style={{ ...shellStyles.mutedText, marginTop: "6px" }}>
                    Batch: {item.batch_no} | Status: {item.status}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <h3 style={{ margin: 0, color: "#17324d" }}>Distribution Snapshot</h3>
          <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
            Current demo-safe total using available transaction history.
          </p>

          <div
            style={{
              marginTop: "18px",
              padding: "22px",
              borderRadius: "18px",
              background:
                "linear-gradient(180deg, #edf4fb 0%, #e5eef7 100%)",
              border: "1px solid #d7e2ef",
            }}
          >
            <p
              style={{
                margin: 0,
                color: "#60738a",
                fontSize: "12px",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Total Distributions
            </p>
            <p
              style={{
                margin: "10px 0 0",
                color: "#17324d",
                fontSize: "36px",
                fontWeight: 700,
              }}
            >
              {String(totalDistributions || 0).padStart(2, "0")}
            </p>
            <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
              Based on inventory transactions with reference type `DISTRIBUTION`.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default InventoryAlertsPanel;
