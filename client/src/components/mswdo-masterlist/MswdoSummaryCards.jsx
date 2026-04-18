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
      label: "Total Evacuees",
      value: summary.totalNumberOfEvacueesIndividuals,
      helperText: "Active evacuee individuals under the selected event and barangay scope.",
    },
    {
      label: "Total Families",
      value: summary.totalNumberOfFamilies,
      helperText: "Active household records under the current filter context.",
    },
    {
      label: "Average Household Size",
      value: summary.averageHouseholdSize,
      helperText: "Average `household_size` value for the filtered households.",
    },
    {
      label: "Currently Admitted",
      value: summary.currentlyAdmittedEvacuees,
      helperText: "Evacuees whose latest log still shows them present in the evacuation center.",
    },
    {
      label: "Total Departed",
      value: summary.totalDepartedEvacuees,
      helperText: "Evacuees whose latest log shows they already left or were transferred.",
    },
    {
      label: "Barangays Covered",
      value: summary.totalBarangaysCovered,
      helperText: "Distinct barangays represented by the filtered household dataset.",
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
