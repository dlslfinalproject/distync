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

const COLORS = ["#2f6499", "#7ea7cf", "#95b7d8", "#c6dced"];

const DistributionPieChart = ({
  title,
  description,
  data,
  emptyMessage,
}) => {
  return (
    <section style={shellStyles.card}>
      <h3 style={{ margin: 0, color: "#17324d", fontSize: "18px" }}>
        {title}
      </h3>
      <p style={{ margin: "8px 0 18px", color: "#60738a", fontSize: "14px" }}>
        {description}
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
        <p style={shellStyles.mutedText}>{emptyMessage}</p>
      )}
    </section>
  );
};

export default DistributionPieChart;
