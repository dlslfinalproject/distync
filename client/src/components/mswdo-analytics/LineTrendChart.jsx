import React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
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

const LineTrendChart = ({ title, description, data }) => {
  return (
    <section style={shellStyles.card}>
      <h3 style={chartStyles.title}>{title}</h3>
      <p style={chartStyles.helper}>{description}</p>

      {data.length > 0 ? (
        <div style={{ width: "100%", height: "320px" }}>
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 24 }}>
              <CartesianGrid stroke="#e4edf6" strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fill: "#66809c", fontSize: 12 }} />
              <YAxis tick={{ fill: "#66809c", fontSize: 12 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#4f86be"
                strokeWidth={3}
                dot={{ r: 4, fill: "#4f86be" }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p style={shellStyles.mutedText}>No trend data available for this view.</p>
      )}
    </section>
  );
};

export default LineTrendChart;
