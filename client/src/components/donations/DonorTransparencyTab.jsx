import React from "react";
import { shellStyles } from "../layout/BarangayLayout";
import StatusCard from "../shared/StatusCard";

const tableStyles = {
  wrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    background: "transparent",
  },
  th: {
    textAlign: "left",
    padding: "12px 14px",
    fontSize: "12px",
    color: "#58708a",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    borderBottom: "1px solid #dfe9f2",
    whiteSpace: "nowrap",
  },
  tr: {
    borderBottom: "1px solid #e7edf5",
  },
  td: {
    padding: "14px",
    fontSize: "14px",
    color: "#334155",
    verticalAlign: "middle",
  },
  itemName: {
    color: "#17324d",
    fontWeight: 700,
  },
  itemSubtext: {
    marginTop: "4px",
    color: "#6b8298",
    fontSize: "12px",
  },
};

const formatNumber = (value) => new Intl.NumberFormat().format(Number(value || 0));

const DonorTransparencyTab = ({ portalData, selectedEventLabel }) => {
  const summaryCards = [
    {
      label: "Total Donations Received",
      value: formatNumber(
        portalData.transparency_summary?.total_donations_received || 0,
      ),
      accentColor: "#2f6499",
    },
    {
      label: "Total Quantity Received",
      value: formatNumber(
        portalData.transparency_summary?.total_quantity_received || 0,
      ),
      accentColor: "#cf7d2d",
    },
    {
      label: "Total Donated Items Distributed",
      value: formatNumber(
        portalData.transparency_summary?.total_donated_items_distributed || 0,
      ),
      accentColor: "#2f8a57",
    },
    {
      label: "Remaining Donated Inventory",
      value: formatNumber(
        portalData.transparency_summary?.remaining_donated_inventory || 0,
      ),
      accentColor: "#7d59bf",
    },
  ];

  return (
    <>
      <section style={shellStyles.card}>
        <p
          style={{
            margin: 0,
            color: "#58708a",
            fontSize: "12px",
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Selected Disaster Event
        </p>

        <p
          style={{
            margin: "10px 0 0",
            color: "#17324d",
            fontSize: "24px",
            fontWeight: 800,
            lineHeight: 1.25,
          }}
        >
          {selectedEventLabel}
        </p>

        <p style={{ ...shellStyles.mutedText, margin: "10px 0 0" }}>
          Donation transparency compares received donated stock against distributed quantities for this event.
        </p>
      </section>

      <section style={shellStyles.statGrid}>
        {summaryCards.map((card) => (
          <StatusCard key={card.label} {...card} />
        ))}
      </section>

      <section style={shellStyles.card}>
        <div style={{ marginBottom: "18px" }}>
          <p
            style={{
              margin: 0,
              color: "#58708a",
              fontSize: "12px",
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Transparency Summary
          </p>
          <h3 style={{ margin: "10px 0 0", color: "#17324d" }}>
            Received vs Distributed Per Item
          </h3>
        </div>

        {(portalData.transparency_summary?.received_vs_distributed || []).length === 0 ? (
          <p style={shellStyles.mutedText}>
            No donated inventory summaries are available yet.
          </p>
        ) : (
          <div style={tableStyles.wrap}>
            <table style={tableStyles.table}>
              <thead>
                <tr>
                  {["Item", "Received", "Distributed", "Remaining"].map((label) => (
                    <th key={label} style={tableStyles.th}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {portalData.transparency_summary.received_vs_distributed.map((row) => (
                  <tr key={row.inventory_item_id} style={tableStyles.tr}>
                    <td style={tableStyles.td}>
                      <div style={tableStyles.itemName}>{row.item_name}</div>
                      <div style={tableStyles.itemSubtext}>
                        Donated inventory item
                      </div>
                    </td>
                    <td style={tableStyles.td}>
                      {formatNumber(row.quantity_received)}
                    </td>
                    <td style={tableStyles.td}>
                      {formatNumber(row.quantity_distributed)}
                    </td>
                    <td style={tableStyles.td}>
                      {formatNumber(row.quantity_remaining)}
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
