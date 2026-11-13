import React from "react";
import StatusCard from "../shared/StatusCard";
import { shellStyles } from "../layout/BarangayLayout";

const inventoryOverviewGridStyles = {
  ...shellStyles.statGrid,
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  marginBottom: "24px",
};

const InventoryOverviewCards = ({ summaryCards }) => {
  return (
    <section className="inventory-items-summary-grid" style={inventoryOverviewGridStyles}>
      {summaryCards.map((card) => (
        <StatusCard key={card.label} {...card} />
      ))}
    </section>
  );
};

export default InventoryOverviewCards;
