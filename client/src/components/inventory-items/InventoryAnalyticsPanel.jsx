import React from "react";

const analyticsCard = {
  background: "#f8fbff",
  border: "1px solid #d6e2ef",
  borderRadius: "14px",
  padding: "16px",
};

const InventoryAnalyticsPanel = ({ cards }) => {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: "16px",
      }}
    >
      {cards.map((card) => (
        <div key={card.title} style={analyticsCard}>
          <h4
            style={{
              margin: "0 0 8px",
              color: "#17324d",
              fontSize: "16px",
              fontWeight: 700,
            }}
          >
            {card.title}
          </h4>
          <p
            style={{
              margin: "0 0 12px",
              color: "#17324d",
              fontSize: "32px",
              fontWeight: 800,
              lineHeight: 1,
            }}
          >
            {card.value}
          </p>
          <p style={{ margin: 0, color: "#5f7892", fontSize: "14px" }}>
            {card.detail}
          </p>
        </div>
      ))}
    </div>
  );
};

export default InventoryAnalyticsPanel;
