import React from "react";
import BarangayBarChart from "./BarangayBarChart";

const SectorDistributionChart = ({ data }) => {
  return (
    <BarangayBarChart
      title="Sector Distribution"
      description="Household and evacuee-level sector occurrences in the selected analytics view."
      data={data}
      dataKey="value"
      color="#5e8fc0"
    />
  );
};

export default SectorDistributionChart;
