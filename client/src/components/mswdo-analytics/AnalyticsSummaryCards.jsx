import React from "react";
import { shellStyles } from "../layout/BarangayLayout";

const cardStyles = {
  label: {
    margin: 0,
    color: "#688199",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  helper: {
    margin: "8px 0 0",
    color: "#62778d",
    fontSize: "13px",
    lineHeight: 1.5,
  },
};

const AnalyticsSummaryCards = ({ summaryMetrics }) => {
  const cards = [
    {
      label: "Total Evacuees",
      value: summaryMetrics.totalEvacuees,
      helperText: "Evacuee individuals included in the selected analytics view.",
    },
    {
      label: "Total Families",
      value: summaryMetrics.totalHouseholds,
      helperText: "Households represented in the current disaster-event scope.",
    },
    {
      label: "Currently Admitted",
      value: summaryMetrics.currentlyAdmitted,
      helperText: "Evacuees whose latest evacuation log is still admitted.",
    },
    {
      label: "Departed",
      value: summaryMetrics.departed,
      helperText: "Evacuees whose latest evacuation log is marked departed.",
    },
    {
      label: "Barangays Covered",
      value: summaryMetrics.totalBarangaysCovered,
      helperText: "Distinct barangays represented in the current analytics view.",
    },
  ];

  return (
    <section style={shellStyles.statGrid}>
      {cards.map((card) => (
        <div key={card.label} style={shellStyles.card}>
          <p style={cardStyles.label}>{card.label}</p>
          <p style={shellStyles.statValue}>{card.value}</p>
          <p style={cardStyles.helper}>{card.helperText}</p>
        </div>
      ))}
    </section>
  );
};

export default AnalyticsSummaryCards;
