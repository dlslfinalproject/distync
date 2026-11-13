import React from "react";
import { shellStyles } from "../layout/BarangayLayout";
import StatusCard from "../shared/StatusCard";

const SummaryCards = ({ cards, isEmpty }) => {
  if (isEmpty) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Summary</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          No active disaster event summary is available yet.
        </p>
      </section>
    );
  }

  return (
    <section style={shellStyles.statGrid}>
      {cards.map((card) => (
        <StatusCard
          key={card.label}
          label={card.label}
          value={String(card.value).padStart(2, "0")}
          helperText={card.helperText}
        />
      ))}
    </section>
  );
};

export default SummaryCards;
