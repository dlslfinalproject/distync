import React from "react";
import { shellStyles } from "../layout/BarangayLayout";

const DonorTransparencyTab = ({ portalData, selectedEventLabel }) => {
  return (
    <>
      <section style={shellStyles.card}>
        <div style={shellStyles.statGrid}>
          <div>
            <p style={shellStyles.mutedText}>Total Donations Received</p>
            <p style={shellStyles.statValue}>
              {portalData.transparency_summary?.total_donations_received || 0}
            </p>
          </div>
          <div>
            <p style={shellStyles.mutedText}>Total Quantity Received</p>
            <p style={shellStyles.statValue}>
              {portalData.transparency_summary?.total_quantity_received || 0}
            </p>
          </div>
          <div>
            <p style={shellStyles.mutedText}>Total Donated Items Distributed</p>
            <p style={shellStyles.statValue}>
              {portalData.transparency_summary?.total_donated_items_distributed || 0}
            </p>
          </div>
          <div>
            <p style={shellStyles.mutedText}>Remaining Donated Inventory</p>
            <p style={shellStyles.statValue}>
              {portalData.transparency_summary?.remaining_donated_inventory || 0}
            </p>
          </div>
        </div>
      </section>

      <section style={shellStyles.card}>
        <div style={{ marginBottom: "16px" }}>
          <h3 style={{ margin: 0, color: "#17324d" }}>Received vs Distributed Per Item</h3>
          <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
            Current filter: {selectedEventLabel}
          </p>
        </div>

        {(portalData.transparency_summary?.received_vs_distributed || []).length === 0 ? (
          <p style={shellStyles.mutedText}>
            No donated inventory summaries are available yet.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Item", "Received", "Distributed", "Remaining"].map((label) => (
                    <th
                      key={label}
                      style={{
                        padding: "12px 14px",
                        textAlign: "left",
                        fontSize: "12px",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "#66809c",
                        borderBottom: "1px solid #e0eaf4",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {portalData.transparency_summary.received_vs_distributed.map((row) => (
                  <tr key={row.inventory_item_id}>
                    <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                      {row.item_name}
                    </td>
                    <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                      {row.quantity_received}
                    </td>
                    <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                      {row.quantity_distributed}
                    </td>
                    <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                      {row.quantity_remaining}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
};

export default DonorTransparencyTab;
