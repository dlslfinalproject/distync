import React from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { shellStyles } from "../layout/BarangayLayout";

const COLORS = ["#4f86be", "#7ea7cf", "#9fc0df", "#5f9ec9", "#88b9d8", "#c0d9ec"];

const SectorDistributionChart = ({ data }) => {
  return (
    <section style={shellStyles.card}>
      <h3 style={{ margin: 0, color: "#17324d", fontSize: "18px" }}>
        Sector Distribution
      </h3>
      <p style={{ margin: "8px 0 18px", color: "#60738a", fontSize: "14px" }}>
        Household and person-level sector occurrences from the current masterlist.
      </p>

      {data.length > 0 ? (
        <div style={{ width: "100%", height: "320px" }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`${entry.name}-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p style={shellStyles.mutedText}>No sector data available for this view.</p>
      )}
    </section>
  );
};

export default SectorDistributionChart;
