import React from "react";
import { shellStyles } from "../layout/BarangayLayout";
import SearchBar from "../shared/SearchBar";
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
};

const summaryStyles = {
  eventCard: {
    border: "1px solid #d7e2ef",
    borderRadius: "18px",
    backgroundColor: "#ffffff",
    padding: "20px 18px",
  },
  eventLabel: {
    margin: 0,
    color: "#58708a",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  eventValue: {
    margin: "10px 0 0",
    color: "#17324d",
    fontSize: "18px",
    fontWeight: 800,
    lineHeight: 1.3,
  },
  eventMetaRow: {
    marginTop: "12px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  eventPeriod: {
    color: "#21405f",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  eventBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 12px",
    borderRadius: "999px",
    backgroundColor: "#e7f1fb",
    border: "1px solid #cfe0f3",
    color: "#2f6499",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  cardsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "18px",
    alignItems: "stretch",
  },
  card: {
    ...shellStyles.card,
    minHeight: "132px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  cardLabel: {
    margin: 0,
    color: "#688199",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    lineHeight: 1.4,
    textTransform: "uppercase",
  },
  cardValue: {
    margin: "18px 0 0",
    color: "#17324d",
    fontSize: "38px",
    fontWeight: 800,
    lineHeight: 1,
    letterSpacing: "-0.03em",
  },
};

const formatNumber = (value) => new Intl.NumberFormat().format(Number(value || 0));
const formatDate = (value) => {
  if (!value) {
    return "--";
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return "--";
  }

  return parsedDate.toLocaleDateString("en-PH", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
};

const DonorTransparencyTab = ({
  portalData,
  selectedEventLabel,
  selectedEvent,
  itemSearch,
  onItemSearchChange,
}) => {
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
  const eventTitle =
    selectedEvent?.title || selectedEventLabel || "All Events";
  const eventPeriod =
    selectedEvent?.start_date || selectedEvent?.end_date
      ? `Period: ${formatDate(selectedEvent?.start_date)} - ${formatDate(selectedEvent?.end_date)}`
      : null;
  const eventStatus = selectedEvent?.status || null;
  const transparencyRows = portalData.transparency_summary?.received_vs_distributed || [];
  const normalizedItemSearch = String(itemSearch || "").trim().toLowerCase();
  const filteredTransparencyRows = normalizedItemSearch
    ? transparencyRows.filter((row) =>
        String(row.item_name || "").toLowerCase().includes(normalizedItemSearch),
      )
    : transparencyRows;

  return (
    <>
      <section style={shellStyles.card}>
        <div style={summaryStyles.eventCard}>
          <p style={summaryStyles.eventLabel}>Selected Disaster Event</p>
          <p style={summaryStyles.eventValue}>{eventTitle}</p>
          <div style={summaryStyles.eventMetaRow}>
            {eventPeriod ? (
              <span style={summaryStyles.eventPeriod}>{eventPeriod}</span>
            ) : null}
            {eventStatus ? (
              <span style={summaryStyles.eventBadge}>{eventStatus}</span>
            ) : null}
          </div>
        </div>
      </section>

      <section style={summaryStyles.cardsGrid}>
        {summaryCards.map((card) => (
          <div key={card.label} style={summaryStyles.card}>
            <p style={summaryStyles.cardLabel}>{card.label}</p>
            <p style={summaryStyles.cardValue}>{card.value}</p>
          </div>
        ))}
      </section>

      <section style={shellStyles.card}>
        <div
          style={{
            marginBottom: "20px",
            display: "grid",
            gap: "16px",
          }}
        >
          <h3 style={{ margin: 0, color: "#17324d" }}>
            Received vs Distributed Per Item
          </h3>
          <div style={{ maxWidth: "520px" }}>
            <SearchBar
              value={itemSearch}
              onChange={onItemSearchChange}
              placeholder="Search donated item"
            />
          </div>
        </div>

        {transparencyRows.length === 0 ? (
          <p style={shellStyles.mutedText}>
            No donated inventory summaries are available yet.
          </p>
        ) : filteredTransparencyRows.length === 0 ? (
          <p style={shellStyles.mutedText}>
            No donated items match your search.
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
                {filteredTransparencyRows.map((row) => (
                  <tr key={row.inventory_item_id} style={tableStyles.tr}>
                    <td style={tableStyles.td}>
                      <div style={tableStyles.itemName}>{row.item_name}</div>
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
