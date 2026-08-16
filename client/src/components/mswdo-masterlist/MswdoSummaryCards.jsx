import React from "react";
import StatusCard from "../shared/StatusCard";

const gridStyles = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "16px",
};

const MswdoSummaryCards = ({ summary, selectedBarangayId }) => {
  const isAllBarangaysView = !selectedBarangayId;

  const cards = [
    {
      label: isAllBarangaysView
        ? "Total Barangays Covered"
        : "Barangays Covered",
      value: summary.totalBarangaysCovered,
    },
    {
      label: isAllBarangaysView
        ? "Total Affected Individuals"
        : "Affected Individuals",
      value: summary.totalNumberOfEvacueesIndividuals,
    },
    {
      label: isAllBarangaysView
        ? "Total Affected Families"
        : "Affected Families",
      value: summary.totalNumberOfFamilies,
    },
    {
      label: "Average Household Size",
      value: summary.averageHouseholdSize,
    },
    {
      label: "Currently Admitted Evacuees",
      value: summary.currentlyAdmittedEvacuees,
    },
    {
      label: "Departed Evacuees",
      value: summary.totalDepartedEvacuees,
    },
  ];

  return (
    <section className="mswdo-masterlist-summary-grid" style={gridStyles}>
      {cards.map((card) => (
        <StatusCard key={card.label} {...card} />
      ))}
    </section>
  );
};

export default MswdoSummaryCards;
