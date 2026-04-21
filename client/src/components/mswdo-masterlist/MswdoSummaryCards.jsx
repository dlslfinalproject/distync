import React from "react";
import StatusCard from "../shared/StatusCard";

const gridStyles = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: "16px",
};

const MswdoSummaryCards = ({ summary }) => {
  const cards = [
    {
      label: "Barangays Covered",
      value: summary.totalBarangaysCovered,
    },
    {
      label: "Total Evacuees",
      value: summary.totalNumberOfEvacueesIndividuals,
    },
    {
      label: "Total Families",
      value: summary.totalNumberOfFamilies,
    },
    {
      label: "Average Household Size",
      value: summary.averageHouseholdSize,
    },
    {
      label: "Currently Admitted",
      value: summary.currentlyAdmittedEvacuees,
    },
    {
      label: "Total Departed",
      value: summary.totalDepartedEvacuees,
    },
  ];

  return (
    <section style={gridStyles}>
      {cards.map((card) => (
        <StatusCard key={card.label} {...card} />
      ))}
    </section>
  );
};

export default MswdoSummaryCards;
