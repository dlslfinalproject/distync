import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { shellStyles } from "../layout/BarangayLayout";

const chartStyles = {
  title: {
    margin: 0,
    color: "#17324d",
    fontSize: "18px",
  },
  helper: {
    margin: "8px 0 18px",
    color: "#60738a",
    fontSize: "14px",
    lineHeight: 1.6,
  },
};

const VerticalBarChart = ({ title, description, data, color = "#4f86be" }) => {
  return (
    <section style={shellStyles.card}>
      <h3 style={chartStyles.title}>{title}</h3>
      <p style={chartStyles.helper}>{description}</p>

      {data.length > 0 ? (
        <div style={{ width: "100%", height: "320px" }}>
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 36 }}>
              <CartesianGrid stroke="#e4edf6" strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                interval={0}
                angle={-12}
                textAnchor="end"
                height={56}
                tick={{ fill: "#66809c", fontSize: 12 }}
              />
              <YAxis tick={{ fill: "#66809c", fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" fill={color} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p style={shellStyles.mutedText}>No chart data available for this view.</p>
      )}
    </section>
  );
};

export default VerticalBarChart;
