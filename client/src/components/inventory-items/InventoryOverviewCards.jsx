import React from "react";
import StatusCard from "../shared/StatusCard";
import { shellStyles } from "../layout/BarangayLayout";

const InventoryOverviewCards = ({ summaryCards }) => {
  return (
    <section style={{ ...shellStyles.statGrid, marginBottom: "24px" }}>
      {summaryCards.map((card) => (
        <StatusCard key={card.label} {...card} />
      ))}
    </section>
  );
};

export default InventoryOverviewCards;
