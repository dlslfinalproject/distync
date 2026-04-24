import React from "react";
import DistributionPieChart from "./DistributionPieChart";

const StayTypeChart = ({ data }) => {
  return (
    <DistributionPieChart
      title="Stay Type Distribution"
      description="Household stay-type distribution for the selected disaster event and barangay filters."
      data={data}
      emptyMessage="No stay type data available for this view."
    />
  );
};

export default StayTypeChart;
