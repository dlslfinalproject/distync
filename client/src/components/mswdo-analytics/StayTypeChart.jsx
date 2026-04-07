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

const COLORS = ["#2f6499", "#5e8fc0", "#95b7d8", "#c6dced"];

const StayTypeChart = ({ data }) => {
  return (
    <section style={shellStyles.card}>
      <h3 style={{ margin: 0, color: "#17324d", fontSize: "18px" }}>
        Stay Type Distribution
      </h3>
      <p style={{ margin: "8px 0 18px", color: "#60738a", fontSize: "14px" }}>
        Distribution of current stay types for the selected disaster event view.
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
        <p style={shellStyles.mutedText}>No stay type data available for this view.</p>
      )}
    </section>
  );
};

export default StayTypeChart;
