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

const MswdoSummaryCards = ({ summary }) => {
  const cards = [
    {
      label: "Total Households",
      value: summary.totalHouseholds,
      helperText: "Household records visible in the monitoring table.",
    },
    {
      label: "Total Evacuees",
      value: summary.totalEvacuees,
      helperText: "Combined household size across the displayed rows.",
    },
    {
      label: "Barangays Covered",
      value: summary.barangaysCovered,
      helperText: "Barangays represented by the current filter set.",
    },
    {
      label: "With Stub Issued",
      value: summary.withStubIssued,
      helperText: "Households that already have an issued stub record.",
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

export default MswdoSummaryCards;
