import React from "react";
import { shellStyles } from "../layout/BarangayLayout";
import StatusCard from "../shared/StatusCard";

const StubSummaryCards = ({ cards }) => {
  return (
    <section style={shellStyles.statGrid}>
      {cards.map((card) => (
        <StatusCard key={card.label} {...card} />
      ))}
    </section>
  );
};

export default StubSummaryCards;
