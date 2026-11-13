import React from "react";
import { pageHeaderStyles } from "../layout/PageHeader";

const filterContainerStyles = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
};

const getFilterButtonStyles = (isActive) => ({
  ...(isActive ? pageHeaderStyles.primaryButton : pageHeaderStyles.secondaryButton),
  minWidth: "120px",
});

const DisasterEventFilters = ({ selectedFilter, onSelectFilter }) => {
  return (
    <div style={filterContainerStyles}>
      <button
        type="button"
        onClick={() => onSelectFilter("all")}
        style={getFilterButtonStyles(selectedFilter === "all")}
      >
        All Events
      </button>
      <button
        type="button"
        onClick={() => onSelectFilter("active")}
        style={getFilterButtonStyles(selectedFilter === "active")}
      >
        Active Events
      </button>
      <button
        type="button"
        onClick={() => onSelectFilter("closed")}
        style={getFilterButtonStyles(selectedFilter === "closed")}
      >
        Closed Events
      </button>
    </div>
  );
};

export default DisasterEventFilters;
